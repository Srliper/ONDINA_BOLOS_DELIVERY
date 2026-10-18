import { describe, expect, it } from 'vitest'
import { seedCatalog, updateItem, type Catalog } from '@/lib/catalog'
import {
  addOrder,
  changeStatus,
  confirmPayment,
  createOrder,
  MAX_STORED_ORDERS,
  OrderError,
  placeOrderSchema,
  revalidateStock,
  transitionError,
  type Order,
  type PlaceOrderInput,
} from '@/lib/order-flow'

const NOW = new Date('2026-10-14T12:00:00Z')

function catalogWithStock(stock: Record<string, number | null>): Catalog {
  let catalog = seedCatalog()
  for (const [id, value] of Object.entries(stock))
    catalog = updateItem(catalog, 'products', id, { stock: value }, NOW).catalog
  return catalog
}

const stockOf = (catalog: Catalog, id: string) => catalog.products.find(product => product.id === id)?.stock

const input = (lines: PlaceOrderInput['lines'], method: 'pix' | 'cartao' | 'dinheiro' = 'pix') =>
  placeOrderSchema.parse({
    customer: {
      fulfillment: 'entrega',
      name: 'Ana Souza',
      phone: '(15) 99123-4567',
      city: 'São Miguel Arcanjo',
      address: { street: 'Rua Tapixi', number: '412', district: 'Vila Tomaz', cep: '18230000' },
    },
    payment: { method },
    lines,
  } satisfies PlaceOrderInput)

const place = (catalog: Catalog, lines: PlaceOrderInput['lines'], method?: 'pix' | 'cartao' | 'dinheiro') =>
  createOrder(catalog, input(lines, method), NOW, 'OB-TESTE')

describe('finalizar pedido', () => {
  it('com estoque: segue para "Aguardando pagamento" e baixa o estoque na hora', () => {
    const catalog = catalogWithStock({ prestigio: 5 })
    const { order, catalog: after } = place(catalog, [{ productId: 'prestigio', quantity: 2 }])
    expect(order).toMatchObject({ status: 'aguardando_pagamento', stockReserved: true, paid: false, shortages: [] })
    expect(stockOf(after, 'prestigio')).toBe(3)
    expect(order.customer).toMatchObject({ name: 'Ana Souza', cep: '18230-000' })
    expect(order.customer.address).toContain('CEP 18230-000')
  })

  it('faltou estoque: cria como PENDENTE, sem baixar nada', () => {
    const catalog = catalogWithStock({ prestigio: 1, 'fuba-goiabada': 4 })
    const { order, catalog: after } = place(catalog, [
      { productId: 'prestigio', quantity: 2 },
      { productId: 'fuba-goiabada', quantity: 1 },
    ])
    expect(order.status).toBe('pendente')
    expect(order.stockReserved).toBe(false)
    expect(order.shortages).toEqual([{ productId: 'prestigio', name: 'Prestígio', requested: 2, available: 1 }])
    expect(after).toBe(catalog)
    expect(order.history[0]?.note).toMatch(/Prestígio \(pediu 2 kg, há 1 kg\)/)
  })

  it('soma linhas repetidas do mesmo bolo ao conferir o estoque', () => {
    const catalog = catalogWithStock({ prestigio: 3 })
    const { order } = place(catalog, [
      { productId: 'prestigio', quantity: 2 },
      { productId: 'prestigio', quantity: 2 },
    ])
    expect(order.status).toBe('pendente')
  })

  it('bolo sem controle de estoque e bolo montado nunca deixam pendente', () => {
    const { order } = place(seedCatalog(), [
      { productId: 'prestigio', quantity: 40 },
      {
        custom: {
          base: 'base-red-velvet',
          recheio: 'recheio-morango-ninho',
          cobertura: 'cobertura-brigadeiro',
          decoracao: 'decoracao-morangos',
        },
        quantity: 1,
      },
    ])
    expect(order.status).toBe('aguardando_pagamento')
  })

  it('recalcula os preços pelo catálogo (o navegador só manda ids e quantidades)', () => {
    const catalog = updateItem(seedCatalog(), 'products', 'prestigio', { price: 70 }, NOW).catalog
    const { order } = place(catalog, [
      { productId: 'prestigio', quantity: 2 },
      {
        custom: {
          base: 'base-red-velvet',
          recheio: 'recheio-morango-ninho',
          cobertura: 'cobertura-brigadeiro',
          decoracao: 'decoracao-morangos',
        },
        quantity: 1,
      },
    ])
    expect(order.items[0]).toMatchObject({ name: 'Prestígio', unitPrice: 70, subtotal: 140 })
    expect(order.items[1]).toMatchObject({ name: 'Bolo Personalizado', unitPrice: 78 })
    expect(order.total).toBe(218)
  })

  it('recusa bolo que saiu do cardápio e camada no lugar errado', () => {
    expect(() => place(seedCatalog(), [{ productId: 'nao-existe', quantity: 1 }])).toThrow(OrderError)
    expect(() =>
      place(seedCatalog(), [
        {
          custom: {
            base: 'recheio-prestigio',
            recheio: 'recheio-morango-ninho',
            cobertura: 'cobertura-brigadeiro',
            decoracao: 'decoracao-morangos',
          },
          quantity: 1,
        },
      ]),
    ).toThrow(/camadas/)
  })

  it('valida a entrada: carrinho vazio e quantidades absurdas', () => {
    expect(placeOrderSchema.safeParse({ ...input([{ productId: 'prestigio', quantity: 1 }]), lines: [] }).success).toBe(
      false,
    )
    expect(
      placeOrderSchema.safeParse({
        ...input([{ productId: 'prestigio', quantity: 1 }]),
        lines: [{ productId: 'prestigio', quantity: 999 }],
      }).success,
    ).toBe(false)
  })
})

