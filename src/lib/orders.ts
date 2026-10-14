import { z } from 'zod'

/**
 * Pedidos guardados no n8n, lidos pelo painel /admin (sempre no servidor).
 * O n8n devolve o mesmo JSON que o site enviou (OrderPayload em src/lib/whatsapp.ts),
 * seja direto, seja como texto numa coluna `payload` (ex.: Google Sheets).
 */

const itemSchema = z.object({
  /** Só nos bolos prontos (pedidos a partir do estoque): usado para baixar o estoque. */
  productId: z.string().max(60).optional(),
  name: z.string(),
  quantity: z.number(),
  subtotal: z.number(),
  outOfStock: z.boolean().optional(),
  layers: z.object({ base: z.string(), recheio: z.string(), cobertura: z.string(), decoracao: z.string() }).optional(),
})

export const storedOrderSchema = z.object({
  orderId: z.string(),
  createdAt: z.string(),
  /** Pedidos antigos não têm status: contam como "novo". */
  status: z.enum(['novo', 'pendente']).optional(),
  customer: z.object({
    name: z.string(),
    fulfillment: z.enum(['entrega', 'retirada']),
    address: z.string(),
  }),
  payment: z.object({ label: z.string() }),
  items: z.array(itemSchema),
  total: z.number(),
})

export type StoredOrder = z.infer<typeof storedOrderSchema>

/**
 * Pedido recebido do próprio site (POST /api/orders): o mesmo formato, com limites de tamanho,
 * porque a rota é pública. Campos extras são descartados.
 */
const text = (max: number) => z.string().max(max)
export const incomingOrderSchema = z.object({
  orderId: z.string().regex(/^OB-[0-9A-Z]{4,12}-[0-9A-Z]{2}$/),
  createdAt: z.string().datetime(),
  status: z.enum(['novo', 'pendente']).optional(),
  customer: z.object({ name: text(60), fulfillment: z.enum(['entrega', 'retirada']), address: text(400) }),
  payment: z.object({ label: text(80) }),
  items: z
    .array(
      z.object({
        productId: z.string().max(60).optional(),
        name: text(80),
        quantity: z.number().int().min(1).max(100),
        subtotal: z.number().min(0).max(100_000),
        outOfStock: z.boolean().optional(),
        layers: z.object({ base: text(80), recheio: text(80), cobertura: text(80), decoracao: text(80) }).optional(),
      }),
    )
    .min(1)
    .max(30),
  total: z.number().min(0).max(1_000_000),
})

/** Baixa de estoque feita ao confirmar um pedido no painel. */
export interface StockChange {
  id: string
  name: string
  from: number
  to: number
}

/** Pedido confirmado no painel (por quem, quando e o que saiu do estoque). */
export interface OrderConfirmation {
  at: string
  by: string
  stock: StockChange[]
}

export type SiteOrder = StoredOrder & { confirmation?: OrderConfirmation }

export type OrdersResult =
  | { status: 'not-configured' }
  | { status: 'error'; message: string }
  | { status: 'ok'; orders: StoredOrder[]; skipped: number }

const MAX_ORDERS = 50

/** Aceita `[...]`, `{ orders: [...] }`, `{ data: [...] }` e linhas com `payload` em texto. */
export function parseOrders(body: unknown): { orders: StoredOrder[]; skipped: number } {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? ((body as Record<string, unknown>)['orders'] ?? (body as Record<string, unknown>)['data'])
      : undefined
  if (!Array.isArray(list)) return { orders: [], skipped: 0 }

  const orders: StoredOrder[] = []
  let skipped = 0
  for (const entry of list) {
    let candidate: unknown = entry
    if (entry && typeof entry === 'object' && 'payload' in entry) {
      const payload = (entry as { payload: unknown }).payload
      try {
        candidate = typeof payload === 'string' ? JSON.parse(payload) : payload
      } catch {
        candidate = undefined
      }
    }
    const parsed = storedOrderSchema.safeParse(candidate)
    if (parsed.success) orders.push(parsed.data)
    else skipped++
  }

  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { orders: orders.slice(0, MAX_ORDERS), skipped }
}

/** Busca a lista no webhook de leitura do n8n, com chave e tempo limite. */
export async function fetchOrdersFromN8n(
  config: { url: string; key?: string | undefined },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<OrdersResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(config.url, {
      headers: { Accept: 'application/json', ...(config.key ? { 'x-ondina-key': config.key } : {}) },
      signal: controller.signal,
    })
    if (!response.ok) return { status: 'error', message: `O n8n respondeu ${response.status}.` }
    const { orders, skipped } = parseOrders(await response.json())
    return { status: 'ok', orders, skipped }
  } catch (error) {
    // DOMException nem sempre é `instanceof Error` (depende do ambiente): confere pelo nome.
    const aborted = (error as { name?: unknown } | null)?.name === 'AbortError'
    return { status: 'error', message: aborted ? 'O n8n demorou para responder.' : 'Não foi possível falar com o n8n.' }
  } finally {
    clearTimeout(timer)
  }
}
