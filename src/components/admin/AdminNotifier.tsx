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

function systemNotify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    new Notification(title, { body, icon: '/favicon.png', tag: 'ondina-admin' })
  } catch {
    // Alguns celulares só notificam por service worker: fica o aviso na tela.
  }
}

export function AdminNotifier() {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const previous = useRef<Snapshot | undefined>(undefined)
  const baseTitle = useRef('')

  useEffect(() => {
    baseTitle.current = document.title
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    return () => {
      document.title = baseTitle.current
    }
  }, [])

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
      systemNotify('Ondina Bolos — painel', alerts.join('\n'))
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
    if (result === 'granted') {
      chime()
      toast.success('Notificações ligadas neste aparelho. Deixe o painel aberto para receber.')
    } else toast.warning('O navegador bloqueou as notificações. Os avisos continuam aparecendo na tela.')
  }

  const pulse = snapshot?.pulse
  return (
    <section className="admin-card admin-alerts" aria-labelledby="admin-alerts-title" aria-live="polite">
      <div className="admin-orders-head">
        <h2 id="admin-alerts-title">
          <BellRing aria-hidden="true" /> Avisos
        </h2>
        {permission === 'granted' ? (
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
        O painel confere sozinho a cada 30 segundos e toca um aviso quando chega novidade. Para receber com o painel
        fechado, ligue o aviso pelo n8n (veja o tutorial).
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
