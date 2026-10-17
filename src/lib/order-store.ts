import { isEphemeralServer, localDataDir, upstashCommand, upstashConfig } from '@/lib/catalog-store'
import type { OrderConfirmation, StoredOrder } from '@/lib/orders'

/**
 * Pedidos do site guardados para o painel /admin (só no servidor), no mesmo banco do cardápio:
 * - Upstash: lista `ondina:orders` (mais novo primeiro, guarda os últimos MAX_ORDERS) e o hash
 *   `ondina:orders:confirmed` (pedido → confirmação). Cada pedido entra com um LPUSH, então dois
 *   pedidos ao mesmo tempo não se atropelam;
 * - no computador: `.data/orders.json`.
 */

export const MAX_ORDERS = 300

export interface OrderStore {
  kind: 'upstash' | 'file' | 'none'
  add(order: StoredOrder): Promise<void>
  list(): Promise<StoredOrder[]>
  confirmations(): Promise<Record<string, OrderConfirmation>>
  setConfirmation(orderId: string, confirmation: OrderConfirmation | null): Promise<void>
}

const LIST = 'ondina:orders'
const CONFIRMED = 'ondina:orders:confirmed'

const parse = <T>(value: unknown): T | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

export function createUpstashOrderStore(url: string, token: string, fetchImpl: typeof fetch = fetch): OrderStore {
  const command = upstashCommand(url, token, fetchImpl)
  return {
    kind: 'upstash',
    add: async order => {
      await command(['LPUSH', LIST, JSON.stringify(order)])
      await command(['LTRIM', LIST, '0', String(MAX_ORDERS - 1)])
    },
    list: async () => {
      const result = await command(['LRANGE', LIST, '0', String(MAX_ORDERS - 1)])
      return Array.isArray(result) ? result.flatMap(entry => parse<StoredOrder>(entry) ?? []) : []
    },
    confirmations: async () => {
      const result = await command(['HGETALL', CONFIRMED])
      const out: Record<string, OrderConfirmation> = {}
      // O REST do Upstash devolve [campo, valor, campo, valor, ...].
      if (Array.isArray(result)) {
        for (let i = 0; i + 1 < result.length; i += 2) {
          const value = parse<OrderConfirmation>(result[i + 1])
          if (typeof result[i] === 'string' && value) out[result[i] as string] = value
        }
      }
      return out
    },
    setConfirmation: async (orderId, confirmation) => {
      await command(confirmation ? ['HSET', CONFIRMED, orderId, JSON.stringify(confirmation)] : ['HDEL', CONFIRMED, orderId])
    },
  }
}

interface OrdersFile {
  orders: StoredOrder[]
  confirmed: Record<string, OrderConfirmation>
}

function fileOrderStore(path: string): OrderStore {
  const read = async (): Promise<OrdersFile> => {
    const { readFile } = await import('node:fs/promises')
    try {
      const data = JSON.parse(await readFile(path, 'utf8')) as Partial<OrdersFile>
      return { orders: data.orders ?? [], confirmed: data.confirmed ?? {} }
    } catch {
      return { orders: [], confirmed: {} }
    }
  }
  const write = async (data: OrdersFile) => {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(data), 'utf8')
  }
  return {
    kind: 'file',
    add: async order => {
      const data = await read()
      await write({ ...data, orders: [order, ...data.orders].slice(0, MAX_ORDERS) })
    },
    list: async () => (await read()).orders,
    confirmations: async () => (await read()).confirmed,
    setConfirmation: async (orderId, confirmation) => {
      const data = await read()
      const confirmed = { ...data.confirmed }
      if (confirmation) confirmed[orderId] = confirmation
      else delete confirmed[orderId]
      await write({ ...data, confirmed })
    },
  }
}

const noOrderStore: OrderStore = {
  kind: 'none',
  add: async () => {},
  list: async () => [],
  confirmations: async () => ({}),
  setConfirmation: async () => {},
}

export function getOrderStore(): OrderStore {
  const upstash = upstashConfig()
  if (upstash) return createUpstashOrderStore(upstash.url, upstash.token)
  if (isEphemeralServer()) return noOrderStore
  return fileOrderStore(`${localDataDir()}orders.json`)
}
