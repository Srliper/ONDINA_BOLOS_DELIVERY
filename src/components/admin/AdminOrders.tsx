import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Hourglass, Loader2, Palette, RefreshCw, Store, Truck, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { TEAM } from '@/data/team'
import { getAdminOrders } from '@/lib/admin-auth'
import { formatBRL } from '@/lib/format'
import type { OrderConfirmation, OrdersResult, SiteOrder, StockChange } from '@/lib/orders'
import type { SoldOutProduct } from '@/lib/stock-alert'
import { announceSoldOut, CATALOG_CHANGED_EVENT } from '@/components/admin/sold-out'

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

const firstName = (memberId: string) => TEAM.find(member => member.id === memberId)?.name.split(' ')[0] ?? memberId

const changeText = (change: StockChange) => `${change.name} ${change.from} → ${change.to}`

type View =
  | { source: 'site'; orders: SiteOrder[] }
  | { source: 'n8n'; result: OrdersResult }
  | { source: 'error'; message: string }

async function api<T>(url: string, method = 'GET'): Promise<T> {
  const response = await fetch(url, { method, credentials: 'same-origin' })
  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string }
  if (!response.ok) throw new Error(body.error ?? `Erro ${response.status}`)
  return body.data as T
}

/**
 * Últimos pedidos: os que o site guardou no banco (com "Confirmar e baixar estoque");
 * sem banco, cai para a leitura do n8n (só consulta).
 */
export function AdminOrders() {
  const [view, setView] = useState<View>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ storage: string; orders: SiteOrder[] }>('/api/orders')
      setView(data.storage === 'none' ? { source: 'n8n', result: await getAdminOrders() } : { source: 'site', orders: data.orders })
    } catch (error) {
      setView({ source: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const confirm = async (order: SiteOrder) => {
    setBusy(order.orderId)
    try {
      const result = await api<{ confirmation: OrderConfirmation; soldOut: SoldOutProduct[] }>(
        `/api/orders/${encodeURIComponent(order.orderId)}/confirm`,
        'POST',
      )
      const changes = result.confirmation.stock
      toast.success(
        changes.length ? `Pedido confirmado. Estoque: ${changes.map(changeText).join(', ')}` : 'Pedido confirmado.',
      )
      announceSoldOut(result.soldOut)
      window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT))
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível confirmar.')
    } finally {
      setBusy(undefined)
    }
  }

  const undo = async (order: SiteOrder) => {
    if (!window.confirm(`Desfazer a confirmação de ${order.orderId}? O estoque que saiu volta para o cardápio.`)) return
    setBusy(order.orderId)
    try {
      await api(`/api/orders/${encodeURIComponent(order.orderId)}/confirm`, 'DELETE')
      toast.success('Confirmação desfeita e estoque devolvido.')
      window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT))
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível desfazer.')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <section className="admin-card admin-orders" aria-labelledby="admin-orders-list-title" aria-busy={loading}>
      <div className="admin-orders-head">
        <h2 id="admin-orders-list-title">Últimos pedidos do site</h2>
        <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <RefreshCw aria-hidden="true" />}
          Atualizar
        </button>
      </div>

      {!view && loading && <p className="admin-muted">Carregando pedidos…</p>}

      {view?.source === 'error' && (
        <p className="admin-error" role="alert">
          {view.message}
        </p>
      )}

      {view?.source === 'site' &&
        (view.orders.length === 0 ? (
          <p className="admin-muted">
            Nenhum pedido guardado ainda. Cada pedido enviado pelo site aparece aqui, com o botão para confirmar e baixar
            o estoque.
          </p>
        ) : (
          <>
            <p className="admin-muted">
              Depois de combinar com o cliente no WhatsApp, toque em <strong>Confirmar e baixar estoque</strong>.
            </p>
            <ul className="admin-order-list">
              {view.orders.map(order => (
                <OrderRow
                  key={order.orderId}
                  order={order}
                  busy={busy === order.orderId}
                  onConfirm={() => void confirm(order)}
                  onUndo={() => void undo(order)}
                />
              ))}
            </ul>
          </>
        ))}

      {view?.source === 'n8n' && <N8nOrders result={view.result} />}
    </section>
  )
}

/** Sem banco no servidor: lista só para consulta, lida do n8n. */
function N8nOrders({ result }: { result: OrdersResult }) {
  if (result.status === 'not-configured') {
    return (
      <p className="admin-muted">
        Para ver e confirmar os pedidos aqui, ligue o banco de dados (Upstash) na Vercel — o passo a passo está no
        README. Enquanto isso, os pedidos continuam chegando no WhatsApp e no n8n normalmente.
      </p>
    )
  }
  if (result.status === 'error') {
    return (
      <p className="admin-error" role="alert">
        {result.message}
      </p>
    )
  }
  if (result.orders.length === 0) return <p className="admin-muted">Nenhum pedido registrado ainda.</p>
  return (
    <>
      <ul className="admin-order-list">
        {result.orders.map(order => (
          <OrderRow key={order.orderId} order={order} />
        ))}
      </ul>
      {result.skipped > 0 && (
        <p className="admin-muted">{result.skipped} registro(s) do n8n fora do formato esperado não foram mostrados.</p>
      )}
    </>
  )
}

function OrderRow({
  order,
  busy = false,
  onConfirm,
  onUndo,
}: {
  order: SiteOrder
  busy?: boolean
  onConfirm?: () => void
  onUndo?: () => void
}) {
  const delivery = order.customer.fulfillment === 'entrega'
  const confirmation = order.confirmation
  const hasStockItems = order.items.some(item => item.productId)
  return (
    <li className={`admin-order${confirmation ? ' is-confirmed' : ''}`}>
      <div className="admin-order-top">
        <span className="admin-order-id">{order.orderId}</span>
        {confirmation ? (
          <span className="admin-order-tag is-confirmed">
            <CheckCircle2 aria-hidden="true" /> Confirmado
          </span>
        ) : (
          order.status === 'pendente' && (
            <span className="admin-order-tag is-pending">
              <Hourglass aria-hidden="true" /> Pendente
            </span>
          )
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

      {confirmation && (
        <p className="admin-order-confirmed">
          Confirmado por {firstName(confirmation.by)} em {formatDate(confirmation.at)}.
          {confirmation.stock.length > 0 && <> Estoque: {confirmation.stock.map(changeText).join(', ')}.</>}
        </p>
      )}
      {onConfirm && !confirmation && (
        <button type="button" className="admin-order-confirm" onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <CheckCircle2 aria-hidden="true" />}
          {hasStockItems ? 'Confirmar e baixar estoque' : 'Confirmar pedido'}
        </button>
      )}
      {onUndo && confirmation && (
        <button type="button" className="admin-order-undo" onClick={onUndo} disabled={busy}>
          <Undo2 aria-hidden="true" /> Desfazer
        </button>
      )}
    </li>
  )
}
