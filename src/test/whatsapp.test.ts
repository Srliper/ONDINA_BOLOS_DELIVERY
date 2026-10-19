import { describe, expect, it, vi } from 'vitest'
import { cartActions, getCartTotal, toCartItems } from '@/lib/cart-store'
import { fulfillmentSchema, type CheckoutData } from '@/lib/checkout'
import {
  buildOrderMessage,
  buildOrderPayload,
  MAPS_URL,
  N8N_WEBHOOK_URL,
  orderWhatsAppUrl,
  processOrderAndSend,
  type SendDeps,
} from '@/lib/whatsapp'

const item = (id: string, quantity: number) => toCartItems([{ productId: id, quantity }])[0]!
const CUSTOM = {
  base: 'base-red-velvet',
  recheio: 'recheio-morango-ninho',
  cobertura: 'cobertura-brigadeiro',
  decoracao: 'decoracao-morangos',
}

const checkout: CheckoutData = {
  customer: fulfillmentSchema.parse({
    fulfillment: 'entrega',
    name: 'Ana Souza',
    phone: '(15) 99123-4567',
    city: 'São Miguel Arcanjo',
    address: {
      street: 'Rua Tapixi',
      number: '412',
      district: 'Vila Tomaz',
      cep: '18230-000',
      complement: '',
      reference: '',
    },
  }),
  payment: { method: 'dinheiro', changeFor: 200 },
}

describe('buildOrderMessage', () => {
  it('com o pedido registrado, traz o número e o link da página do pedido', () => {
    const items = [item('prestigio', 1)]
    const message = buildOrderMessage({
      items,
      total: getCartTotal(items),
      checkout,
      registered: {
        orderId: 'OB-1',
        status: 'aguardando_pagamento',
        shortages: [],
        trackingUrl: 'https://ondinabolos.com.br/pedido/OB-1?t=abc',
      },
    })
    expect(message).toContain('🧾 *Pedido:* OB-1')
    expect(message.split('\n').at(-1)).toBe('🔗 *Acompanhe o pedido:* https://ondinabolos.com.br/pedido/OB-1?t=abc')
  })

  it('segue o formato oficial, com as camadas do bolo personalizado', () => {
    const items = [...toCartItems([{ custom: CUSTOM, quantity: 1 }]), item('prestigio', 2)]
    expect(buildOrderMessage({ items, total: getCartTotal(items), checkout })).toBe(
      [
        'Olá, Ondina Bolos! Gostaria de fazer um pedido.',
        '',
        '🎂 *Meu Pedido:*',
        '• 1x Bolo Personalizado - R$ 78,00',
        '   ◦ Base: Base Red Velvet',
        '   ◦ Recheio: Morango com Ninho',
        '   ◦ Cobertura: Cobertura de Brigadeiro',
        '   ◦ Decoração: Morangos Frescos',
        '• 2x Prestígio (kg) - R$ 120,00',
        '',
        '🚚 *Frete:* R$ 0,00 (entrega grátis em São Miguel Arcanjo)',
        '💰 *Total Geral:* R$ 198,00',
        '',
        '👤 *Nome:* Ana Souza',
        '📍 *Endereço:* Rua Tapixi, 412 — Vila Tomaz, São Miguel Arcanjo — CEP 18230-000',
        '💳 *Forma de Pagamento:* Dinheiro (troco para R$ 200,00)',
        `🗺️ *Referência do mapa:* ${MAPS_URL}`,
      ].join('\n'),
    )
  })

  it('usa a retirada na loja quando não há entrega', () => {
    const message = buildOrderMessage({
      items: [item('prestigio', 1)],
      total: 60,
      checkout: {
        customer: { fulfillment: 'retirada', name: 'Ana Souza', city: 'Pilar do Sul', phone: '5515991234567' },
        payment: { method: 'cartao' },
      },
    })
    expect(message).toContain('📍 *Endereço:* Retirada na loja (Rua Tapixi, 412')
    expect(message).toContain('💳 *Forma de Pagamento:* Cartão na retirada')
    expect(message).toContain('🚚 *Frete:* Retirada no Local (sem frete)')
  })

  it('gera o link da API oficial do WhatsApp com a mensagem codificada', () => {
    const url = orderWhatsAppUrl('Olá & tchau')
    expect(url).toBe('https://api.whatsapp.com/send?phone=5515997115450&text=Ol%C3%A1%20%26%20tchau')
  })
})

