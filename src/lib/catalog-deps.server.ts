import { getRequestIP } from '@tanstack/react-start/server'
import { currentAdminSession } from '@/lib/admin-auth'
import type { CatalogApiDeps } from '@/lib/catalog-api'
import { getImageStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import type { ImageApiDeps } from '@/lib/image-api'
import type { OrderApiDeps } from '@/lib/order-api'
import { getOrderStore } from '@/lib/order-store'
import { createSoldOutNotifier } from '@/lib/stock-alert'

const isAdmin = async () => Boolean(await currentAdminSession())

/** Aviso automático de esgotado (opcional): webhook do n8n que manda a mensagem no WhatsApp. */
const notifySoldOut = createSoldOutNotifier({
  url: process.env['N8N_STOCK_ALERT_URL'],
  key: process.env['N8N_ORDERS_KEY'],
})

/** Dependências reais das rotas de API do catálogo (banco + sessão do /admin). Só no servidor. */
export const catalogApiDeps: CatalogApiDeps = {
  load: () => loadCatalog(),
  save: catalog => saveCatalog(catalog),
  isAdmin,
  notifySoldOut,
}

/** Dependências reais da rota de fotos (/api/images). Só no servidor. */
export const imageApiDeps: ImageApiDeps = {
  read: id => getImageStorage(id).read(),
  write: (id, value) => getImageStorage(id).write(value),
  isAdmin,
}

/** Dependências reais das rotas de pedidos (/api/orders). Só no servidor. */
export const orderApiDeps = (): OrderApiDeps => ({
  store: getOrderStore(),
  loadCatalog: () => loadCatalog(),
  saveCatalog: catalog => saveCatalog(catalog),
  adminId: async () => (await currentAdminSession())?.memberId,
  clientIp: () => getRequestIP({ xForwardedFor: true }) ?? 'desconhecido',
  notifySoldOut,
})
