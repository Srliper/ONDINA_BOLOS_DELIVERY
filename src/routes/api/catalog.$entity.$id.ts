import { createFileRoute } from '@tanstack/react-router'
import { handleCatalogRequest } from '@/lib/catalog-api'
import { catalogApiDeps } from '@/lib/catalog-deps.server'

// GET (um item), PUT (altera) e DELETE (apaga) em /api/catalog/{entidade}/{id}
export const Route = createFileRoute('/api/catalog/$entity/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleCatalogRequest(request, params, catalogApiDeps),
      PUT: ({ request, params }) => handleCatalogRequest(request, params, catalogApiDeps),
      DELETE: ({ request, params }) => handleCatalogRequest(request, params, catalogApiDeps),
    },
  },
})
