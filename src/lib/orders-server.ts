import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'
import { currentAdminSession } from '@/lib/admin-auth'
import { CatalogError, type Catalog } from '@/lib/catalog'
import { getOrdersStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import {
  addOrder,
  changeStatus,
  confirmPayment,
  createOrder,
  findOrder,
  ORDER_STATUSES,
  OrderError,
  ordersDocSchema,
  placeOrderSchema,
  replaceOrder,
  revalidateStock,
  type Order,
  type OrdersDoc,
  type Shortage,
} from '@/lib/order-flow'

/**
 * Pedidos no servidor: o site registra cada pedido aqui (conferindo o estoque) e o painel
 * /admin lista e muda o status. Pedido e estoque são gravados juntos, um de cada vez.
 */

/* ---------- Banco ---------- */

async function loadOrders(): Promise<OrdersDoc> {
  const raw = await getOrdersStorage().read()
  if (!raw) return { orders: [] }
  const parsed = ordersDocSchema.safeParse(JSON.parse(raw))
  if (parsed.success) return parsed.data
  // Não sobrescreve um banco com defeito: melhor parar e avisar do que apagar pedidos.
  console.error('[pedidos] dados guardados fora do formato', parsed.error.issues[0])
  throw new OrderError(503, 'Os pedidos guardados estão fora do formato. Fale com quem cuida do site.')
}

const saveOrders = (doc: OrdersDoc) => getOrdersStorage().write(JSON.stringify(doc))

/** Grava o pedido primeiro: se o estoque falhar depois, o pedido não se perde. */
async function persist(doc: OrdersDoc, before: Catalog, after: Catalog) {
  await saveOrders(doc)
  if (after !== before) await saveCatalog(after)
}

/** Uma escrita de cada vez nesta instância (ler → mudar → gravar sem atropelar outra). */
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

async function attempt<T>(task: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await task()) }
  } catch (error) {
    if (error instanceof OrderError || error instanceof CatalogError) return { ok: false, error: error.message }
    console.error('[pedidos] erro inesperado', error)
    return { ok: false, error: 'Erro inesperado no servidor.' }
  }
}

/* ---------- Site: registrar o pedido ---------- */

/** Limite simples contra abuso: pedidos por IP numa janela de tempo (por instância). */
const recentByIp = new Map<string, number[]>()
const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX = 6

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (recentByIp.get(ip) ?? []).filter(at => now - at < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) return true
  recent.push(now)
  recentByIp.set(ip, recent)
  return false
}

export type PlaceOrderResult = Result<{ orderId: string; status: Order['status']; shortages: Shortage[]; total: number }>

/** Chamado ao finalizar: confere o estoque, reserva o que tiver e grava o pedido. */
export const placeOrder = createServerFn({ method: 'POST' })
  .validator(placeOrderSchema)
  .handler(({ data }): Promise<PlaceOrderResult> =>
    attempt(() =>
      exclusive(async () => {
        if (rateLimited(getRequestIP({ xForwardedFor: true }) ?? 'desconhecido')) {
          throw new OrderError(429, 'Muitos pedidos seguidos. Tente de novo em alguns minutos.')
        }
        const [catalog, doc] = await Promise.all([loadCatalog(), loadOrders()])
        const created = createOrder(catalog, data)
        await persist(addOrder(doc, created.order), catalog, created.catalog)
        const { id, status, shortages, total } = created.order
        return { orderId: id, status, shortages, total }
      }),
    ),
  )

/* ---------- Painel ---------- */

async function requireMember(): Promise<string> {
  const session = await currentAdminSession()
  if (!session) throw new OrderError(401, 'Sessão expirada. Entre de novo.')
  return session.memberId
}

export const listOrders = createServerFn({ method: 'GET' }).handler(
  (): Promise<Result<{ orders: Order[]; storage: 'upstash' | 'file' | 'none' }>> =>
    attempt(async () => {
      await requireMember()
      const storage = getOrdersStorage().kind
      return { orders: storage === 'none' ? [] : (await loadOrders()).orders, storage }
    }),
)

/** Lê pedido e catálogo, aplica a ação e grava os dois. */
const updateOrder = (
  id: string,
  action: (order: Order, catalog: Catalog, by: string) => { order: Order; catalog: Catalog; released?: boolean },
) =>
  attempt(async () => {
    const by = await requireMember()
    return exclusive(async () => {
      const [catalog, doc] = await Promise.all([loadCatalog(), loadOrders()])
      const result = action(findOrder(doc, id), catalog, by)
      await persist(replaceOrder(doc, result.order), catalog, result.catalog)
      return { order: result.order, released: result.released ?? false }
    })
  })

const idSchema = z.object({ id: z.string().min(1).max(40) })

export const setOrderStatus = createServerFn({ method: 'POST' })
  .validator(idSchema.extend({ status: z.enum(ORDER_STATUSES) }))
  .handler(({ data }) => updateOrder(data.id, (order, catalog, by) => changeStatus(order, catalog, data.status, by)))

export const confirmOrderPayment = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(({ data }) => updateOrder(data.id, (order, catalog, by) => ({ order: confirmPayment(order, by), catalog })))

export const recheckOrderStock = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(({ data }) => updateOrder(data.id, (order, catalog, by) => revalidateStock(order, catalog, by)))
