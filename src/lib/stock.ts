import { formatQuantity } from '@/data/products'
import type { CartItem, Product, ReadyCartItem } from '@/types/product'

/**
 * Estoque dos bolos prontos (marcado pela equipe no /admin, em kg ou bolos).
 * Quando falta estoque, o site não passa pela etapa de pagamento: o pedido vai pelo
 * WhatsApp marcado como PENDENTE e a Ondina confirma a disponibilidade na conversa.
 * Bolos montados no Monte seu Bolo são sempre feitos sob encomenda (sem estoque).
 */

/** Estoque zerado (bolo sem controle de estoque nunca esgota). */
export const isSoldOut = (product: Product): boolean => product.stock !== null && product.stock <= 0

/** A quantidade pedida passa do que há em estoque. */
export const lacksStock = (item: CartItem): item is ReadyCartItem =>
  item.type === 'ready' && item.product.stock !== null && item.quantity > item.product.stock

/** Itens do carrinho que deixam o pedido pendente. */
export const pendingItems = (items: readonly CartItem[]): ReadyCartItem[] => items.filter(lacksStock)

export const isPendingOrder = (items: readonly CartItem[]): boolean => items.some(lacksStock)

/** "3 kg em estoque", "Esgotado"; undefined quando não há controle de estoque. */
export function stockLabel(product: Product): string | undefined {
  if (product.stock === null) return undefined
  if (product.stock <= 0) return 'Esgotado'
  return `${formatQuantity(product, product.stock)} em estoque`
}

/** Aviso na linha do carrinho quando o item vai como pendente. */
export function shortageText(item: ReadyCartItem): string {
  const stock = item.product.stock ?? 0
  return stock <= 0
    ? 'Sem estoque: vai como pedido pendente.'
    : `Só ${formatQuantity(item.product, stock)} em estoque: vai como pedido pendente.`
}

