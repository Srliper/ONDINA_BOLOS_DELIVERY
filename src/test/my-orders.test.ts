import { beforeEach, describe, expect, it } from 'vitest'
import { recentOrders, rememberOrder } from '@/lib/my-orders'

describe('Meus pedidos (neste aparelho)', () => {
  beforeEach(() => window.localStorage.clear())

  it('guarda os 5 mais recentes, sem repetir', () => {
    for (let n = 1; n <= 7; n++) rememberOrder({ id: `OB-${n}`, url: `/pedido/OB-${n}?t=x`, createdAt: '2026-10-18T12:00:00Z' })
    rememberOrder({ id: 'OB-5', url: '/pedido/OB-5?t=x', createdAt: '2026-10-18T13:00:00Z' })
    expect(recentOrders().map(order => order.id)).toEqual(['OB-5', 'OB-7', 'OB-6', 'OB-4', 'OB-3'])
  })

  it('ignora lixo guardado', () => {
    window.localStorage.setItem('ondina:my-orders', '{"quebrado":')
    expect(recentOrders()).toEqual([])
    window.localStorage.setItem('ondina:my-orders', JSON.stringify([{ id: 1 }, { id: 'OB-1', url: '/pedido/OB-1' }]))
    expect(recentOrders()).toEqual([{ id: 'OB-1', url: '/pedido/OB-1' }])
  })
})
