import { describe, expect, it, vi } from 'vitest'
import { seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import {
  addMessage,
  applyGatewayPayment,
  canPayOnline,
  changeStatus,
  createOrder,
  markRead,
  MAX_MESSAGES,
  orderSchema,
  ordersPulse,
  OrderError,
  placeOrderSchema,
  revalidateStock,
  tokenMatches,
  trackedView,
  trackingPath,
  unreadForCustomer,
  unreadForStore,
  type Order,
  type PlaceOrderInput,
} from '@/lib/order-flow'
import { buildPreference, createMercadoPago, validWebhookSignature } from '@/lib/payment-gateway'
import { processOrderOnSite, type SiteOrderDeps } from '@/lib/site-order'
import { toCartItems } from '@/lib/cart-store'
import { fulfillmentSchema } from '@/lib/checkout'

const NOW = new Date('2026-10-18T12:00:00Z')
const LATER = new Date('2026-10-18T12:05:00Z')
const TOKEN = 'a'.repeat(32)

function catalogWithStock(stock: Record<string, number | null>): Catalog {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock))
    catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  return catalog
}

const input = (lines: PlaceOrderInput['lines'], method: PlaceOrderInput['payment']['method'] = 'online') =>
  placeOrderSchema.parse({
    customer: { fulfillment: 'retirada', name: 'Ana Souza', city: 'São Miguel Arcanjo', phone: '(15) 99123-4567' },
    payment: { method },
    lines,
  } satisfies PlaceOrderInput)

const onlineOrder = (stock = 5, quantity = 2): Order =>
  createOrder(
    catalogWithStock({ prestigio: stock }),
    input([{ productId: 'prestigio', quantity }]),
    NOW,
    'OB-SITE',
    TOKEN,
  ).order

describe('pedido pelo site', () => {
  it('guarda canal, WhatsApp do cliente e a chave da página do pedido', () => {
    const order = onlineOrder()
    expect(order).toMatchObject({ channel: 'site', accessToken: TOKEN, status: 'aguardando_pagamento', messages: [] })
    expect(order.customer.phone).toBe('5515991234567')
    expect(order.payment.label).toBe('Pagamento online (Pix ou cartão)')
    expect(canPayOnline(order)).toBe(true)
    expect(trackingPath(order)).toBe(`/pedido/OB-SITE?t=${TOKEN}`)
  })

  it('pedido pelo WhatsApp continua no canal WhatsApp e não paga pelo site', () => {
    const order = createOrder(seedCatalog(), input([{ productId: 'prestigio', quantity: 1 }], 'pix'), NOW).order
    expect(order.channel).toBe('whatsapp')
    expect(order.accessToken).toMatch(/^[a-f0-9]{32}$/)
    expect(canPayOnline(order)).toBe(false)
  })

  it('pendente (sem estoque) não pode pagar até o estoque ser confirmado', () => {
    const catalog = catalogWithStock({ prestigio: 0 })
    const order = createOrder(catalog, input([{ productId: 'prestigio', quantity: 2 }]), NOW, 'OB-P', TOKEN).order
    expect(order.status).toBe('pendente')
    expect(canPayOnline(order)).toBe(false)
    const restocked = updateItem(catalog, 'products', 'prestigio', { stock: 3 }, NOW).catalog
    expect(canPayOnline(revalidateStock(order, restocked, 'ondina', NOW).order)).toBe(true)
  })

  it('pedidos guardados antes desta versão continuam válidos', () => {
    const { channel: _channel, accessToken: _token, messages: _messages, ...old } = onlineOrder()
    const parsed = orderSchema.parse({
      ...old,
      customer: { ...old.customer, phone: undefined },
      payment: { ...old.payment, method: 'pix' },
    })
    expect(parsed).toMatchObject({ channel: 'whatsapp', messages: [] })
    expect(parsed.accessToken).toBeUndefined()
  })
})

