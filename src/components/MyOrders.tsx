import { useEffect, useState } from 'react'
import { ChevronRight, ReceiptText } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { recentOrders, type RememberedOrder } from '@/lib/my-orders'

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/**
 * "Meus pedidos" no topo: os últimos pedidos feitos neste aparelho, com o link para a página de
 * cada um (status, pagamento e conversa). Só aparece depois do primeiro pedido.
 */
export function MyOrders() {
  const [orders, setOrders] = useState<RememberedOrder[]>([])

  // Só no navegador (o servidor não sabe dos pedidos deste aparelho).
  useEffect(() => {
    setOrders(recentOrders())
  }, [])

  if (orders.length === 0) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cart-button"
          aria-label={`Meus pedidos (${orders.length})`}
          title="Meus pedidos"
        >
          <ReceiptText aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="my-orders">
        <p className="my-orders-title">Meus pedidos</p>
        <ul>
          {orders.map(order => (
            <li key={order.id}>
              <a href={order.url}>
                <span>
                  <strong>{order.id}</strong>
                  <small>{dateFormat.format(new Date(order.createdAt))}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="my-orders-note">Guardados só neste aparelho. Toque para ver o andamento e falar com a Ondina.</p>
      </PopoverContent>
    </Popover>
  )
}
