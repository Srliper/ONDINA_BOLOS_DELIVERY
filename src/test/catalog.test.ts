import { afterEach, describe, expect, it } from 'vitest'
import { BOLO_LAYERS, DEFAULT_LAYERS, getLayerById } from '@/data/bolo-layers'
import { DEFAULT_PRODUCTS, getProductById, products } from '@/data/products'
import {
  applyCatalog,
  CatalogError,
  catalogSchema,
  createItem,
  deleteItem,
  seedCatalog,
  slugify,
  toBoloLayers,
  toProducts,
  updateItem,
  withNewDefaults,
  type Catalog,
} from '@/lib/catalog'
import { handleCatalogRequest, type CatalogApiDeps } from '@/lib/catalog-api'
import { createUpstashStorage, loadCatalog } from '@/lib/catalog-store'

const NOW = new Date('2026-10-13T12:00:00Z')

afterEach(() => applyCatalog(seedCatalog()))

describe('catálogo padrão', () => {
  it('reproduz o cardápio e as camadas atuais do site', () => {
    const seed = seedCatalog()
    expect(toProducts(seed)).toEqual(DEFAULT_PRODUCTS)
    expect(toBoloLayers(seed)).toEqual(DEFAULT_LAYERS)
    expect(seed.fillings.map(f => f.id)).toContain('recheio-morango-ninho')
    expect(new Set(seed.layers.map(l => l.category))).toEqual(new Set(['base', 'cobertura', 'decoracao']))
  })
})

