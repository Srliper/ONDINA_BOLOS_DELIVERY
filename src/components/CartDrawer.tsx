import { useEffect, useId, useState } from 'react'
import { MessageCircle, Minus, Palette, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { StackedCake } from '@/components/StackedCake'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatQuantity } from '@/data/products'
import { MAX_QUANTITY, useCart, useCartOpen } from '@/lib/cart-store'
import { formatBRL } from '@/lib/format'
import { generateWhatsAppLink } from '@/lib/whatsapp'
import type { CartItem } from '@/types/product'

export function CartDrawer() {
  const [open, setOpen] = useCartOpen()
  const cart = useCart()
  const [address, setAddress] = useState('')
  const addressId = useId()

  // Avisos de "adicionado" ficariam por cima do botão de finalizar.
  useEffect(() => {
    if (open) toast.dismiss()
  }, [open])

  const goToMenu = () => {
    setOpen(false)
    document.getElementById('bolos')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="cart-drawer">
        <SheetHeader className="cart-header">
          <SheetTitle className="cart-title">Seu pedido</SheetTitle>
          <SheetDescription className="cart-subtitle">
            {cart.isEmpty ? 'Nenhum bolo escolhido ainda.' : 'Confira os itens e envie pelo WhatsApp. A confirmação é feita na conversa.'}
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
        ) : (
          <>
            <ul className="cart-list" aria-label="Itens do pedido">
              {cart.items.map((item, index) => (
                <CartLine key={item.id} item={item} index={index} />
              ))}
            </ul>

            <div className="cart-footer">
              <label htmlFor={addressId} className="cart-address-label">
                Endereço de entrega
              </label>
              <textarea
                id={addressId}
                className="cart-address"
                value={address}
                maxLength={240}
                rows={2}
                onChange={event => setAddress(event.target.value)}
                placeholder="Rua, número e bairro. Deixe em branco para retirar na loja."
              />

              <div className="cart-total" aria-live="polite">
                <span>Total estimado</span>
                <strong key={cart.total}>{formatBRL(cart.total)}</strong>
              </div>

              <a
                className="checkout-button"
                href={generateWhatsAppLink(cart.items, cart.total, address)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                Finalizar Pedido no WhatsApp
              </a>
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
          <StackedCake images={item.layerImages} width={56} />
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
