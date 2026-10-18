import { CatalogError, type Catalog } from '@/lib/catalog'
import { notifySoldOut, notifyStore } from '@/lib/catalog-deps.server'
import { getOrdersStorage, getStockRequestsStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import {
  applyGatewayPayment,
  expireUnpaid,
  isPaymentExpired,
  OrderError,
  ordersDocSchema,
  replaceOrder,
  type Order,
  type OrdersDoc,
} from '@/lib/order-flow'
import type { PaymentGateway } from '@/lib/payment-gateway'
import type { SoldOutProduct } from '@/lib/stock-alert'
import { exclusive } from '@/lib/redis-guard.server'
import { StockRequestError, stockRequestsDocSchema, type StockRequestsDoc } from '@/lib/stock-requests'

/**
 * Banco dos pedidos e dos avisos de estoque (só no servidor). O banco é online e sem servidor
 * próprio: Upstash Redis pela API REST (paga por uso, nada ligado o tempo todo), ou arquivos em
 * .data/ no computador. Leitura → mudança → gravação, uma de cada vez (trava no Redis).
 */

/* ---------- Fila de escrita (em todas as cópias do site) ---------- */

export { createRateLimit, exclusive } from '@/lib/redis-guard.server'

/* ---------- Pedidos ---------- */

export async function loadOrders(): Promise<OrdersDoc> {
  const raw = await getOrdersStorage().read()
  if (!raw) return { orders: [] }
  const parsed = ordersDocSchema.safeParse(JSON.parse(raw))
  if (parsed.success) return parsed.data
  // Não sobrescreve um banco com defeito: melhor parar e avisar do que apagar pedidos.
  console.error('[pedidos] dados guardados fora do formato', parsed.error.issues[0])
  throw new OrderError(503, 'Os pedidos guardados estão fora do formato. Fale com quem cuida do site.')
}

export const saveOrders = (doc: OrdersDoc) => getOrdersStorage().write(JSON.stringify(doc))

/** Bolos que tinham estoque e ficaram em 0 com esta mudança. */
const newlySoldOut = (before: Catalog, after: Catalog): SoldOutProduct[] =>
  after.products.flatMap(product => {
    const was = before.products.find(entry => entry.id === product.id)?.stock
    return product.stock === 0 && was !== 0 && was !== null && was !== undefined
      ? [{ id: product.id, name: product.name }]
      : []
  })

/**
 * Grava o pedido primeiro: se o estoque falhar depois, o pedido não se perde.
 * Se algum bolo esgotou, avisa o n8n (opcional; nunca impede salvar) e devolve quais foram.
 */
export async function persist(doc: OrdersDoc, before: Catalog, after: Catalog, by?: string): Promise<SoldOutProduct[]> {
  await saveOrders(doc)
  if (after === before) return []
  await saveCatalog(after)
  const soldOut = newlySoldOut(before, after)
  if (soldOut.length) await notifySoldOut(soldOut, by)
  return soldOut
}

/**
 * Cancela os pedidos online que passaram do prazo sem pagamento e devolve o estoque deles.
 * Chamado ao listar e abrir pedidos (sem tarefa agendada): quase sempre só lê.
 */
export async function sweepExpired(now = new Date()): Promise<OrdersDoc> {
  if (getOrdersStorage().kind === 'none') return { orders: [] }
  const doc = await loadOrders()
  if (!doc.orders.some(order => isPaymentExpired(order, now))) return doc
  return exclusive(async () => {
    const [catalog, fresh] = await Promise.all([loadCatalog(), loadOrders()])
    const result = expireUnpaid(fresh, catalog, now)
    if (result.expired.length) await persist(result.doc, catalog, result.catalog, 'sistema')
    return result.doc
  })
}

/**
 * Confere um pagamento direto na API do gateway e aplica no pedido. Com expectedOrderId, ignora
 * pagamentos de outro pedido (o id veio do navegador). Devolve o pedido atualizado.
 */
export async function syncGatewayPayment(
  gateway: PaymentGateway,
  paymentId: string,
  expectedOrderId?: string,
): Promise<Order | undefined> {
  const payment = await gateway.getPayment(paymentId)
  if (expectedOrderId && payment.orderId !== expectedOrderId) return undefined
  return exclusive(async () => {
    const doc = await loadOrders()
    const order = doc.orders.find(entry => entry.id === payment.orderId)
    if (!order) return undefined
    const result = applyGatewayPayment(order, payment)
    if (!result.changed) return order
    await saveOrders(replaceOrder(doc, result.order))
    if (result.approved) {
      await notifyStore({
        event: 'pagamento-aprovado',
        orderId: order.id,
        customer: order.customer.name,
        total: order.total,
      })
    }
    return result.order
  })
}

/* ---------- Avisos de estoque ("avise-me") ---------- */

export async function loadStockRequests(): Promise<StockRequestsDoc> {
  const storage = getStockRequestsStorage()
  if (storage.kind === 'none') return { requests: [] }
  const raw = await storage.read()
  if (!raw) return { requests: [] }
  const parsed = stockRequestsDocSchema.safeParse(JSON.parse(raw))
  if (parsed.success) return parsed.data
  console.error('[avisos] dados guardados fora do formato', parsed.error.issues[0])
  throw new StockRequestError(503, 'Os avisos guardados estão fora do formato. Fale com quem cuida do site.')
}

export const saveStockRequests = (doc: StockRequestsDoc) => getStockRequestsStorage().write(JSON.stringify(doc))

/* ---------- Resposta das server functions ---------- */

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

export async function attempt<T>(task: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await task()) }
  } catch (error) {
    if (
      error instanceof OrderError ||
      error instanceof CatalogError ||
      error instanceof StockRequestError ||
      (error instanceof Error && error.name === 'GatewayError')
    ) {
      return { ok: false, error: error.message }
    }
    console.error('[servidor] erro inesperado', error)
    return { ok: false, error: 'Erro inesperado no servidor.' }
  }
}
