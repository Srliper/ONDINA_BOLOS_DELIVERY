import { isEphemeralServer, localDataDir, upstashCommand, upstashConfig } from '@/lib/catalog-store'
import { storedOrderSchema, type LegacyOrder, type OrderConfirmation } from '@/lib/orders'

/**
 * Leitura dos pedidos no formato antigo (só no servidor), onde a versão anterior do site os
 * guardava: lista `ondina:orders` + hash `ondina:orders:confirmed` no Upstash, ou `.data/orders.json`.
 * Nada é gravado aqui: os pedidos novos ficam em getOrdersStorage (src/lib/catalog-store.ts).
 */

const LIST = 'ondina:orders'
const CONFIRMED = 'ondina:orders:confirmed'
const MAX_LEGACY = 300

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const toOrders = (entries: unknown[], confirmed: Record<string, OrderConfirmation>): LegacyOrder[] =>
  entries.flatMap(entry => {
    const parsed = storedOrderSchema.safeParse(parseJson(entry))
    if (!parsed.success) return []
    const confirmation = confirmed[parsed.data.orderId]
    return [confirmation ? { ...parsed.data, confirmation } : parsed.data]
  })

async function fromUpstash(url: string, token: string): Promise<LegacyOrder[]> {
  const command = upstashCommand(url, token)
  const [list, hash] = await Promise.all([
    command(['LRANGE', LIST, '0', String(MAX_LEGACY - 1)]),
    command(['HGETALL', CONFIRMED]),
  ])
  const confirmed: Record<string, OrderConfirmation> = {}
  // O REST do Upstash devolve [campo, valor, campo, valor, ...].
  if (Array.isArray(hash)) {
    for (let i = 0; i + 1 < hash.length; i += 2) {
      const value = parseJson(hash[i + 1]) as OrderConfirmation | undefined
      if (typeof hash[i] === 'string' && value) confirmed[hash[i] as string] = value
    }
  }
  return toOrders(Array.isArray(list) ? list : [], confirmed)
}

async function fromFile(path: string): Promise<LegacyOrder[]> {
  const { readFile } = await import('node:fs/promises')
  try {
    const data = JSON.parse(await readFile(path, 'utf8')) as {
      orders?: unknown[]
      confirmed?: Record<string, OrderConfirmation>
    }
    return toOrders(data.orders ?? [], data.confirmed ?? {})
  } catch {
    return []
  }
}

/** Pedidos antigos (mais novos primeiro); vazio se não houver nenhum ou se o banco não responder. */
export async function listLegacyOrders(): Promise<LegacyOrder[]> {
  try {
    const upstash = upstashConfig()
    if (upstash) return await fromUpstash(upstash.url, upstash.token)
    if (isEphemeralServer()) return []
    return await fromFile(`${localDataDir()}orders.json`)
  } catch (error) {
    console.error('[pedidos antigos] não foi possível ler', error)
    return []
  }
}
