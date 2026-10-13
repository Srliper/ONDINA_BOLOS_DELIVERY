import { formatAddress, paymentLabel, PENDING_PAYMENT_LABEL, type CheckoutData, type PaymentMethod } from '@/lib/checkout'
import { celebrate } from '@/lib/confetti'
import { MAPS_URL, WHATSAPP_NUMBER } from '@/lib/contact'
import { formatBRLPlain } from '@/lib/format'
import { DELIVERY_CITY, shippingFee } from '@/lib/shipping'
import { lacksStock, pendingItems } from '@/lib/stock'
import type { CartItem } from '@/types/product'

export { MAPS_URL, WHATSAPP_NUMBER }

/** Webhook do n8n que recebe cada pedido (pode ser trocado pela variável VITE_N8N_WEBHOOK_URL). */
export const N8N_WEBHOOK_URL =
  import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n.ondinabolos.com/webhook/pedido-recebido'

/** Quanto esperamos o n8n antes de seguir para o WhatsApp mesmo sem resposta. */
export const N8N_TIMEOUT_MS = 2500
/** Tempo para o confete aparecer antes de a conversa abrir. */
const CONFETTI_LEAD_MS = 450

const whatsappUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

/** Link oficial da API do WhatsApp com a mensagem do pedido. */
export const orderWhatsAppUrl = (text: string) =>
  `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`

/* ---------- Mensagem do pedido ---------- */

export interface OrderInput {
  items: readonly CartItem[]
  total: number
  checkout: CheckoutData
}

const shippingText = ({ customer }: CheckoutData) =>
  customer.fulfillment === 'entrega'
    ? `${formatBRLPlain(shippingFee('entrega'))} (entrega grátis em ${DELIVERY_CITY})`
    : 'Retirada no Local (sem frete)'

const paymentText = ({ customer, payment }: CheckoutData) =>
  payment
    ? paymentLabel(payment.method, customer.fulfillment) +
      (payment.changeFor !== undefined ? ` (troco para ${formatBRLPlain(payment.changeFor)})` : '')
    : PENDING_PAYMENT_LABEL

/** Mensagem do pedido no formato oficial (texto puro, ainda não codificado). */
export function buildOrderMessage({ items, total, checkout }: OrderInput): string {
  const missing = pendingItems(items)
  const itemLines = items.flatMap(item => {
    const subtotal = formatBRLPlain(item.price * item.quantity)
    if (item.type === 'ready') {
      const kg = item.product.unit === 'kg' ? ' (kg)' : ''
      return [`• ${item.quantity}x ${item.name}${kg} - ${subtotal}${lacksStock(item) ? ' ⚠️ sem estoque' : ''}`]
    }
    const { base, recheio, cobertura, decoracao } = item.customConfig
    return [
      `• ${item.quantity}x Bolo Personalizado - ${subtotal}`,
      `   ◦ Base: ${base}`,
      `   ◦ Recheio: ${recheio}`,
      `   ◦ Cobertura: ${cobertura}`,
      `   ◦ Decoração: ${decoracao}`,
    ]
  })

  return [
    missing.length
      ? 'Olá, Ondina Bolos! Gostaria de deixar um pedido pendente.'
      : 'Olá, Ondina Bolos! Gostaria de fazer um pedido.',
    '',
    ...(missing.length
      ? [
          `⏳ *PEDIDO PENDENTE:* sem estoque de ${missing.map(item => item.name).join(', ')}. Aguardo a confirmação da disponibilidade para combinar o pagamento.`,
          '',
        ]
      : []),
    '🎂 *Meu Pedido:*',
    ...itemLines,
    '',
    `🚚 *Frete:* ${shippingText(checkout)}`,
    `💰 *Total Geral:* ${formatBRLPlain(total + shippingFee(checkout.customer.fulfillment))}`,
    '',
    `👤 *Nome:* ${checkout.customer.name}`,
    `📍 *Endereço:* ${formatAddress(checkout.customer)}`,
    `💳 *Forma de Pagamento:* ${paymentText(checkout)}`,
    `🗺️ *Referência do mapa:* ${MAPS_URL}`,
  ].join('\n')
}

/* ---------- Dados enviados ao n8n ---------- */

type DeliveryCustomer = Extract<CheckoutData['customer'], { fulfillment: 'entrega' }>

export interface OrderPayload {
  orderId: string
  createdAt: string
  source: 'site'
  /** "pendente" quando algum bolo está sem estoque: não houve escolha de pagamento. */
  status: 'novo' | 'pendente'
  customer: {
    name: string
    fulfillment: CheckoutData['customer']['fulfillment']
    /** Endereço em uma linha (ou "Retirada na loja ..."). */
    address: string
    /** Campos separados, só na entrega. */
    details?: DeliveryCustomer['address']
  }
  payment: { method: PaymentMethod | null; label: string; changeFor?: number }
  shipping: { method: CheckoutData['customer']['fulfillment']; fee: number; city: string }
  items: {
    type: CartItem['type']
    name: string
    quantity: number
    /** Só quando o bolo estava sem estoque suficiente. */
    outOfStock?: true
    unitPrice: number
    subtotal: number
    layers?: { base: string; recheio: string; cobertura: string; decoracao: string }
  }[]
  total: number
  /** A mesma mensagem que vai para o WhatsApp, para o n8n poder registrar/encaminhar. */
  message: string
}

