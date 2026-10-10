import { MapPin, MessageCircle, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import logo from '@/assets/ondina_logo.png'
import { useCart, useCartOpen } from '@/lib/cart-store'
import { CART_TARGET_ID } from '@/lib/fly-to-cart'
import { generateContactLink, MAPS_URL } from '@/lib/whatsapp'

export function Header() {
  const { count } = useCart()
  const [, setOpen] = useCartOpen()
  const label = count === 0 ? 'Abrir carrinho, vazio' : `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`

  return (
    <nav className="bakery-nav" aria-label="Navegação principal">
      <div className="scroll-progress" aria-hidden="true" />
      <div className="bakery-container bakery-nav-inner">
        <a className="brand" href="#" aria-label="Ondina Bolos, início">
          <img src={logo} alt="" width={55} height={55} />
          <div>
            <div className="brand-name">Ondina Bolos</div>
            <div className="brand-since">Desde 2003</div>
          </div>
        </a>
        <div className="nav-actions">
          <a className="nav-catalog" href="#bolos">Cardápio</a>
          <a className="nav-catalog" href="#monte">Monte seu bolo</a>
          <a className="nav-location" href={MAPS_URL} target="_blank" rel="noreferrer">
            <MapPin size={14} aria-hidden="true" />
            Localização
          </a>
          <Button asChild variant="cocoa" className="nav-whatsapp">
            <a href={generateContactLink()} target="_blank" rel="noreferrer" aria-label="Falar com a Ondina no WhatsApp">
              <MessageCircle aria-hidden="true" />
              <span>Pedir agora</span>
            </a>
          </Button>
          <button id={CART_TARGET_ID} type="button" className="cart-button" onClick={() => setOpen(true)} aria-label={label}>
            <ShoppingBag aria-hidden="true" />
            {count > 0 && (
              // A key muda com a contagem: o selo remonta e repete a animação a cada alteração.
              <span key={count} className="cart-badge" aria-hidden="true">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  )
}
