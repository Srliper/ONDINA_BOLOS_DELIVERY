import { createServerFn } from '@tanstack/react-start'
import { currentAdminSession } from '@/lib/admin-auth'
import { getCatalogStorage, loadCatalog } from '@/lib/catalog-store'

/** Catálogo em uso (do banco, ou o padrão) — carregado pela rota raiz para o site inteiro. */
export const getPublicCatalog = createServerFn({ method: 'GET' }).handler(() => loadCatalog())

/** Onde o catálogo está guardado — para o painel avisar quando falta configurar o banco. */
export const getCatalogStorageKind = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await currentAdminSession())) return null
  return getCatalogStorage().kind
})
