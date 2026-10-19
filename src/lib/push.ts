import { z } from 'zod'
import type { SoldOutProduct } from '@/lib/stock-alert'
import { storeEventMessage, type StoreEvent } from '@/lib/store-alert'

/**
 * Notificação push no celular/computador da equipe (Web Push), mesmo com o painel fechado.
 * Cada aparelho que tocou em "Ligar notificações" no /admin guarda aqui a sua inscrição.
 * Funções puras; o envio fica em src/lib/push.server.ts.
 */

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith('https://'),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

const storedSchema = pushSubscriptionSchema.extend({ memberId: z.string(), createdAt: z.string() })
export type StoredSubscription = z.infer<typeof storedSchema>

export const pushDocSchema = z.object({ subscriptions: z.array(storedSchema) })
export type PushDoc = z.infer<typeof pushDocSchema>

/** Aparelhos guardados no máximo (os mais antigos saem primeiro). */
export const MAX_SUBSCRIPTIONS = 30

/** Guarda (ou atualiza) a inscrição de um aparelho. */
export function addSubscription(
  doc: PushDoc,
  subscription: PushSubscriptionInput,
  memberId: string,
  now = new Date(),
): PushDoc {
  const others = doc.subscriptions.filter(entry => entry.endpoint !== subscription.endpoint)
  return {
    subscriptions: [{ ...subscription, memberId, createdAt: now.toISOString() }, ...others].slice(0, MAX_SUBSCRIPTIONS),
  }
}

export function removeSubscriptions(doc: PushDoc, endpoints: readonly string[]): PushDoc {
  const gone = new Set(endpoints)
  return { subscriptions: doc.subscriptions.filter(entry => !gone.has(entry.endpoint)) }
}

export interface PushPayload {
  title: string
  body: string
  /** Página aberta ao tocar na notificação. */
  url: string
  /** Notificações com o mesmo tag se substituem (não empilham). */
  tag: string
}

/** O aviso para a equipe vira uma notificação curta. */
export function pushFromEvent(alert: StoreEvent): PushPayload {
  const titles: Record<StoreEvent['event'], string> = {
    'pedido-novo': 'Pedido novo',
    'pagamento-aprovado': 'Pago — para entregar',
    'mensagem-cliente': 'Mensagem de cliente',
    'aviso-estoque': 'Cliente quer bolo esgotado',
  }
  const tag = 'orderId' in alert ? `${alert.event}:${alert.orderId}` : `${alert.event}:${alert.productId}`
  return { title: `Ondina Bolos · ${titles[alert.event]}`, body: storeEventMessage(alert), url: '/admin', tag }
}

export function pushFromSoldOut(products: readonly SoldOutProduct[]): PushPayload {
  return {
    title: 'Ondina Bolos · Esgotou',
    body: `${products.map(product => product.name).join(', ')} chegou a 0 no estoque.`,
    url: '/admin',
    tag: `esgotou:${products.map(product => product.id).join(',')}`,
  }
}
