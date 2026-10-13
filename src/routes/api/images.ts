import { createFileRoute } from '@tanstack/react-router'
import { imageApiDeps } from '@/lib/catalog-deps.server'
import { handleImageRequest } from '@/lib/image-api'

// POST /api/images — envia uma foto pelo painel (só administração)
export const Route = createFileRoute('/api/images')({
  server: {
    handlers: {
      POST: ({ request }) => handleImageRequest(request, {}, imageApiDeps),
    },
  },
})
