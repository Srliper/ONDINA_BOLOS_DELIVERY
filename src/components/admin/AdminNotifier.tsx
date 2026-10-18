import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BellOff, BellRing, CircleDollarSign, Hourglass, MessageCircle, PackageCheck, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { ADMIN_ACTED_EVENT, ORDERS_CHANGED_EVENT } from '@/components/admin/sold-out'
import type { OrdersPulse } from '@/lib/order-flow'

/**
 * Avisos do painel: com o /admin aberto (no celular ou no computador), confere a cada 30 s se
 * chegou pedido novo, pagamento online aprovado (pedido para entregar), mensagem de cliente ou
 * pedido de "avise-me" de bolo esgotado. Avisa com toque, notificação do aparelho (se permitida),
 * contador no título da aba, e recarrega a lista de pedidos.
 * Com o painel fechado, o aviso pode ir pelo n8n (N8N_STORE_ALERT_URL, veja o README).
 */

const POLL_MS = 30_000

interface Snapshot {
  pulse: OrdersPulse
  restockIds: string[]
}

const newIds = (now: readonly string[], before: readonly string[]) => now.filter(id => !before.includes(id))

/** Toque curto gerado no navegador (sem arquivo de áudio). */
function chime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const notes = [880, 1320]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = context.currentTime + index * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.32)
    })
    window.setTimeout(() => void context.close(), 1000)
  } catch {
    // Sem som: o aviso na tela continua.
  }
}

async function systemNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    // No celular, só o service worker consegue mostrar a notificação.
    const registration = await navigator.serviceWorker?.getRegistration('/')
    if (registration) await registration.showNotification(title, { body, icon: '/icon-192.png', tag: 'ondina-admin' })
    else new Notification(title, { body, icon: '/icon-192.png', tag: 'ondina-admin' })
  } catch {
    // Sem notificação do aparelho: fica o aviso na tela.
  }
}

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'

/** Chave VAPID (base64url) no formato que o navegador pede. */
function vapidKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

type PushState = 'checking' | 'unavailable' | 'off' | 'on'