describe('pagamento confirmado pelo gateway', () => {
  const approved = { id: '123', status: 'approved', amount: 120, orderId: 'OB-SITE' }

  it('aprovado com o valor certo: pago e direto para o preparo', () => {
    const order = onlineOrder()
    expect(order.total).toBe(120)
    const result = applyGatewayPayment(order, approved, LATER)
    expect(result).toMatchObject({ changed: true, approved: true })
    expect(result.order).toMatchObject({
      paid: true,
      status: 'em_preparo',
      gateway: { paymentId: '123', status: 'approved' },
    })
    expect(result.order.history.at(-1)).toMatchObject({ by: 'mercadopago', status: 'em_preparo' })
    expect(canPayOnline(result.order)).toBe(false)
  })

  it('a mesma notificação repetida não muda nada', () => {
    const once = applyGatewayPayment(onlineOrder(), approved, LATER).order
    expect(applyGatewayPayment(once, approved, LATER)).toMatchObject({ changed: false, approved: false, order: once })
  })

  it('pendente ou recusado: só registra o status, sem marcar pago', () => {
    const result = applyGatewayPayment(onlineOrder(), { ...approved, status: 'rejected' }, LATER)
    expect(result.order).toMatchObject({ paid: false, status: 'aguardando_pagamento', gateway: { status: 'rejected' } })
    expect(trackedView(result.order).gatewayStatus).toBe('rejected')
  })

  it('valor menor que o total não confirma o pedido', () => {
    const result = applyGatewayPayment(onlineOrder(), { ...approved, amount: 1 }, LATER)
    expect(result.order.paid).toBe(false)
    expect(result.order.history.at(-1)?.note).toMatch(/menor que o total/)
  })

  it('recusa pagamento de outro pedido', () => {
    expect(() => applyGatewayPayment(onlineOrder(), { ...approved, orderId: 'OB-OUTRO' }, LATER)).toThrow(OrderError)
  })

  it('pago com o pedido cancelado: marca pago e lembra de devolver', () => {
    const cancelled = changeStatus(onlineOrder(), seedCatalog(), 'cancelado', 'ondina', NOW).order
    const result = applyGatewayPayment(cancelled, approved, LATER)
    expect(result.order).toMatchObject({ paid: true, status: 'cancelado' })
    expect(result.order.history.at(-1)?.note).toMatch(/devolva/)
  })
})

describe('conversa pela página do pedido', () => {
  it('conta as não lidas de cada lado e quem responde já leu', () => {
    let order = addMessage(onlineOrder(), 'cliente', '  Pode ser às 15h? ', undefined, NOW)
    expect(order.messages[0]).toMatchObject({ from: 'cliente', text: 'Pode ser às 15h?' })
    expect(unreadForStore(order)).toBe(1)
    expect(unreadForCustomer(order)).toBe(0)

    order = addMessage(order, 'loja', 'Pode sim!', 'ondina', LATER)
    expect(unreadForStore(order)).toBe(0)
    expect(unreadForCustomer(order)).toBe(1)
    expect(order.messages[1]?.by).toBe('ondina')

    order = markRead(order, 'cliente', LATER)
    expect(unreadForCustomer(order)).toBe(0)
  })

  it('recusa mensagem vazia e respeita o limite da conversa', () => {
    expect(() => addMessage(onlineOrder(), 'cliente', '   ')).toThrow(/Escreva/)
    const full = {
      ...onlineOrder(),
      messages: Array.from({ length: MAX_MESSAGES }, () => ({
        at: NOW.toISOString(),
        from: 'cliente' as const,
        text: 'oi',
      })),
    }
    expect(() => addMessage(full, 'cliente', 'mais uma')).toThrow(/limite/)
  })

  it('a página do cliente não mostra telefone, chave nem quem da equipe respondeu', () => {
    const order = addMessage(onlineOrder(), 'loja', 'Oi!', 'kaique', NOW)
    const view = JSON.stringify(trackedView(order))
    expect(view).not.toContain('5515991234567')
    expect(view).not.toContain(TOKEN)
    expect(view).not.toContain('kaique')
    expect(trackedView(order)).toMatchObject({
      firstName: 'Ana',
      canPay: true,
      messages: [{ from: 'loja', text: 'Oi!' }],
    })
  })

  it('confere a chave do pedido', () => {
    const order = onlineOrder()
    expect(tokenMatches(order, TOKEN)).toBe(true)
    expect(tokenMatches(order, 'b'.repeat(32))).toBe(false)
    expect(tokenMatches({ ...order, accessToken: undefined }, '')).toBe(false)
  })
})

describe('avisos do painel', () => {
  it('resume o que precisa de atenção', () => {
    const toDeliver = applyGatewayPayment(onlineOrder(), {
      id: '1',
      status: 'approved',
      amount: 120,
      orderId: 'OB-SITE',
    }).order
    const waiting = addMessage({ ...onlineOrder(), id: 'OB-2' }, 'cliente', 'Oi')
    const done = { ...onlineOrder(), id: 'OB-3', status: 'entregue' as const }
    const pulse = ordersPulse([toDeliver, waiting, done])
    expect(pulse).toMatchObject({ open: 2, toDeliver: 1, awaitingPayment: 1, pending: 0, unread: 1 })
    expect(pulse.toDeliverIds).toEqual(['OB-SITE'])
    expect(pulse.openIds).toEqual(['OB-SITE', 'OB-2'])
  })
})

