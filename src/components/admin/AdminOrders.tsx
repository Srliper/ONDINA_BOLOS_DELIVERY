import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  Globe,
  Hourglass,
  Link2,
  Loader2,
  MessageCircle,
  PackageSearch,
  Palette,
  Phone,
  RefreshCw,
  Send,
  Store,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminReport } from '@/components/admin/AdminReport'
import {
  ADMIN_ACTED_EVENT,
  announceSoldOut,
  CATALOG_CHANGED_EVENT,
  ORDERS_CHANGED_EVENT,
} from '@/components/admin/sold-out'
import { formatBRL } from '@/lib/format'
import {
  MAX_MESSAGE_LENGTH,
  ORDER_STATUSES,
  paymentDeadline,
  shortageText,
  statusLabel,
  trackingPath,
  transitionError,
  unreadForStore,
  type Order,
  type OrderStatus,
} from '@/lib/order-flow'
import type { LegacyOrder } from '@/lib/orders'
import {
  confirmOrderPayment,
  listOrders,
  markOrderRead,
  recheckOrderStock,
  sendStoreMessage,
  setOrderStatus,
} from '@/lib/orders-server'
import { customerWhatsAppUrl, formatPhone } from '@/lib/phone'
import type { SoldOutProduct } from '@/lib/stock-alert'

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

type Filter = 'abertos' | 'a_entregar' | 'mensagens' | OrderStatus | 'todos'