export function AdminNotifier() {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [push, setPush] = useState<PushState>('checking')
  const [publicKey, setPublicKey] = useState<string>()
  const previous = useRef<Snapshot | undefined>(undefined)
  const pushOn = useRef(false)
  const baseTitle = useRef('')

  useEffect(() => {
    baseTitle.current = document.title
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    return () => {
      document.title = baseTitle.current
    }
  }, [])

  // Push configurado no servidor (chaves VAPID) e este aparelho já inscrito?
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        if (!pushSupported()) return active && setPush('unavailable')
        const { getPushConfig } = await import('@/lib/push-server')
        const config = await getPushConfig()
        if (!active) return
        if (!config.ok || !config.publicKey) return setPush('unavailable')
        setPublicKey(config.publicKey)
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (active) setPush(subscription && Notification.permission === 'granted' ? 'on' : 'off')
      } catch {
        if (active) setPush('unavailable')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    pushOn.current = push === 'on'
  }, [push])

  const check = useCallback(async () => {
    try {
      const { adminPulse } = await import('@/lib/orders-server')
      const result = await adminPulse()
      if (!result.ok) return
      const next: Snapshot = { pulse: result.pulse, restockIds: result.restockIds }
      const before = previous.current
      previous.current = next
      setSnapshot(next)

      const attention = next.pulse.toDeliver + next.pulse.pending + next.pulse.unread + next.restockIds.length
      document.title = attention > 0 ? `(${attention}) ${baseTitle.current}` : baseTitle.current

      // Na primeira leitura só guarda o estado: avisa o que chegar depois.
      if (!before) return
      const alerts: string[] = []
      const created = newIds(next.pulse.openIds, before.pulse.openIds)
      const paid = newIds(next.pulse.toDeliverIds, before.pulse.toDeliverIds).filter(id => before.pulse.openIds.includes(id))
      const restock = newIds(next.restockIds, before.restockIds)
      if (created.length) alerts.push(created.length === 1 ? `Pedido novo: ${created[0]}` : `${created.length} pedidos novos`)
      if (paid.length) alerts.push(paid.length === 1 ? `Para entregar: ${paid[0]}` : `${paid.length} pedidos para entregar`)
      if (next.pulse.unread > before.pulse.unread) alerts.push('Mensagem nova de cliente')
      if (restock.length) alerts.push(restock.length === 1 ? 'Cliente quer um bolo esgotado' : `${restock.length} clientes querem bolos esgotados`)
      if (!alerts.length) return

      chime()
      toast.info(alerts.join(' · '), { duration: 15_000 })
      // Com o push ligado, a notificação do aparelho já vem do servidor (sem repetir).
      if (!pushOn.current) void systemNotify('Ondina Bolos — painel', alerts.join('\n'))
      window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT))
    } catch {
      // Sem conexão agora: tenta de novo no próximo ciclo.
    }
  }, [])

  useEffect(() => {
    void check()
    const timer = window.setInterval(() => void check(), POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void check()
    // Mudança feita pela própria equipe no painel: atualiza os números sem tocar aviso.
    const onActed = () => {
      previous.current = undefined
      void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(ADMIN_ACTED_EVENT, onActed)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(ADMIN_ACTED_EVENT, onActed)
    }
  }, [check])

  const enable = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') {
      toast.warning('O navegador bloqueou as notificações. Os avisos continuam aparecendo na tela.')
      return
    }
    chime()
    if (!publicKey || !pushSupported()) {
      toast.success('Notificações ligadas neste aparelho. Deixe o painel aberto para receber.')
      return
    }
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) }))
      const { savePushSubscription } = await import('@/lib/push-server')
      const saved = await savePushSubscription({ data: subscription.toJSON() as never })
      if (!saved.ok) throw new Error(saved.error)
      setPush('on')
      toast.success('Notificações ligadas neste aparelho, mesmo com o painel fechado.')
    } catch (error) {
      console.error('[push] não deu para inscrever o aparelho', error)
      toast.warning('Não deu para ligar as notificações com o painel fechado. Com ele aberto, os avisos continuam.')
    }
  }

  const disable = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        const { removePushSubscription } = await import('@/lib/push-server')
        await removePushSubscription({ data: { endpoint: subscription.endpoint } })
        await subscription.unsubscribe()
      }
      setPush('off')
      toast.success('Notificações desligadas neste aparelho.')
    } catch {
      toast.error('Não deu para desligar agora. Tente de novo.')
    }
  }

  const pulse = snapshot?.pulse
  return (
    <section className="admin-card admin-alerts" aria-labelledby="admin-alerts-title" aria-live="polite">
      <div className="admin-orders-head">
        <h2 id="admin-alerts-title">
          <BellRing aria-hidden="true" /> Avisos
        </h2>
        {push === 'on' ? (
          <button type="button" className="admin-refresh" onClick={() => void disable()} title="Desligar neste aparelho">
            <BellRing aria-hidden="true" /> Notificações ligadas (mesmo fechado)
          </button>
        ) : permission === 'granted' && push !== 'off' ? (
          <span className="admin-order-tag is-paid">
            <BellRing aria-hidden="true" /> Notificações ligadas
          </span>
        ) : permission !== 'unsupported' ? (
          <button type="button" className="admin-refresh" onClick={() => void enable()}>
            {permission === 'denied' ? <BellOff aria-hidden="true" /> : <BellRing aria-hidden="true" />}
            {permission === 'denied' ? 'Notificações bloqueadas' : 'Ligar notificações'}
          </button>
        ) : null}
      </div>
      <ul className="admin-alert-list">
        <AlertItem icon={<Truck />} count={pulse?.toDeliver} label="para entregar" hot />
        <AlertItem icon={<CircleDollarSign />} count={pulse?.awaitingPayment} label="aguardando pagamento" />
        <AlertItem icon={<Hourglass />} count={pulse?.pending} label="pendentes (sem estoque)" hot />
        <AlertItem icon={<MessageCircle />} count={pulse?.unread} label="mensagens não lidas" hot />
        <AlertItem icon={<PackageCheck />} count={snapshot?.restockIds.length} label="esperando bolo esgotado" hot />
      </ul>
      <p className="admin-muted">
        O painel confere sozinho a cada 30 segundos e toca um aviso quando chega novidade.{' '}
        {push === 'on'
          ? 'Este aparelho também recebe as notificações com o painel fechado.'
          : push === 'off'
            ? 'Toque em “Ligar notificações” para receber no celular mesmo com o painel fechado (no iPhone, adicione o painel à Tela de Início antes).'
            : 'Para receber com o painel fechado, quem cuida do site configura as chaves das notificações (veja o tutorial).'}
      </p>
    </section>
  )
}

function AlertItem({ icon, count, label, hot }: { icon: ReactNode; count: number | undefined; label: string; hot?: boolean }) {
  return (
    <li className={hot && count ? 'is-hot' : undefined}>
      <span aria-hidden="true">{icon}</span>
      <strong>{count ?? '–'}</strong> {label}
    </li>
  )
}