describe('buildOrderPayload', () => {
  it('manda ao n8n os itens, camadas, cliente e a mesma mensagem', () => {
    const items = toCartItems([{ custom: CUSTOM, quantity: 2 }])
    const payload = buildOrderPayload({ items, total: 156, checkout }, 'msg', new Date('2026-10-11T12:00:00Z'))
    expect(payload).toMatchObject({
      createdAt: '2026-10-11T12:00:00.000Z',
      source: 'site',
      customer: { name: 'Ana Souza', fulfillment: 'entrega', details: { street: 'Rua Tapixi', number: '412' } },
      payment: { method: 'dinheiro', label: 'Dinheiro (troco para R$ 200,00)', changeFor: 200 },
      items: [
        {
          type: 'custom',
          name: 'Bolo Personalizado',
          quantity: 2,
          unitPrice: 78,
          subtotal: 156,
          layers: { base: 'Base Red Velvet' },
        },
      ],
      total: 156,
      message: 'msg',
    })
    expect(payload.orderId).toMatch(/^OB-[0-9A-Z]+-[0-9A-Z]{2}$/)
  })
})

describe('processOrderAndSend', () => {
  const setup = (
    fetchImpl: SendDeps['fetch'],
    opened: Window | null = {} as Window,
    register: SendDeps['register'] = () => Promise.reject(new Error('servidor fora do ar')),
  ) => {
    const calls: string[] = []
    const deps: SendDeps = {
      register: vi.fn(register),
      fetch: vi.fn(fetchImpl),
      open: vi.fn(() => {
        calls.push('open')
        return opened
      }),
      navigate: vi.fn(() => {
        calls.push('navigate')
      }),
      celebrate: vi.fn(() => {
        calls.push('confete')
      }),
      wait: () => Promise.resolve(),
    }
    return { deps, calls }
  }
  const items = [item('prestigio', 1)]

  const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {})

  it('registra no site com ids e quantidades, usa o número do pedido e a decisão de estoque do servidor', async () => {
    const register = vi.fn<SendDeps['register']>(() =>
      Promise.resolve({
        orderId: 'OB-SERVIDOR-01',
        status: 'pendente',
        shortages: [{ productId: 'prestigio', name: 'Prestígio', requested: 1, available: 0 }],
      }),
    )
    const { deps } = setup(() => Promise.resolve(new Response('{}')), {} as Window, register)
    const result = await processOrderAndSend(items, 60, checkout, deps)

    expect(register).toHaveBeenCalledWith([{ productId: 'prestigio', quantity: 1 }], checkout)
    expect(result).toMatchObject({ orderId: 'OB-SERVIDOR-01', registered: true, pending: true })
    const body = JSON.parse(vi.mocked(deps.fetch).mock.calls[0]![1]!.body as string)
    expect(body).toMatchObject({ orderId: 'OB-SERVIDOR-01', status: 'pendente', items: [{ outOfStock: true }] })
    expect(body.message).toContain('🧾 *Pedido:* OB-SERVIDOR-01')
    expect(body.message).toContain('⏳ *PEDIDO PENDENTE (falta de estoque):* Prestígio.')
    expect(body.message).toContain(
      '💳 *Forma de Pagamento:* Dinheiro (troco para R$ 200,00) — depois da confirmação do estoque',
    )
  })

  it('manda as camadas do bolo montado por id', async () => {
    const register = vi.fn<SendDeps['register']>(() =>
      Promise.resolve({ orderId: 'OB-1', status: 'aguardando_pagamento', shortages: [] }),
    )
    const { deps } = setup(() => Promise.resolve(new Response('{}')), {} as Window, register)
    const result = await processOrderAndSend(toCartItems([{ custom: CUSTOM, quantity: 2 }]), 156, checkout, deps)
    expect(register).toHaveBeenCalledWith([{ custom: CUSTOM, quantity: 2 }], checkout)
    expect(result.pending).toBe(false)
  })

  it('avisa o n8n com JSON, solta o confete e só então abre o WhatsApp', async () => {
    const error = silence()
    const { deps, calls } = setup(() => Promise.resolve(new Response('{}', { status: 200 })))
    const result = await processOrderAndSend(items, 60, checkout, deps)
    expect(result.registered).toBe(false)
    error.mockRestore()

    expect(deps.fetch).toHaveBeenCalledWith(N8N_WEBHOOK_URL, expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse(vi.mocked(deps.fetch).mock.calls[0]![1]!.body as string)
    expect(body.total).toBe(60)
    expect(body.message).toContain('🎂 *Meu Pedido:*')
    expect(calls).toEqual(['confete', 'open'])
    expect(deps.open).toHaveBeenCalledWith(result.whatsappUrl)
    expect(result.savedToN8n).toBe(true)
  })

  it('abre o WhatsApp mesmo se o n8n cair ou recusar', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const fetchImpl of [
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.resolve(new Response('erro', { status: 500 })),
    ] satisfies SendDeps['fetch'][]) {
      const { deps, calls } = setup(fetchImpl)
      const result = await processOrderAndSend(items, 60, checkout, deps)
      expect(result.savedToN8n).toBe(false)
      expect(calls).toEqual(['confete', 'open'])
    }
    // Registro no site (fora do ar no teste) + n8n, nas duas tentativas.
    expect(error).toHaveBeenCalledTimes(4)
    error.mockRestore()
  })

  it('desiste do n8n depois do tempo limite', async () => {
    vi.useFakeTimers()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { deps, calls } = setup(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )
    const pending = processOrderAndSend(items, 60, checkout, deps)
    await vi.advanceTimersByTimeAsync(3000)
    const result = await pending
    expect(result.savedToN8n).toBe(false)
    expect(calls).toEqual(['confete', 'open'])
    error.mockRestore()
    vi.useRealTimers()
  })

  it('se o pop-up for bloqueado, abre o WhatsApp na própria aba', async () => {
    const error = silence()
    const { deps, calls } = setup(() => Promise.resolve(new Response('{}')), null)
    await processOrderAndSend(items, 60, checkout, deps)
    expect(calls).toEqual(['confete', 'open', 'navigate'])
    error.mockRestore()
  })
})