/** Id curto para cruzar o registro do n8n com a conversa (ex.: OB-MG6Z1K2A-7Q). */
export const createOrderId = (now: Date) =>
  `OB-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`

export function buildOrderPayload(order: OrderInput, message: string, now = new Date()): OrderPayload {
  const { customer, payment } = order.checkout
  return {
    orderId: createOrderId(now),
    createdAt: now.toISOString(),
    source: 'site',
    status: payment && pendingItems(order.items).length === 0 ? 'novo' : 'pendente',
    customer: {
      name: customer.name,
      fulfillment: customer.fulfillment,
      address: formatAddress(customer),
      ...(customer.fulfillment === 'entrega' ? { details: customer.address } : {}),
    },
    payment: {
      method: payment?.method ?? null,
      label: paymentText(order.checkout),
      ...(payment?.changeFor !== undefined ? { changeFor: payment.changeFor } : {}),
    },
    items: order.items.map(item => ({
      type: item.type,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
      ...(lacksStock(item) ? { outOfStock: true as const } : {}),
      ...(item.type === 'custom' ? { layers: item.customConfig } : {}),
    })),
    shipping: { method: customer.fulfillment, fee: shippingFee(customer.fulfillment), city: customer.city },
    total: order.total + shippingFee(customer.fulfillment),
    message,
  }
}

/* ---------- Processar e enviar ---------- */

/** O que o envio usa do navegador — trocável nos testes. */
export interface SendDeps {
  fetch: typeof fetch
  /** Abre a conversa em nova aba; devolve null se o navegador bloquear o pop-up. */
  open: (url: string) => Window | null
  navigate: (url: string) => void
  celebrate: () => Promise<void> | void
  wait: (ms: number) => Promise<void>
}

const browserDeps = (): SendDeps => ({
  fetch: (input, init) => window.fetch(input, init),
  open: url => {
    // Sem "noopener" no window.open: com ele o navegador sempre devolve null e não
    // daria para saber se o pop-up foi bloqueado. Cortamos o vínculo logo em seguida.
    const tab = window.open(url, '_blank')
    if (tab) tab.opener = null
    return tab
  },
  navigate: url => window.location.assign(url),
  celebrate,
  wait: ms => new Promise(resolve => window.setTimeout(resolve, ms)),
})

export interface SendResult {
  orderId: string
  /** O n8n confirmou o recebimento (2xx) dentro do tempo limite. */
  savedToN8n: boolean
  whatsappUrl: string
}

/**
 * Registra o pedido no n8n e abre a conversa no WhatsApp.
 * O n8n nunca bloqueia o cliente: se cair, demorar ou recusar, o erro só vai para o console
 * e o WhatsApp abre do mesmo jeito — o pedido não pode se perder.
 */
export async function processOrderAndSend(
  items: readonly CartItem[],
  total: number,
  checkout: CheckoutData,
  deps: SendDeps = browserDeps(),
): Promise<SendResult> {
  const order = { items, total, checkout }
  const message = buildOrderMessage(order)
  const payload = buildOrderPayload(order, message)
  const url = orderWhatsAppUrl(message)

  let savedToN8n = false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)
  try {
    const response = await deps.fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      keepalive: true,
    })
    savedToN8n = response.ok
    if (!response.ok) console.error(`[pedido ${payload.orderId}] n8n respondeu ${response.status}`)
  } catch (error) {
    console.error(`[pedido ${payload.orderId}] não foi possível avisar o n8n`, error)
  } finally {
    clearTimeout(timer)
  }

  // Confete logo antes de sair para o WhatsApp.
  void deps.celebrate()
  await deps.wait(CONFETTI_LEAD_MS)

  // Se o navegador bloquear a nova aba (comum no iPhone depois de esperar a rede),
  // abre na própria aba — no celular isso leva direto ao app do WhatsApp.
  if (!deps.open(url)) deps.navigate(url)

  return { orderId: payload.orderId, savedToN8n, whatsappUrl: url }
}

/* ---------- Contato avulso ---------- */

/** Link para dúvidas avulsas (sem carrinho), ex.: "Pedir agora" no topo. */
export function generateContactLink(productName?: string): string {
  return whatsappUrl(
    productName
      ? `Olá, Ondina Bolos! 🍰 Gostaria de pedir o bolo ${productName} e combinar tamanho, disponibilidade e entrega ou retirada.`
      : 'Olá, Ondina Bolos! 🍰 Gostaria de fazer um pedido e combinar entrega ou retirada.',
  )
}
