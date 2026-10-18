import { describe, expect, it, vi } from 'vitest'
import { seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import {
  applyGatewayPayment,
  canPayOnline,
  createOrder,
  expireUnpaid,
  isPaymentExpired,
  paymentDeadline,
  PAYMENT_GRACE_MS,
  PAYMENT_WINDOW_MS,
  placeOrderSchema,
  revalidateStock,
  trackedView,
  type PlaceOrderInput,
} from '@/lib/order-flow'
import { buildPreference } from '@/lib/payment-gateway'
import { BusyError, createRateLimit, createWriteLock, type RedisCommand } from '@/lib/redis-guard.server'

const NOW = new Date('2026-10-18T12:00:00Z')
const at = (ms: number) => new Date(NOW.getTime() + ms)

function catalogWithStock(stock: Record<string, number | null>): Catalog {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock))
    catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  return catalog
}
const stockOf = (catalog: Catalog, id: string) => catalog.products.find(product => product.id === id)?.stock

const input = (method: PlaceOrderInput['payment']['method'], quantity = 2) =>
  placeOrderSchema.parse({
    customer: { fulfillment: 'retirada', name: 'Ana Souza', city: 'São Miguel Arcanjo', phone: '15991234567' },
    payment: { method },
    lines: [{ productId: 'prestigio', quantity }],
  } satisfies PlaceOrderInput)

describe('prazo para pagar o pedido online', () => {
  const placed = () => createOrder(catalogWithStock({ prestigio: 5 }), input('online'), NOW, 'OB-1')

  it('pedido online tem 2 h para pagar; depois não abre mais o pagamento', () => {
    const { order } = placed()
    expect(paymentDeadline(order)).toEqual(at(PAYMENT_WINDOW_MS))
    expect(canPayOnline(order, at(PAYMENT_WINDOW_MS - 1))).toBe(true)
    expect(canPayOnline(order, at(PAYMENT_WINDOW_MS))).toBe(false)
    expect(trackedView(order, NOW)).toMatchObject({ canPay: true, payBy: at(PAYMENT_WINDOW_MS).toISOString() })
  })

  it('depois do prazo + folga, cancela e devolve o estoque', () => {
    const { order, catalog } = placed()
    expect(stockOf(catalog, 'prestigio')).toBe(3)
    const doc = { orders: [order] }

    const early = expireUnpaid(doc, catalog, at(PAYMENT_WINDOW_MS + PAYMENT_GRACE_MS - 1))
    expect(early.expired).toEqual([])
    expect(early.doc).toBe(doc)

    const late = expireUnpaid(doc, catalog, at(PAYMENT_WINDOW_MS + PAYMENT_GRACE_MS))
    expect(late.expired).toHaveLength(1)
    expect(late.doc.orders[0]).toMatchObject({ status: 'cancelado', stockReserved: false })
    expect(late.doc.orders[0]!.history.at(-1)).toMatchObject({ by: 'sistema', note: expect.stringMatching(/prazo/) })
    expect(stockOf(late.catalog, 'prestigio')).toBe(5)
  })

  it('não mexe em pedido pago, pedido do WhatsApp nem pendente', () => {
    const catalog = catalogWithStock({ prestigio: 5 })
    const paid = applyGatewayPayment(
      placed().order,
      { id: '1', status: 'approved', amount: 120, orderId: 'OB-1' },
      NOW,
    ).order
    const whatsapp = createOrder(catalog, input('pix'), NOW, 'OB-2').order
    const pending = createOrder(catalogWithStock({ prestigio: 0 }), input('online'), NOW, 'OB-3').order
    const later = at(24 * 60 * 60_000)
    for (const order of [paid, whatsapp, pending]) expect(isPaymentExpired(order, later)).toBe(false)
  })

  it('pendente liberado depois conta o prazo a partir da liberação', () => {
    const empty = catalogWithStock({ prestigio: 0 })
    const pending = createOrder(empty, input('online'), NOW, 'OB-4').order
    const released = revalidateStock(pending, catalogWithStock({ prestigio: 5 }), 'ondina', at(5 * 60 * 60_000)).order
    expect(paymentDeadline(released)).toEqual(at(5 * 60 * 60_000 + PAYMENT_WINDOW_MS))
  })

  it('o link do Mercado Pago vence no mesmo prazo', () => {
    const preference = buildPreference(placed().order, 'https://ondinabolos.com.br')
    expect(preference).toMatchObject({ expires: true, expiration_date_to: at(PAYMENT_WINDOW_MS).toISOString() })
  })
})

