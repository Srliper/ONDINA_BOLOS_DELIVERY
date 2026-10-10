import { describe, expect, it } from 'vitest'
import { getProductById } from '@/data/products'
import { ADDRESS_PLACEHOLDER, buildOrderMessage, generateWhatsAppLink, MAPS_URL } from '@/lib/whatsapp'
import { cartActions, getCartTotal, toCartItems } from '@/lib/cart-store'
import type { CartItem } from '@/types/product'

const item = (id: string, quantity: number): CartItem => ({ product: getProductById(id)!, quantity })

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
    expect(items.map(i => [i.product.id, i.quantity])).toEqual([['prestigio', 2], ['fuba-goiabada', 1]])
    expect(getCartTotal(items)).toBe(145)

    cartActions.setQuantity('prestigio', 0)
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([{ productId: 'fuba-goiabada', quantity: 1 }])

    cartActions.clear()
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([])
  })
})
