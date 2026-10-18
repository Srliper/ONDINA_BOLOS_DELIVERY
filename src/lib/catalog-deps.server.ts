import { currentAdminSession } from '@/lib/admin-auth'
import type { CatalogApiDeps } from '@/lib/catalog-api'
import { getImageStorage, loadCatalog, saveCatalog } from '@/lib/catalog-store'
import { exclusive } from '@/lib/redis-guard.server'
import type { ImageApiDeps } from '@/lib/image-api'
import { pushFromEvent, pushFromSoldOut } from '@/lib/push'
import { pushToStaff } from '@/lib/push.server'
import { createSoldOutNotifier, type SoldOutNotifier } from '@/lib/stock-alert'
import { createStoreNotifier, type StoreNotifier } from '@/lib/store-alert'

const isAdmin = async () => Boolean(await currentAdminSession())

const soldOutToN8n = createSoldOutNotifier({
  url: process.env['N8N_STOCK_ALERT_URL'],
  key: process.env['N8N_ORDERS_KEY'],
})

/** Aviso de esgotado: push nos aparelhos da equipe + webhook opcional do n8n. */
export const notifySoldOut: SoldOutNotifier = async (products, by) => {
  await Promise.all([soldOutToN8n(products, by), pushToStaff(pushFromSoldOut(products))])
}

/** Avisos para a equipe com o painel fechado: push nos aparelhos + n8n (opcional). */
const storeToN8n = createStoreNotifier({
  url: process.env['N8N_STORE_ALERT_URL'],
  key: process.env['N8N_ORDERS_KEY'],
})

export const notifyStore: StoreNotifier = async alert => {
  await Promise.all([storeToN8n(alert), pushToStaff(pushFromEvent(alert))])
}

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

