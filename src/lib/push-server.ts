import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { currentAdminSession } from '@/lib/admin-auth'
import { getPushStorage } from '@/lib/catalog-store'
import { addSubscription, pushSubscriptionSchema, removeSubscriptions } from '@/lib/push'
import { loadPushDoc, pushToStaff, savePushDoc, vapidConfig } from '@/lib/push.server'
import { exclusive } from '@/lib/redis-guard.server'

/** Server functions das notificações push do painel (só com a sessão da equipe). */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

async function member(): Promise<string | undefined> {
  return (await currentAdminSession())?.memberId
}

/** Chave pública para o aparelho se inscrever (sem ela, o push não está configurado). */
export const getPushConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Result<{ publicKey?: string }>> => {
    if (!(await member())) return { ok: false, error: 'Sessão expirada. Entre de novo.' }
    const config = vapidConfig()
    return { ok: true, ...(config && getPushStorage().kind !== 'none' ? { publicKey: config.publicKey } : {}) }
  },
)

export const savePushSubscription = createServerFn({ method: 'POST' })
  .validator(pushSubscriptionSchema)
  .handler(async ({ data }): Promise<Result<object>> => {
    const memberId = await member()
    if (!memberId) return { ok: false, error: 'Sessão expirada. Entre de novo.' }
    try {
      await exclusive(async () => savePushDoc(addSubscription(await loadPushDoc(), data, memberId)))
      await pushToStaff({
        title: 'Ondina Bolos · Notificações ligadas',
        body: 'Este aparelho vai avisar sobre pedidos, pagamentos e mensagens.',
        url: '/admin',
        tag: 'teste',
      })
      return { ok: true }
    } catch (error) {
      console.error('[push] não deu para guardar o aparelho', error)
      return { ok: false, error: 'Não deu para ligar as notificações agora. Tente de novo.' }
    }
  })

export const removePushSubscription = createServerFn({ method: 'POST' })
  .validator(z.object({ endpoint: z.string().max(1000) }))
  .handler(async ({ data }): Promise<Result<object>> => {
    if (!(await member())) return { ok: false, error: 'Sessão expirada. Entre de novo.' }
    await exclusive(async () => savePushDoc(removeSubscriptions(await loadPushDoc(), [data.endpoint])))
    return { ok: true }
  })
