import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Palette, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CheckoutStepper } from '@/components/CheckoutStepper'
import { StackedCake } from '@/components/StackedCake'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatQuantity } from '@/data/products'
import { MAX_QUANTITY, useCart, useCartOpen } from '@/lib/cart-store'
import { formatAddress, paymentLabel, type CheckoutData } from '@/lib/checkout'
import { formatBRL } from '@/lib/format'
import { generateWhatsAppLink } from '@/lib/whatsapp'
import type { CartItem } from '@/types/product'

export function CartDrawer() {
  const [open, setOpen] = useCartOpen()
  const cart = useCart()
  const [checkingOut, setCheckingOut] = useState(false)

  // Avisos de "adicionado" ficariam por cima do botão de finalizar; ao fechar, volta para a lista.
  useEffect(() => {
    if (open) toast.dismiss()
    else setCheckingOut(false)
  }, [open])

  const showCheckout = checkingOut && !cart.isEmpty

  const sendOrder = ({ customer, payment }: CheckoutData) => {
    const paymentText =
      paymentLabel(payment.method, customer.fulfillment) +
      (payment.changeFor !== undefined ? ` (troco para ${formatBRL(payment.changeFor)})` : '')
    const link = generateWhatsAppLink(cart.items, cart.total, formatAddress(customer), {
      name: customer.name,
      payment: paymentText,
    })
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  const goToMenu = () => {
    setOpen(false)
    document.getElementById('bolos')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="cart-drawer">
        <SheetHeader className="cart-header">
          <SheetTitle className="cart-title">{showCheckout ? 'Finalizar pedido' : 'Seu pedido'}</SheetTitle>
          <SheetDescription className="cart-subtitle">
            {cart.isEmpty
              ? 'Nenhum bolo escolhido ainda.'
              : showCheckout
                ? 'Três passos rápidos e o pedido segue pronto para o WhatsApp.'
                : 'Confira os itens e envie pelo WhatsApp. A confirmação é feita na conversa.'}
          </SheetDescription>
        </SheetHeader>

        {cart.isEmpty ? (
          <div className="cart-empty">
            <ShoppingBag aria-hidden="true" />
            <p>Escolha um bolo no cardápio e toque em “Adicionar”.</p>
            <button type="button" className="bakery-button bakery-button-cocoa" onClick={goToMenu}>
              Ver cardápio
            </button>
          </div>
        ) : showCheckout ? (
          <CheckoutStepper
            items={cart.items}
            total={cart.total}
            onBack={() => setCheckingOut(false)}
            onConfirm={sendOrder}
          />
        ) : (
          <>
            <ul className="cart-list" aria-label="Itens do pedido">
              {cart.items.map((item, index) => (
                <CartLine key={item.id} item={item} index={index} />
              ))}
            </ul>

            <div className="cart-footer">
              <div className="cart-total" aria-live="polite">
                <span>Total estimado</span>
                <strong key={cart.total}>{formatBRL(cart.total)}</strong>
              </div>

              <button type="button" className="checkout-button" onClick={() => setCheckingOut(true)}>
                Finalizar pedido
                <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="cart-clear" onClick={cart.clear}>
                Esvaziar carrinho
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function CartLine({ item, index }: { item: CartItem; index: number }) {
  const { id, name, price, quantity } = item
  const { increment, decrement, remove } = useCart()
  const isCustom = item.type === 'custom'
  const step = item.type === 'ready' && item.product.unit === 'kg' ? 'quilo' : 'bolo'
  const quantityLabel =
    item.type === 'ready' ? formatQuantity(item.product, quantity) : `${quantity} ${quantity === 1 ? 'bolo' : 'bolos'}`

  return (
    <li className={`cart-line${isCustom ? ' is-custom' : ''}`} style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
      {item.type === 'custom' ? (
        <span className="cart-thumb cart-thumb-custom">
          <StackedCake layers={item.layers} width={56} />
        </span>
      ) : (
        <img src={item.product.image} alt="" className="cart-thumb" width={64} height={64} />
      )}
      <div className="cart-line-info">
        <p className="cart-line-name">
          {isCustom && <Palette aria-hidden="true" className="cart-line-icon" />}
          {name}
        </p>
        {item.type === 'custom' ? (
          <dl className="cart-custom-layers" aria-label="Camadas escolhidas">
            <div><dt>Base</dt><dd>{item.customConfig.base}</dd></div>
            <div><dt>Recheio</dt><dd>{item.customConfig.recheio}</dd></div>
            <div><dt>Cobertura</dt><dd>{item.customConfig.cobertura}</dd></div>
            <div><dt>Decoração</dt><dd>{item.customConfig.decoracao}</dd></div>
          </dl>
        ) : null}
        <p className="cart-line-meta">
          {formatBRL(price)} {item.type === 'ready' ? item.product.priceUnit : 'cada'}
        </p>
        <div className="cart-stepper" role="group" aria-label={`Quantidade de ${name}`}>
          <button type="button" onClick={() => decrement(id)} aria-label={`Tirar 1 ${step} de ${name}`}>
            <Minus aria-hidden="true" />
          </button>
          <output key={quantity} aria-live="polite">
            {quantityLabel}
          </output>
          <button
            type="button"
            onClick={() => increment(id)}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={`Adicionar 1 ${step} de ${name}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="cart-line-end">
        <strong>{formatBRL(price * quantity)}</strong>
        <button type="button" className="cart-remove" onClick={() => remove(id)} aria-label={`Remover ${name} do pedido`}>
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
