import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { OrderTracking } from '@/components/OrderTracking'

/**
 * Página do pedido para o cliente: /pedido/<id>?t=<chave>. O Mercado Pago volta para cá com
 * payment_id depois do pagamento; o servidor confere o pagamento direto na API deles.
 */
const searchSchema = z.object({
  t: z.string().catch(''),
  payment_id: z.union([z.string(), z.number()]).transform(String).optional().catch(undefined),
})

export const Route = createFileRoute('/pedido/$id')({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: 'Seu pedido | Ondina Bolos' },
      // Página pessoal do cliente: fora do Google.
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: OrderPage,
})

function OrderPage() {
  const { id } = Route.useParams()
  const { t, payment_id: paymentId } = Route.useSearch()
  return <OrderTracking id={id} token={t} paymentId={paymentId && /^\d{1,20}$/.test(paymentId) ? paymentId : undefined} />
}
