import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import { handleCatalogRequest } from '@/lib/catalog-api'
import { handleOrderRequest, resetOrderRateLimit, type OrderApiDeps } from '@/lib/order-api'
import { createUpstashOrderStore, type OrderStore } from '@/lib/order-store'
import type { OrderConfirmation, StoredOrder } from '@/lib/orders'
import { createSoldOutNotifier, soldOutMessage, storeAlertUrl } from '@/lib/stock-alert'
import { returnToStock, takeFromStock } from '@/lib/stock'

const NOW = new Date('2026-10-14T12:00:00Z')
const SITE = 'https://ondinabolos.com.br'

const withStock = (stock: Record<string, number | null>): Catalog => {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock)) catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  return catalog
}

const order = (id: string, items: StoredOrder['items']): StoredOrder => ({
  orderId: id,
  createdAt: NOW.toISOString(),
  status: 'novo',
  customer: { name: 'Ana', fulfillment: 'retirada', address: 'Retirada na loja' },
  payment: { label: 'Pix' },
  items,
  total: 120,
})

function memoryStore(): OrderStore {
  let orders: StoredOrder[] = []
  const confirmed: Record<string, OrderConfirmation> = {}
  return {
    kind: 'file',
    add: async entry => {
      orders = [entry, ...orders]
    },
    list: async () => orders,
    confirmations: async () => ({ ...confirmed }),
    setConfirmation: async (id, value) => {
      if (value) confirmed[id] = value
      else delete confirmed[id]
    },
  }
}

