import { describe, expect, it, vi } from 'vitest'
import { fetchOrdersFromN8n, parseOrders } from '@/lib/orders'

const order = (orderId: string, createdAt: string) => ({
  orderId,
  createdAt,
  source: 'site',
  customer: { name: 'Ana', fulfillment: 'entrega', address: 'Rua Tapixi, 412', details: { street: 'Rua Tapixi' } },
  payment: { method: 'pix', label: 'Pix' },
  items: [{ type: 'ready', name: 'Prestígio', quantity: 1, unitPrice: 60, subtotal: 60 }],
  total: 60,
  message: '...',
})

describe('parseOrders', () => {
  it('aceita lista direta, { orders }, { data } e payload em texto (Google Sheets)', () => {
    const a = order('OB-1', '2026-10-10T10:00:00.000Z')
    const b = order('OB-2', '2026-10-11T10:00:00.000Z')
    for (const body of [[a, b], { orders: [a, b] }, { data: [a, b] }, [{ payload: JSON.stringify(a) }, { payload: b }]]) {
      const { orders, skipped } = parseOrders(body)
      expect(orders.map(o => o.orderId)).toEqual(['OB-2', 'OB-1']) // mais novo primeiro
      expect(skipped).toBe(0)
    }
  })

  it('ignora registros quebrados e respostas sem lista', () => {
    expect(parseOrders([{ payload: '{quebrado' }, { orderId: 'só isso' }, order('OB-3', '2026-10-11T00:00:00Z')])).toMatchObject({
      skipped: 2,
      orders: [{ orderId: 'OB-3' }],
    })
    expect(parseOrders('nada')).toEqual({ orders: [], skipped: 0 })
    expect(parseOrders(null)).toEqual({ orders: [], skipped: 0 })
  })

  it('mostra no máximo 50 pedidos', () => {
    const many = Array.from({ length: 60 }, (_, i) => order(`OB-${i}`, new Date(2026, 0, 1, 0, i).toISOString()))
    expect(parseOrders(many).orders).toHaveLength(50)
  })
})

describe('fetchOrdersFromN8n', () => {
  it('manda a chave no cabeçalho e devolve os pedidos', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([order('OB-9', '2026-10-11T00:00:00Z')])))
    const result = await fetchOrdersFromN8n({ url: 'https://n8n.test/webhook/pedidos', key: 'k' }, fetchImpl)
    expect(result).toMatchObject({ status: 'ok', orders: [{ orderId: 'OB-9' }] })
    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers['x-ondina-key']).toBe('k')
  })

  it('transforma falhas do n8n em mensagens, sem quebrar o painel', async () => {
    const down = await fetchOrdersFromN8n({ url: 'x' }, () => Promise.reject(new TypeError('Failed to fetch')))
    expect(down).toEqual({ status: 'error', message: 'Não foi possível falar com o n8n.' })
    const refused = await fetchOrdersFromN8n({ url: 'x' }, () => Promise.resolve(new Response('no', { status: 401 })))
    expect(refused).toEqual({ status: 'error', message: 'O n8n respondeu 401.' })
    const slow = await fetchOrdersFromN8n(
      { url: 'x' },
      (_u, init) => new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')))),
      20,
    )
    expect(slow).toEqual({ status: 'error', message: 'O n8n demorou para responder.' })
  })
})
