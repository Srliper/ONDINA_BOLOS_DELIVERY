import { currentAdminSession } from '@/lib/admin-auth'
import type { CatalogApiDeps } from '@/lib/catalog-api'
import { loadCatalog, saveCatalog } from '@/lib/catalog-store'

/** Dependências reais das rotas de API do catálogo (banco + sessão do /admin). Só no servidor. */
export const catalogApiDeps: CatalogApiDeps = {
  load: () => loadCatalog(),
  save: catalog => saveCatalog(catalog),
  isAdmin: async () => Boolean(await currentAdminSession()),
}