function setup({ admin = 'edgard', catalog = withStock({ prestigio: 3, 'fuba-goiabada': 1 }) } = {}) {
  let stored = catalog
  const notify = vi.fn(async () => {})
  const deps: OrderApiDeps = {
    store: memoryStore(),
    loadCatalog: async () => stored,
    saveCatalog: async next => {
      stored = next
    },
    adminId: async () => admin || undefined,
    clientIp: () => '1.2.3.4',
    notifySoldOut: notify,
    now: () => NOW,
  }
  const call = (method: string, path: string, body?: unknown, origin = SITE) => {
    const [, , , id, action] = path.split('/')
    return handleOrderRequest(
      new Request(SITE + path, {
        method,
        headers: { 'content-type': 'application/json', origin },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      { id, action: action === 'confirm' ? 'confirm' : undefined },
      deps,
    )
  }
  return { call, deps, notify, catalog: () => stored }
}

beforeEach(() => resetOrderRateLimit())

describe('baixa de estoque', () => {
  it('tira o que o pedido levou, sem passar de 0, e aponta o que esgotou', () => {
    const catalog = withStock({ prestigio: 3, 'fuba-goiabada': 1 })
    const result = takeFromStock(
      catalog,
      [
        { productId: 'prestigio', quantity: 2 },
        { productId: 'fuba-goiabada', quantity: 4 },
        { productId: 'ninho-nutella', quantity: 1 }, // sem controle de estoque
        { quantity: 1 }, // bolo montado
      ],
      NOW,
    )
    expect(result.changes).toEqual([
      { id: 'prestigio', name: 'Prestígio', from: 3, to: 1 },
      { id: 'fuba-goiabada', name: 'Fubá com goiabada', from: 1, to: 0 },
    ])
    expect(result.soldOut).toEqual([{ id: 'fuba-goiabada', name: 'Fubá com goiabada' }])
    expect(result.catalog.version).toBe(catalog.version + 1)

    const back = returnToStock(result.catalog, result.changes, NOW)
    expect(back.products.find(p => p.id === 'prestigio')?.stock).toBe(3)
    expect(back.products.find(p => p.id === 'fuba-goiabada')?.stock).toBe(1)
    // Nada a baixar: o catálogo não muda de versão.
    expect(takeFromStock(catalog, [{ productId: 'ninho-nutella', quantity: 1 }]).catalog).toBe(catalog)
  })
})

describe('API /api/orders', () => {
  const sent = {
    ...order('OB-MG6Z1K2A-7Q', [
      { productId: 'prestigio', name: 'Prestígio', quantity: 2, subtotal: 120 },
      { productId: 'fuba-goiabada', name: 'Fubá com goiabada', quantity: 1, subtotal: 25 },
    ]),
    message: 'texto do WhatsApp',
    source: 'site',
  }

  it('o site guarda o pedido; só a equipe vê a lista', async () => {
    const { call } = setup()
    expect((await call('POST', '/api/orders', sent)).status).toBe(201)
    expect((await call('POST', '/api/orders', sent)).status).toBe(201) // repetido não duplica
    const list = await (await call('GET', '/api/orders')).json()
    expect(list.data.orders).toHaveLength(1)
    expect(list.data.orders[0]).not.toHaveProperty('message')

    expect((await setup({ admin: '' }).call('GET', '/api/orders')).status).toBe(401)
  })

  it('recusa pedido fora do formato, de outro site ou em excesso', async () => {
    const { call } = setup()
    expect((await call('POST', '/api/orders', { ...sent, orderId: 'qualquer' })).status).toBe(400)
    expect((await call('POST', '/api/orders', { ...sent, items: [] })).status).toBe(400)
    expect((await call('POST', '/api/orders', sent, 'https://site-malicioso.com')).status).toBe(403)
    for (let i = 0; i < 8; i++) await call('POST', '/api/orders', { ...sent, orderId: `OB-AAAA${i}000-ZZ` })
    expect((await call('POST', '/api/orders', { ...sent, orderId: 'OB-BBBB0000-ZZ' })).status).toBe(429)
  })

  it('confirmar baixa o estoque uma vez, avisa o esgotado e pode ser desfeito', async () => {
    const { call, catalog, notify } = setup()
    await call('POST', '/api/orders', sent)

    const confirmed = await call('POST', '/api/orders/OB-MG6Z1K2A-7Q/confirm')
    expect(confirmed.status).toBe(200)
    const body = await confirmed.json()
    expect(body.data.confirmation).toMatchObject({ by: 'edgard', at: NOW.toISOString() })
    expect(body.data.soldOut).toEqual([{ id: 'fuba-goiabada', name: 'Fubá com goiabada' }])
    expect(catalog().products.find(p => p.id === 'prestigio')?.stock).toBe(1)
    expect(notify).toHaveBeenCalledWith([{ id: 'fuba-goiabada', name: 'Fubá com goiabada' }], 'edgard')

    expect((await call('POST', '/api/orders/OB-MG6Z1K2A-7Q/confirm')).status).toBe(409)
    const list = await (await call('GET', '/api/orders')).json()
    expect(list.data.orders[0].confirmation.stock).toHaveLength(2)

    expect((await call('DELETE', '/api/orders/OB-MG6Z1K2A-7Q/confirm')).status).toBe(200)
    expect(catalog().products.find(p => p.id === 'prestigio')?.stock).toBe(3)
    expect(catalog().products.find(p => p.id === 'fuba-goiabada')?.stock).toBe(1)
    expect((await call('DELETE', '/api/orders/OB-MG6Z1K2A-7Q/confirm')).status).toBe(409)
  })

  it('confirmar exige login e a mesma origem; pedido inexistente dá 404', async () => {
    expect((await setup({ admin: '' }).call('POST', '/api/orders/OB-MG6Z1K2A-7Q/confirm')).status).toBe(401)
    const { call } = setup()
    await call('POST', '/api/orders', sent)
    expect((await call('POST', '/api/orders/OB-MG6Z1K2A-7Q/confirm', undefined, 'https://site-malicioso.com')).status).toBe(403)
    expect((await call('POST', '/api/orders/OB-NAOEXISTE-00/confirm')).status).toBe(404)
  })
})

describe('guardar pedidos no Upstash', () => {
  it('usa LPUSH/LTRIM, LRANGE e um hash para as confirmações', async () => {
    const commands: string[][] = []
    const list: string[] = []
    const hash = new Map<string, string>()
    const fakeFetch: typeof fetch = async (_url, init) => {
      const command = JSON.parse(String(init?.body)) as string[]
      commands.push(command)
      const [name, , a, b] = command
      if (name === 'LPUSH') list.unshift(a!)
      if (name === 'HSET') hash.set(a!, b!)
      if (name === 'HDEL') hash.delete(a!)
      const result = name === 'LRANGE' ? list : name === 'HGETALL' ? [...hash].flat() : 'OK'
      return Response.json({ result })
    }
    const store = createUpstashOrderStore('https://exemplo.upstash.io', 'token', fakeFetch)
    await store.add(order('OB-AAAA0000-01', [{ name: 'Prestígio', quantity: 1, subtotal: 60 }]))
    expect((await store.list())[0]?.orderId).toBe('OB-AAAA0000-01')
    await store.setConfirmation('OB-AAAA0000-01', { at: NOW.toISOString(), by: 'kaique', stock: [] })
    expect(await store.confirmations()).toEqual({ 'OB-AAAA0000-01': { at: NOW.toISOString(), by: 'kaique', stock: [] } })
    await store.setConfirmation('OB-AAAA0000-01', null)
    expect(await store.confirmations()).toEqual({})
    expect(commands.map(c => c[0])).toEqual(['LPUSH', 'LTRIM', 'LRANGE', 'HSET', 'HGETALL', 'HDEL', 'HGETALL'])
    expect(commands[1]).toEqual(['LTRIM', 'ondina:orders', '0', '299'])
  })
})

describe('aviso de esgotado', () => {
  const products = [{ id: 'prestigio', name: 'Prestígio' }]

  it('monta a mensagem e o link para o WhatsApp da loja', () => {
    expect(soldOutMessage(products)).toContain('Esgotou no site da Ondina Bolos: Prestígio.')
    expect(storeAlertUrl(products)).toMatch(/^https:\/\/wa\.me\/5515997115450\?text=%E2%9A%A0/)
  })

  it('manda ao n8n com a chave, e falha sem quebrar', async () => {
    const fakeFetch = vi.fn(async () => new Response('{}'))
    await createSoldOutNotifier({ url: 'https://n8n.exemplo/webhook/esgotou', key: 'chave' }, fakeFetch)(products, 'ondina')
    const [url, init] = fakeFetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://n8n.exemplo/webhook/esgotou')
    expect((init.headers as Record<string, string>)['x-ondina-key']).toBe('chave')
    expect(JSON.parse(String(init.body))).toMatchObject({ event: 'estoque-esgotado', by: 'ondina', products })

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(createSoldOutNotifier({ url: 'https://n8n.exemplo/x' }, async () => Promise.reject(new Error('caiu')))(products)).resolves.toBeUndefined()
    error.mockRestore()

    const unused = vi.fn()
    await createSoldOutNotifier({ url: undefined }, unused)(products)
    expect(unused).not.toHaveBeenCalled()
  })

  it('zerar o estoque pelo painel avisa uma vez', async () => {
    let stored = withStock({ prestigio: 1 })
    const notify = vi.fn(async () => {})
    const put = (stock: number) =>
      handleCatalogRequest(
        new Request(`${SITE}/api/catalog/products/prestigio`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', origin: SITE },
          body: JSON.stringify({ stock }),
        }),
        { entity: 'products', id: 'prestigio' },
        { load: async () => stored, save: async c => void (stored = c), isAdmin: async () => true, notifySoldOut: notify },
      )
    await put(0)
    await put(0)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith([{ id: 'prestigio', name: 'Prestígio' }])
  })
})
