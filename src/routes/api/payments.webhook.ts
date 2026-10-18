import { createFileRoute } from '@tanstack/react-router'
import { handlePaymentWebhook } from '@/lib/payment-webhook.server'

// POST /api/payments/webhook — notificação do Mercado Pago (pagamento aprovado, recusado…)
export const Route = createFileRoute('/api/payments/webhook')({
  server: {
    handlers: {
      POST: ({ request }) => handlePaymentWebhook(request),
    },
  },
})
