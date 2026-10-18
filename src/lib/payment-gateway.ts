import { paymentDeadline, trackingPath, type GatewayPayment, type Order } from '@/lib/order-flow'

/**
 * Gateway de pagamento do site: Mercado Pago (Checkout Pro — Pix e cartão, na página segura deles).
 * Só roda no servidor: o token (MERCADOPAGO_ACCESS_TOKEN) nunca vai para o navegador.
 *
 * - createCheckout: cria a "preferência" com os itens do pedido e devolve o link de pagamento;
 * - getPayment: lê o pagamento direto na API do Mercado Pago. A confirmação vale só por aqui —
 *   nunca pelo que o navegador ou a notificação dizem.
 */

const API = 'https://api.mercadopago.com'

export interface PaymentGateway {
  createCheckout(order: Order, baseUrl: string): Promise<{ preferenceId: string; url: string }>
  getPayment(paymentId: string): Promise<GatewayPayment>
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatewayError'
  }
}

/** Corpo da preferência: os mesmos itens e o mesmo total que o servidor calculou. */
export function buildPreference(order: Order, baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '')
  const back = `${base}${trackingPath(order)}`
  // O Mercado Pago só aceita voltar sozinho e notificar em endereço público com https.
  const isPublic = base.startsWith('https://')
  // O link de pagamento vence junto com o prazo do pedido (depois disso o estoque volta).
  const deadline = paymentDeadline(order)?.toISOString()
  return {
    external_reference: order.id,
    items: [
      ...order.items.map((item, index) => ({
        id: item.productId ?? `bolo-personalizado-${index + 1}`,
        title: `${item.name}${item.unit === 'kg' ? ' (kg)' : ''}`.slice(0, 250),
        ...(item.detail ? { description: item.detail.slice(0, 250) } : {}),
        quantity: item.quantity,
        unit_price: Math.round(item.unitPrice * 100) / 100,
        currency_id: 'BRL',
      })),
      ...(order.shippingFee > 0
        ? [{ id: 'frete', title: 'Frete', quantity: 1, unit_price: order.shippingFee, currency_id: 'BRL' }]
        : []),
    ],
    payer: { name: order.customer.name },
    back_urls: { success: back, pending: back, failure: back },
    ...(isPublic ? { auto_return: 'approved', notification_url: `${base}/api/payments/webhook` } : {}),
    statement_descriptor: 'ONDINA BOLOS',
    // Boleto demora dias para compensar: no bolo, só Pix e cartão.
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }], installments: 3 },
    ...(deadline ? { expires: true, expiration_date_to: deadline, date_of_expiration: deadline } : {}),
    metadata: { order_id: order.id },
  }
}

export function createMercadoPago(token: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8000): PaymentGateway {
  const call = async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
        signal: controller.signal,
      })
      if (!response.ok) {
        console.error(
          `[pagamento] Mercado Pago respondeu ${response.status} em ${path}`,
          await response.text().catch(() => ''),
        )
        throw new GatewayError('O pagamento online não respondeu agora. Tente de novo em instantes.')
      }
      return (await response.json()) as Record<string, unknown>
    } catch (error) {
      if (error instanceof GatewayError) throw error
      console.error('[pagamento] falha ao falar com o Mercado Pago', error)
      throw new GatewayError('O pagamento online não respondeu agora. Tente de novo em instantes.')
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async createCheckout(order, baseUrl) {
      const body = await call('/checkout/preferences', {
        method: 'POST',
        // A mesma tentativa repetida não cria duas preferências.
        headers: { 'X-Idempotency-Key': `${order.id}-${order.updatedAt}` },
        body: JSON.stringify(buildPreference(order, baseUrl)),
      })
      const url = token.startsWith('TEST-') ? (body['sandbox_init_point'] ?? body['init_point']) : body['init_point']
      if (typeof body['id'] !== 'string' || typeof url !== 'string') {
        throw new GatewayError('O pagamento online não devolveu o link. Tente de novo.')
      }
      return { preferenceId: body['id'], url }
    },
    async getPayment(paymentId) {
      if (!/^\d{1,20}$/.test(paymentId)) throw new GatewayError('Pagamento inválido.')
      const body = await call(`/v1/payments/${paymentId}`)
      return {
        id: String(body['id']),
        status: String(body['status'] ?? ''),
        amount: Number(body['transaction_amount'] ?? 0),
        orderId: String(body['external_reference'] ?? ''),
      }
    },
  }
}

/** Gateway configurado no servidor (MERCADOPAGO_ACCESS_TOKEN), ou undefined. */
export function configuredGateway(): PaymentGateway | undefined {
  const token = process.env['MERCADOPAGO_ACCESS_TOKEN']
  return token ? createMercadoPago(token) : undefined
}

/**
 * Assinatura da notificação (x-signature), quando MERCADOPAGO_WEBHOOK_SECRET estiver configurado.
 * Formato do Mercado Pago: "ts=…,v1=…", HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
 */
export async function validWebhookSignature(
  secret: string,
  signature: string | null,
  requestId: string | null,
  dataId: string,
): Promise<boolean> {
  if (!signature) return false
  const parts = Object.fromEntries(
    signature.split(',').map(part => part.trim().split('=') as [string, string | undefined]),
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false
  const manifest = `id:${dataId.toLowerCase()};${requestId ? `request-id:${requestId};` : ''}ts:${ts};`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  const expected = Array.from(mac, byte => byte.toString(16).padStart(2, '0')).join('')
  if (expected.length !== v1.length) return false
  let diff = 0
  for (let index = 0; index < expected.length; index++) diff |= expected.charCodeAt(index) ^ v1.charCodeAt(index)
  return diff === 0
}
