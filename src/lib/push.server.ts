import webpush from 'web-push'
import { getPushStorage } from '@/lib/catalog-store'
import { pushDocSchema, removeSubscriptions, type PushDoc, type PushPayload, type StoredSubscription } from '@/lib/push'

/**
 * Envio das notificações push (Web Push com chaves VAPID). Configure VAPID_PUBLIC_KEY e
 * VAPID_PRIVATE_KEY (gere com `bunx web-push generate-vapid-keys`). Sem elas, nada é enviado.
 * Falha no envio nunca impede o pedido; aparelhos que saíram (404/410) são esquecidos.
 */

export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | undefined {
  const publicKey = process.env['VAPID_PUBLIC_KEY']
  const privateKey = process.env['VAPID_PRIVATE_KEY']
  if (!publicKey || !privateKey) return undefined
  const site = process.env['SITE_URL'] || process.env['VITE_SITE_URL']
  const subject = process.env['VAPID_SUBJECT'] || (site?.startsWith('https://') ? site : 'mailto:equipe@ondinabolos.com.br')
  return { publicKey, privateKey, subject }
}

export async function loadPushDoc(): Promise<PushDoc> {
  const storage = getPushStorage()
  if (storage.kind === 'none') return { subscriptions: [] }
  try {
    const raw = await storage.read()
    const parsed = raw ? pushDocSchema.safeParse(JSON.parse(raw)) : undefined
    return parsed?.success ? parsed.data : { subscriptions: [] }
  } catch (error) {
    console.error('[push] não deu para ler os aparelhos', error)
    return { subscriptions: [] }
  }
}

export const savePushDoc = (doc: PushDoc) => getPushStorage().write(JSON.stringify(doc))

export type PushSender = (subscription: StoredSubscription, body: string) => Promise<void>

/** Manda a notificação para todos os aparelhos; devolve os que não existem mais. */
export async function deliver(
  subscriptions: readonly StoredSubscription[],
  payload: PushPayload,
  send: PushSender,
): Promise<string[]> {
  const gone: string[] = []
  const body = JSON.stringify(payload)
  await Promise.all(
    subscriptions.map(async subscription => {
      try {
        await send(subscription, body)
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(subscription.endpoint)
        else console.error(`[push] falhou para um aparelho (${status ?? 'sem resposta'})`)
      }
    }),
  )
  return gone
}

/** Notifica a equipe em todos os aparelhos inscritos (erro silencioso). */
export async function pushToStaff(payload: PushPayload): Promise<void> {
  const config = vapidConfig()
  if (!config) return
  try {
    const doc = await loadPushDoc()
    if (!doc.subscriptions.length) return
    const gone = await deliver(doc.subscriptions, payload, async (subscription, body) => {
      await webpush.sendNotification(subscription, body, {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: 60 * 60,
        urgency: 'high',
        timeout: 5000,
      })
    })
    if (gone.length) await savePushDoc(removeSubscriptions(await loadPushDoc(), gone))
  } catch (error) {
    console.error('[push] não foi possível notificar a equipe', error)
  }
}
