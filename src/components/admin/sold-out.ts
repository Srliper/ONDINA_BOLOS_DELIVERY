import { toast } from 'sonner'
import { storeAlertUrl, type SoldOutProduct } from '@/lib/stock-alert'

/** Avisa as outras partes do painel (cardápio) que o estoque mudou. */
export const CATALOG_CHANGED_EVENT = 'ondina:catalog-changed'

/** Toast com o atalho para avisar o WhatsApp da loja que um bolo esgotou. */
export function announceSoldOut(products: readonly SoldOutProduct[]) {
  if (!products.length) return
  toast.warning(`Esgotou: ${products.map(product => product.name).join(', ')}`, {
    duration: 12_000,
    action: { label: 'Avisar no WhatsApp', onClick: () => window.open(storeAlertUrl(products), '_blank', 'noopener') },
  })
}

/** Avisa a lista de pedidos e a procura por esgotados que chegou novidade (o painel recarrega). */
export const ORDERS_CHANGED_EVENT = 'ondina:orders-changed'

/** A equipe mudou algo no painel (status, pagamento, resposta): os avisos só atualizam os números. */
export const ADMIN_ACTED_EVENT = 'ondina:admin-acted'