describe('CRUD puro', () => {
  it('cria com id a partir do nome, exige imagem para item novo e recusa id repetido', () => {
    const seed = seedCatalog()
    expect(() =>
      createItem(seed, 'fillings', {
        name: 'Doce de Leite com Nozes',
        price: 19,
        description: '',
        badge: null,
        image_url: '',
      }),
    ).toThrow(CatalogError)
    const { catalog, item } = createItem(
      seed,
      'fillings',
      {
        name: 'Doce de Leite com Nozes',
        price: 19,
        description: 'Cremoso',
        badge: null,
        image_url: 'https://exemplo.com/nozes.png',
      },
      NOW,
    )
    expect(item.id).toBe('doce-de-leite-com-nozes')
    expect(catalog.version).toBe(1)
    expect(catalog.updated_at).toBe(NOW.toISOString())
    expect(() => createItem(catalog, 'fillings', { ...item })).toThrow(/Já existe/)
  })

  it('valida preço, nome e endereço da imagem', () => {
    try {
      createItem(seedCatalog(), 'products', {
        name: 'X',
        price: -1,
        description: '',
        image_url: 'ftp://x',
        category: 'festas',
        price_unit: 'o quilo',
        unit: 'kg',
        featured: false,
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogError)
      expect(Object.keys((error as CatalogError).issues ?? {})).toEqual(
        expect.arrayContaining(['name', 'price', 'image_url']),
      )
    }
  })

  it('altera sem mudar o id e apaga com proteção da última opção de cada etapa', () => {
    const seed = seedCatalog()
    const { catalog, item } = updateItem(seed, 'products', 'prestigio', { price: 65, id: 'outro-id' }, NOW)
    expect(item).toMatchObject({ id: 'prestigio', price: 65 })
    expect(() => updateItem(seed, 'products', 'nao-existe', { price: 1 })).toThrow(/não encontrado/)

    const bases = seed.layers.filter(l => l.category === 'base')
    let current: Catalog = seed
    for (const base of bases.slice(1)) current = deleteItem(current, 'layers', base.id)
    expect(() => deleteItem(current, 'layers', bases[0]!.id)).toThrow(/pelo menos uma opção/)
    expect(() => deleteItem(catalog, 'products', 'nao-existe')).toThrow(/não encontrado/)
  })

  it('gera ids limpos', () => {
    expect(slugify('  Bolo de Cenoura c/ Chocolate! ')).toBe('bolo-de-cenoura-c-chocolate')
  })
})

describe('applyCatalog', () => {
  it('troca preços e opções que o site, o carrinho e o Monte seu Bolo usam', () => {
    const changed = updateItem(seedCatalog(), 'products', 'prestigio', { price: 70 }, NOW).catalog
    const withFilling = createItem(
      changed,
      'fillings',
      { name: 'Pistache', price: 22, description: '', badge: 'premium', image_url: '/layers/pistache.png' },
      NOW,
    ).catalog
    applyCatalog(withFilling)
    expect(getProductById('prestigio')?.price).toBe(70)
    expect(products).toHaveLength(DEFAULT_PRODUCTS.length)
    expect(getLayerById('pistache')).toMatchObject({
      category: 'recheio',
      price: 22,
      badge: 'premium',
      image: '/layers/pistache.png',
    })
    expect(BOLO_LAYERS.map(l => l.category).indexOf('recheio')).toBeGreaterThan(
      BOLO_LAYERS.map(l => l.category).indexOf('base'),
    )
  })
})

describe('API /api/catalog', () => {
  const setup = (admin = true) => {
    let stored: Catalog = seedCatalog()
    const deps: CatalogApiDeps = {
      load: async () => stored,
      save: async catalog => {
        stored = catalog
      },
      isAdmin: async () => admin,
    }
    const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
      const [, , , entity = '', id] = path.split('/')
      const request = new Request(`https://ondinabolos.com.br${path}`, {
        method,
        headers:
          body === undefined
            ? headers
            : { 'content-type': 'application/json', origin: 'https://ondinabolos.com.br', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return handleCatalogRequest(request, { entity, id }, deps)
    }
    return { call, stored: () => stored }
  }

  it('faz o CRUD completo de recheios', async () => {
    const { call, stored } = setup()
    const created = await call('POST', '/api/catalog/fillings', {
      name: 'Pistache',
      price: 22,
      description: 'Creme de pistache',
      badge: null,
      image_url: 'https://cdn.exemplo.com/pistache.png',
    })
    expect(created.status).toBe(201)
    expect((await created.json()).data.id).toBe('pistache')

    const one = await call('GET', '/api/catalog/fillings/pistache')
    expect((await one.json()).data.price).toBe(22)

    const updated = await call('PUT', '/api/catalog/fillings/pistache', { price: 24 })
    expect((await updated.json()).data.price).toBe(24)

    expect((await call('DELETE', '/api/catalog/fillings/pistache')).status).toBe(200)
    expect(stored().fillings.some(f => f.id === 'pistache')).toBe(false)
    expect((await call('GET', '/api/catalog/fillings/pistache')).status).toBe(404)
  })

  it('lista é pública; escrever exige login, JSON e a mesma origem', async () => {
    const anon = setup(false)
    expect((await anon.call('GET', '/api/catalog/products')).status).toBe(200)
    expect((await anon.call('POST', '/api/catalog/products', {})).status).toBe(401)

    const { call } = setup()
    expect(
      (await call('DELETE', '/api/catalog/products/prestigio', undefined, { origin: 'https://site-malicioso.com' }))
        .status,
    ).toBe(403)
    const notJson = await handleCatalogRequest(
      new Request('https://ondinabolos.com.br/api/catalog/products', { method: 'POST', body: 'name=x' }),
      { entity: 'products' },
      { load: async () => seedCatalog(), save: async () => {}, isAdmin: async () => true },
    )
    expect(notJson.status).toBe(400)
    expect((await call('GET', '/api/catalog/usuarios')).status).toBe(404)
  })

  it('devolve os erros de validação por campo', async () => {
    const { call } = setup()
    const response = await call('POST', '/api/catalog/layers', {
      name: 'Base X',
      price: 'caro',
      description: '',
      category: 'teto',
      badge: null,
      image_url: '',
    })
    expect(response.status).toBe(400)
    expect(Object.keys((await response.json()).issues)).toEqual(expect.arrayContaining(['price', 'category']))
  })
})

describe('armazenamento', () => {
  it('fala com o Upstash pelo REST e cai no cardápio padrão se o dado estiver quebrado', async () => {
    const calls: unknown[] = []
    let value: string | null = null
    const fakeFetch: typeof fetch = async (_url, init) => {
      const command = JSON.parse(String(init?.body)) as string[]
      calls.push(command[0])
      if (command[0] === 'SET') value = command[2] ?? null
      return Response.json({ result: command[0] === 'GET' ? value : 'OK' })
    }
    const storage = createUpstashStorage('https://exemplo.upstash.io', 'token', fakeFetch)
    expect(await loadCatalog(storage)).toEqual(seedCatalog())
    await storage.write(JSON.stringify(updateItem(seedCatalog(), 'products', 'prestigio', { price: 80 }, NOW).catalog))
    expect((await loadCatalog(storage)).products.find(p => p.id === 'prestigio')?.price).toBe(80)
    value = '{"quebrado":'
    const error = console.error
    console.error = () => {}
    expect(await loadCatalog(storage)).toEqual(seedCatalog())
    console.error = error
    expect(calls).toEqual(['GET', 'SET', 'GET', 'GET'])
  })
})

describe('bolos novos do cardápio padrão', () => {
  const ids = (catalog: Catalog) => catalog.products.map(product => product.id)

  it('entram sozinhos no catálogo salvo, no lugar certo e sem duplicar', () => {
    // Catálogo salvo antes de existirem Kinder Bueno e Oreo (e sem a lista de excluídos, como os antigos).
    const old = seedCatalog()
    const saved = catalogSchema.parse({
      ...old,
      removed_defaults: undefined,
      products: old.products.filter(product => !['kinder-bueno', 'oreo'].includes(product.id)),
    })
    const merged = withNewDefaults(saved)
    expect(ids(merged)).toEqual(ids(seedCatalog()))
    expect(withNewDefaults(merged)).toBe(merged)
    expect(new Set(ids(merged)).size).toBe(merged.products.length)
  })

  it('mantém edições do catálogo salvo (preço, estoque, ordem)', () => {
    const edited = updateItem(seedCatalog(), 'products', 'prestigio', { price: 70, stock: 3 }, NOW).catalog
    const saved = { ...edited, products: edited.products.filter(product => product.id !== 'oreo') }
    const merged = withNewDefaults(saved)
    expect(merged.products.find(product => product.id === 'prestigio')).toMatchObject({ price: 70, stock: 3 })
    expect(ids(merged)).toContain('oreo')
  })

  it('bolo excluído pela equipe não volta, e volta se for adicionado de novo', () => {
    const deleted = deleteItem(seedCatalog(), 'products', 'oreo', NOW)
    expect(deleted.removed_defaults).toEqual(['oreo'])
    expect(ids(withNewDefaults(deleted))).not.toContain('oreo')

    const oreo = seedCatalog().products.find(product => product.id === 'oreo')!
    const restored = createItem(deleted, 'products', oreo, NOW).catalog
    expect(restored.removed_defaults).toEqual([])
  })

  it('bolos com mais fotos levam a galeria para o site', () => {
    const prestigio = toProducts(seedCatalog()).find(product => product.id === 'prestigio')
    expect(prestigio?.gallery).toHaveLength(2)
  })
})
