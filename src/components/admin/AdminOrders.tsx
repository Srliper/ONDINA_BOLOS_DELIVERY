import { useCallback, useEffect, useState } from 'react'
import { Hourglass, Loader2, Palette, RefreshCw, Store, Truck } from 'lucide-react'
import { getAdminOrders } from '@/lib/admin-auth'
import { formatBRL } from '@/lib/format'
import type { OrdersResult, StoredOrder } from '@/lib/orders'

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

/** Últimos pedidos registrados no n8n (lidos no servidor, só com sessão válida). */
export function AdminOrders() {
  const [result, setResult] = useState<OrdersResult>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setResult(await getAdminOrders())
    } catch {
      setResult({ status: 'error', message: 'Não foi possível carregar os pedidos.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="admin-card admin-orders" aria-labelledby="admin-orders-list-title" aria-busy={loading}>
      <div className="admin-orders-head">
        <h2 id="admin-orders-list-title">Últimos pedidos do site</h2>
        <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <RefreshCw aria-hidden="true" />}
          Atualizar
        </button>
      </div>

      {!result && loading && <p className="admin-muted">Carregando pedidos…</p>}

      {result?.status === 'not-configured' && (
        <p className="admin-muted">
          A lista ainda não está ligada ao n8n. Configure <code>N8N_ORDERS_URL</code> (e <code>N8N_ORDERS_KEY</code>)
          no servidor — o passo a passo está no README, em “Pedidos no painel”. Enquanto isso, os pedidos continuam
          chegando no WhatsApp e no n8n normalmente.
        </p>
      )}

      {result?.status === 'error' && (
        <p className="admin-error" role="alert">
          {result.message}
        </p>
      )}

      {result?.status === 'ok' &&
        (result.orders.length === 0 ? (
          <p className="admin-muted">Nenhum pedido registrado ainda.</p>
        ) : (
          <>
            <ul className="admin-order-list">
              {result.orders.map(order => (
                <OrderRow key={order.orderId} order={order} />
              ))}
            </ul>
            {result.skipped > 0 && (
              <p className="admin-muted">
                {result.skipped} registro(s) do n8n fora do formato esperado não foram mostrados.
              </p>
            )}
          </>
        ))}
    </section>
  )
}

function OrderRow({ order }: { order: StoredOrder }) {
  const delivery = order.customer.fulfillment === 'entrega'
  return (
    <li className="admin-order">
      <div className="admin-order-top">
        <span className="admin-order-id">{order.orderId}</span>
        {order.status === 'pendente' && (
          <span className="admin-order-tag is-pending">
            <Hourglass aria-hidden="true" /> Pendente
          </span>
        )}
        <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
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
              {item.layers && (
                <small>
                  {item.layers.base} · {item.layers.recheio} · {item.layers.cobertura} · {item.layers.decoracao}
                </small>
              )}
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
