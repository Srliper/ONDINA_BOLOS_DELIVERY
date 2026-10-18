import { z } from 'zod'
import { LAYER_ORDER } from '@/data/bolo-layers'
import { toBoloLayers, toProducts, type Catalog } from '@/lib/catalog'
import { formatAddress, fulfillmentSchema, paymentLabel, PAYMENT_METHODS, type Fulfillment } from '@/lib/checkout'
import { formatBRLPlain } from '@/lib/format'
import { shippingFee } from '@/lib/shipping'

/**
 * Pedidos do site e o fluxo de entrega, com o controle de estoque.
 * Funções puras: quem grava no banco é src/lib/orders-server.ts.
 *
 * Regras:
 * - Ao finalizar, o servidor recalcula os preços pelo catálogo e confere o estoque.
 *   Tudo em estoque → "Aguardando pagamento" e o estoque é reservado (baixado) na hora.
 *   Faltou algum bolo → "PENDENTE (Falta de estoque)", sem reservar nada.
 * - Pedido PENDENTE não avança para nenhuma etapa (nem pelo seletor, nem pelo "Confirmar pagamento").
 *   Só sai dali por "Verificar estoque", depois que a equipe dá entrada no estoque — ou cancelando.
 * - Cancelar devolve ao estoque o que tinha sido reservado.
 */

/* ---------- Status ---------- */

export const ORDER_STATUSES = [
  'pendente',
  'aguardando_pagamento',
  'em_preparo',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: 'PENDENTE (Falta de estoque)',
  aguardando_pagamento: 'Aguardando pagamento',
  em_preparo: 'Pago / Em preparo',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

/** Nome do status; na retirada, "saiu para entrega" vira "pronto para retirada". */
export const statusLabel = (status: OrderStatus, fulfillment: Fulfillment['fulfillment'] = 'entrega'): string =>
  status === 'saiu_para_entrega' && fulfillment === 'retirada'
    ? 'Pronto para retirada'
    : status === 'entregue' && fulfillment === 'retirada'
      ? 'Retirado'
      : STATUS_LABELS[status]

/** Pagamento feito na entrega/retirada: o pedido pode ir para o preparo antes de pago. */
const paysOnHandover = (order: Order) => order.payment.method === 'dinheiro' || order.payment.method === 'cartao'

/* ---------- O que o site manda ao finalizar ---------- */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60)

export const orderLineSchema = z.union([
  z.object({ productId: slug, quantity: z.number().int().min(1).max(50) }),
  z.object({
    custom: z.object({ base: slug, recheio: slug, cobertura: slug, decoracao: slug }),
    quantity: z.number().int().min(1).max(20),
  }),
])

export type OrderLine = z.infer<typeof orderLineSchema>

export const placeOrderSchema = z.object({
  customer: fulfillmentSchema,
  payment: z.object({
    method: z.enum(PAYMENT_METHODS as unknown as ['pix', 'cartao', 'dinheiro']),
    changeFor: z.number().positive().max(100_000).optional(),
  }),
  lines: z.array(orderLineSchema).min(1, 'O carrinho está vazio.').max(30),
})

export type PlaceOrderInput = z.input<typeof placeOrderSchema>

/* ---------- Pedido guardado ---------- */

const orderItemSchema = z.object({
  /** Id do bolo pronto; ausente no bolo montado. */
  productId: z.string().optional(),
  /** Ids das camadas do bolo montado. */
  layerIds: z.object({ base: z.string(), recheio: z.string(), cobertura: z.string(), decoracao: z.string() }).optional(),
  name: z.string(),
  /** "Base Red Velvet · Morango com Ninho · …" no bolo montado. */
  detail: z.string().optional(),
  unit: z.enum(['kg', 'un']),
  quantity: z.number(),
  unitPrice: z.number(),
  subtotal: z.number(),
})

const shortageSchema = z.object({
  productId: z.string(),
  name: z.string(),
  requested: z.number(),
  /** null = o bolo saiu do cardápio. */
  available: z.number().nullable(),
})

const historySchema = z.object({
  at: z.string(),
  status: z.enum(ORDER_STATUSES),
  /** Quem fez (id da equipe) ou "site"/"sistema". */
  by: z.string(),
  note: z.string().optional(),
})

