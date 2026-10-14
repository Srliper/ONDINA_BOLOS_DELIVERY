import { WHATSAPP_NUMBER } from '@/lib/contact'

/**
 * Aviso de bolo esgotado para o WhatsApp da loja:
 * - no painel, um toque abre a conversa com o número da loja e o texto pronto (storeAlertUrl);
 * - no servidor, se houver N8N_STOCK_ALERT_URL, o n8n recebe o aviso na hora e pode mandar a
 *   mensagem sozinho (notifySoldOut). Falha do n8n nunca impede salvar o estoque.
 */

export interface SoldOutProduct {
  id: string
  name: string
}

export function soldOutMessage(products: readonly SoldOutProduct[]): string {
  const names = products.map(product => product.name).join(', ')
  return `⚠️ Esgotou no site da Ondina Bolos: ${names}. Quando tiver de novo, aumente o estoque no painel (/admin). Até lá, os pedidos desse bolo chegam como pendentes.`
}

/** Link que abre o WhatsApp com a mensagem pronta para o número da loja. */
export const storeAlertUrl = (products: readonly SoldOutProduct[]) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(soldOutMessage(products))}`

export type SoldOutNotifier = (products: readonly SoldOutProduct[], by?: string) => Promise<void>

/** Manda o aviso para o webhook do n8n (com chave e tempo limite; erro só no console). */
export function createSoldOutNotifier(
  config: { url: string | undefined; key?: string | undefined },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 4000,
): SoldOutNotifier {
  return async (products, by) => {
    if (!config.url || products.length === 0) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.key ? { 'x-ondina-key': config.key } : {}) },
        body: JSON.stringify({
          event: 'estoque-esgotado',
          at: new Date().toISOString(),
          ...(by ? { by } : {}),
          products,
          message: soldOutMessage(products),
        }),
        signal: controller.signal,
      })
      if (!response.ok) console.error(`[estoque] n8n respondeu ${response.status} ao aviso de esgotado`)
    } catch (error) {
      console.error('[estoque] não foi possível avisar o n8n que esgotou', error)
    } finally {
      clearTimeout(timer)
    }
  }
}
