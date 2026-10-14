import { createFileRoute } from '@tanstack/react-router'
import { orderApiDeps } from '@/lib/catalog-deps.server'
import { handleOrderRequest } from '@/lib/order-api'

// POST (confirma e baixa o estoque) e DELETE (desfaz) em /api/orders/{id}/confirm
export const Route = createFileRoute('/api/orders/$id/confirm')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleOrderRequest(request, { id: params.id, action: 'confirm' }, orderApiDeps()),
      DELETE: ({ request, params }) => handleOrderRequest(request, { id: params.id, action: 'confirm' }, orderApiDeps()),
    },
  },
})