describe('cartActions', () => {
  it('adiciona, altera, remove e limpa', () => {
    cartActions.clear()
    cartActions.add('prestigio')
    cartActions.add('prestigio', 2)
    cartActions.add('produto-inexistente')
    cartActions.decrement('prestigio')
    cartActions.add('fuba-goiabada')

    const raw = JSON.parse(localStorage.getItem('ondina-bolos:cart:v1') ?? '[]')
    const items = toCartItems(raw)
    expect(items.map(i => [i.id, i.quantity])).toEqual([
      ['prestigio', 2],
      ['fuba-goiabada', 1],
    ])
    expect(getCartTotal(items)).toBe(145)

    cartActions.setQuantity('prestigio', 0)
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([
      { productId: 'fuba-goiabada', quantity: 1 },
    ])

    cartActions.clear()
    expect(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).toEqual([])
  })

  it('soma o mesmo bolo montado em vez de duplicar e calcula o preço pelas camadas', () => {
    cartActions.clear()
    const lineId = cartActions.addCustom(CUSTOM)
    cartActions.addCustom(CUSTOM)
    cartActions.add('prestigio')
    expect(cartActions.addCustom({ ...CUSTOM, base: 'recheio-prestigio' })).toBeUndefined()

    const items = toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!))
    const custom = items.find(i => i.type === 'custom')
    expect(custom).toMatchObject({
      id: lineId,
      name: 'Bolo Personalizado',
      price: 78,
      quantity: 2,
      customConfig: {
        base: 'Base Red Velvet',
        recheio: 'Morango com Ninho',
        cobertura: 'Cobertura de Brigadeiro',
        decoracao: 'Morangos Frescos',
      },
    })
    expect(getCartTotal(items)).toBe(78 * 2 + 60)

    cartActions.decrement(lineId!)
    cartActions.decrement(lineId!)
    expect(toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!)).map(i => i.id)).toEqual(['prestigio'])
    cartActions.clear()
  })

  it('descarta do navegador camadas que saíram do cardápio', () => {
    localStorage.setItem(
      'ondina-bolos:cart:v1',
      JSON.stringify([{ custom: { ...CUSTOM, cobertura: 'cobertura-que-nao-existe' }, quantity: 1 }]),
    )
    expect(toCartItems(JSON.parse(localStorage.getItem('ondina-bolos:cart:v1')!))).toEqual([])
  })
})
