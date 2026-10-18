import { currentAdminSession } from '@/lib/admin-auth'
import type { CatalogApiDeps } from '@/lib/catalog-api'
import { getImageStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import { exclusive } from '@/lib/redis-guard.server'
import type { ImageApiDeps } from '@/lib/image-api'
import { createSoldOutNotifier } from '@/lib/stock-alert'
import { createStoreNotifier } from '@/lib/store-alert'

const isAdmin = async () => Boolean(await currentAdminSession())

/** Aviso automático de esgotado (opcional): webhook do n8n que manda a mensagem no WhatsApp. */
export const notifySoldOut = createSoldOutNotifier({
  url: process.env['N8N_STOCK_ALERT_URL'],
  key: process.env['N8N_ORDERS_KEY'],
})

/** Avisos para a equipe com o painel fechado (opcional): pedido novo, pagamento, mensagem, procura. */
export const notifyStore = createStoreNotifier({
  url: process.env['N8N_STORE_ALERT_URL'],
  key: process.env['N8N_ORDERS_KEY'],
})

/** Dependências reais das rotas de API do catálogo (banco + sessão do /admin). Só no servidor. */
export const catalogApiDeps: CatalogApiDeps = {
  load: () => loadCatalog(),
  save: catalog => saveCatalog(catalog),
  isAdmin,
  notifySoldOut,
  exclusive,
}

/** Dependências reais da rota de fotos (/api/images). Só no servidor. */
export const imageApiDeps: ImageApiDeps = {
  read: id => getImageStorage(id).read(),
  write: (id, value) => getImageStorage(id).write(value),
  isAdmin,
}