/** Em aberto = ainda precisa de alguma ação da equipe. */
const isOpen = (order: Order) => order.status !== 'entregue' && order.status !== 'cancelado'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'abertos', label: 'Em aberto' },
  { id: 'a_entregar', label: 'A entregar' },
  { id: 'mensagens', label: 'Mensagens novas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { id: 'em_preparo', label: 'Em preparo' },
  { id: 'saiu_para_entrega', label: 'Saiu / pronto' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
]

/** Pago (ou pago na entrega) e ainda não entregue. */
const toDeliver = (order: Order) => order.status === 'em_preparo' || order.status === 'saiu_para_entrega'

const matches = (order: Order, filter: Filter) =>
  filter === 'todos'
    ? true
    : filter === 'abertos'
      ? isOpen(order)
      : filter === 'a_entregar'
        ? toDeliver(order)
        : filter === 'mensagens'
          ? unreadForStore(order) > 0
          : order.status === filter

const ALERT_FILTERS: readonly Filter[] = ['pendente', 'a_entregar', 'mensagens']

type Storage = 'upstash' | 'file' | 'none'

/** Pedidos do site, gravados no banco do próprio site: status da entrega, pagamento e estoque. */
export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>()
  const [legacy, setLegacy] = useState<LegacyOrder[]>([])
  const [storage, setStorage] = useState<Storage>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('abertos')
  const [busyId, setBusyId] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOrders()
      if (result.ok) {
        setOrders(result.orders)
        setLegacy(result.legacy)
        setStorage(result.storage)
        setError(undefined)
      } else setError(result.error)
    } catch {
      setError('Não foi possível carregar os pedidos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // Os avisos do painel encontraram novidade: recarrega a lista.
    const reload = () => void load()
    window.addEventListener(ORDERS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(ORDERS_CHANGED_EVENT, reload)
  }, [load])

  const counts = useMemo(() => {
    const map = new Map<Filter, number>()
    for (const option of FILTERS) map.set(option.id, (orders ?? []).filter(order => matches(order, option.id)).length)
    return map
  }, [orders])

  const visible = (orders ?? []).filter(order => matches(order, filter))

  /** Roda uma ação no servidor e troca o pedido na lista pela versão gravada. */
  const run = async (
    order: Order,
    action: () => Promise<
      { ok: true; order: Order; released: boolean; soldOut: SoldOutProduct[] } | { ok: false; error: string }
    >,
    success: (updated: Order, released: boolean) => string | undefined,
  ): Promise<boolean> => {
    setBusyId(order.id)
    try {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return false
      }
      setOrders(list => list?.map(entry => (entry.id === result.order.id ? result.order : entry)))
      const message = success(result.order, result.released)
      if (message) toast.success(message)
      // O estoque pode ter mudado (reserva ou devolução): o cardápio do painel recarrega e avisa o que esgotou.
      window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT))
      window.dispatchEvent(new Event(ADMIN_ACTED_EVENT))
      announceSoldOut(result.soldOut)
      return true
    } catch {
      toast.error('Não foi possível falar com o servidor. Tente de novo.')
      return false
    } finally {
      setBusyId(undefined)
    }
  }

  const changeStatus = (order: Order, status: OrderStatus) => {
    if (
      status === 'cancelado' &&
      !window.confirm(`Cancelar o pedido ${order.id}? O estoque reservado volta para o cardápio.`)
    ) {
      return
    }
    void run(
      order,
      () => setOrderStatus({ data: { id: order.id, status } }),
      updated => `${updated.id}: ${statusLabel(updated.status, updated.customer.fulfillment)}`,
    )
  }

  const confirmPayment = (order: Order) =>
    void run(
      order,
      () => confirmOrderPayment({ data: { id: order.id } }),
      updated => `Pagamento confirmado — ${updated.id} foi para o preparo.`,
    )

  const recheck = (order: Order) =>
    void run(
      order,
      () => recheckOrderStock({ data: { id: order.id } }),
      (updated, released) => {
        if (released) return `Estoque reservado: ${updated.id} liberado para pagamento.`
        toast.warning(`Ainda falta estoque: ${updated.shortages.map(s => s.name).join(', ')}.`)
        return undefined
      },
    )

  const reply = (order: Order, text: string) =>
    run(
      order,
      () => sendStoreMessage({ data: { id: order.id, text } }),
      () => 'Mensagem enviada: o cliente vê na página do pedido.',
    )

  const openChat = (order: Order) => {
    if (unreadForStore(order) === 0) return
    void run(
      order,
      () => markOrderRead({ data: { id: order.id } }),
      () => undefined,
    )
  }

  return (
    <>
      <section className="admin-card admin-orders" aria-labelledby="admin-orders-list-title" aria-busy={loading}>
        <div className="admin-orders-head">
          <h2 id="admin-orders-list-title">Pedidos do site</h2>
          <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <RefreshCw aria-hidden="true" />}
            Atualizar
          </button>
        </div>

        {!orders && loading && <p className="admin-muted">Carregando pedidos…</p>}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {storage === 'none' && (
          <p className="admin-muted">
            O banco de dados ainda não foi configurado no servidor, então os pedidos não ficam guardados aqui (eles
            continuam chegando pelo WhatsApp e pelo n8n). Conecte o Upstash Redis na Vercel — veja o README.
          </p>
        )}

        {orders && storage !== 'none' && (
          <>
            <div className="admin-order-filters" role="group" aria-label="Filtrar pedidos">
              {FILTERS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className="admin-filter"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                  <span className={ALERT_FILTERS.includes(option.id) && counts.get(option.id) ? 'is-alert' : undefined}>
                    {counts.get(option.id) ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="admin-muted">
                {orders.length === 0 ? 'Nenhum pedido registrado ainda.' : 'Nenhum pedido neste filtro.'}
              </p>
            ) : (
              <ul className="admin-order-list">
                {visible.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    busy={busyId === order.id}
                    onStatus={status => changeStatus(order, status)}
                    onConfirmPayment={() => confirmPayment(order)}
                    onRecheck={() => recheck(order)}
                    onReply={text => reply(order, text)}
                    onOpenChat={() => openChat(order)}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {legacy.length > 0 && (
          <details className="admin-legacy">
            <summary>Pedidos antigos ({legacy.length}) — antes do controle de status, só para consulta</summary>
            <ul className="admin-order-list">
              {legacy.map(order => (
                <LegacyCard key={order.orderId} order={order} />
              ))}
            </ul>
          </details>
        )}
      </section>
      {orders && storage !== 'none' && <AdminReport orders={orders} />}
    </>
  )
}

/** Pedido do formato antigo: só os dados, sem ações. */
function LegacyCard({ order }: { order: LegacyOrder }) {
  const delivery = order.customer.fulfillment === 'entrega'
  return (
    <li className="admin-order is-legacy">
      <div className="admin-order-top">
        <span className="admin-order-id">{order.orderId}</span>
        <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
      </div>
      <div className="admin-order-badges">
        {order.status === 'pendente' && <span className="admin-status is-pendente">Pendente</span>}
        {order.confirmation && (
          <span className="admin-order-tag is-paid">
            <BadgeCheck aria-hidden="true" /> Confirmado ({order.confirmation.by})
          </span>
        )}
      </div>
      <p className="admin-order-customer">
        <strong>{order.customer.name}</strong>
        <span className={`admin-order-tag${delivery ? ' is-delivery' : ''}`}>
          {delivery ? <Truck aria-hidden="true" /> : <Store aria-hidden="true" />}
          {delivery ? 'Entrega' : 'Retirada'}
        </span>
      </p>
      <p className="admin-order-address">{order.customer.address}</p>
      <ul className="admin-order-items">
        {order.items.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <span>
              {item.layers && <Palette aria-hidden="true" />}
              {item.quantity}× {item.name}
              {item.outOfStock && <em className="admin-order-shortage">sem estoque</em>}
            </span>
            <span>{formatBRL(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <div className="admin-order-bottom">
        <span>{order.payment.label}</span>
        <strong>{formatBRL(order.total)}</strong>
      </div>
    </li>
  )
}

function OrderCard({
  order,
  busy,
  onStatus,
  onConfirmPayment,
  onRecheck,
  onReply,
  onOpenChat,
}: {
  order: Order
  busy: boolean
  onStatus: (status: OrderStatus) => void
  onConfirmPayment: () => void
  onRecheck: () => void
  onReply: (text: string) => Promise<boolean>
  onOpenChat: () => void
}) {
  const [reply, setReply] = useState('')
  const delivery = order.customer.fulfillment === 'entrega'
  const unread = unreadForStore(order)
  const deadline = paymentDeadline(order)
  // Mensagem nova abre a conversa sozinha; depois, quem manda é a equipe.
  const [chatOpen, setChatOpen] = useState(unread > 0)
  useEffect(() => {
    if (unread > 0) setChatOpen(true)
  }, [unread])
  const trackingUrl =
    order.accessToken && typeof window !== 'undefined' ? `${window.location.origin}${trackingPath(order)}` : undefined
  const firstName = order.customer.name.split(' ')[0]
  const whatsappText = `Oi, ${firstName}! Aqui é da Ondina Bolos 🍰 Sobre o seu pedido ${order.id}: ${
    trackingUrl ? `acompanhe e fale com a gente por aqui: ${trackingUrl}` : ''
  }`

  const copyLink = async () => {
    if (!trackingUrl) return
    try {
      await navigator.clipboard.writeText(trackingUrl)
      toast.success('Link do pedido copiado')
    } catch {
      toast.error('Não deu para copiar o link.')
    }
  }

  const submitReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!reply.trim() || busy) return
    if (await onReply(reply)) setReply('')
  }
  const pending = order.status === 'pendente'
  const canPay = !pending && !order.paid && order.status !== 'cancelado'
  const selectId = `order-status-${order.id}`

  return (
    <li className={`admin-order is-${order.status}`} aria-busy={busy}>
      <div className="admin-order-top">
        <span className="admin-order-id">{order.id}</span>
        <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
      </div>

      <div className="admin-order-badges">
        <span className={`admin-status is-${order.status}`}>
          {pending && <Hourglass aria-hidden="true" />}
          {statusLabel(order.status, order.customer.fulfillment)}
        </span>
        <span className={`admin-order-tag${order.paid ? ' is-paid' : ''}`}>
          {order.paid ? <BadgeCheck aria-hidden="true" /> : <CircleDollarSign aria-hidden="true" />}
          {order.paid ? 'Pago' : 'Não pago'}
        </span>
        <span className={`admin-order-tag${order.channel === 'site' ? ' is-site' : ''}`}>
          {order.channel === 'site' ? <Globe aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
          {order.channel === 'site' ? 'Pelo site' : 'WhatsApp'}
        </span>
        {unread > 0 && (
          <span className="admin-order-tag is-unread">
            <MessageCircle aria-hidden="true" /> {unread} {unread === 1 ? 'mensagem nova' : 'mensagens novas'}
          </span>
        )}
      </div>

      <p className="admin-order-customer">
        <strong>{order.customer.name}</strong>
        <span className={`admin-order-tag${delivery ? ' is-delivery' : ''}`}>
          {delivery ? <Truck aria-hidden="true" /> : <Store aria-hidden="true" />}
          {delivery ? 'Entrega' : 'Retirada'}
        </span>
      </p>
      <p className="admin-order-address">{order.customer.address}</p>
      {order.schedule && (
        <p className="admin-order-schedule">
          <CalendarClock aria-hidden="true" /> Para {order.schedule.label}
        </p>
      )}
      {order.customer.phone && (
        <p className="admin-order-contact">
          <a href={customerWhatsAppUrl(order.customer.phone, whatsappText)} target="_blank" rel="noreferrer">
            <Phone aria-hidden="true" /> {formatPhone(order.customer.phone)}
          </a>
          {trackingUrl && (
            <button type="button" onClick={() => void copyLink()}>
              <Link2 aria-hidden="true" /> Copiar link do pedido
            </button>
          )}
        </p>
      )}

      <ul className="admin-order-items">
        {order.items.map((item, index) => (
          <li key={`${item.productId ?? 'custom'}-${index}`}>
            <span>
              {item.layerIds && <Palette aria-hidden="true" />}
              {item.quantity}
              {item.unit === 'kg' ? ' kg' : '×'} {item.name}
              {order.shortages.some(s => s.productId === item.productId) && (
                <em className="admin-order-shortage">sem estoque</em>
              )}
              {item.detail && <small>{item.detail}</small>}
            </span>
            <span>{formatBRL(item.subtotal)}</span>
          </li>
        ))}
      </ul>

      <div className="admin-order-bottom">
        <span>{order.payment.label}</span>
        <strong>{formatBRL(order.total)}</strong>
      </div>
      {deadline && (
        <p className="admin-muted">
          Pagamento online até {formatDate(deadline.toISOString())}. Sem pagamento, o pedido é cancelado sozinho e o
          estoque volta.
        </p>
      )}

      {pending && (
        <div className="admin-order-blocked" role="note">
          <p>
            <strong>Bloqueado por falta de estoque.</strong> Não avança para preparo nem entrega até o estoque ser
            validado.
          </p>
          <ul>
            {order.shortages.map(shortage => (
              <li key={shortage.productId}>
                {shortageText(shortage, order.items.find(item => item.productId === shortage.productId)?.unit)}
              </li>
            ))}
          </ul>
          <p className="admin-muted">Dê entrada no estoque em “Bolos” (mais abaixo) e depois verifique.</p>
          <button type="button" className="admin-order-btn is-primary" onClick={onRecheck} disabled={busy}>
            {busy ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <PackageSearch aria-hidden="true" />}
            Verificar estoque
          </button>
        </div>
      )}

      <div className="admin-order-actions">
        <label htmlFor={selectId}>Status da entrega</label>
        <select
          id={selectId}
          value={order.status}
          disabled={busy || order.status === 'entregue' || order.status === 'cancelado'}
          onChange={event => onStatus(event.target.value as OrderStatus)}
        >
          {ORDER_STATUSES.map(status => {
            const blocked = status !== order.status ? transitionError(order, status) : undefined
            return (
              <option key={status} value={status} disabled={Boolean(blocked)} title={blocked}>
                {statusLabel(status, order.customer.fulfillment)}
                {blocked && status !== 'pendente' ? ' 🔒' : ''}
              </option>
            )
          })}
        </select>
        <button
          type="button"
          className="admin-order-btn"
          onClick={onConfirmPayment}
          disabled={busy || !canPay}
          title={pending ? 'Pedido pendente: valide o estoque primeiro.' : undefined}
        >
          <BadgeCheck aria-hidden="true" />
          {order.paid ? 'Pagamento confirmado' : 'Confirmar pagamento'}
        </button>
      </div>

      {order.accessToken && (
        <details
          className="admin-order-chat"
          open={chatOpen}
          onToggle={event => {
            const open = event.currentTarget.open
            setChatOpen(open)
            if (open) onOpenChat()
          }}
        >
          <summary>
            Conversa pelo site {order.messages.length > 0 && `(${order.messages.length})`}
            {unread > 0 && <span className="admin-chat-dot" aria-label={`${unread} não lidas`} />}
          </summary>
          <div className="track-chat is-admin" role="log">
            {order.messages.length === 0 ? (
              <p className="admin-muted">Nenhuma mensagem. O cliente vê o que você escrever na página do pedido.</p>
            ) : (
              order.messages.map((message, index) => (
                <div key={index} className={`chat-bubble is-${message.from === 'loja' ? 'cliente' : 'loja'}`}>
                  <span className="chat-author">
                    {message.from === 'loja' ? `Loja${message.by ? ` (${message.by})` : ''}` : firstName}
                  </span>
                  <p>{message.text}</p>
                  <time dateTime={message.at}>{formatDate(message.at)}</time>
                </div>
              ))
            )}
          </div>
          <form className="chat-form" onSubmit={submitReply}>
            <label htmlFor={`reply-${order.id}`} className="sr-only">
              Responder {firstName}
            </label>
            <textarea
              id={`reply-${order.id}`}
              value={reply}
              onChange={event => setReply(event.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              placeholder={`Responder ${firstName}…`}
            />
            <button type="submit" className="admin-order-btn is-primary" disabled={busy || !reply.trim()}>
              <Send aria-hidden="true" /> Enviar
            </button>
          </form>
        </details>
      )}

      <details className="admin-order-history">
        <summary>Histórico</summary>
        <ol>
          {order.history.map((entry, index) => (
            <li key={index}>
              <time dateTime={entry.at}>{formatDate(entry.at)}</time> —{' '}
              {statusLabel(entry.status, order.customer.fulfillment)} <small>({entry.by})</small>
              {entry.note && <small> · {entry.note}</small>}
            </li>
          ))}
        </ol>
      </details>
    </li>
  )
}
