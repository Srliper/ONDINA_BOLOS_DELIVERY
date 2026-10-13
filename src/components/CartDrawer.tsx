import { useEffect, useState } from 'react'
import { ArrowRight, Hourglass, MessageCircle, Minus, Palette, PartyPopper, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CheckoutStepper } from '@/components/CheckoutStepper'
import { StackedCake } from '@/components/StackedCake'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatQuantity } from '@/data/products'
import { MAX_QUANTITY, useCart, useCartOpen } from '@/lib/cart-store'
import type { CheckoutData } from '@/lib/checkout'
import { formatBRL } from '@/lib/format'
import { isPendingOrder, lacksStock, shortageText } from '@/lib/stock'
import { processOrderAndSend, type SendResult } from '@/lib/whatsapp'
import type { CartItem } from '@/types/product'

export function CartDrawer() {
  const [open, setOpen] = useCartOpen()
  const cart = useCart()
  const [checkingOut, setCheckingOut] = useState(false)
  const [sent, setSent] = useState<SendResult>()

  // Avisos de "adicionado" ficariam por cima do botão de finalizar; ao fechar, volta para a lista.
  useEffect(() => {
    if (open) toast.dismiss()
    else {
      setCheckingOut(false)
      setSent(undefined)
    }
  }, [open])

  const showCheckout = checkingOut && !cart.isEmpty
  const pending = isPendingOrder(cart.items)

  const goToMenu = () => {
    setOpen(false)
    document.getElementById('bolos')?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendOrder = async (checkout: CheckoutData) => {
    const result = await processOrderAndSend(cart.items, cart.total, checkout)
    setSent(result)
    setCheckingOut(false)
    cart.clear()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="cart-drawer">
        <SheetHeader className="cart-header">
          <SheetTitle className="cart-title">
            {sent ? 'Pedido pronto!' : showCheckout ? 'Finalizar pedido' : 'Seu pedido'}
          </SheetTitle>
          <SheetDescription className="cart-subtitle">
            {sent
              ? 'Falta só um toque: envie a mensagem na conversa do WhatsApp.'
              : cart.isEmpty
              ? 'Nenhum bolo escolhido ainda.'
              : showCheckout
                ? pending
                  ? 'Dois passos rápidos e o pedido pendente segue para o WhatsApp.'
                  : 'Três passos rápidos e o pedido segue pronto para o WhatsApp.'
                : 'Confira os itens e envie pelo WhatsApp. A confirmação é feita na conversa.'}
          </SheetDescription>
        </SheetHeader>

        {sent ? (
          <div className="cart-empty cart-sent" role="status">
            <PartyPopper aria-hidden="true" />
            <p>
              Abrimos o WhatsApp com o seu pedido <strong>{sent.orderId}</strong>. Toque em <strong>Enviar</strong> na
              conversa para a Ondina receber e confirmar.
            </p>
            <a className="checkout-button" href={sent.whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              Abrir o WhatsApp de novo
            </a>
            <button type="button" className="cart-clear" onClick={goToMenu}>
              Voltar ao cardápio
            </button>
          </div>
        ) : cart.isEmpty ? (
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
              {pending && (
                <p className="cart-pending" role="status">
                  <Hourglass aria-hidden="true" />
                  <span>
                    Tem bolo sem estoque: o pedido vai como <strong>pendente</strong>, sem pagamento agora. A Ondina
                    confirma pelo WhatsApp.
                  </span>
                </p>
              )}

              <button type="button" className="checkout-button" onClick={() => setCheckingOut(true)}>
                {pending ? 'Continuar como pedido pendente' : 'Finalizar pedido'}
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
        {lacksStock(item) && <p className="cart-line-shortage">{shortageText(item)}</p>}
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
