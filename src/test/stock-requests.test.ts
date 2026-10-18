import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/store-db.server', () => ({ syncGatewayPayment: vi.fn() }))

import { seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import { createOrder, placeOrderSchema } from '@/lib/order-flow'
import type { PaymentGateway } from '@/lib/payment-gateway'
import { handlePaymentWebhook } from '@/lib/payment-webhook.server'
import {
  addStockRequest,
  demandByProduct,
  markNotified,
  removeStockRequest,
  restockInputSchema,
  restockMessage,
  StockRequestError,
  type StockRequestsDoc,
} from '@/lib/stock-requests'
import { createStoreNotifier, storeEventMessage } from '@/lib/store-alert'

const NOW = new Date('2026-10-18T12:00:00Z')

function catalogWithStock(stock: Record<string, number | null>): Catalog {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock))
    catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  return catalog
}

const request = (phone = '(15) 99123-4567', quantity?: number) =>
  restockInputSchema.parse({ productId: 'prestigio', name: 'Ana Souza', phone, ...(quantity ? { quantity } : {}) })

const empty: StockRequestsDoc = { requests: [] }

describe('avise-me quando chegar', () => {
  it('registra só bolo esgotado (estoque 0)', () => {
    const { doc, request: saved, waiting } = addStockRequest(empty, catalogWithStock({ prestigio: 0 }), request(), NOW)
    expect(saved).toMatchObject({ productName: 'Prestígio', phone: '5515991234567', status: 'aguardando' })
    expect(waiting).toBe(1)
    expect(doc.requests).toHaveLength(1)

    expect(() => addStockRequest(empty, catalogWithStock({ prestigio: 2 }), request(), NOW)).toThrow(/disponível/)
    expect(() => addStockRequest(empty, seedCatalog(), request(), NOW)).toThrow(StockRequestError)
    expect(() =>
      addStockRequest(
        empty,
        seedCatalog(),
        restockInputSchema.parse({ productId: 'nao-existe', name: 'Ana', phone: '15991234567' }),
      ),
    ).toThrow(/saiu do cardápio/)
  })

  it('o mesmo WhatsApp esperando o mesmo bolo não duplica', () => {
    const catalog = catalogWithStock({ prestigio: 0 })
    const first = addStockRequest(empty, catalog, request(), NOW).doc
    const again = addStockRequest(first, catalog, request('15991234567', 3), NOW)
    expect(again.doc.requests).toHaveLength(1)
    expect(again.request.quantity).toBe(3)
    const other = addStockRequest(again.doc, catalog, request('(15) 98888-7777'), NOW)
    expect(other.waiting).toBe(2)
  })

  it('marca como avisado e remove', () => {
    const doc = addStockRequest(empty, catalogWithStock({ prestigio: 0 }), request(), NOW).doc
    const id = doc.requests[0]!.id
    const notified = markNotified(doc, [id], 'edgard', NOW)
    expect(notified.requests[0]).toMatchObject({ status: 'avisado', notifiedBy: 'edgard' })
    expect(removeStockRequest(notified, id).requests).toHaveLength(0)
    expect(() => markNotified(doc, ['AV-X'], 'edgard')).toThrow(/não encontrado/)
  })

  it('mostra a demanda: avisos + pedidos pendentes, do mais procurado ao menos', () => {
    const catalog = catalogWithStock({ prestigio: 0, 'fuba-goiabada': 0 })
    let doc = addStockRequest(empty, catalog, request('15991234567', 2), NOW).doc
    doc = addStockRequest(doc, catalog, { ...request('15988887777'), productId: 'fuba-goiabada' }, NOW).doc
    const pending = createOrder(
      catalog,
      placeOrderSchema.parse({
        customer: { fulfillment: 'retirada', name: 'Bia Lima', city: 'São Miguel Arcanjo', phone: '15977776666' },
        payment: { method: 'pix' },
        lines: [{ productId: 'prestigio', quantity: 3 }],
      }),
      NOW,
      'OB-PEND',
    ).order

    const demand = demandByProduct(catalog, doc.requests, [pending])
    expect(demand.map(entry => entry.productId)).toEqual(['prestigio', 'fuba-goiabada'])
    expect(demand[0]).toMatchObject({ stock: 0, requested: 5, waiting: [{ name: 'Ana Souza' }] })
    expect(demand[0]!.pendingOrders).toEqual([
      { id: 'OB-PEND', name: 'Bia Lima', phone: '5515977776666', requested: 3 },
    ])

    // Avisados não contam mais na demanda.
    const notified = markNotified(
      doc,
      doc.requests.map(entry => entry.id),
      'ondina',
    )
    expect(demandByProduct(catalog, notified.requests, [])).toEqual([])
  })

  it('mensagem pronta para avisar o cliente', () => {
    expect(restockMessage({ name: 'Ana Souza', productName: 'Prestígio' }, 'https://ondinabolos.com.br')).toMatch(
      /^Oi, Ana! .*Prestígio.*chegou!.*https:\/\/ondinabolos\.com\.br/,
    )
  })
})

