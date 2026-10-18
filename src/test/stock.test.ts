import { afterEach, describe, expect, it } from 'vitest'
import { getProductById } from '@/data/products'
import { toCartItems } from '@/lib/cart-store'
import { applyCatalog, catalogSchema, seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import { handleCatalogRequest } from '@/lib/catalog-api'
import { fulfillmentSchema, type CheckoutData } from '@/lib/checkout'
import { handleImageRequest, parseImageDataUrl, type ImageApiDeps } from '@/lib/image-api'
import { isPendingOrder, isSoldOut, lacksStock, stockLabel } from '@/lib/stock'
import { buildOrderMessage, buildOrderPayload } from '@/lib/whatsapp'

const NOW = new Date('2026-10-13T12:00:00Z')

/** Aplica um catálogo com estoque nos bolos indicados. */
function withStock(stock: Record<string, number | null>): Catalog {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock))
    catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  applyCatalog(catalog)
  return catalog
}

afterEach(() => applyCatalog(seedCatalog()))

const retirada: CheckoutData['customer'] = fulfillmentSchema.parse({
  fulfillment: 'retirada',
  name: 'Ana Souza',
  city: 'São Miguel Arcanjo',
  phone: '5515991234567',
})

describe('estoque no catálogo', () => {
  it('começa sem controle e aceita catálogos salvos antes do estoque', () => {
    expect(seedCatalog().products.every(p => p.stock === null)).toBe(true)
    const old = JSON.parse(JSON.stringify(seedCatalog())) as { products: Record<string, unknown>[] }
    for (const product of old.products) delete product['stock']
    const parsed = catalogSchema.safeParse(old)
    expect(parsed.success && parsed.data.products[0]?.stock).toBe(null)
  })

  it('valida o número e chega ao site', () => {
    expect(() => updateItem(seedCatalog(), 'products', 'prestigio', { stock: -1 })).toThrow()
    expect(() => updateItem(seedCatalog(), 'products', 'prestigio', { stock: 1.5 })).toThrow()
    withStock({ prestigio: 0, 'fuba-goiabada': 3 })
    expect(getProductById('prestigio')?.stock).toBe(0)
    expect(isSoldOut(getProductById('prestigio')!)).toBe(true)
    expect(stockLabel(getProductById('fuba-goiabada')!)).toBe('3 bolos em estoque')
    expect(stockLabel(getProductById('ninho-nutella')!)).toBeUndefined()
  })

  it('a equipe muda o estoque pela API; visitante não', async () => {
    let stored = seedCatalog()
    const deps = (admin: boolean) => ({
      load: async () => stored,
      save: async (catalog: Catalog) => {
        stored = catalog
      },
      isAdmin: async () => admin,
    })
    const put = (admin: boolean) =>
      handleCatalogRequest(
        new Request('https://ondinabolos.com.br/api/catalog/products/prestigio', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', origin: 'https://ondinabolos.com.br' },
          body: JSON.stringify({ stock: 4 }),
        }),
        { entity: 'products', id: 'prestigio' },
        deps(admin),
      )
    expect((await put(false)).status).toBe(401)
    expect((await put(true)).status).toBe(200)
    expect(stored.products.find(p => p.id === 'prestigio')?.stock).toBe(4)
  })
})