export const orderSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(ORDER_STATUSES),
  paid: z.boolean(),
  paidAt: z.string().optional(),
  /** O estoque destes itens já foi baixado (devolve ao cancelar). */
  stockReserved: z.boolean(),
  customer: z.object({
    name: z.string(),
    fulfillment: z.enum(['entrega', 'retirada']),
    city: z.string(),
    /** Endereço em uma linha (ou "Retirada na loja …"). */
    address: z.string(),
    cep: z.string().optional(),
  }),
  payment: z.object({
    method: z.enum(['pix', 'cartao', 'dinheiro']),
    label: z.string(),
    changeFor: z.number().optional(),
  }),
  items: z.array(orderItemSchema),
  shortages: z.array(shortageSchema),
  shippingFee: z.number(),
  total: z.number(),
  history: z.array(historySchema),
})

export type Order = z.infer<typeof orderSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type Shortage = z.infer<typeof shortageSchema>

export const ordersDocSchema = z.object({ orders: z.array(orderSchema) })
export type OrdersDoc = z.infer<typeof ordersDocSchema>

/** Quantos pedidos o banco guarda (os mais antigos já finalizados saem primeiro). */
export const MAX_STORED_ORDERS = 500

export class OrderError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 429 | 503,
    message: string,
  ) {
    super(message)
    this.name = 'OrderError'
  }
}

/* ---------- Itens: preços e estoque pelo catálogo ---------- */

/** Recalcula nome, unidade e preço de cada linha pelo catálogo — nunca confia no preço do navegador. */
export function resolveItems(catalog: Catalog, lines: readonly OrderLine[]): OrderItem[] {
  const products = new Map(toProducts(catalog).map(product => [product.id, product]))
  const layers = new Map(toBoloLayers(catalog).map(layer => [layer.id, layer]))
  return lines.map(line => {
    if ('productId' in line) {
      const product = products.get(line.productId)
      if (!product) throw new OrderError(409, 'Um dos bolos do carrinho saiu do cardápio. Atualize a página e confira o pedido.')
      return {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: line.quantity,
        unitPrice: product.price,
        subtotal: product.price * line.quantity,
      }
    }
    const chosen = LAYER_ORDER.map(category => {
      const layer = layers.get(line.custom[category])
      if (!layer || layer.category !== category) {
        throw new OrderError(409, 'Uma das camadas do bolo montado mudou. Monte o bolo de novo.')
      }
      return layer
    })
    const unitPrice = chosen.reduce((sum, layer) => sum + layer.price, 0)
    return {
      layerIds: line.custom,
      name: 'Bolo Personalizado',
      detail: chosen.map(layer => layer.name).join(' · '),
      unit: 'un',
      quantity: line.quantity,
      unitPrice,
      subtotal: unitPrice * line.quantity,
    }
  })
}

/** Quanto de cada bolo pronto o pedido usa (somando linhas repetidas). */
function demandByProduct(items: readonly OrderItem[]): Map<string, number> {
  const demand = new Map<string, number>()
  for (const item of items) {
    if (item.productId) demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.quantity)
  }
  return demand
}

/** Bolos que faltam no estoque para este pedido (vazio = pode seguir). Bolo montado é sob encomenda. */
export function findShortages(catalog: Catalog, items: readonly OrderItem[]): Shortage[] {
  const shortages: Shortage[] = []
  for (const [productId, requested] of demandByProduct(items)) {
    const product = catalog.products.find(entry => entry.id === productId)
    const name = items.find(item => item.productId === productId)?.name ?? productId
    if (!product) shortages.push({ productId, name, requested, available: null })
    else if (product.stock !== null && requested > product.stock) {
      shortages.push({ productId, name, requested, available: product.stock })
    }
  }
  return shortages
}

/** Baixa (sign = -1) ou devolve (sign = 1) o estoque dos bolos com controle. */
function moveStock(catalog: Catalog, items: readonly OrderItem[], sign: 1 | -1, now: Date): Catalog {
  const demand = demandByProduct(items)
  let changed = false
  const products = catalog.products.map(product => {
    const quantity = demand.get(product.id)
    if (!quantity || product.stock === null) return product
    changed = true
    return { ...product, stock: Math.max(0, product.stock + sign * quantity) }
  })
  return changed
    ? { ...catalog, products, version: catalog.version + 1, updated_at: now.toISOString() }
    : catalog
}

