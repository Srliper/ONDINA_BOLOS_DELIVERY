import { createServerFn } from '@tanstack/react-start'
import { getRequestIP, getRequestUrl } from '@tanstack/react-start/server'
import { z } from 'zod'
import { currentAdminSession } from '@/lib/admin-auth'
import type { Catalog } from '@/lib/catalog'
import { notifyStore } from '@/lib/catalog-deps.server'
import { getOrdersStorage, loadCatalog } from '@/lib/catalog-store'
import { listLegacyOrders } from '@/lib/order-store'
import type { LegacyOrder } from '@/lib/orders'
import { configuredGateway } from '@/lib/payment-gateway'
import type { SoldOutProduct } from '@/lib/stock-alert'
import {
  attempt,
  createRateLimit,
  exclusive,
  loadOrders,
  loadStockRequests,
  persist,
  saveOrders,
  sweepExpired,
  syncGatewayPayment,
  type Result,
} from '@/lib/store-db.server'
import {
  addMessage,
  addOrder,
  canPayOnline,
  changeStatus,
  confirmPayment,
  createOrder,
  expireUnpaid,
  findOrder,
  markRead,
  messageTextSchema,
  ORDER_STATUSES,
  OrderError,
  ordersPulse,
  placeOrderSchema,
  replaceOrder,
  revalidateStock,
  tokenMatches,
  trackedView,
  unreadForCustomer,
  withPreference,
  type Order,
  type OrdersPulse,
  type Shortage,
  type TrackedOrder,
} from '@/lib/order-flow'

/**
 * Pedidos no servidor: o site registra cada pedido aqui (conferindo o estoque), o cliente acompanha
 * e conversa pela página do pedido, o gateway confirma o pagamento online e o painel /admin lista,
 * muda o status e responde. Pedido e estoque são gravados juntos, um de cada vez.
 */

/* ---------- Site: registrar o pedido ---------- */

const orderRateLimited = createRateLimit(6, 10 * 60_000, 'pedido')
const messageRateLimited = createRateLimit(20, 10 * 60_000, 'mensagem')
const clientIp = () => getRequestIP({ xForwardedFor: true }) ?? 'desconhecido'

export type PlaceOrderResult = Result<{
  orderId: string
  status: Order['status']
  shortages: Shortage[]
  total: number
  /** Chave da página de acompanhamento (/pedido/<id>?t=…). */
  accessToken: string
}>

/** Chamado ao finalizar: confere o estoque, reserva o que tiver e grava o pedido. */
export const placeOrder = createServerFn({ method: 'POST' })
  .validator(placeOrderSchema)
  .handler(({ data }): Promise<PlaceOrderResult> =>
    attempt(async () => {
      if (await orderRateLimited(clientIp())) {
        throw new OrderError(429, 'Muitos pedidos seguidos. Tente de novo em alguns minutos.')
      }
      if (data.payment.method === 'online' && !configuredGateway()) {
        throw new OrderError(409, 'O pagamento pelo site está indisponível agora. Envie o pedido pelo WhatsApp.')
      }
      const created = await exclusive(async () => {
        const [catalog, doc] = await Promise.all([loadCatalog(), loadOrders()])
        // Antes de conferir o estoque, devolve o que estava preso em pedidos online não pagos.
        const swept = expireUnpaid(doc, catalog)
        const result = createOrder(swept.catalog, data)
        await persist(addOrder(swept.doc, result.order), catalog, result.catalog)
        return result.order
      })
      if (created.channel === 'site') {
        await notifyStore({
          event: 'pedido-novo',
          orderId: created.id,
          customer: created.customer.name,
          total: created.total,
          status: created.status,
          channel: created.channel,
        })
      }
      const { id, status, shortages, total, accessToken = '' } = created
      return { orderId: id, status, shortages, total, accessToken }
    }),
  )

/** O que o checkout pode oferecer (o pagamento online só aparece com o gateway configurado). */
export const getCheckoutOptions = createServerFn({ method: 'GET' }).handler(async () => ({
  onlinePayment: Boolean(configuredGateway()) && getOrdersStorage().kind !== 'none',
}))

/* ---------- Página do pedido (cliente) ---------- */

const trackSchema = z.object({
  id: z.string().min(1).max(40),
  token: z.string().regex(/^[a-f0-9]{32}$/),
})

/** Endereço público do site (volta do pagamento e notificações do gateway). */
const siteOrigin = () =>
  (process.env['SITE_URL'] || process.env['VITE_SITE_URL'] || getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin).replace(/\/+$/, '')

/** Mesma resposta para pedido inexistente e chave errada: não dá para adivinhar pedidos. */
const NOT_FOUND = 'Pedido não encontrado. Confira o link que você recebeu.'

async function trackedOrder(id: string, token: string): Promise<Order> {
  const order = (await sweepExpired()).orders.find(entry => entry.id === id)
  if (!order || !tokenMatches(order, token)) throw new OrderError(404, NOT_FOUND)
  return order
}

/**
 * Dados da página do pedido. Com paymentId (volta do Mercado Pago), confere o pagamento direto
 * na API deles antes de responder. Ao abrir, as mensagens da loja contam como lidas.
 */
