import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CircleDollarSign, Hourglass, Loader2, PackageSearch, Palette, RefreshCw, Store, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { formatBRL } from '@/lib/format'
import {
  ORDER_STATUSES,
  shortageText,
  statusLabel,
  transitionError,
  type Order,
  type OrderStatus,
} from '@/lib/order-flow'
import { confirmOrderPayment, listOrders, recheckOrderStock, setOrderStatus } from '@/lib/orders-server'

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

type Filter = 'abertos' | OrderStatus | 'todos'

/** Em aberto = ainda precisa de alguma ação da equipe. */
const isOpen = (order: Order) => order.status !== 'entregue' && order.status !== 'cancelado'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'abertos', label: 'Em aberto' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { id: 'em_preparo', label: 'Em preparo' },
  { id: 'saiu_para_entrega', label: 'Saiu / pronto' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
]

const matches = (order: Order, filter: Filter) =>
  filter === 'todos' ? true : filter === 'abertos' ? isOpen(order) : order.status === filter

type Storage = 'upstash' | 'file' | 'none'

/** Pedidos do site, gravados no banco do próprio site: status da entrega, pagamento e estoque. */
export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>()
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
    action: () => Promise<{ ok: true; order: Order; released: boolean } | { ok: false; error: string }>,
    success: (updated: Order, released: boolean) => string | undefined,
  ) => {
    setBusyId(order.id)
    try {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOrders(list => list?.map(entry => (entry.id === result.order.id ? result.order : entry)))
      const message = success(result.order, result.released)
      if (message) toast.success(message)
    } catch {
      toast.error('Não foi possível falar com o servidor. Tente de novo.')
    } finally {
      setBusyId(undefined)
    }
  }

  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === 'cancelado' && !window.confirm(`Cancelar o pedido ${order.id}? O estoque reservado volta para o cardápio.`)) {
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

  return (
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
                <span className={option.id === 'pendente' && counts.get('pendente') ? 'is-alert' : undefined}>
                  {counts.get(option.id) ?? 0}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="admin-muted">{orders.length === 0 ? 'Nenhum pedido registrado ainda.' : 'Nenhum pedido neste filtro.'}</p>
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
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function OrderCard({
  order,
  busy,
  onStatus,
  onConfirmPayment,
  onRecheck,
}: {
  order: Order
  busy: boolean
  onStatus: (status: OrderStatus) => void
  onConfirmPayment: () => void
  onRecheck: () => void
}) {
  const delivery = order.customer.fulfillment === 'entrega'
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
