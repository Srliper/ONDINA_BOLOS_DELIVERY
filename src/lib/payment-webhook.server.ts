import { configuredGateway, validWebhookSignature, type PaymentGateway } from '@/lib/payment-gateway'
import { syncGatewayPayment } from '@/lib/store-db.server'

/**
 * Notificação do Mercado Pago. O corpo só diz "o pagamento X mudou": o status de verdade é lido
 * na API deles (syncGatewayPayment), então uma notificação falsa não marca nada como pago.
 * Responde 200 para o que não interessa; 500 faz o Mercado Pago tentar de novo mais tarde.
 */
export async function handlePaymentWebhook(
  request: Request,
  deps: {
    gateway?: PaymentGateway | undefined
    secret?: string | undefined
    sync?: typeof syncGatewayPayment
  } = { gateway: configuredGateway(), secret: process.env['MERCADOPAGO_WEBHOOK_SECRET'] },
): Promise<Response> {
  const url = new URL(request.url)
  let body: { type?: string; topic?: string; action?: string; data?: { id?: string | number } } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // Notificações antigas (IPN) vêm só na URL.
  }
  const type = body.type ?? body.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const paymentId = String(body.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '')
  if (type !== 'payment' || !/^\d{1,20}$/.test(paymentId)) return new Response('ignorado', { status: 200 })
  if (!deps.gateway) return new Response('pagamento online desligado', { status: 200 })

  if (deps.secret) {
    const dataId = url.searchParams.get('data.id') ?? paymentId
    const valid = await validWebhookSignature(
      deps.secret,
      request.headers.get('x-signature'),
      request.headers.get('x-request-id'),
      dataId,
    )
    if (!valid) return new Response('assinatura inválida', { status: 401 })
  }

  try {
    await (deps.sync ?? syncGatewayPayment)(deps.gateway, paymentId)
    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('[pagamento] erro ao processar a notificação', error)
    return new Response('erro', { status: 500 })
  }
}
