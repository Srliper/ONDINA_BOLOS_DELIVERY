import { describe, expect, it } from 'vitest'
import { getProductById } from '@/data/products'
import { ADDRESS_PLACEHOLDER, buildOrderMessage, generateWhatsAppLink, MAPS_URL } from '@/lib/whatsapp'
import { cartActions, getCartTotal, toCartItems } from '@/lib/cart-store'

const item = (id: string, quantity: number) => toCartItems([{ productId: id, quantity }])[0]!
const CUSTOM = {
  base: 'base-red-velvet',
  recheio: 'recheio-morango-ninho',
  cobertura: 'cobertura-brigadeiro',
  decoracao: 'decoracao-morangos',
}

describe('buildOrderMessage', () => {
  const items = [item('prestigio', 1), item('fuba-goiabada', 2)]

  it('segue o formato oficial do pedido', () => {
    expect(buildOrderMessage(items, getCartTotal(items))).toBe(
      [
        'Olá, Ondina Bolos! 🍰 Gostaria de fazer um pedido:',
        '',
        '📋 *Meu Pedido:*',
        '• 1x Prestígio (kg) - R$ 60,00',
        '• 2x Fubá com goiabada - R$ 50,00',
        '',
        '💰 *Total Estimado: R$ 110,00*',
        '',
        `📍 *Meu Endereço:* ${ADDRESS_PLACEHOLDER}`,
        `🗺️ *Ponto de Referência:* ${MAPS_URL}`,
      ].join('\n'),
    )
  })

  it('usa o endereço informado pelo cliente', () => {
    expect(buildOrderMessage(items, 110, '  Rua Tapixi, 412 ')).toContain('📍 *Meu Endereço:* Rua Tapixi, 412\n')
  })

  it('gera um link wa.me codificado para o número oficial', () => {
    const link = generateWhatsAppLink(items, 110)
    expect(link.startsWith('https://wa.me/5515997115450?text=')).toBe(true)
    expect(decodeURIComponent(link.split('?text=')[1]!)).toBe(buildOrderMessage(items, 110))
  })
})

describe('cartActions', () => {
  it('adiciona, altera, remove e limpa', () => {
    cartActions.clear()
    cartActions.add('prestigio')
    cartActions.add('prestigio', 2)
    cartActions.add('produto-inexistente')
    cartActions.decrement('prestigio')
    cartActions.add('fuba-goiabada')

    const raw = JSON.parse(localStorage.getItem('ondina-bolos:cart:v1') ?? '[]')
    const items = toCartItems(raw)
    expect(items.map(i => [i.id, i.quantity])).toEqual([['prestigio', 2], ['fuba-goiabada', 1]])
    expect(getCartTotal(items)).toBe(145)

    cartActions.setQuantity('prestigio', 0)
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([{ productId: 'fuba-goiabada', quantity: 1 }])

    cartActions.clear()
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([])
  })

  it('soma o mesmo bolo montado em vez de duplicar e calcula o preço pelas camadas', () => {
    cartActions.clear()
    const lineId = cartActions.addCustom(CUSTOM)
    cartActions.addCustom(CUSTOM)
    cartActions.add('prestigio')
    expect(cartActions.addCustom({ ...CUSTOM, base: 'recheio-prestigio' })).toBeUndefined()

    const items = toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!))
    const custom = items.find(i => i.type === 'custom')
    expect(custom).toMatchObject({
      id: lineId,
      name: 'Bolo Personalizado',
      price: 78,
      quantity: 2,
      customConfig: {
        base: 'Base Red Velvet',
        recheio: 'Morango com Ninho',
        cobertura: 'Cobertura de Brigadeiro',
        decoracao: 'Morangos Frescos',
      },
    })
    expect(getCartTotal(items)).toBe(78 * 2 + 60)

    cartActions.decrement(lineId!)
    cartActions.decrement(lineId!)
    expect(toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).map(i => i.id)).toEqual(['prestigio'])
    cartActions.clear()
  })

  it('descarta do navegador camadas que saíram do cardápio', () => {
    localStorage.setItem(
      'ondina-bolos:cart:v1',
      JSON.stringify([{ custom: { ...CUSTOM, cobertura: 'cobertura-que-nao-existe' }, quantity: 1 }]),
    )
    expect(toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!))).toEqual([])
  })
})

describe('buildOrderMessage com bolo montado', () => {
  it('lista as camadas abaixo do bolo personalizado', () => {
    const items = toCartItems([{ custom: CUSTOM, quantity: 1 }])
    expect(buildOrderMessage(items, 78)).toContain(
      [
        '• 1x Bolo Personalizado - R$ 78,00',
        '   Base: Base Red Velvet',
        '   Recheio: Morango com Ninho',
        '   Cobertura: Cobertura de Brigadeiro',
        '   Decoração: Morangos Frescos',
      ].join('\n'),
    )
  })
})
