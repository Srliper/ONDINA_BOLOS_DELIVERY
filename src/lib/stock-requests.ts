import { z } from 'zod'
import type { Catalog } from '@/lib/catalog'
import type { Order } from '@/lib/order-flow'
import { phoneSchema } from '@/lib/phone'

/**
 * "Avise-me quando chegar": com o bolo esgotado (estoque 0), o cliente deixa nome e WhatsApp.
 * A equipe vê no painel quantos estão esperando cada bolo (a demanda do esgotado), pega o contato
 * e avisa — pelo WhatsApp ou marcando como avisado. Funções puras; o banco fica em
 * src/lib/stock-requests-server.ts.
 */

export const restockInputSchema = z.object({
  productId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome.')
    .max(60, 'Use no máximo 60 caracteres.')
    .regex(/^[A-Za-zÀ-ÿ' .-]+$/, 'Use só letras no nome.'),
  phone: phoneSchema,
  /** Quanto o cliente quer (kg ou unidades), opcional. */
  quantity: z.number().int().min(1).max(50).optional(),
})

export type RestockInput = z.input<typeof restockInputSchema>

const requestSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  name: z.string(),
  phone: z.string(),
  quantity: z.number().optional(),
  createdAt: z.string(),
  status: z.enum(['aguardando', 'avisado']),
  notifiedAt: z.string().optional(),
  notifiedBy: z.string().optional(),
})

export type StockRequest = z.infer<typeof requestSchema>

export const stockRequestsDocSchema = z.object({ requests: z.array(requestSchema) })
export type StockRequestsDoc = z.infer<typeof stockRequestsDocSchema>

export const MAX_STOCK_REQUESTS = 1000

export class StockRequestError extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409 | 429 | 503,
    message: string,
  ) {
    super(message)
    this.name = 'StockRequestError'
  }
}

const requestId = (now: Date) =>
  `AV-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`

/**
 * Registra o pedido de aviso. Só vale para bolo esgotado; o mesmo WhatsApp esperando o mesmo
 * bolo não duplica (atualiza nome e quantidade).
 */
export function addStockRequest(
  doc: StockRequestsDoc,
  catalog: Catalog,
  input: z.output<typeof restockInputSchema>,
  now = new Date(),
): { doc: StockRequestsDoc; request: StockRequest; waiting: number } {
  const product = catalog.products.find(entry => entry.id === input.productId)
  if (!product) throw new StockRequestError(404, 'Esse bolo saiu do cardápio.')
  if (product.stock === null || product.stock > 0) {
    throw new StockRequestError(409, 'Esse bolo está disponível agora: é só adicionar ao carrinho.')
  }
  const existing = doc.requests.find(
    entry => entry.status === 'aguardando' && entry.productId === product.id && entry.phone === input.phone,
  )
  const request: StockRequest = existing
    ? { ...existing, name: input.name, ...(input.quantity ? { quantity: input.quantity } : {}) }
    : {
        id: requestId(now),
        productId: product.id,
        productName: product.name,
        name: input.name,
        phone: input.phone,
        ...(input.quantity ? { quantity: input.quantity } : {}),
        createdAt: now.toISOString(),
        status: 'aguardando',
      }
  let requests: StockRequest[] = existing
    ? doc.requests.map(entry => (entry.id === existing.id ? request : entry))
    : [request, ...doc.requests]
  // Limite do banco: saem primeiro os já avisados mais antigos.
  while (requests.length > MAX_STOCK_REQUESTS) {
    let index = requests.length - 1
    while (index > 0 && requests[index]!.status !== 'avisado') index--
    requests = requests.filter((_, position) => position !== (index > 0 ? index : requests.length - 1))
  }
  const waiting = requests.filter(entry => entry.status === 'aguardando' && entry.productId === product.id).length
  return { doc: { requests }, request, waiting }
}

export function markNotified(doc: StockRequestsDoc, ids: readonly string[], by: string, now = new Date()): StockRequestsDoc {
  const set = new Set(ids)
  if (!doc.requests.some(entry => set.has(entry.id))) throw new StockRequestError(404, 'Aviso não encontrado.')
  return {
    requests: doc.requests.map(entry =>
      set.has(entry.id) && entry.status === 'aguardando'
        ? { ...entry, status: 'avisado', notifiedAt: now.toISOString(), notifiedBy: by }
        : entry,
    ),
  }
}

export function removeStockRequest(doc: StockRequestsDoc, id: string): StockRequestsDoc {
  if (!doc.requests.some(entry => entry.id === id)) throw new StockRequestError(404, 'Aviso não encontrado.')
  return { requests: doc.requests.filter(entry => entry.id !== id) }
}

/** Procura por um bolo: quem pediu aviso e os pedidos PENDENTES que esperam por ele. */
export interface ProductDemand {
  productId: string
  productName: string
  /** Estoque atual (null = sem controle; o bolo pode ter voltado). */
  stock: number | null
  unit: 'kg' | 'un'
  waiting: StockRequest[]
  /** Pedidos PENDENTES com falta deste bolo. */
  pendingOrders: { id: string; name: string; phone?: string | undefined; requested: number }[]
  /** Quanto falta no total (kg ou unidades) para atender todo mundo que já disse quanto quer. */
  requested: number
}

/** Demanda dos esgotados, do bolo mais procurado para o menos. */
export function demandByProduct(catalog: Catalog, requests: readonly StockRequest[], orders: readonly Order[]): ProductDemand[] {
  const map = new Map<string, ProductDemand>()
  const entry = (productId: string, fallbackName: string) => {
    let demand = map.get(productId)
    if (!demand) {
      const product = catalog.products.find(item => item.id === productId)
      demand = {
        productId,
        productName: product?.name ?? fallbackName,
        stock: product ? product.stock : 0,
        unit: product?.unit ?? 'kg',
        waiting: [],
        pendingOrders: [],
        requested: 0,
      }
      map.set(productId, demand)
    }
    return demand
  }
  for (const request of requests) {
    if (request.status !== 'aguardando') continue
    const demand = entry(request.productId, request.productName)
    demand.waiting.push(request)
    demand.requested += request.quantity ?? 0
  }
  for (const order of orders) {
    if (order.status !== 'pendente') continue
    for (const shortage of order.shortages) {
      const demand = entry(shortage.productId, shortage.name)
      demand.pendingOrders.push({
        id: order.id,
        name: order.customer.name,
        phone: order.customer.phone,
        requested: shortage.requested,
      })
      demand.requested += shortage.requested
    }
  }
  return [...map.values()].sort(
    (a, b) => b.waiting.length + b.pendingOrders.length - (a.waiting.length + a.pendingOrders.length),
  )
}

/** Mensagem pronta para avisar o cliente que o bolo voltou. */
export const restockMessage = (request: Pick<StockRequest, 'name' | 'productName'>, siteUrl: string) =>
  `Oi, ${request.name.split(' ')[0]}! Aqui é da Ondina Bolos 🍰 O ${request.productName} que você pediu para avisar chegou! Peça pelo site (${siteUrl}) ou responda aqui que a gente separa para você.`
