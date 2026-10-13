import { createFileRoute } from '@tanstack/react-router'
import { handleCatalogRequest } from '@/lib/catalog-api'
import { catalogApiDeps } from '@/lib/catalog-deps.server'

// GET (lista) e POST (cria) em /api/catalog/{products|fillings|layers}
export const Route = createFileRoute('/api/catalog/$entity')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleCatalogRequest(request, params, catalogApiDeps),
      POST: ({ request, params }) => handleCatalogRequest(request, params, catalogApiDeps),
    },
  },
})
