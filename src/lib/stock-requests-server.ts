import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'
import { currentAdminSession } from '@/lib/admin-auth'
import { notifyStore } from '@/lib/catalog-deps.server'
import { getStockRequestsStorage, loadCatalog } from '@/lib/catalog-store'
import {
  attempt,
  createRateLimit,
  exclusive,
  loadOrders,
  loadStockRequests,
  saveStockRequests,
  type Result,
} from '@/lib/store-db.server'
import {
  addStockRequest,
  demandByProduct,
  markNotified,
  removeStockRequest,
  restockInputSchema,
  StockRequestError,
  type ProductDemand,
} from '@/lib/stock-requests'

/**
 * "Avise-me quando chegar" (bolo esgotado): o cliente registra nome e WhatsApp; a equipe vê a
 * procura no painel, pega o contato e marca quem já foi avisado.
 */

const rateLimited = createRateLimit(8, 10 * 60_000, 'aviso')

/** Público: o cliente pede para ser avisado quando o bolo esgotado voltar. */
export const requestRestock = createServerFn({ method: 'POST' })
  .validator(restockInputSchema)
  .handler(({ data }): Promise<Result<{ waiting: number }>> =>
    attempt(async () => {
      if (await rateLimited(getRequestIP({ xForwardedFor: true }) ?? 'desconhecido')) {
        throw new StockRequestError(429, 'Muitos pedidos seguidos. Tente de novo em alguns minutos.')
      }
      if (getStockRequestsStorage().kind === 'none') {
        throw new StockRequestError(503, 'Não deu para guardar agora. Fale com a Ondina pelo WhatsApp.')
      }
      const result = await exclusive(async () => {
        const [catalog, doc] = await Promise.all([loadCatalog(), loadStockRequests()])
        const added = addStockRequest(doc, catalog, data)
        await saveStockRequests(added.doc)
        return added
      })
      await notifyStore({
        event: 'aviso-estoque',
        productId: result.request.productId,
        productName: result.request.productName,
        customer: result.request.name,
        waiting: result.waiting,
      })
      return { waiting: result.waiting }
    }),
  )

async function requireMember(): Promise<string> {
  const session = await currentAdminSession()
  if (!session) throw new StockRequestError(401, 'Sessão expirada. Entre de novo.')
  return session.memberId
}

/** Painel: procura pelos bolos esgotados (avisos + pedidos pendentes), do mais procurado ao menos. */
export const listStockDemand = createServerFn({ method: 'GET' }).handler(
  (): Promise<Result<{ demand: ProductDemand[]; notifiedCount: number }>> =>
    attempt(async () => {
      await requireMember()
      const [catalog, requests, orders] = await Promise.all([
        loadCatalog(),
        loadStockRequests(),
        loadOrders().catch(() => ({ orders: [] })),
      ])
      return {
        demand: demandByProduct(catalog, requests.requests, orders.orders),
        notifiedCount: requests.requests.filter(entry => entry.status === 'avisado').length,
      }
    }),
)

export const markRestockNotified = createServerFn({ method: 'POST' })
  .validator(z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(200) }))
  .handler(({ data }): Promise<Result<object>> =>
    attempt(async () => {
      const by = await requireMember()
      await exclusive(async () => saveStockRequests(markNotified(await loadStockRequests(), data.ids, by)))
      return {}
    }),
  )

export const deleteRestockRequest = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1).max(40) }))
  .handler(({ data }): Promise<Result<object>> =>
    attempt(async () => {
      await requireMember()
      await exclusive(async () => saveStockRequests(removeStockRequest(await loadStockRequests(), data.id)))
      return {}
    }),
  )
