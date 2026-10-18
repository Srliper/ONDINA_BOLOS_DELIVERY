/**
 * Pedidos feitos neste aparelho ("Meus pedidos" no topo do site). Só conveniência: fica no
 * navegador do cliente e pode sumir; o link do pedido é o que vale.
 */

export interface RememberedOrder {
  id: string
  url: string
  createdAt: string
}

const RECENT_KEY = 'ondina:my-orders'
const MAX = 5

export function recentOrders(): RememberedOrder[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as RememberedOrder[]
    return Array.isArray(list) ? list.filter(entry => typeof entry?.url === 'string' && typeof entry.id === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberOrder(order: RememberedOrder): void {
  try {
    const list = [order, ...recentOrders().filter(entry => entry.id !== order.id)].slice(0, MAX)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Sem armazenamento (aba anônima): o link do pedido continua valendo.
  }
}
