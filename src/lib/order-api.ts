import { CatalogError, type Catalog } from '@/lib/catalog'
import type { OrderStore } from '@/lib/order-store'
import { incomingOrderSchema, type OrderConfirmation, type SiteOrder } from '@/lib/orders'
import type { SoldOutNotifier } from '@/lib/stock-alert'
import { returnToStock, takeFromStock } from '@/lib/stock'

/**
 * Pedidos do site no painel:
 *   POST   /api/orders                   o site guarda o pedido (público, com limites)
 *   GET    /api/orders                   lista com as confirmações (só administração)
 *   POST   /api/orders/{id}/confirm      confirma e baixa o estoque (só administração)
 *   DELETE /api/orders/{id}/confirm      desfaz a confirmação e devolve o estoque
 * Escritas da administração exigem a mesma origem do site (proteção contra CSRF).
 */

export interface OrderApiDeps {
  store: OrderStore
  loadCatalog: () => Promise<Catalog>
  saveCatalog: (catalog: Catalog) => Promise<void>
  /** Quem está logado (memberId), ou undefined. */
  adminId: () => Promise<string | undefined>
  clientIp: () => string
  notifySoldOut?: SoldOutNotifier
  now?: () => Date
}

const MAX_BODY = 30_000
const RATE_LIMIT = 8
const RATE_WINDOW_MS = 10 * 60_000

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

const sameOrigin = (request: Request) => {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

/* Poucos pedidos por IP em 10 minutos: uma família pede uma ou duas vezes, robô não passa. */
const recent = new Map<string, number[]>()
function tooMany(ip: string, now: number): boolean {
  const times = (recent.get(ip) ?? []).filter(time => now - time < RATE_WINDOW_MS)
  if (times.length >= RATE_LIMIT) return true
  times.push(now)
  recent.set(ip, times)
  return false
}
export const resetOrderRateLimit = () => recent.clear()

async function recordOrder(request: Request, deps: OrderApiDeps): Promise<Response> {
  if (!sameOrigin(request)) throw new CatalogError(403, 'Origem não permitida.')
  if (deps.store.kind === 'none') return json(202, { data: { saved: false } })
  const raw = await request.text()
  if (raw.length > MAX_BODY) throw new CatalogError(400, 'Pedido grande demais.')
  if (tooMany(deps.clientIp(), (deps.now?.() ?? new Date()).getTime())) {
    throw new CatalogError(429, 'Muitos pedidos seguidos. O WhatsApp continua funcionando normalmente.')
  }
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new CatalogError(400, 'JSON inválido.')
  }
  const parsed = incomingOrderSchema.safeParse(body)
  if (!parsed.success) throw new CatalogError(400, 'Pedido fora do formato.')
  const existing = await deps.store.list()
  if (!existing.some(order => order.orderId === parsed.data.orderId)) await deps.store.add(parsed.data)
  return json(201, { data: { saved: true, orderId: parsed.data.orderId } })
}

export async function handleOrderRequest(
  request: Request,
  params: { id?: string | undefined; action?: 'confirm' | undefined },
  deps: OrderApiDeps,
): Promise<Response> {
  try {
    const method = request.method.toUpperCase()
    if (!params.id && method === 'POST') return await recordOrder(request, deps)

    const by = await deps.adminId()
    if (!by) throw new CatalogError(401, 'Entre na área da equipe (/admin) para ver os pedidos.')

    if (!params.id && method === 'GET') {
      const [orders, confirmed] = await Promise.all([deps.store.list(), deps.store.confirmations()])
      const data: SiteOrder[] = orders.map(order => {
        const confirmation = confirmed[order.orderId]
        return confirmation ? { ...order, confirmation } : order
      })
      return json(200, { data: { storage: deps.store.kind, orders: data } })
    }

    if (!params.id || params.action !== 'confirm' || (method !== 'POST' && method !== 'DELETE')) {
      return json(405, { error: 'Método não permitido nesta rota.' })
    }
    if (!sameOrigin(request)) throw new CatalogError(403, 'Origem não permitida.')

    const [orders, confirmed] = await Promise.all([deps.store.list(), deps.store.confirmations()])
    const order = orders.find(entry => entry.orderId === params.id)
    if (!order) throw new CatalogError(404, 'Pedido não encontrado.')
    const current = confirmed[order.orderId]
    const now = deps.now?.() ?? new Date()

    if (method === 'POST') {
      if (current) throw new CatalogError(409, 'Esse pedido já foi confirmado.')
      const result = takeFromStock(await deps.loadCatalog(), order.items, now)
      if (result.changes.length) await deps.saveCatalog(result.catalog)
      const confirmation: OrderConfirmation = { at: now.toISOString(), by, stock: result.changes }
      await deps.store.setConfirmation(order.orderId, confirmation)
      if (result.soldOut.length) await deps.notifySoldOut?.(result.soldOut, by)
      return json(200, { data: { confirmation, soldOut: result.soldOut } })
    }

    if (!current) throw new CatalogError(409, 'Esse pedido não está confirmado.')
    if (current.stock.length) await deps.saveCatalog(returnToStock(await deps.loadCatalog(), current.stock, now))
    await deps.store.setConfirmation(order.orderId, null)
    return json(200, { data: { restored: current.stock } })
  } catch (error) {
    if (error instanceof CatalogError) {
      return json(error.status, { error: error.message, ...(error.issues ? { issues: error.issues } : {}) })
    }
    console.error('[pedidos] erro inesperado', error)
    return json(500, { error: 'Erro inesperado no servidor.' })
  }
}
