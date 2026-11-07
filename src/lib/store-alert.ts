/**
 * Avisos para a equipe quando o painel está fechado (opcional): o servidor manda um POST para o
 * webhook do n8n (N8N_STORE_ALERT_URL), que pode repassar no WhatsApp da loja. Com o painel
 * aberto, os avisos aparecem na tela (src/components/admin/AdminNotifier.tsx).
 * Falha do n8n nunca impede o pedido, o pagamento ou a mensagem.
 */

import type { Order } from '@/lib/order-flow'

export type StoreEvent =
  | {
      event: 'pedido-novo'
      orderId: string
      customer: string
      total: number
      status: string
      channel: string
      details?: string
    }
  | { event: 'pagamento-aprovado'; orderId: string; customer: string; total: number; details?: string }
  | { event: 'mensagem-cliente'; orderId: string; customer: string; text: string }
  | { event: 'aviso-estoque'; productId: string; productName: string; customer: string; waiting: number }

export function storeEventMessage(alert: StoreEvent): string {
  const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  switch (alert.event) {
    case 'pedido-novo':
      return `🧾 Pedido novo no site: ${alert.orderId} — ${alert.customer}, ${brl(alert.total)} (${alert.status}).`
    case 'pagamento-aprovado':
      return `✅ Pagamento online aprovado: ${alert.orderId} — ${alert.customer}, ${brl(alert.total)}. Pode preparar e entregar!`
    case 'mensagem-cliente':
      return `💬 ${alert.customer} escreveu no pedido ${alert.orderId}: "${alert.text.slice(0, 200)}"`
    case 'aviso-estoque':
      return `🔔 ${alert.customer} quer ${alert.productName} (esgotado). Já são ${alert.waiting} esperando o aviso.`
  }
}

/**
 * O pedido inteiro em texto (itens, dia, endereço, telefone), para o n8n repassar no WhatsApp da loja.
 * Fica fora do push, que só mostra a linha curta.
 */
export function orderDetails(order: Order): string {
  const pickup = order.customer.fulfillment === 'retirada'
  return [
    ...order.items.map(
      item =>
        `🎂 ${item.unit === 'kg' ? `${item.quantity} kg` : `${item.quantity}x`} ${item.name}${item.detail ? ` (${item.detail})` : ''}`,
    ),
    ...(order.schedule ? [`📅 Para quando: ${order.schedule.label}`] : []),
    `${pickup ? '🏠 Retirada' : '📍 Entrega'}: ${order.customer.address}`,
    ...(order.customer.phone ? [`📞 WhatsApp do cliente: ${order.customer.phone}`] : []),
    `💳 ${order.payment.label}`,
  ].join('\n')
}

const alertText = (alert: StoreEvent) => {
  const details = 'details' in alert ? alert.details : undefined
  return details ? `${storeEventMessage(alert)}\n\n${details}` : storeEventMessage(alert)
}

export type StoreNotifier = (alert: StoreEvent) => Promise<void>

export function createStoreNotifier(
  config: { url: string | undefined; key?: string | undefined },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): StoreNotifier {
  return async alert => {
    if (!config.url) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.key ? { 'x-ondina-key': config.key } : {}) },
        body: JSON.stringify({ ...alert, at: new Date().toISOString(), message: alertText(alert) }),
        signal: controller.signal,
      })
      if (!response.ok) console.error(`[avisos] n8n respondeu ${response.status} ao aviso "${alert.event}"`)
    } catch (error) {
      console.error(`[avisos] não foi possível avisar o n8n ("${alert.event}")`, error)
    } finally {
      clearTimeout(timer)
    }
  }
}
