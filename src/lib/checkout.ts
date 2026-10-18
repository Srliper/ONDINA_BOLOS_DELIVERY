import { z } from 'zod'
import { phoneSchema } from '@/lib/phone'
import { DELIVERY_CITY, isDeliveryCity, STORE_ADDRESS } from '@/lib/shipping'

/* ---------- Entrega ou retirada + endereço ---------- */

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Informe ${label}.`).max(max, `Use no máximo ${max} caracteres.`)

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
  // "18230000" ou "18230-000" → "18230-000"
  cep: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, 'Informe o CEP com 8 números (ex.: 18230-000).')
    .transform(value => `${value.replace('-', '').slice(0, 5)}-${value.replace('-', '').slice(5)}`),
  complement: optionalText(60),
  reference: optionalText(120),
})

export const customerSchema = z.object({
  name: text(2, 60, 'seu nome completo')
    .regex(/^[A-Za-zÀ-ÿ' .-]+$/, 'Use só letras no nome.')
    .regex(/^\S+(\s+\S+)+$/, 'Informe nome e sobrenome.'),
  city: text(2, 60, 'sua cidade'),
  /** WhatsApp do cliente: a equipe usa para avisar do pedido e do estoque. */
  phone: phoneSchema,
})

export const DELIVERY_ONLY_IN_CITY = `Entregamos só em ${DELIVERY_CITY}. Para a sua cidade, escolha Retirada no Local.`

/** Etapa 1: nome e cidade; endereço só quando é entrega — e entrega só em São Miguel Arcanjo. */
export const fulfillmentSchema = z
  .discriminatedUnion('fulfillment', [
    customerSchema.extend({ fulfillment: z.literal('entrega'), address: addressSchema }),
    customerSchema.extend({ fulfillment: z.literal('retirada') }),
  ])
  .superRefine((value, ctx) => {
    if (value.fulfillment === 'entrega' && !isDeliveryCity(value.city)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: DELIVERY_ONLY_IN_CITY })
    }
  })

export type FulfillmentInput = z.input<typeof fulfillmentSchema>
export type Fulfillment = z.output<typeof fulfillmentSchema>
export type DeliveryAddress = z.output<typeof addressSchema>

/* ---------- Pagamento ---------- */

/**
 * pix/cartão/dinheiro: combinados pelo WhatsApp (ou pagos na entrega/retirada).
 * online: pago aqui no site, pelo gateway (Mercado Pago — Pix ou cartão).
 */
export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro' | 'online'

/** Formas combinadas com a loja (pedido pelo WhatsApp). */
export const PAYMENT_METHODS: readonly Exclude<PaymentMethod, 'online'>[] = ['pix', 'cartao', 'dinheiro']

export const ALL_PAYMENT_METHODS = ['pix', 'cartao', 'dinheiro', 'online'] as const

/** Onde o cliente finaliza: pela conversa do WhatsApp ou aqui no site (pagamento online). */
export type OrderChannel = 'whatsapp' | 'site'

export const channelOf = (method: PaymentMethod): OrderChannel => (method === 'online' ? 'site' : 'whatsapp')

export const paymentLabel = (method: PaymentMethod, fulfillment: Fulfillment['fulfillment']): string =>
  method === 'online'
    ? 'Pagamento online (Pix ou cartão)'
    : method === 'pix'
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
  /** Escolhido sempre; no pedido pendente (falta estoque) só vale depois da confirmação do estoque. */
  payment: Payment
  /** Para quando (data e faixa de horário). */
  schedule?: Schedule | undefined
}

/** Complemento do pagamento no pedido pendente: nada é cobrado antes de o estoque ser confirmado. */
export const PENDING_PAYMENT_NOTE = 'depois da confirmação do estoque'

export const PICKUP_ADDRESS = STORE_ADDRESS

/** Endereço em uma linha, para o resumo e a mensagem do pedido. */
export function formatAddress(customer: Fulfillment): string {
  if (customer.fulfillment === 'retirada') return `Retirada na loja (${PICKUP_ADDRESS})`
  const { street, number, district, cep, complement, reference } = customer.address
  return [
    `${street}, ${number.toUpperCase() === 'SN' ? 'S/N' : number.toUpperCase()}`,
    complement,
    `${district}, ${DELIVERY_CITY}`,
    `CEP ${cep}`,
    reference ? `Referência: ${reference}` : undefined,
  ]
    .filter(Boolean)
    .join(' — ')
}

/* ---------- Para quando (data e horário) ---------- */

/** Faixas de entrega/retirada dentro do horário da loja (seg–sex 7h–18h, sáb 7h–20h, dom fechado). */
export const DELIVERY_PERIODS = {
  manha: { label: 'Manhã', from: 8, to: 12 },
  tarde: { label: 'Tarde', from: 12, to: 18 },
  noite: { label: 'Noite (só sábado)', from: 18, to: 20 },
} as const

export type DeliveryPeriod = keyof typeof DELIVERY_PERIODS

export const DELIVERY_PERIOD_IDS = Object.keys(DELIVERY_PERIODS) as DeliveryPeriod[]

/** Até quantos dias à frente dá para agendar. */
export const MAX_SCHEDULE_DAYS = 60

const STORE_TZ = 'America/Sao_Paulo'

/** "AAAA-MM-DD" de hoje no horário da loja. */
export const storeToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  )

/** Hora cheia de agora no horário da loja (0–23). */
const storeHour = (now: Date): number =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: STORE_TZ, hour: '2-digit', hour12: false }).format(now)) % 24

const parseDay = (value: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date
}

/** "AAAA-MM-DD" daqui a `days` dias (contando do dia de hoje da loja). */
export const addDays = (day: string, days: number): string => {
  const date = parseDay(day) ?? new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export interface Schedule {
  date: string
  period: DeliveryPeriod
}

/** O que está errado na data/horário escolhidos, ou undefined se pode. */
export function scheduleError(
  schedule: { date: string; period: string },
  now = new Date(),
): { field: 'date' | 'period'; message: string } | undefined {
  const day = parseDay(schedule.date)
  if (!day) return { field: 'date', message: 'Escolha a data.' }
  const today = storeToday(now)
  if (schedule.date < today) return { field: 'date', message: 'Escolha uma data a partir de hoje.' }
  if (schedule.date > addDays(today, MAX_SCHEDULE_DAYS)) {
    return { field: 'date', message: `Dá para agendar com até ${MAX_SCHEDULE_DAYS} dias.` }
  }
  const weekday = day.getUTCDay()
  if (weekday === 0) return { field: 'date', message: 'Aos domingos a loja fecha. Escolha outro dia.' }
  const period = DELIVERY_PERIODS[schedule.period as DeliveryPeriod]
  if (!period) return { field: 'period', message: 'Escolha o horário.' }
  if (schedule.period === 'noite' && weekday !== 6) {
    return { field: 'period', message: 'À noite (18h às 20h), só aos sábados.' }
  }
  // Hoje: só faixas que começam daqui a pelo menos 1 hora.
  if (schedule.date === today && storeHour(now) >= period.from - 1) {
    return { field: 'period', message: 'Esse horário de hoje já passou. Escolha outro horário ou outro dia.' }
  }
  return undefined
}

export const scheduleSchema = z
  .object({ date: z.string(), period: z.enum(['manha', 'tarde', 'noite']) })
  .superRefine((value, ctx) => {
    const error = scheduleError(value)
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [error.field], message: error.message })
  })

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "sábado, 25/10 — tarde (12h às 18h)". */
export function scheduleLabel(schedule: Schedule): string {
  const day = parseDay(schedule.date)
  const period = DELIVERY_PERIODS[schedule.period]
  const name = period.label.replace(/ \(.*\)$/, '').toLowerCase()
  if (!day) return `${schedule.date} — ${name} (${period.from}h às ${period.to}h)`
  const [, month, date] = schedule.date.split('-')
  return `${WEEKDAYS[day.getUTCDay()]}, ${date}/${month} — ${name} (${period.from}h às ${period.to}h)`
}
