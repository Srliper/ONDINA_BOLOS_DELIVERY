import { formatQuantity } from '@/data/products'
import type { Catalog } from '@/lib/catalog'
import type { StockChange } from '@/lib/orders'
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

/* ---------- Baixa de estoque ao confirmar um pedido no painel ---------- */

const withProducts = (catalog: Catalog, products: Catalog['products'], now: Date): Catalog => ({
  ...catalog,
  products,
  version: catalog.version + 1,
  updated_at: now.toISOString(),
})

/**
 * Tira do estoque o que o pedido levou (só bolos prontos com estoque marcado; nunca abaixo de 0).
 * Devolve o catálogo novo, o que mudou e os bolos que acabaram de esgotar.
 */
export function takeFromStock(
  catalog: Catalog,
  items: readonly { productId?: string | undefined; quantity: number }[],
  now = new Date(),
): { catalog: Catalog; changes: StockChange[]; soldOut: { id: string; name: string }[] } {
  const wanted = new Map<string, number>()
  for (const item of items) {
    if (item.productId) wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity)
  }
  const changes: StockChange[] = []
  const products = catalog.products.map(product => {
    const quantity = wanted.get(product.id)
    if (!quantity || product.stock === null) return product
    const to = Math.max(0, product.stock - quantity)
    if (to === product.stock) return product
    changes.push({ id: product.id, name: product.name, from: product.stock, to })
    return { ...product, stock: to }
  })
  return {
    catalog: changes.length ? withProducts(catalog, products, now) : catalog,
    changes,
    soldOut: changes.filter(change => change.to === 0).map(({ id, name }) => ({ id, name })),
  }
}

/** Desfaz uma baixa: devolve ao estoque o que tinha saído (se o bolo ainda existir e tiver estoque marcado). */
export function returnToStock(catalog: Catalog, changes: readonly StockChange[], now = new Date()): Catalog {
  const back = new Map(changes.map(change => [change.id, change.from - change.to]))
  let changed = false
  const products = catalog.products.map(product => {
    const amount = back.get(product.id)
    if (!amount || product.stock === null) return product
    changed = true
    return { ...product, stock: Math.min(9999, product.stock + amount) }
  })
  return changed ? withProducts(catalog, products, now) : catalog
}