describe('avisos para a equipe (n8n)', () => {
  it('manda o evento com a mensagem pronta e não quebra se o n8n falhar', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    const notify = createStoreNotifier({ url: 'https://n8n/aviso', key: 'k' }, fetchMock as unknown as typeof fetch)
    await notify({ event: 'pagamento-aprovado', orderId: 'OB-1', customer: 'Ana', total: 120 })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      event: 'pagamento-aprovado',
      orderId: 'OB-1',
      message: expect.stringContaining('OB-1'),
    })

    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing = createStoreNotifier({ url: 'https://n8n/aviso' }, (async () => {
      throw new Error('fora do ar')
    }) as unknown as typeof fetch)
    await expect(
      failing({ event: 'mensagem-cliente', orderId: 'OB-1', customer: 'Ana', text: 'oi' }),
    ).resolves.toBeUndefined()
    error.mockRestore()
    expect(
      storeEventMessage({
        event: 'aviso-estoque',
        productId: 'p',
        productName: 'Prestígio',
        customer: 'Ana',
        waiting: 3,
      }),
    ).toMatch(/3/)
  })
})

describe('notificação do Mercado Pago', () => {
  const gateway = {} as PaymentGateway
  const post = (body: unknown, query = '', headers: Record<string, string> = {}) =>
    new Request(`https://ondinabolos.com.br/api/payments/webhook${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })

  it('confere o pagamento na API (nunca confia no corpo)', async () => {
    const sync = vi.fn(async () => undefined)
    const response = await handlePaymentWebhook(post({ type: 'payment', data: { id: '555' } }), { gateway, sync })
    expect(response.status).toBe(200)
    expect(sync).toHaveBeenCalledWith(gateway, '555')
  })

  it('ignora o que não é pagamento e ids estranhos', async () => {
    const sync = vi.fn()
    expect(
      (await handlePaymentWebhook(post({ type: 'merchant_order', data: { id: '1' } }), { gateway, sync })).status,
    ).toBe(200)
    expect(
      (await handlePaymentWebhook(post({ type: 'payment', data: { id: '../x' } }), { gateway, sync })).status,
    ).toBe(200)
    expect(sync).not.toHaveBeenCalled()
  })

  it('com segredo configurado, recusa assinatura inválida', async () => {
    const sync = vi.fn()
    const response = await handlePaymentWebhook(
      post({ type: 'payment', data: { id: '555' } }, '?data.id=555&type=payment', { 'x-signature': 'ts=1,v1=abc' }),
      { gateway, sync, secret: 'segredo' },
    )
    expect(response.status).toBe(401)
    expect(sync).not.toHaveBeenCalled()
  })

  it('erro ao gravar responde 500 para o Mercado Pago tentar de novo', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sync = vi.fn(async () => {
      throw new Error('banco fora do ar')
    })
    expect((await handlePaymentWebhook(post({ type: 'payment', data: { id: '555' } }), { gateway, sync })).status).toBe(
      500,
    )
    error.mockRestore()
  })
})
