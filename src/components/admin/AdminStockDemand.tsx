import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, Hourglass, Loader2, Phone, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ADMIN_ACTED_EVENT, CATALOG_CHANGED_EVENT, ORDERS_CHANGED_EVENT } from '@/components/admin/sold-out'
import { customerWhatsAppUrl, formatPhone } from '@/lib/phone'
import { restockMessage, type ProductDemand } from '@/lib/stock-requests'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const formatDay = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date)
}

const amount = (unit: ProductDemand['unit'], value: number) => (unit === 'kg' ? `${value} kg` : `${value} un.`)

/**
 * Procura pelos bolos esgotados (estoque 0): quem pediu "avise-me" e os pedidos PENDENTES.
 * A equipe vê a demanda, pega o contato e avisa quando o bolo voltar.
 */
export function AdminStockDemand() {
  const [demand, setDemand] = useState<ProductDemand[]>()
  const [notifiedCount, setNotifiedCount] = useState(0)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { listStockDemand } = await import('@/lib/stock-requests-server')
      const result = await listStockDemand()
      if (result.ok) {
        setDemand(result.demand)
        setNotifiedCount(result.notifiedCount)
        setError(undefined)
      } else setError(result.error)
    } catch {
      setError('Não foi possível carregar a procura pelos bolos esgotados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const reload = () => void load()
    window.addEventListener(ORDERS_CHANGED_EVENT, reload)
    window.addEventListener(CATALOG_CHANGED_EVENT, reload)
    return () => {
      window.removeEventListener(ORDERS_CHANGED_EVENT, reload)
      window.removeEventListener(CATALOG_CHANGED_EVENT, reload)
    }
  }, [load])

  const markNotified = async (key: string, ids: string[]) => {
    setBusy(key)
    try {
      const { markRestockNotified } = await import('@/lib/stock-requests-server')
      const result = await markRestockNotified({ data: { ids } })
      if (!result.ok) return void toast.error(result.error)
      toast.success(ids.length === 1 ? 'Marcado como avisado.' : `${ids.length} clientes marcados como avisados.`)
      window.dispatchEvent(new Event(ADMIN_ACTED_EVENT))
      await load()
    } catch {
      toast.error('Não foi possível falar com o servidor. Tente de novo.')
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Remover este pedido de aviso?')) return
    setBusy(id)
    try {
      const { deleteRestockRequest } = await import('@/lib/stock-requests-server')
      const result = await deleteRestockRequest({ data: { id } })
      if (!result.ok) return void toast.error(result.error)
      window.dispatchEvent(new Event(ADMIN_ACTED_EVENT))
      await load()
    } catch {
      toast.error('Não foi possível falar com o servidor. Tente de novo.')
    } finally {
      setBusy(undefined)
    }
  }

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <section className="admin-card admin-demand" aria-labelledby="admin-demand-title" aria-busy={loading}>
      <div className="admin-orders-head">
        <h2 id="admin-demand-title">
          <BellRing aria-hidden="true" /> Procura por bolos esgotados
        </h2>
        <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 aria-hidden="true" className="checkout-spin" /> : <RefreshCw aria-hidden="true" />}
          Atualizar
        </button>
      </div>
      <p className="admin-muted">
        Quem tocou em “Avise-me quando chegar” num bolo com estoque 0, e os pedidos pendentes esperando estoque. Dê
        entrada no estoque em “Bolos” e avise cada cliente pelo WhatsApp (a mensagem já vai pronta).
      </p>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {demand && demand.length === 0 && (
        <p className="admin-muted">
          Ninguém esperando bolo esgotado agora.{notifiedCount > 0 && ` ${notifiedCount} já avisados.`}
        </p>
      )}

      {demand && demand.length > 0 && (
        <ul className="admin-demand-list">
          {demand.map(product => {
            const back = product.stock === null || product.stock > 0
            const waitingIds = product.waiting.map(request => request.id)
            return (
              <li key={product.productId} className={`admin-demand-item${back ? ' is-back' : ''}`}>
                <div className="admin-demand-head">
                  <strong>{product.productName}</strong>
                  <span className={`admin-order-tag${back ? ' is-paid' : ' is-pending'}`}>
                    {back
                      ? product.stock === null
                        ? 'Disponível: avise os clientes'
                        : `Voltou: ${amount(product.unit, product.stock)} — avise os clientes`
                      : 'Estoque 0'}
                  </span>
                </div>
                <p className="admin-demand-count">
                  <strong>{product.waiting.length}</strong>{' '}
                  {product.waiting.length === 1 ? 'pessoa esperando' : 'pessoas esperando'}
                  {product.pendingOrders.length > 0 && (
                    <>
                      {' · '}
                      <strong>{product.pendingOrders.length}</strong>{' '}
                      {product.pendingOrders.length === 1 ? 'pedido pendente' : 'pedidos pendentes'}
                    </>
                  )}
                  {product.requested > 0 && <> · procura de pelo menos {amount(product.unit, product.requested)}</>}
                </p>

                {product.waiting.length > 0 && (
                  <ul className="admin-demand-contacts">
                    {product.waiting.map(request => (
                      <li key={request.id}>
                        <span>
                          <strong>{request.name}</strong>
                          <small>
                            {formatDay(request.createdAt)}
                            {request.quantity ? ` · quer ${amount(product.unit, request.quantity)}` : ''}
                          </small>
                        </span>
                        <a
                          className="admin-demand-phone"
                          href={customerWhatsAppUrl(request.phone, restockMessage(request, siteUrl))}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Phone aria-hidden="true" /> {formatPhone(request.phone)}
                        </a>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => void markNotified(request.id, [request.id])}
                          disabled={busy !== undefined}
                          aria-label={`Marcar ${request.name} como avisado`}
                          title="Marcar como avisado"
                        >
                          <Check aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => void remove(request.id)}
                          disabled={busy !== undefined}
                          aria-label={`Remover o aviso de ${request.name}`}
                          title="Remover"
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {product.pendingOrders.length > 0 && (
                  <ul className="admin-demand-contacts is-orders">
                    {product.pendingOrders.map(order => (
                      <li key={order.id}>
                        <span>
                          <strong>
                            <Hourglass aria-hidden="true" /> {order.id}
                          </strong>
                          <small>
                            {order.name} · pediu {amount(product.unit, order.requested)}
                          </small>
                        </span>
                        {order.phone && (
                          <a
                            className="admin-demand-phone"
                            href={customerWhatsAppUrl(
                              order.phone,
                              `Oi, ${order.name.split(' ')[0]}! Aqui é da Ondina Bolos 🍰 Sobre o seu pedido ${order.id}: `,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Phone aria-hidden="true" /> {formatPhone(order.phone)}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {waitingIds.length > 1 && (
                  <button
                    type="button"
                    className="admin-order-btn"
                    onClick={() => void markNotified(product.productId, waitingIds)}
                    disabled={busy !== undefined}
                  >
                    {busy === product.productId ? (
                      <Loader2 aria-hidden="true" className="checkout-spin" />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    Marcar todos como avisados
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
