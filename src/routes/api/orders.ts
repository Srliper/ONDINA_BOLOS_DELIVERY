import { createFileRoute } from '@tanstack/react-router'
import { orderApiDeps } from '@/lib/catalog-deps.server'
import { handleOrderRequest } from '@/lib/order-api'

// POST (o site guarda o pedido) e GET (lista para o painel) em /api/orders
export const Route = createFileRoute('/api/orders')({
  server: {
    handlers: {
      GET: ({ request }) => handleOrderRequest(request, {}, orderApiDeps()),
      POST: ({ request }) => handleOrderRequest(request, {}, orderApiDeps()),
    },
  },
})
