import { z } from 'zod'
import { BUSINESS } from '@/lib/site'

/* ---------- Entrega ou retirada + endereço ---------- */

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `Informe ${label}.`)
    .max(max, `Use no máximo ${max} caracteres.`)

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform(value => (value ? value : undefined))

export const addressSchema = z.object({
  street: text(3, 120, 'a rua').regex(/[A-Za-zÀ-ÿ]/, 'Informe o nome da rua.'),
  // "412", "412A" ou "S/N"
  number: z
    .string()
    .trim()
    .regex(/^(\d{1,5}[A-Za-z]?|s\/?n)$/i, 'Use só o número (ex.: 412) ou S/N.'),
  district: text(2, 60, 'o bairro'),
  complement: optionalText(60),
  reference: optionalText(120),
})

export const customerSchema = z.object({
  name: text(2, 60, 'seu nome').regex(/^[A-Za-zÀ-ÿ' .-]+$/, 'Use só letras no nome.'),
})

/** Etapa 1: nome, e endereço só quando é entrega. */
export const fulfillmentSchema = z.discriminatedUnion('fulfillment', [
  customerSchema.extend({ fulfillment: z.literal('entrega'), address: addressSchema }),
  customerSchema.extend({ fulfillment: z.literal('retirada') }),
])

export type FulfillmentInput = z.input<typeof fulfillmentSchema>
export type Fulfillment = z.output<typeof fulfillmentSchema>
export type DeliveryAddress = z.output<typeof addressSchema>

/* ---------- Pagamento ---------- */

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['pix', 'cartao', 'dinheiro']

export const paymentLabel = (method: PaymentMethod, fulfillment: Fulfillment['fulfillment']): string =>
  method === 'pix'
    ? 'Pix'
    : method === 'cartao'
      ? fulfillment === 'entrega'
        ? 'Cartão na entrega'
        : 'Cartão na retirada'
      : 'Dinheiro'

export interface Payment {
  method: PaymentMethod
  /** Só para dinheiro: valor da nota para levar troco. */
  changeFor?: number | undefined
}

/** "50" ou "50,00" → 50; vazio → undefined; inválido → NaN. */
export const parseMoney = (value: string): number | undefined => {
  const clean = value.trim().replace(/^R\$\s*/i, '')
  if (!clean) return undefined
  return /^\d{1,5}([.,]\d{1,2})?$/.test(clean) ? Number(clean.replace(',', '.')) : Number.NaN
}

/** Mensagem de erro do troco, ou undefined se estiver ok. */
export function validateChange(changeFor: number | undefined, total: number): string | undefined {
  if (changeFor === undefined) return undefined
  if (Number.isNaN(changeFor)) return 'Use só números (ex.: 100 ou 100,00).'
  if (changeFor < total) return 'O valor para troco precisa ser maior que o total do pedido.'
  return undefined
}

/* ---------- Pedido completo ---------- */

export interface CheckoutData {
  customer: Fulfillment
  payment: Payment
}

export const PICKUP_ADDRESS = `${BUSINESS.street} — ${BUSINESS.district}, ${BUSINESS.city}`

/** Endereço em uma linha, para o resumo e a mensagem do pedido. */
export function formatAddress(customer: Fulfillment): string {
  if (customer.fulfillment === 'retirada') return `Retirada na loja (${PICKUP_ADDRESS})`
  const { street, number, district, complement, reference } = customer.address
  return [
    `${street}, ${number.toUpperCase() === 'SN' ? 'S/N' : number.toUpperCase()}`,
    complement,
    `${district}, ${BUSINESS.city}`,
    reference ? `Referência: ${reference}` : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
}
