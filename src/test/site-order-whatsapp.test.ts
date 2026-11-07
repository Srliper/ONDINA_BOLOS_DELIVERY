import { describe, expect, it, vi } from 'vitest'
import { seedCatalog } from '@/lib/catalog'
import { createOrder, placeOrderSchema, trackedView, type Order } from '@/lib/order-flow'
import { createStoreNotifier, orderDetails } from '@/lib/store-alert'
import { trackedOrderMessage, trackedOrderWhatsAppUrl, WHATSAPP_NUMBER } from '@/lib/whatsapp'

const NOW = new Date('2026-10-14T12:00:00Z')

function paidSiteOrder(): Order {
  const input = placeOrderSchema.parse({
    customer: {
      fulfillment: 'entrega',
      name: 'Maria Oliveira',
      phone: '(15) 99700-1122',
      city: 'São Miguel Arcanjo',
      address: { street: 'Rua XV de Novembro', number: '230', district: 'Centro', cep: '18230000' },
    },
    payment: { method: 'online' },
    lines: [{ productId: 'prestigio', quantity: 2 }],
  })
  const { order } = createOrder(seedCatalog(), input, NOW, 'OB-SITE')
  return { ...order, paid: true, status: 'em_preparo' }
}

describe('pedido do site no WhatsApp da loja', () => {
  it('a cliente manda o pedido pago, com itens, total, endereço e link — sem o telefone', () => {
    const order = paidSiteOrder()
    const text = trackedOrderMessage(trackedView(order, NOW), 'https://site/pedido/OB-SITE?t=abc')
    expect(text).toContain('🧾 *Pedido:* OB-SITE')
    expect(text).toContain('✅ *Pagamento:* pago pelo site')
    expect(text).toMatch(/• 2(x| kg) .+ - R\$/)
    expect(text).toContain('👤 *Nome:* Maria')
    expect(text).toContain('📍 *Entrega em:* Rua XV de Novembro, 230')
    expect(text).toContain('🔗 *Pedido no site:* https://site/pedido/OB-SITE?t=abc')
    expect(text).not.toContain('99700')
    const url = trackedOrderWhatsAppUrl(trackedView(order, NOW))
    expect(url).toContain(`phone=${WHATSAPP_NUMBER}`)
    expect(decodeURIComponent(url)).not.toContain('Pedido no site')
  })

  it('o aviso do n8n leva o pedido inteiro; a linha curta continua igual', async () => {
    const order = paidSiteOrder()
    const details = orderDetails(order)
    expect(details).toContain('📞 WhatsApp do cliente: 5515997001122')
    expect(details).toContain('📍 Entrega: Rua XV de Novembro, 230')

    const fetchMock = vi.fn(async () => new Response('{}'))
    const notify = createStoreNotifier({ url: 'https://n8n/aviso' }, fetchMock as unknown as typeof fetch)
    await notify({ event: 'pagamento-aprovado', orderId: order.id, customer: 'Maria Oliveira', total: 60, details })
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(sent.message).toMatch(/^✅ Pagamento online aprovado: OB-SITE/)
    expect(sent.message).toContain(details)
    expect(sent.details).toBe(details)
  })
})
