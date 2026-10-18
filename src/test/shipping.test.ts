import { describe, expect, it } from 'vitest'
import { getShippingOptions, isDeliveryCity, normalizeCity, shippingFee, STORE_ADDRESS } from '@/lib/shipping'

describe('frete', () => {
  it('reconhece São Miguel Arcanjo escrito de vários jeitos', () => {
    expect(normalizeCity('  SÃO  Miguel Arcanjo - SP ')).toBe('sao miguel arcanjo')
    for (const city of [
      'São Miguel Arcanjo',
      'sao miguel arcanjo',
      'São Miguel Arcanjo/SP',
      'SAO MIGUEL ARCANJO, SP',
    ]) {
      expect(isDeliveryCity(city)).toBe(true)
    }
    for (const city of ['Pilar do Sul', 'São Miguel', 'Itapetininga', '']) expect(isDeliveryCity(city)).toBe(false)
  })

  it('em São Miguel Arcanjo oferece entrega com frete R$ 0,00 ou retirada', () => {
    const options = getShippingOptions('São Miguel Arcanjo')
    expect(options.map(o => [o.method, o.fee])).toEqual([
      ['entrega', 0],
      ['retirada', 0],
    ])
  })

  it('em outra cidade só oferece Retirada no Local, com o endereço da loja', () => {
    expect(getShippingOptions('Pilar do Sul')).toEqual([
      { method: 'retirada', label: 'Retirada no Local', fee: 0, address: STORE_ADDRESS },
    ])
    expect(STORE_ADDRESS).toMatch(/Rua Tapixi, 412/)
  })

  it('frete é zero nas duas formas', () => {
    expect(shippingFee('entrega')).toBe(0)
    expect(shippingFee('retirada')).toBe(0)
  })
})
