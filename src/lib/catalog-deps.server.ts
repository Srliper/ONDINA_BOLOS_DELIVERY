import { currentAdminSession } from '@/lib/admin-auth'
import type { CatalogApiDeps } from '@/lib/catalog-api'
import { getImageStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import type { ImageApiDeps } from '@/lib/image-api'

const isAdmin = async () => Boolean(await currentAdminSession())

/** Dependências reais das rotas de API do catálogo (banco + sessão do /admin). Só no servidor. */
export const catalogApiDeps: CatalogApiDeps = {
  load: () => loadCatalog(),
  save: catalog => saveCatalog(catalog),
  isAdmin,
}

/** Dependências reais da rota de fotos (/api/images). Só no servidor. */
export const imageApiDeps: ImageApiDeps = {
  read: id => getImageStorage(id).read(),
  write: (id, value) => getImageStorage(id).write(value),
  isAdmin,
}
