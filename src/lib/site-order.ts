import type { CheckoutData } from '@/lib/checkout'
import { celebrate } from '@/lib/confetti'
import { rememberOrder, type RememberedOrder } from '@/lib/my-orders'
import { trackingPath, type OrderStatus } from '@/lib/order-flow'
import { toOrderLines } from '@/lib/whatsapp'
import type { CartItem } from '@/types/product'

/**
 * Pedido finalizado aqui no site (pagamento online): registra no servidor e leva o cliente
 * para a página segura do Mercado Pago. Pedido pendente (falta estoque) não é cobrado: vai
 * direto para a página do pedido, onde o pagamento abre quando a Ondina confirmar o estoque.
 */

export interface SiteOrderDeps {
  register: (
    lines: ReturnType<typeof toOrderLines>,
    checkout: CheckoutData,
  ) => Promise<{ orderId: string; status: OrderStatus; accessToken: string }>
  startPayment: (id: string, token: string) => Promise<string>
  navigate: (url: string) => void
  remember: (order: RememberedOrder) => void
  celebrate: () => Promise<void> | void
}

export interface SiteOrderResult {
  orderId: string
  pending: boolean
  trackingUrl: string
  /** Link do pagamento (quando abriu); sem ele, o cliente paga pela página do pedido. */
  paymentUrl?: string
}

const browserDeps = (): SiteOrderDeps => ({
  register: async (lines, checkout) => {
    const { placeOrder } = await import('@/lib/orders-server')
    const result = await placeOrder({
      data: { lines, customer: checkout.customer, payment: checkout.payment, schedule: checkout.schedule },
    })
    if (!result.ok) throw new Error(result.error)
    return result
  },
  startPayment: async (id, token) => {
    const { startOrderPayment } = await import('@/lib/orders-server')
    const result = await startOrderPayment({ data: { id, token } })
    if (!result.ok) throw new Error(result.error)
    return result.url
  },
  navigate: url => window.location.assign(url),
  remember: rememberOrder,
  celebrate,
})

/** Erro no registro sobe para o carrinho (que oferece o WhatsApp); erro no pagamento não. */
export async function processOrderOnSite(
  items: readonly CartItem[],
  checkout: CheckoutData,
  deps: SiteOrderDeps = browserDeps(),
): Promise<SiteOrderResult> {
  const registered = await deps.register(toOrderLines(items), checkout)
  const trackingUrl = trackingPath({ id: registered.orderId, accessToken: registered.accessToken })
  deps.remember({ id: registered.orderId, url: trackingUrl, createdAt: new Date().toISOString() })
  const pending = registered.status === 'pendente'
  void deps.celebrate()

  let paymentUrl: string | undefined
  if (!pending) {
    try {
      paymentUrl = await deps.startPayment(registered.orderId, registered.accessToken)
    } catch (error) {
      // O pedido já está guardado: a página dele tem o botão "Pagar agora" para tentar de novo.
      console.error('[pedido] não deu para abrir o pagamento agora', error)
    }
  }
  deps.navigate(paymentUrl ?? trackingUrl)
  return { orderId: registered.orderId, pending, trackingUrl, ...(paymentUrl ? { paymentUrl } : {}) }
}

export { recentOrders, type RememberedOrder } from '@/lib/my-orders'
