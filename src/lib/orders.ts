import { z } from 'zod'

/**
 * Pedidos no formato antigo (antes do fluxo com status de src/lib/order-flow.ts), guardados pela
 * versão anterior do site. Só leitura: o painel ainda mostra esses pedidos, sem ações.
 */

const itemSchema = z.object({
  productId: z.string().max(60).optional(),
  name: z.string(),
  quantity: z.number(),
  subtotal: z.number(),
  outOfStock: z.boolean().optional(),
  layers: z.object({ base: z.string(), recheio: z.string(), cobertura: z.string(), decoracao: z.string() }).optional(),
})

export const storedOrderSchema = z.object({
  orderId: z.string(),
  createdAt: z.string(),
  status: z.enum(['novo', 'pendente']).optional(),
  customer: z.object({
    name: z.string(),
    fulfillment: z.enum(['entrega', 'retirada']),
    address: z.string(),
  }),
  payment: z.object({ label: z.string() }),
  items: z.array(itemSchema),
  total: z.number(),
})

export type StoredOrder = z.infer<typeof storedOrderSchema>

/** Confirmação feita no painel antigo (por quem, quando e o que saiu do estoque). */
export interface OrderConfirmation {
  at: string
  by: string
  stock: { id: string; name: string; from: number; to: number }[]
}

export type LegacyOrder = StoredOrder & { confirmation?: OrderConfirmation }
