import { describe, expect, it } from 'vitest'
import {
  formatAddress,
  fulfillmentSchema,
  parseMoney,
  paymentLabel,
  validateChange,
} from '@/lib/checkout'

const delivery = {
  fulfillment: 'entrega' as const,
  name: '  Ana Souza ',
  city: 'São Miguel Arcanjo',
  address: { street: 'Rua Tapixi', number: '412', district: 'Vila Tomaz', cep: '18230000', complement: '', reference: ' perto da praça ' },
}

describe('fulfillmentSchema', () => {
  it('aceita entrega completa e limpa espaços e opcionais vazios', () => {
    const result = fulfillmentSchema.parse(delivery)
    expect(result).toEqual({
      fulfillment: 'entrega',
      name: 'Ana Souza',
      city: 'São Miguel Arcanjo',
      address: { street: 'Rua Tapixi', number: '412', district: 'Vila Tomaz', cep: '18230-000', complement: undefined, reference: 'perto da praça' },
    })
  })

  it('recusa número inválido, rua sem letras, bairro e nome vazios', () => {
    const result = fulfillmentSchema.safeParse({
      fulfillment: 'entrega',
      name: 'A1',
      city: 'São Miguel Arcanjo',
      address: { street: '123', number: 'quatro', district: ' ', cep: '1823', complement: '', reference: '' },
    })
    expect(result.success).toBe(false)
    const fields = result.success ? [] : result.error.issues.map(issue => issue.path.at(-1))
    expect(fields).toEqual(expect.arrayContaining(['name', 'street', 'number', 'district', 'cep']))
  })

  it('pede nome completo (nome e sobrenome)', () => {
    const result = fulfillmentSchema.safeParse({ fulfillment: 'retirada', name: 'Ana', city: 'Pilar do Sul' })
    expect(result.success ? '' : result.error.issues[0]?.message).toMatch(/nome e sobrenome/)
  })

  it('aceita o CEP com ou sem hífen e guarda no formato 00000-000', () => {
    for (const cep of ['18230-000', '18230000', ' 18230-000 ']) {
      const parsed = fulfillmentSchema.parse({ ...delivery, address: { ...delivery.address, cep } })
      expect(parsed.fulfillment === 'entrega' && parsed.address.cep).toBe('18230-000')
    }
    for (const cep of ['', '1823-000', 'abcde-fgh', '182300000']) {
      expect(fulfillmentSchema.safeParse({ ...delivery, address: { ...delivery.address, cep } }).success).toBe(false)
    }
  })

  it('aceita S/N e número com letra', () => {
    for (const number of ['s/n', 'SN', '12A']) {
      expect(fulfillmentSchema.safeParse({ ...delivery, address: { ...delivery.address, number } }).success).toBe(true)
    }
  })

  it('na retirada só pede nome e cidade', () => {
    expect(fulfillmentSchema.parse({ fulfillment: 'retirada', name: 'Ana Souza', city: 'Pilar do Sul' })).toEqual({
      fulfillment: 'retirada',
      name: 'Ana Souza',
      city: 'Pilar do Sul',
    })
  })

  it('recusa entrega fora de São Miguel Arcanjo e aponta a retirada', () => {
    const result = fulfillmentSchema.safeParse({ ...delivery, city: 'Pilar do Sul' })
    expect(result.success).toBe(false)
    const issue = result.success ? undefined : result.error.issues[0]
    expect(issue?.path).toEqual(['city'])
    expect(issue?.message).toMatch(/Retirada no Local/)
  })

  it('aceita a cidade escrita de vários jeitos', () => {
    for (const city of ['sao miguel arcanjo', 'SÃO MIGUEL ARCANJO - SP', ' São  Miguel Arcanjo/SP ']) {
      expect(fulfillmentSchema.safeParse({ ...delivery, city }).success).toBe(true)
    }
  })
})

describe('pagamento', () => {
  it('lê valores de troco e valida contra o total', () => {
    expect(parseMoney('')).toBeUndefined()
    expect(parseMoney('100')).toBe(100)
    expect(parseMoney('R$ 82,50')).toBe(82.5)
    expect(parseMoney('cem')).toBeNaN()
    expect(validateChange(undefined, 78)).toBeUndefined()
    expect(validateChange(50, 78)).toMatch(/maior que o total/)
    expect(validateChange(Number.NaN, 78)).toMatch(/números/)
    expect(validateChange(100, 78)).toBeUndefined()
  })

  it('nomeia o cartão conforme entrega ou retirada', () => {
    expect(paymentLabel('cartao', 'entrega')).toBe('Cartão na entrega')
    expect(paymentLabel('cartao', 'retirada')).toBe('Cartão na retirada')
    expect(paymentLabel('pix', 'entrega')).toBe('Pix')
  })
})

describe('formatAddress', () => {
  it('monta o endereço em uma linha', () => {
    expect(formatAddress(fulfillmentSchema.parse({ ...delivery, address: { ...delivery.address, number: 'sn' } }))).toBe(
      'Rua Tapixi, S/N — Vila Tomaz, São Miguel Arcanjo — CEP 18230-000 — Referência: perto da praça',
    )
    expect(formatAddress({ fulfillment: 'retirada', name: 'Ana Souza', city: 'Pilar do Sul' })).toMatch(/^Retirada na loja \(Rua Tapixi, 412/)
  })
})