export const getTrackedOrder = createServerFn({ method: 'POST' })
  .validator(trackSchema.extend({ paymentId: z.string().regex(/^\d{1,20}$/).optional() }))
  .handler(({ data }): Promise<Result<{ order: TrackedOrder }>> =>
    attempt(async () => {
      let order = await trackedOrder(data.id, data.token)
      const gateway = configuredGateway()
      if (data.paymentId && gateway && !order.paid) {
        try {
          order = (await syncGatewayPayment(gateway, data.paymentId, order.id)) ?? order
        } catch (error) {
          // O webhook confirma depois; a página mostra o status atual.
          console.error('[pagamento] não deu para conferir o pagamento na volta', error)
        }
      }
      if (unreadForCustomer(order) > 0) {
        order = await exclusive(async () => {
          const doc = await loadOrders()
          const updated = markRead(findOrder(doc, order.id), 'cliente')
          await saveOrders(replaceOrder(doc, updated))
          return updated
        })
      }
      return { order: trackedView(order, new Date()) }
    }),
  )

/** "Pagar agora": cria o pagamento no Mercado Pago e devolve o link da página segura deles. */
export const startOrderPayment = createServerFn({ method: 'POST' })
  .validator(trackSchema)
  .handler(({ data }): Promise<Result<{ url: string }>> =>
    attempt(async () => {
      const gateway = configuredGateway()
      if (!gateway) throw new OrderError(503, 'O pagamento online está indisponível agora. Fale com a Ondina pelo WhatsApp.')
      const order = await trackedOrder(data.id, data.token)
      if (!canPayOnline(order, new Date())) {
        throw new OrderError(
          409,
          order.status === 'aguardando_pagamento' && order.payment.method === 'online' && !order.paid
            ? 'O prazo para pagar este pedido acabou. Faça um pedido novo ou fale com a Ondina.'
            : order.paid
            ? 'Este pedido já está pago.'
            : order.status === 'pendente'
              ? 'O pedido está aguardando estoque: o pagamento abre quando a Ondina confirmar.'
              : 'Este pedido não está aguardando pagamento online.',
        )
      }
      const checkout = await gateway.createCheckout(order, siteOrigin())
      await exclusive(async () => {
        const doc = await loadOrders()
        await saveOrders(replaceOrder(doc, withPreference(findOrder(doc, order.id), checkout.preferenceId)))
      })
      return { url: checkout.url }
    }),
  )

/** Mensagem do cliente para a loja, pela página do pedido. */
export const sendCustomerMessage = createServerFn({ method: 'POST' })
  .validator(trackSchema.extend({ text: messageTextSchema }))
  .handler(({ data }): Promise<Result<{ order: TrackedOrder }>> =>
    attempt(async () => {
      if (await messageRateLimited(clientIp())) throw new OrderError(429, 'Muitas mensagens seguidas. Espere alguns minutos.')
      const order = await exclusive(async () => {
        const doc = await loadOrders()
        const current = doc.orders.find(entry => entry.id === data.id)
        if (!current || !tokenMatches(current, data.token)) throw new OrderError(404, NOT_FOUND)
        const updated = addMessage(current, 'cliente', data.text)
        await saveOrders(replaceOrder(doc, updated))
        return updated
      })
      await notifyStore({ event: 'mensagem-cliente', orderId: order.id, customer: order.customer.name, text: data.text })
      return { order: trackedView(order, new Date()) }
    }),
  )

/* ---------- Painel ---------- */

async function requireMember(): Promise<string> {
  const session = await currentAdminSession()
  if (!session) throw new OrderError(401, 'Sessão expirada. Entre de novo.')
  return session.memberId
}

export const listOrders = createServerFn({ method: 'GET' }).handler(
  (): Promise<Result<{ orders: Order[]; legacy: LegacyOrder[]; storage: 'upstash' | 'file' | 'none' }>> =>
    attempt(async () => {
      await requireMember()
      const storage = getOrdersStorage().kind
      const [orders, legacy] = await Promise.all([
        storage === 'none' ? [] : sweepExpired().then(doc => doc.orders),
        listLegacyOrders(),
      ])
      return { orders, legacy, storage }
    }),
)

/** Resumo leve para os avisos do painel (consultado a cada poucos segundos). */
export const adminPulse = createServerFn({ method: 'GET' }).handler(
  (): Promise<Result<{ pulse: OrdersPulse; restockWaiting: number; restockIds: string[] }>> =>
    attempt(async () => {
      await requireMember()
      const empty = ordersPulse([])
      if (getOrdersStorage().kind === 'none') return { pulse: empty, restockWaiting: 0, restockIds: [] }
      const [doc, requests] = await Promise.all([sweepExpired(), loadStockRequests()])
      const waiting = requests.requests.filter(entry => entry.status === 'aguardando')
      return { pulse: ordersPulse(doc.orders), restockWaiting: waiting.length, restockIds: waiting.map(entry => entry.id) }
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
      const soldOut: SoldOutProduct[] = await persist(replaceOrder(doc, result.order), catalog, result.catalog, by)
      return { order: result.order, released: result.released ?? false, soldOut }
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

/** Resposta da loja na conversa do pedido (o cliente vê na página do pedido). */
export const sendStoreMessage = createServerFn({ method: 'POST' })
  .validator(idSchema.extend({ text: messageTextSchema }))
  .handler(({ data }) =>
    updateOrder(data.id, (order, catalog, by) => ({ order: addMessage(order, 'loja', data.text, by), catalog })),
  )

/** A equipe abriu a conversa: as mensagens do cliente contam como lidas. */
export const markOrderRead = createServerFn({ method: 'POST' })
  .validator(idSchema)
  .handler(({ data }) => updateOrder(data.id, (order, catalog) => ({ order: markRead(order, 'loja'), catalog })))
