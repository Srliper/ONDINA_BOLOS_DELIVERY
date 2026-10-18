import type { Order } from '@/lib/order-flow'

/**
 * Relatório de vendas do painel, calculado dos pedidos guardados (sem banco extra).
 * "Vendido" = pedidos pagos (online ou confirmados pela equipe), sem os cancelados.
 */

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
/** "AAAA-MM-DD" no horário da loja. */
const dayOf = (iso: string | Date) => dayFormat.format(typeof iso === 'string' ? new Date(iso) : iso)

export interface SalesReport {
  days: number
  /** Total pago no período (R$). */
  revenue: number
  paidOrders: number
  /** Pedidos feitos no período (sem cancelados), pagos ou não. */
  orders: number
  /** Ainda não pagos (aguardando, pendentes, a pagar na entrega). */
  openValue: number
  cancelled: number
  averageTicket: number
  byChannel: Record<Order['channel'], { orders: number; revenue: number }>
  /** Bolos que mais venderam (por valor), até 5. */
  topProducts: { name: string; unit: 'kg' | 'un'; quantity: number; revenue: number }[]
  /** Um item por dia do período, do mais antigo ao de hoje. */
  daily: { date: string; revenue: number; orders: number }[]
}

export function salesReport(orders: readonly Order[], days: number, now = new Date()): SalesReport {
  const dates: string[] = []
  for (let back = days - 1; back >= 0; back--) dates.push(dayOf(new Date(now.getTime() - back * 86_400_000)))
  const first = dates[0]!
  const inPeriod = orders.filter(order => dayOf(order.createdAt) >= first && dayOf(order.createdAt) <= dates.at(-1)!)
  const active = inPeriod.filter(order => order.status !== 'cancelado')
  const paid = active.filter(order => order.paid)

  const daily = new Map(dates.map(date => [date, { date, revenue: 0, orders: 0 }]))
  for (const order of active) {
    const entry = daily.get(dayOf(order.createdAt))
    if (!entry) continue
    entry.orders++
    if (order.paid) entry.revenue += order.total
  }

  const byChannel: SalesReport['byChannel'] = { site: { orders: 0, revenue: 0 }, whatsapp: { orders: 0, revenue: 0 } }
  for (const order of active) {
    byChannel[order.channel].orders++
    if (order.paid) byChannel[order.channel].revenue += order.total
  }

  const products = new Map<string, SalesReport['topProducts'][number]>()
  for (const order of paid) {
    for (const item of order.items) {
      const key = `${item.name}|${item.unit}`
      const entry = products.get(key) ?? { name: item.name, unit: item.unit, quantity: 0, revenue: 0 }
      entry.quantity += item.quantity
      entry.revenue += item.subtotal
      products.set(key, entry)
    }
  }

  const revenue = paid.reduce((sum, order) => sum + order.total, 0)
  return {
    days,
    revenue,
    paidOrders: paid.length,
    orders: active.length,
    openValue: active.filter(order => !order.paid).reduce((sum, order) => sum + order.total, 0),
    cancelled: inPeriod.length - active.length,
    averageTicket: paid.length ? revenue / paid.length : 0,
    byChannel,
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    daily: [...daily.values()],
  }
}