const amount = (unit: OrderItem['unit'], quantity: number) => (unit === 'kg' ? `${quantity} kg` : `${quantity} un.`)

/** Texto curto do que falta: "Prestígio (pediu 2 kg, há 1 kg)". */
export function shortageText(shortage: Shortage, unit: OrderItem['unit'] = 'kg'): string {
  if (shortage.available === null) return `${shortage.name} (saiu do cardápio)`
  return `${shortage.name} (pediu ${amount(unit, shortage.requested)}, há ${amount(unit, shortage.available)})`
}

/* ---------- Criar o pedido ---------- */

/** Id curto para cruzar o painel, o n8n e a conversa (ex.: OB-MG6Z1K2A-7Q). */
export const createOrderId = (now: Date) =>
  `OB-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`

const cepOf = (customer: Fulfillment) => (customer.fulfillment === 'entrega' ? customer.address.cep : undefined)

/**
 * Cria o pedido conferindo o estoque. Devolve também o catálogo com o estoque já baixado
 * (o mesmo objeto, se nada mudou) — quem chama grava os dois juntos.
 */
export function createOrder(
  catalog: Catalog,
  input: z.output<typeof placeOrderSchema>,
  now = new Date(),
  id = createOrderId(now),
): { order: Order; catalog: Catalog } {
  const items = resolveItems(catalog, input.lines)
  const shortages = findShortages(catalog, items)
  const pending = shortages.length > 0
  const { customer, payment } = input
  const fee = shippingFee(customer.fulfillment)
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const at = now.toISOString()

  const order: Order = {
    id,
    createdAt: at,
    updatedAt: at,
    status: pending ? 'pendente' : 'aguardando_pagamento',
    paid: false,
    stockReserved: !pending,
    customer: {
      name: customer.name,
      fulfillment: customer.fulfillment,
      city: customer.city,
      address: formatAddress(customer),
      ...(cepOf(customer) ? { cep: cepOf(customer) } : {}),
    },
    payment: {
      method: payment.method,
      label:
        paymentLabel(payment.method, customer.fulfillment) +
        (payment.changeFor !== undefined ? ` (troco para ${formatBRLPlain(payment.changeFor)})` : ''),
      ...(payment.changeFor !== undefined ? { changeFor: payment.changeFor } : {}),
    },
    items,
    shortages,
    shippingFee: fee,
    total: subtotal + fee,
    history: [
      {
        at,
        status: pending ? 'pendente' : 'aguardando_pagamento',
        by: 'site',
        ...(pending ? { note: `Falta de estoque: ${shortages.map(s => shortageText(s, unitOf(items, s))).join('; ')}` } : {}),
      },
    ],
  }
  return { order, catalog: pending ? catalog : moveStock(catalog, items, -1, now) }
}

const unitOf = (items: readonly OrderItem[], shortage: Shortage) =>
  items.find(item => item.productId === shortage.productId)?.unit ?? 'kg'

/* ---------- Ações do painel ---------- */

const PENDING_BLOCK =
  'Pedido PENDENTE por falta de estoque: ele não pode avançar. Dê entrada no estoque (Bolos, no painel) e toque em “Verificar estoque”.'

/** Motivo de a mudança não ser permitida, ou undefined se pode. */
export function transitionError(order: Order, to: OrderStatus): string | undefined {
  if (order.status === to) return 'O pedido já está nesse status.'
  if (order.status === 'entregue' || order.status === 'cancelado') {
    return `Pedido ${statusLabel(order.status, order.customer.fulfillment).toLowerCase()}: não muda mais.`
  }
  if (to === 'cancelado') return undefined
  if (order.status === 'pendente') return PENDING_BLOCK
  if (to === 'pendente') return 'Só o sistema marca um pedido como PENDENTE, ao conferir o estoque.'
  if (to === 'aguardando_pagamento' && order.paid) return 'O pagamento já foi confirmado.'
  // Preparo em diante exige pagamento confirmado (menos dinheiro/cartão, pagos na entrega ou retirada).
  if (to !== 'aguardando_pagamento' && !order.paid && !paysOnHandover(order)) {
    return to === 'em_preparo'
      ? 'Confirme o pagamento antes de mandar para o preparo.'
      : 'Confirme o pagamento antes de seguir com o pedido.'
  }
  return undefined
}