describe('Mercado Pago', () => {
  it('monta a preferência com os itens e o total do servidor', () => {
    const order = onlineOrder()
    const preference = buildPreference(order, 'https://ondinabolos.com.br/')
    expect(preference.external_reference).toBe('OB-SITE')
    expect(preference.items).toEqual([
      { id: 'prestigio', title: 'Prestígio (kg)', quantity: 2, unit_price: 60, currency_id: 'BRL' },
    ])
    expect(preference.back_urls.success).toBe(`https://ondinabolos.com.br/pedido/OB-SITE?t=${TOKEN}`)
    expect(preference).toMatchObject({
      auto_return: 'approved',
      notification_url: 'https://ondinabolos.com.br/api/payments/webhook',
    })
  })

  it('no computador (http) não pede volta automática nem notificação', () => {
    const preference = buildPreference(onlineOrder(), 'http://localhost:3000')
    expect(preference).not.toHaveProperty('notification_url')
    expect(preference).not.toHaveProperty('auto_return')
  })

  it('cria o checkout e lê o pagamento pela API', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/checkout/preferences')
        ? Response.json({ id: 'pref-1', init_point: 'https://mp/checkout', sandbox_init_point: 'https://mp/sandbox' })
        : Response.json({ id: 987, status: 'approved', transaction_amount: 120, external_reference: 'OB-SITE' }),
    )
    const gateway = createMercadoPago('APP_USR-123', fetchMock as unknown as typeof fetch)
    expect(await gateway.createCheckout(onlineOrder(), 'https://ondinabolos.com.br')).toEqual({
      preferenceId: 'pref-1',
      url: 'https://mp/checkout',
    })
    expect(await gateway.getPayment('987')).toEqual({ id: '987', status: 'approved', amount: 120, orderId: 'OB-SITE' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer APP_USR-123')

    const sandbox = createMercadoPago('TEST-1', fetchMock as unknown as typeof fetch)
    expect((await sandbox.createCheckout(onlineOrder(), 'https://x')).url).toBe('https://mp/sandbox')
    await expect(gateway.getPayment('../../users')).rejects.toThrow()
  })

  it('erro do Mercado Pago vira uma mensagem amigável', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const gateway = createMercadoPago(
      'APP_USR-1',
      (async () => new Response('falhou', { status: 500 })) as unknown as typeof fetch,
    )
    await expect(gateway.createCheckout(onlineOrder(), 'https://x')).rejects.toThrow(/Tente de novo/)
    error.mockRestore()
  })

  it('confere a assinatura da notificação', async () => {
    const secret = 'segredo'
    const manifest = 'id:123;request-id:req-1;ts:1700000000;'
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
    const v1 = Array.from(mac, byte => byte.toString(16).padStart(2, '0')).join('')
    expect(await validWebhookSignature(secret, `ts=1700000000,v1=${v1}`, 'req-1', '123')).toBe(true)
    expect(await validWebhookSignature(secret, `ts=1700000000,v1=${v1}`, 'req-2', '123')).toBe(false)
    expect(await validWebhookSignature(secret, null, 'req-1', '123')).toBe(false)
  })
})

describe('processOrderOnSite', () => {
  const checkout = {
    customer: fulfillmentSchema.parse({
      fulfillment: 'retirada',
      name: 'Ana Souza',
      city: 'Pilar do Sul',
      phone: '15991234567',
    }),
    payment: { method: 'online' as const },
  }
  const items = toCartItems([{ productId: 'prestigio', quantity: 1 }])

  const deps = (status: 'aguardando_pagamento' | 'pendente', startPayment: SiteOrderDeps['startPayment']) => {
    const navigate = vi.fn()
    const remember = vi.fn()
    const value: SiteOrderDeps = {
      register: async () => ({ orderId: 'OB-1', status, accessToken: TOKEN }),
      startPayment,
      navigate,
      remember,
      celebrate: () => undefined,
    }
    return { value, navigate, remember }
  }

  it('com estoque: leva para o pagamento do Mercado Pago', async () => {
    const { value, navigate, remember } = deps('aguardando_pagamento', async () => 'https://mp/checkout')
    const result = await processOrderOnSite(items, checkout, value)
    expect(navigate).toHaveBeenCalledWith('https://mp/checkout')
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({ id: 'OB-1', url: `/pedido/OB-1?t=${TOKEN}` }))
    expect(result).toMatchObject({ pending: false, paymentUrl: 'https://mp/checkout' })
  })

  it('pendente: não cobra e vai para a página do pedido', async () => {
    const startPayment = vi.fn(async () => 'nunca')
    const { value, navigate } = deps('pendente', startPayment)
    await processOrderOnSite(items, checkout, value)
    expect(startPayment).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(`/pedido/OB-1?t=${TOKEN}`)
  })

  it('pagamento fora do ar: o pedido fica guardado e o cliente paga pela página dele', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { value, navigate } = deps('aguardando_pagamento', async () => {
      throw new Error('fora do ar')
    })
    await processOrderOnSite(items, checkout, value)
    expect(navigate).toHaveBeenCalledWith(`/pedido/OB-1?t=${TOKEN}`)
    error.mockRestore()
  })

  it('falha ao registrar sobe para o carrinho oferecer o WhatsApp', async () => {
    const { value, navigate } = deps('aguardando_pagamento', async () => 'x')
    value.register = async () => {
      throw new Error('O pagamento pelo site está indisponível agora.')
    }
    await expect(processOrderOnSite(items, checkout, value)).rejects.toThrow(/indisponível/)
    expect(navigate).not.toHaveBeenCalled()
  })
})