describe('bloqueio do pedido PENDENTE', () => {
  const pendingOrder = () => {
    const catalog = catalogWithStock({ prestigio: 0 })
    return { catalog, order: place(catalog, [{ productId: 'prestigio', quantity: 2 }]).order }
  }

  it('não avança para nenhuma etapa pelo seletor, mesmo que o admin tente', () => {
    const { catalog, order } = pendingOrder()
    for (const status of ['aguardando_pagamento', 'em_preparo', 'saiu_para_entrega', 'entregue'] as const) {
      expect(transitionError(order, status)).toMatch(/PENDENTE/)
      expect(() => changeStatus(order, catalog, status, 'ondina', NOW)).toThrow(/PENDENTE/)
    }
  })

  it('não aceita "Confirmar pagamento"', () => {
    expect(() => confirmPayment(pendingOrder().order, 'ondina', NOW)).toThrow(/PENDENTE/)
  })

  it('só é liberado depois da entrada no estoque e da verificação', () => {
    const { catalog, order } = pendingOrder()

    const still = revalidateStock(order, catalog, 'ondina', NOW)
    expect(still.released).toBe(false)
    expect(still.order.status).toBe('pendente')

    const restocked = updateItem(catalog, 'products', 'prestigio', { stock: 5 }, NOW).catalog
    const released = revalidateStock(order, restocked, 'ondina', NOW)
    expect(released.released).toBe(true)
    expect(released.order).toMatchObject({ status: 'aguardando_pagamento', stockReserved: true, shortages: [] })
    expect(stockOf(released.catalog, 'prestigio')).toBe(3)
    expect(released.order.history.at(-1)).toMatchObject({ status: 'aguardando_pagamento', by: 'ondina' })
  })

  it('pode ser cancelado (sem mexer no estoque, que não foi reservado)', () => {
    const { catalog, order } = pendingOrder()
    const result = changeStatus(order, catalog, 'cancelado', 'ondina', NOW)
    expect(result.order.status).toBe('cancelado')
    expect(result.catalog).toBe(catalog)
  })

  it('o sistema é o único que marca PENDENTE', () => {
    const { order } = place(seedCatalog(), [{ productId: 'prestigio', quantity: 1 }])
    expect(transitionError(order, 'pendente')).toMatch(/Só o sistema/)
  })
})

describe('fluxo de entrega', () => {
  const placed = (method: 'pix' | 'cartao' | 'dinheiro' = 'pix') => {
    const catalog = catalogWithStock({ prestigio: 5 })
    const result = place(catalog, [{ productId: 'prestigio', quantity: 2 }], method)
    return { order: result.order, catalog: result.catalog }
  }

  it('Pix: confirma o pagamento e vai para o preparo; antes disso o preparo fica travado', () => {
    const { order } = placed('pix')
    expect(transitionError(order, 'em_preparo')).toMatch(/Confirme o pagamento/)
    const paid = confirmPayment(order, 'ondina', NOW)
    expect(paid).toMatchObject({ paid: true, status: 'em_preparo', paidAt: NOW.toISOString() })
    expect(() => confirmPayment(paid, 'ondina', NOW)).toThrow(/já foi confirmado/)
  })

  it('dinheiro/cartão (pago na entrega): pode preparar antes e "Entregue" marca como pago', () => {
    const { order, catalog } = placed('dinheiro')
    expect(transitionError(order, 'em_preparo')).toBeUndefined()
    const preparing = changeStatus(order, catalog, 'em_preparo', 'ondina', NOW).order
    const out = changeStatus(preparing, catalog, 'saiu_para_entrega', 'ondina', NOW).order
    const delivered = changeStatus(out, catalog, 'entregue', 'ondina', NOW).order
    expect(delivered).toMatchObject({ status: 'entregue', paid: true })
    expect(transitionError(delivered, 'cancelado')).toMatch(/não muda mais/)
  })

  it('cancelar devolve o estoque reservado', () => {
    const { order, catalog } = placed()
    expect(stockOf(catalog, 'prestigio')).toBe(3)
    const cancelled = changeStatus(order, catalog, 'cancelado', 'ondina', NOW)
    expect(cancelled.order).toMatchObject({ status: 'cancelado', stockReserved: false })
    expect(stockOf(cancelled.catalog, 'prestigio')).toBe(5)
  })
})

describe('banco de pedidos', () => {
  it('guarda o mais novo primeiro e, cheio, tira o finalizado mais antigo', () => {
    const make = (id: string, status: Order['status']): Order => ({
      ...place(seedCatalog(), [{ productId: 'prestigio', quantity: 1 }]).order,
      id,
      status,
    })
    let doc = { orders: [make('antigo-entregue', 'entregue')] as Order[] }
    for (let i = 1; i < MAX_STORED_ORDERS; i++) doc = addOrder(doc, make(`aberto-${i}`, 'aguardando_pagamento'))
    expect(doc.orders).toHaveLength(MAX_STORED_ORDERS)
    doc = addOrder(doc, make('novo', 'pendente'))
    expect(doc.orders).toHaveLength(MAX_STORED_ORDERS)
    expect(doc.orders[0]?.id).toBe('novo')
    expect(doc.orders.some(order => order.id === 'antigo-entregue')).toBe(false)
  })
})