describe('pedido pendente', () => {
  it('fica pendente com estoque 0 ou quantidade acima do estoque', () => {
    withStock({ prestigio: 2, 'fuba-goiabada': 0 })
    const [two, three] = [
      toCartItems([{ productId: 'prestigio', quantity: 2 }])[0]!,
      toCartItems([{ productId: 'prestigio', quantity: 3 }])[0]!,
    ]
    expect(lacksStock(two)).toBe(false)
    expect(lacksStock(three)).toBe(true)
    expect(isPendingOrder(toCartItems([{ productId: 'fuba-goiabada', quantity: 1 }]))).toBe(true)
    expect(isPendingOrder(toCartItems([{ productId: 'ninho-nutella', quantity: 9 }]))).toBe(false)
  })

  it('sem o servidor, a mensagem e o registro no n8n vão marcados como pendentes pelo estoque do navegador', () => {
    withStock({ 'fuba-goiabada': 0 })
    const items = toCartItems([
      { productId: 'fuba-goiabada', quantity: 1 },
      { productId: 'prestigio', quantity: 1 },
    ])
    const order = { items, total: 85, checkout: { customer: retirada, payment: { method: 'pix' as const } } }
    const message = buildOrderMessage(order)
    expect(message).toContain('Gostaria de deixar um pedido pendente.')
    expect(message).toContain('⏳ *PEDIDO PENDENTE (falta de estoque):* Fubá com goiabada.')
    expect(message).toContain('• 1x Fubá com goiabada - R$ 25,00 ⚠️ sem estoque')
    expect(message).toContain('• 1x Prestígio (kg) - R$ 60,00\n')
    expect(message).toContain('💳 *Forma de Pagamento:* Pix — depois da confirmação do estoque')

    const payload = buildOrderPayload(order, message, NOW)
    expect(payload.status).toBe('pendente')
    expect(payload.payment).toEqual({ method: 'pix', label: 'Pix — depois da confirmação do estoque' })
    expect(payload.items[0]).toMatchObject({ name: 'Fubá com goiabada', outOfStock: true })
    expect(payload.items[1]).not.toHaveProperty('outOfStock')
  })

  it('com estoque, o pedido segue normal', () => {
    withStock({ prestigio: 5 })
    const items = toCartItems([{ productId: 'prestigio', quantity: 2 }])
    const checkout = { customer: retirada, payment: { method: 'pix' as const } }
    const message = buildOrderMessage({ items, total: 120, checkout })
    expect(message).not.toContain('PENDENTE')
    expect(buildOrderPayload({ items, total: 120, checkout }, message, NOW).status).toBe('novo')
  })
})

describe('fotos enviadas pelo painel', () => {
  const JPEG = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3))
  const setup = (admin = true) => {
    const saved = new Map<string, string>()
    const deps: ImageApiDeps = {
      read: async id => saved.get(id) ?? null,
      write: async (id, value) => {
        saved.set(id, value)
      },
      isAdmin: async () => admin,
      newId: () => 'img-teste123',
    }
    const post = (dataUrl: unknown, origin = 'https://ondinabolos.com.br') =>
      handleImageRequest(
        new Request('https://ondinabolos.com.br/api/images', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({ dataUrl }),
        }),
        {},
        deps,
      )
    const get = (id: string) =>
      handleImageRequest(new Request(`https://ondinabolos.com.br/api/images/${id}`), { id }, deps)
    return { post, get }
  }

  it('guarda a foto e devolve o endereço para o image_url', async () => {
    const { post, get } = setup()
    const response = await post(JPEG)
    expect(response.status).toBe(201)
    expect((await response.json()).data.url).toBe('/api/images/img-teste123')

    const image = await get('img-teste123')
    expect(image.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await image.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xff, 0xd8, 0xff]))
    expect((await get('img-naoexiste')).status).toBe(404)
    expect((await get('../catalog')).status).toBe(404)

    // O endereço devolvido passa na validação do catálogo.
    expect(
      updateItem(seedCatalog(), 'products', 'prestigio', { image_url: '/api/images/img-teste123' }).item.image_url,
    ).toBe('/api/images/img-teste123')
  })

  it('só a equipe envia, do próprio site, e só fotos de verdade', async () => {
    expect((await setup(false).post(JPEG)).status).toBe(401)
    expect((await setup().post(JPEG, 'https://site-malicioso.com')).status).toBe(403)
    expect((await setup().post('data:image/svg+xml;base64,PHN2Zz4=')).status).toBe(400)
    // Diz ser PNG, mas os bytes são de outro arquivo.
    expect(() => parseImageDataUrl('data:image/png;base64,' + btoa('<html>'))).toThrow(/não é uma foto/)
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(1_400_000)
    expect(() => parseImageDataUrl(huge)).toThrow(/grande demais/)
  })
})
