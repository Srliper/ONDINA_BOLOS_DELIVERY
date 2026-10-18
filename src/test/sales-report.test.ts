import { describe, expect, it } from 'vitest'
import { seedCatalog } from '@/lib/catalog'
import {
  applyGatewayPayment,
  changeStatus,
  confirmPayment,
  createOrder,
  placeOrderSchema,
  type PlaceOrderInput,
} from '@/lib/order-flow'
import { salesReport } from '@/lib/sales-report'

const NOW = new Date('2026-10-18T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

const order = (
  id: string,
  when: Date,
  method: PlaceOrderInput['payment']['method'],
  quantity: number,
  productId = 'prestigio',
) =>
  createOrder(
    seedCatalog(),
    placeOrderSchema.parse({
      customer: { fulfillment: 'retirada', name: 'Ana Souza', city: 'São Miguel Arcanjo', phone: '15991234567' },
      payment: { method },
      lines: [{ productId, quantity }],
    }),
    when,
    id,
  ).order

describe('relatório de vendas', () => {
  const site = applyGatewayPayment(order('OB-1', daysAgo(0), 'online', 2), {
    id: '1',
    status: 'approved',
    amount: 120,
    orderId: 'OB-1',
  }).order
  const whatsapp = confirmPayment(order('OB-2', daysAgo(1), 'pix', 1), 'ondina')
  const unpaid = order('OB-3', daysAgo(2), 'dinheiro', 3)
  const cancelled = changeStatus(order('OB-4', daysAgo(1), 'pix', 5), seedCatalog(), 'cancelado', 'ondina').order
  const old = confirmPayment(order('OB-5', daysAgo(20), 'pix', 4), 'ondina')
  const all = [site, whatsapp, unpaid, cancelled, old]

  it('soma só o que foi pago no período, sem cancelados', () => {
    const report = salesReport(all, 7, NOW)
    expect(report).toMatchObject({
      revenue: 180,
      paidOrders: 2,
      orders: 3,
      openValue: 180,
      cancelled: 1,
      averageTicket: 90,
    })
    expect(report.byChannel).toEqual({ site: { orders: 1, revenue: 120 }, whatsapp: { orders: 2, revenue: 60 } })
  })

  it('um ponto por dia, terminando hoje', () => {
    const report = salesReport(all, 7, NOW)
    expect(report.daily).toHaveLength(7)
    expect(report.daily.at(-1)).toEqual({ date: '2026-10-18', revenue: 120, orders: 1 })
    expect(report.daily.at(-2)).toEqual({ date: '2026-10-17', revenue: 60, orders: 1 })
  })

  it('mais vendidos por valor e período maior pega os antigos', () => {
    const report = salesReport(all, 30, NOW)
    expect(report.revenue).toBe(420)
    expect(report.topProducts[0]).toEqual({ name: 'Prestígio', unit: 'kg', quantity: 7, revenue: 420 })
  })
})
