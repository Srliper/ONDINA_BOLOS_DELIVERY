import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { BadgeCheck, CreditCard, Hourglass, Loader2, MessageCircle, Palette, Send, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import logo from '@/assets/ondina_logo.png'
import { formatBRL } from '@/lib/format'
import { MAX_MESSAGE_LENGTH, type OrderStatus, type TrackedOrder } from '@/lib/order-flow'
import { generateContactLink } from '@/lib/whatsapp'

/** Com a página aberta, confere novidades (status, pagamento, respostas da loja) de tempo em tempo. */
const POLL_MS = 20_000

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})
const formatDate = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date)
}

const STEPS: { status: OrderStatus; label: (pickup: boolean) => string }[] = [
  { status: 'aguardando_pagamento', label: () => 'Pagamento' },
  { status: 'em_preparo', label: () => 'Em preparo' },
  { status: 'saiu_para_entrega', label: pickup => (pickup ? 'Pronto para retirar' : 'Saiu para entrega') },
  { status: 'entregue', label: pickup => (pickup ? 'Retirado' : 'Entregue') },
]

const stepIndex = (status: OrderStatus) => STEPS.findIndex(step => step.status === status)

export function OrderTracking({ id, token, paymentId }: { id: string; token: string; paymentId?: string | undefined }) {
  const [order, setOrder] = useState<TrackedOrder>()
  const [error, setError] = useState<string>()
  const [paying, setPaying] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const firstLoad = useRef(true)
  const chatEnd = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const { getTrackedOrder } = await import('@/lib/orders-server')
      // O payment_id da volta do Mercado Pago só precisa ser conferido uma vez.
      const result = await getTrackedOrder({
        data: { id, token, ...(firstLoad.current && paymentId ? { paymentId } : {}) },
      })
      firstLoad.current = false
      if (result.ok) {
        setOrder(result.order)
        setError(undefined)
      } else setError(result.error)
    } catch {
      setError(current => current ?? 'Não foi possível carregar o pedido agora. Tente de novo em instantes.')
    }
  }, [id, token, paymentId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const messageCount = order?.messages.length ?? 0
  useEffect(() => {
    if (messageCount) chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [messageCount])

  const pay = async () => {
    setPaying(true)
    try {
      const { startOrderPayment } = await import('@/lib/orders-server')
      const result = await startOrderPayment({ data: { id, token } })
      if (result.ok) window.location.assign(result.url)
      else {
        toast.error(result.error)
        setPaying(false)
      }
    } catch {
      toast.error('Não foi possível abrir o pagamento. Tente de novo.')
      setPaying(false)
    }
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const { sendCustomerMessage } = await import('@/lib/orders-server')
      const result = await sendCustomerMessage({ data: { id, token, text } })
      if (result.ok) {
        setOrder(result.order)
        setText('')
      } else toast.error(result.error)
    } catch {
      toast.error('Não foi possível enviar. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="track">
      <header className="track-top">
        <a href="/" className="admin-brand">
          <img src={logo} alt="" width={40} height={40} />
          <span>
            <strong>Ondina Bolos</strong>
            <small>Seu pedido</small>
          </span>
        </a>
      </header>

      <main className="track-main">
        {!order && !error && (
          <p className="admin-muted track-loading">
            <Loader2 aria-hidden="true" className="checkout-spin" /> Carregando seu pedido…
          </p>
        )}
        {error && !order && (
          <section className="track-card">
            <h1>Pedido não encontrado</h1>
            <p className="admin-muted">{error}</p>
            <a className="checkout-button" href={generateContactLink()} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" /> Falar com a Ondina no WhatsApp
            </a>
          </section>
        )}

        {order && (
          <>
            <section className="track-card" aria-labelledby="track-title">
              <p className="track-id">Pedido {order.id}</p>
              <h1 id="track-title">Olá, {order.firstName}!</h1>
              <p className="admin-muted">Feito em {formatDate(order.createdAt)}</p>
              <StatusBlock order={order} paying={paying} onPay={pay} />
            </section>

            <section className="track-card" aria-labelledby="track-chat-title">
              <h2 id="track-chat-title">
                <MessageCircle aria-hidden="true" /> Conversa com a Ondina
              </h2>
              <p className="admin-muted">
                Dúvidas sobre o pedido, horário ou entrega? Escreva aqui — a equipe responde por esta página.
              </p>
              <div className="track-chat" role="log" aria-live="polite">
                {order.messages.length === 0 ? (
                  <p className="admin-muted">Nenhuma mensagem ainda.</p>
                ) : (
                  order.messages.map((message, index) => (
                    <div key={index} className={`chat-bubble is-${message.from}`}>
                      <span className="chat-author">{message.from === 'loja' ? 'Ondina Bolos' : 'Você'}</span>
                      <p>{message.text}</p>
                      <time dateTime={message.at}>{formatDate(message.at)}</time>
                    </div>
                  ))
                )}
                <div ref={chatEnd} />
              </div>
              <form className="chat-form" onSubmit={send}>
                <label htmlFor="track-message" className="sr-only">
                  Mensagem para a Ondina
                </label>
                <textarea
                  id="track-message"
                  value={text}
                  onChange={event => setText(event.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={2}
                  placeholder="Escreva sua mensagem…"
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <button type="submit" className="admin-order-btn is-primary" disabled={sending || !text.trim()}>
                  {sending ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <Send aria-hidden="true" />}
                  Enviar
                </button>
              </form>
            </section>

            <section className="track-card" aria-labelledby="track-items-title">
              <h2 id="track-items-title">Itens</h2>
              <ul className="admin-order-items">
                {order.items.map((item, index) => (
                  <li key={index}>
                    <span>
                      {item.detail && <Palette aria-hidden="true" />}
                      {item.quantity}
                      {item.unit === 'kg' ? ' kg' : '×'} {item.name}
                      {order.shortages.includes(item.name) && order.status === 'pendente' && (
                        <em className="admin-order-shortage">aguardando estoque</em>
                      )}
                      {item.detail && <small>{item.detail}</small>}
                    </span>
                    <span>{formatBRL(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="admin-order-bottom">
                <span>{order.paymentLabel}</span>
                <strong>{formatBRL(order.total)}</strong>
              </div>
              <p className="admin-order-address">
                {order.fulfillment === 'entrega' ? 'Entrega em: ' : ''}
                {order.address}
              </p>
              <p className="track-help">
                Prefere falar por lá?{' '}
                <a href={generateContactLink()} target="_blank" rel="noreferrer">
                  Chame a Ondina no WhatsApp
                </a>{' '}
                e diga o número do pedido.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function StatusBlock({ order, paying, onPay }: { order: TrackedOrder; paying: boolean; onPay: () => void }) {
  const pickup = order.fulfillment === 'retirada'

  if (order.status === 'cancelado') {
    return (
      <p className="track-status is-cancelled" role="status">
        <XCircle aria-hidden="true" /> Este pedido foi cancelado. Qualquer dúvida, escreva na conversa abaixo.
      </p>
    )
  }

  const current = stepIndex(order.status)
  return (
    <>
      {order.status === 'pendente' ? (
        <p className="checkout-notice is-pending track-status" role="status">
          <Hourglass aria-hidden="true" />
          <span>
            <strong>Aguardando estoque:</strong> {order.shortages.join(', ')}. Nada foi cobrado. Assim que a Ondina
            confirmar o estoque, {order.channel === 'site' ? 'o botão de pagar aparece aqui' : 'ela avisa você'}.
          </span>
        </p>
      ) : (
        <ol className="track-steps" aria-label="Andamento do pedido">
          {STEPS.map((step, index) => (
            <li
              key={step.status}
              className={index < current ? 'is-done' : index === current ? 'is-current' : undefined}
              aria-current={index === current ? 'step' : undefined}
            >
              <span className="checkout-step-dot" aria-hidden="true">
                {index < current || (index === current && order.status === 'entregue') ? <BadgeCheck /> : index + 1}
              </span>
              {step.label(pickup)}
            </li>
          ))}
        </ol>
      )}

      {order.paid && (
        <p className="track-status is-paid" role="status">
          <BadgeCheck aria-hidden="true" /> Pagamento confirmado.
          {order.status === 'em_preparo' && ' Seu bolo está sendo preparado!'}
        </p>
      )}

      {order.canPay && (
        <div className="track-pay">
          {order.gatewayStatus === 'rejected' && (
            <p className="checkout-error" role="alert">
              O pagamento não foi aprovado. Tente de novo com outro cartão ou pelo Pix.
            </p>
          )}
          {(order.gatewayStatus === 'pending' || order.gatewayStatus === 'in_process') && (
            <p className="checkout-notice" role="status">
              Pagamento em análise. Se você pagou por Pix, a confirmação chega em instantes — esta página atualiza
              sozinha.
            </p>
          )}
          <button type="button" className="checkout-button is-online" onClick={onPay} disabled={paying} aria-busy={paying}>
            {paying ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <CreditCard aria-hidden="true" />}
            {paying ? 'Abrindo pagamento…' : `Pagar ${formatBRL(order.total)} agora`}
          </button>
          <p className="track-help">
            <ShieldCheck aria-hidden="true" /> Pix ou cartão, na página segura do Mercado Pago.
          </p>
        </div>
      )}

      {!order.paid && !order.canPay && order.status === 'aguardando_pagamento' && (
        <p className="admin-muted">A Ondina confirma o pagamento pela conversa do WhatsApp ({order.paymentLabel}).</p>
      )}
    </>
  )
}