const withHistory = (order: Order, patch: Partial<Order>, by: string, now: Date, note?: string): Order => {
  const at = now.toISOString()
  const status = patch.status ?? order.status
  return {
    ...order,
    ...patch,
    updatedAt: at,
    history: [...order.history, { at, status, by, ...(note ? { note } : {}) }],
  }
}

/** Troca o status (seletor do painel). Cancelar devolve o estoque reservado. */
export function changeStatus(
  order: Order,
  catalog: Catalog,
  to: OrderStatus,
  by: string,
  now = new Date(),
): { order: Order; catalog: Catalog } {
  const error = transitionError(order, to)
  if (error) throw new OrderError(409, error)

  if (to === 'cancelado') {
    const restored = order.stockReserved ? moveStock(catalog, order.items, 1, now) : catalog
    return {
      order: withHistory(order, { status: 'cancelado', stockReserved: false }, by, now, order.stockReserved ? 'Estoque devolvido.' : undefined),
      catalog: restored,
    }
  }
  // Entregue com pagamento na entrega/retirada: o dinheiro entrou na hora.
  const paidNow = to === 'entregue' && !order.paid
  return {
    order: withHistory(
      order,
      { status: to, ...(paidNow ? { paid: true, paidAt: now.toISOString() } : {}) },
      by,
      now,
      paidNow ? 'Pago na entrega.' : undefined,
    ),
    catalog,
  }
}

/** Botão "Confirmar pagamento": marca como pago e, se estava aguardando, manda para o preparo. */
export function confirmPayment(order: Order, by: string, now = new Date()): Order {
  if (order.status === 'pendente') throw new OrderError(409, PENDING_BLOCK)
  if (order.status === 'cancelado') throw new OrderError(409, 'Pedido cancelado: não há pagamento a confirmar.')
  if (order.paid) throw new OrderError(409, 'O pagamento já foi confirmado.')
  const status = order.status === 'aguardando_pagamento' ? 'em_preparo' : order.status
  return withHistory(order, { paid: true, paidAt: now.toISOString(), status }, by, now, 'Pagamento confirmado.')
}

/**
 * "Verificar estoque" num pedido PENDENTE: se agora há estoque de tudo, reserva e libera
 * para "Aguardando pagamento"; senão continua pendente, com a falta atualizada.
 */
export function revalidateStock(
  order: Order,
  catalog: Catalog,
  by: string,
  now = new Date(),
): { order: Order; catalog: Catalog; released: boolean } {
  if (order.status !== 'pendente') throw new OrderError(409, 'Só pedidos PENDENTES precisam verificar o estoque.')
  const shortages = findShortages(catalog, order.items)
  if (shortages.length > 0) {
    return { order: { ...order, shortages, updatedAt: now.toISOString() }, catalog, released: false }
  }
  return {
    order: withHistory(
      order,
      { status: 'aguardando_pagamento', shortages: [], stockReserved: true },
      by,
      now,
      'Estoque conferido e reservado.',
    ),
    catalog: moveStock(catalog, order.items, -1, now),
    released: true,
  }
}

/** Guarda o pedido novo no começo e limita o tamanho, tirando primeiro os já finalizados mais antigos. */
export function addOrder(doc: OrdersDoc, order: Order): OrdersDoc {
  const orders = [order, ...doc.orders]
  while (orders.length > MAX_STORED_ORDERS) {
    let oldestDone = orders.length - 1
    while (oldestDone > 0 && orders[oldestDone]!.status !== 'entregue' && orders[oldestDone]!.status !== 'cancelado') oldestDone--
    // Nenhum finalizado: sai o mais antigo de todos.
    orders.splice(oldestDone > 0 ? oldestDone : orders.length - 1, 1)
  }
  return { orders }
}

export function replaceOrder(doc: OrdersDoc, order: Order): OrdersDoc {
  return { orders: doc.orders.map(entry => (entry.id === order.id ? order : entry)) }
}

export function findOrder(doc: OrdersDoc, id: string): Order {
  const order = doc.orders.find(entry => entry.id === id)
  if (!order) throw new OrderError(404, 'Pedido não encontrado.')
  return order
}
