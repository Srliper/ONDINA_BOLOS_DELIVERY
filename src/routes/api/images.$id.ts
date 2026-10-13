import { createFileRoute } from '@tanstack/react-router'
import { imageApiDeps } from '@/lib/catalog-deps.server'
import { handleImageRequest } from '@/lib/image-api'

// GET /api/images/{id} — mostra uma foto enviada pelo painel
export const Route = createFileRoute('/api/images/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleImageRequest(request, params, imageApiDeps),
    },
  },
})