/** Redis de mentira, com os comandos que a trava e o limite usam. */
function fakeRedis() {
  const data = new Map<string, string>()
  const command: RedisCommand = async ([name, key, ...rest]) => {
    switch (name) {
      case 'SET':
        if (rest.includes('NX') && data.has(key!)) return null
        data.set(key!, rest[0]!)
        return 'OK'
      case 'EVAL': {
        const [, lockKey, token] = rest
        if (data.get(lockKey!) === token) return data.delete(lockKey!) ? 1 : 0
        return 0
      }
      case 'INCR': {
        const next = Number(data.get(key!) ?? 0) + 1
        data.set(key!, String(next))
        return next
      }
      case 'PEXPIRE':
        return 1
      default:
        throw new Error(`comando inesperado ${name}`)
    }
  }
  return { data, command }
}

describe('trava de gravação entre cópias do site', () => {
  it('duas cópias nunca gravam ao mesmo tempo', async () => {
    const redis = fakeRedis()
    // Duas "cópias do site" com filas próprias, mas o mesmo Redis.
    const first = createWriteLock(redis.command)
    const second = createWriteLock(redis.command)
    let running = 0
    let overlap = false
    const task = (label: string, log: string[]) => async () => {
      running++
      if (running > 1) overlap = true
      await new Promise(resolve => setTimeout(resolve, 20))
      log.push(label)
      running--
      return label
    }
    const log: string[] = []
    const results = await Promise.all([first(task('a', log)), second(task('b', log)), first(task('c', log))])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(overlap).toBe(false)
    expect(log).toHaveLength(3)
    expect(redis.data.has('ondina:lock:write')).toBe(false)
  })

  it('libera a trava mesmo quando a tarefa falha', async () => {
    const redis = fakeRedis()
    const exclusive = createWriteLock(redis.command)
    await expect(exclusive(async () => Promise.reject(new Error('falhou')))).rejects.toThrow('falhou')
    expect(redis.data.size).toBe(0)
    await expect(exclusive(async () => 'ok')).resolves.toBe('ok')
  })

  it('trava presa por outra cópia: desiste com aviso amigável', async () => {
    const redis = fakeRedis()
    redis.data.set('ondina:lock:write', 'de-outra-copia')
    const exclusive = createWriteLock(redis.command, { waitMs: 60 })
    await expect(exclusive(async () => 'nunca')).rejects.toBeInstanceOf(BusyError)
    // Não apaga a trava dos outros.
    expect(redis.data.get('ondina:lock:write')).toBe('de-outra-copia')
  })

  it('sem Redis (no computador), a fila local basta', async () => {
    const exclusive = createWriteLock(undefined)
    await expect(Promise.all([exclusive(async () => 1), exclusive(async () => 2)])).resolves.toEqual([1, 2])
  })
})

describe('limite de pedidos por pessoa', () => {
  it('conta no Redis, valendo para todas as cópias', async () => {
    const redis = fakeRedis()
    const one = createRateLimit(2, 60_000, 'pedido', redis.command)
    const other = createRateLimit(2, 60_000, 'pedido', redis.command)
    expect(await one('1.2.3.4', NOW.getTime())).toBe(false)
    expect(await other('1.2.3.4', NOW.getTime())).toBe(false)
    expect(await one('1.2.3.4', NOW.getTime())).toBe(true)
    expect(await other('5.6.7.8', NOW.getTime())).toBe(false)
    // Janela nova: zera.
    expect(await one('1.2.3.4', NOW.getTime() + 60_000)).toBe(false)
  })

  it('Redis fora do ar: conta na memória e nunca bloqueia por erro', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const limit = createRateLimit(1, 60_000, 'pedido', async () => {
      throw new Error('fora do ar')
    })
    expect(await limit('ip', NOW.getTime())).toBe(false)
    expect(await limit('ip', NOW.getTime())).toBe(true)
    error.mockRestore()
  })
})
