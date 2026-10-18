import { formatAddress, paymentLabel, PENDING_PAYMENT_NOTE, type CheckoutData, type PaymentMethod } from '@/lib/checkout'
import { celebrate } from '@/lib/confetti'
import { MAPS_URL, WHATSAPP_NUMBER } from '@/lib/contact'
import { formatBRLPlain } from '@/lib/format'
import { DELIVERY_CITY, shippingFee } from '@/lib/shipping'
import { createOrderId, type OrderLine, type OrderStatus, type Shortage } from '@/lib/order-flow'
import { lacksStock } from '@/lib/stock'
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

/** O que o servidor decidiu ao registrar o pedido (estoque conferido lá). */
export interface RegisteredOrder {
  orderId: string
  status: OrderStatus
  shortages: Shortage[]
}

export interface OrderInput {
  items: readonly CartItem[]
  total: number
  checkout: CheckoutData
  /** Sem registro (servidor fora do ar), vale a conferência de estoque feita no navegador. */
  registered?: RegisteredOrder | undefined
}

/** Itens sem estoque: pela resposta do servidor, ou pelo estoque que o navegador conhece. */
function missingItems({ items, registered }: OrderInput): CartItem[] {
  if (!registered) return items.filter(lacksStock)
  const ids = new Set(registered.shortages.map(shortage => shortage.productId))
  return items.filter(item => item.type === 'ready' && ids.has(item.product.id))
}

const isPending = (order: OrderInput) =>
  order.registered ? order.registered.status === 'pendente' : missingItems(order).length > 0

/** Linhas do carrinho como o servidor recebe (ids e quantidades; preços ele recalcula). */
export const toOrderLines = (items: readonly CartItem[]): OrderLine[] =>
  items.map(item =>
    item.type === 'ready'
      ? { productId: item.product.id, quantity: item.quantity }
      : { custom: item.layerIds, quantity: item.quantity },
  )

const shippingText = ({ customer }: CheckoutData) =>
  customer.fulfillment === 'entrega'
    ? `${formatBRLPlain(shippingFee('entrega'))} (entrega grátis em ${DELIVERY_CITY})`
    : 'Retirada no Local (sem frete)'

const paymentText = ({ customer, payment }: CheckoutData, pending = false) =>
  paymentLabel(payment.method, customer.fulfillment) +
  (payment.changeFor !== undefined ? ` (troco para ${formatBRLPlain(payment.changeFor)})` : '') +
  (pending ? ` — ${PENDING_PAYMENT_NOTE}` : '')

/** Mensagem do pedido no formato oficial (texto puro, ainda não codificado). */
export function buildOrderMessage(order: OrderInput): string {
  const { items, total, checkout, registered } = order
  const missing = missingItems(order)
  const pending = isPending(order)
  const itemLines = items.flatMap(item => {
    const subtotal = formatBRLPlain(item.price * item.quantity)
    if (item.type === 'ready') {
      const kg = item.product.unit === 'kg' ? ' (kg)' : ''
      return [`• ${item.quantity}x ${item.name}${kg} - ${subtotal}${missing.includes(item) ? ' ⚠️ sem estoque' : ''}`]
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
    pending
      ? 'Olá, Ondina Bolos! Gostaria de deixar um pedido pendente.'
      : 'Olá, Ondina Bolos! Gostaria de fazer um pedido.',
    ...(registered ? [`🧾 *Pedido:* ${registered.orderId}`] : []),
    '',
    ...(pending
      ? [
          `⏳ *PEDIDO PENDENTE (falta de estoque):* ${missing.map(item => item.name).join(', ') || 'algum item'}. Aguardo a confirmação da disponibilidade para seguir com o pagamento.`,
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
    `💳 *Forma de Pagamento:* ${paymentText(checkout, pending)}`,
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
  payment: { method: PaymentMethod; label: string; changeFor?: number }
  shipping: { method: CheckoutData['customer']['fulfillment']; fee: number; city: string }
  items: {
    type: CartItem['type']
    /** Só nos bolos prontos: id do bolo, para o n8n cruzar com o cardápio. */
    productId?: string
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

export { createOrderId }

export function buildOrderPayload(order: OrderInput, message: string, now = new Date()): OrderPayload {
  const { customer, payment } = order.checkout
  const missing = missingItems(order)
  return {
    orderId: order.registered?.orderId ?? createOrderId(now),
    createdAt: now.toISOString(),
    source: 'site',
    status: isPending(order) ? 'pendente' : 'novo',
    customer: {
      name: customer.name,
      fulfillment: customer.fulfillment,
      address: formatAddress(customer),
      ...(customer.fulfillment === 'entrega' ? { details: customer.address } : {}),
    },
    payment: {
      method: payment.method,
      label: paymentText(order.checkout, isPending(order)),
      ...(payment.changeFor !== undefined ? { changeFor: payment.changeFor } : {}),
    },
    items: order.items.map(item => ({
      type: item.type,
      ...(item.type === 'ready' ? { productId: item.product.id } : {}),
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
      ...(missing.includes(item) ? { outOfStock: true as const } : {}),
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
  /** Registra o pedido no servidor do site (confere o estoque); rejeita se não der. */
  register: (lines: OrderLine[], checkout: CheckoutData) => Promise<RegisteredOrder>
  fetch: typeof fetch
  /** Abre a conversa em nova aba; devolve null se o navegador bloquear o pop-up. */
  open: (url: string) => Window | null
  navigate: (url: string) => void
  celebrate: () => Promise<void> | void
  wait: (ms: number) => Promise<void>
}

const browserDeps = (): SendDeps => ({
  register: async (lines, checkout) => {
    const { placeOrder } = await import('@/lib/orders-server')
    const result = await placeOrder({ data: { lines, customer: checkout.customer, payment: checkout.payment } })
    if (!result.ok) throw new Error(result.error)
    return { orderId: result.orderId, status: result.status, shortages: result.shortages }
  },
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
  /** Pedido registrado no painel (estoque conferido no servidor). */
  registered: boolean
  pending: boolean
  /** O n8n confirmou o recebimento (2xx) dentro do tempo limite. */
  savedToN8n: boolean
  whatsappUrl: string
}

/** Quanto esperamos o servidor registrar o pedido antes de seguir sem ele. */
export const REGISTER_TIMEOUT_MS = 6000

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tempo esgotado')), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

/**
 * Registra o pedido no site (estoque conferido no servidor) e no n8n, e abre a conversa no WhatsApp.
 * Nenhum dos dois bloqueia o cliente: se cair, demorar ou recusar, o erro vai para o console
 * e o WhatsApp abre do mesmo jeito — o pedido não pode se perder.
 */
export async function processOrderAndSend(
  items: readonly CartItem[],
  total: number,
  checkout: CheckoutData,
  deps: SendDeps = browserDeps(),
): Promise<SendResult> {
  let registered: RegisteredOrder | undefined
  try {
    registered = await withTimeout(deps.register(toOrderLines(items), checkout), REGISTER_TIMEOUT_MS)
  } catch (error) {
    console.error('[pedido] não foi possível registrar no site; segue pelo WhatsApp', error)
  }

  const order = { items, total, checkout, registered }
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

  return {
    orderId: payload.orderId,
    registered: Boolean(registered),
    pending: payload.status === 'pendente',
    savedToN8n,
    whatsappUrl: url,
  }
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
