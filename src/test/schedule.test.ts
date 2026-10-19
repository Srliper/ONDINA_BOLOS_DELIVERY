import { describe, expect, it } from 'vitest'
import { addDays, fulfillmentSchema, scheduleError, scheduleLabel, storeToday, type CheckoutData } from '@/lib/checkout'
import { seedCatalog } from '@/lib/catalog'
import { createOrder, placeOrderSchema, trackedView } from '@/lib/order-flow'
import { toCartItems } from '@/lib/cart-store'
import { buildOrderMessage, buildOrderPayload } from '@/lib/whatsapp'

// Segunda-feira, 19/10/2026, 9h em São Miguel Arcanjo (12h UTC).
const MONDAY_9H = new Date('2026-10-19T12:00:00Z')

describe('para quando (data e horário)', () => {
  it('usa o dia de hoje no horário da loja', () => {
    // 1h UTC de terça ainda é segunda à noite em São Paulo.
    expect(storeToday(new Date('2026-10-20T01:00:00Z'))).toBe('2026-10-19')
    expect(addDays('2026-10-19', 13)).toBe('2026-11-01')
  })

  it('aceita dias e faixas dentro do horário da loja', () => {
    expect(scheduleError({ date: '2026-10-19', period: 'tarde' }, MONDAY_9H)).toBeUndefined()
    expect(scheduleError({ date: '2026-10-20', period: 'manha' }, MONDAY_9H)).toBeUndefined()
    expect(scheduleError({ date: '2026-10-24', period: 'noite' }, MONDAY_9H)).toBeUndefined()
  })

  it('recusa passado, domingo, noite fora do sábado e longe demais', () => {
    expect(scheduleError({ date: '2026-10-17', period: 'tarde' }, MONDAY_9H)).toMatchObject({
      field: 'date',
      message: /a partir de hoje/,
    })
    expect(scheduleError({ date: '2026-10-25', period: 'tarde' }, MONDAY_9H)).toMatchObject({
      field: 'date',
      message: /domingos/,
    })
    expect(scheduleError({ date: '2026-10-20', period: 'noite' }, MONDAY_9H)).toMatchObject({
      field: 'period',
      message: /sábados/,
    })
    expect(scheduleError({ date: '2027-01-30', period: 'tarde' }, MONDAY_9H)).toMatchObject({
      field: 'date',
      message: /60 dias/,
    })
    expect(scheduleError({ date: '2026-02-30', period: 'tarde' }, MONDAY_9H)).toMatchObject({ field: 'date' })
    expect(scheduleError({ date: '2026-10-20', period: '' }, MONDAY_9H)).toMatchObject({ field: 'period' })
  })

  it('hoje, só faixas que começam daqui a pelo menos 1 hora', () => {
    expect(scheduleError({ date: '2026-10-19', period: 'manha' }, MONDAY_9H)).toMatchObject({
      field: 'period',
      message: /já passou/,
    })
    expect(scheduleError({ date: '2026-10-19', period: 'tarde' }, new Date('2026-10-19T14:30:00Z'))).toMatchObject({
      field: 'period',
    })
  })

  it('texto pronto para a mensagem e o painel', () => {
    expect(scheduleLabel({ date: '2026-10-24', period: 'tarde' })).toBe('sábado, 24/10 — tarde (12h às 18h)')
    expect(scheduleLabel({ date: '2026-10-24', period: 'noite' })).toBe('sábado, 24/10 — noite (18h às 20h)')
  })

  it('vai junto no pedido, na página do cliente, no WhatsApp e no n8n', () => {
    const schedule = { date: addDays(storeToday(), 1), period: 'tarde' as const }
    // Amanhã pode cair num domingo: nesse caso, depois de amanhã.
    if (scheduleError(schedule)) schedule.date = addDays(schedule.date, 1)
    const customer = {
      fulfillment: 'retirada' as const,
      name: 'Ana Souza',
      city: 'São Miguel Arcanjo',
      phone: '15991234567',
    }
    const parsed = placeOrderSchema.parse({
      customer,
      payment: { method: 'pix' },
      lines: [{ productId: 'prestigio', quantity: 1 }],
      schedule,
    })
    const { order } = createOrder(seedCatalog(), parsed)
    expect(order.schedule).toEqual({ ...schedule, label: scheduleLabel(schedule) })
    expect(trackedView(order).scheduleLabel).toBe(scheduleLabel(schedule))

    const checkout: CheckoutData = { customer: fulfillmentSchema.parse(customer), payment: { method: 'pix' }, schedule }
    const items = toCartItems([{ productId: 'prestigio', quantity: 1 }])
    const message = buildOrderMessage({ items, total: 60, checkout })
    expect(message).toContain(`📅 *Para quando:* ${scheduleLabel(schedule)}`)
    expect(buildOrderPayload({ items, total: 60, checkout }, message).schedule).toMatchObject({ period: 'tarde' })
  })

  it('o servidor recusa data inválida', () => {
    const customer = {
      fulfillment: 'retirada' as const,
      name: 'Ana Souza',
      city: 'São Miguel Arcanjo',
      phone: '15991234567',
    }
    const result = placeOrderSchema.safeParse({
      customer,
      payment: { method: 'pix' },
      lines: [{ productId: 'prestigio', quantity: 1 }],
      schedule: { date: '2020-01-01', period: 'tarde' },
    })
    expect(result.success).toBe(false)
  })
})
