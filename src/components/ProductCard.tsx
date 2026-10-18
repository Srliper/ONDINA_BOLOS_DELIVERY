import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, ChevronLeft, ChevronRight, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { RestockDialog } from '@/components/RestockDialog'
import { CATEGORY_LABEL } from '@/data/products'
import { cartActions, setCartOpen } from '@/lib/cart-store'
import { flyToCart } from '@/lib/fly-to-cart'
import { formatBRL } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { isSoldOut, stockLabel } from '@/lib/stock'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product'

type AddState = 'idle' | 'loading' | 'success'

const LOADING_MS = 400
const SUCCESS_MS = 1600

const LABEL: Record<AddState, string> = {
  idle: 'Adicionar',
  loading: 'Adicionando…',
  success: 'Adicionado!',
}

interface ProductCardProps {
  product: Product
  /** Posição na grade, usada para escalonar a entrada. */
  index?: number
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [state, setState] = useState<AddState>('idle')
  const imageRef = useRef<HTMLImageElement>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const handleAdd = () => {
    if (state === 'loading') return
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setState('loading')

    // A foto voa até o carrinho; o item entra quando ela chega, e o contador pula junto.
    void flyToCart(imageRef.current).then(() => cartActions.add(product.id))

    later(() => {
      setState('success')
      toast.success(`🍰 ${product.name} adicionado ao carrinho!`, {
        action: { label: 'Ver carrinho', onClick: () => setCartOpen(true) },
      })
      later(() => setState('idle'), SUCCESS_MS)
    }, LOADING_MS)
  }

  // Mais de uma foto do mesmo bolo: setas e bolinhas para passar, sem repetir o cartão.
  const photos = [product.image, ...(product.gallery ?? [])]
  const [photo, setPhoto] = useState(0)
  const current = photos[photo] ?? product.image
  const step = (delta: number) => setPhoto(index => (index + delta + photos.length) % photos.length)

  const [restockOpen, setRestockOpen] = useState(false)
  const soldOut = isSoldOut(product)
  const stock = stockLabel(product)
  const Icon = state === 'loading' ? Loader2 : state === 'success' ? Check : ShoppingBag

  return (
    <article className="cake-item" data-reveal style={stagger(index)}>
      <div className="cake-media">
        {soldOut && <span className="cake-soldout">Esgotado</span>}
        <img
          ref={imageRef}
          className="cake-image"
          src={current}
          alt={`Bolo ${product.name} da Ondina Bolos${photos.length > 1 ? `, foto ${photo + 1} de ${photos.length}` : ''}`}
          loading="lazy"
          decoding="async"
          width={600}
          height={600}
        />
        {photos.length > 1 && (
          <>
            <button type="button" className="cake-photo-nav is-prev" onClick={() => step(-1)} aria-label={`Foto anterior de ${product.name}`}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="cake-photo-nav is-next" onClick={() => step(1)} aria-label={`Próxima foto de ${product.name}`}>
              <ChevronRight aria-hidden="true" />
            </button>
            <div className="cake-photo-dots" role="group" aria-label={`Fotos de ${product.name}`}>
              {photos.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                  aria-pressed={index === photo}
                  onClick={() => setPhoto(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <p className="cake-category">{CATEGORY_LABEL[product.category]}</p>
      <h3>{product.name}</h3>
      <p className="cake-description">{product.description}</p>
      <p className="cake-price">
        <strong>{formatBRL(product.price)}</strong> {product.priceUnit}
      </p>
      {stock && (
        <p className={cn('cake-stock', soldOut && 'is-out')}>
          {soldOut ? 'Esgotado agora: dá para deixar como pedido pendente.' : stock}
        </p>
      )}
      <button
        type="button"
        className={cn('add-button', `is-${state}`)}
        onClick={handleAdd}
        aria-label={
          state === 'idle'
            ? soldOut
              ? `Deixar ${product.name} como pedido pendente`
              : `Adicionar ${product.name} ao carrinho`
            : undefined
        }
        aria-disabled={state === 'loading'}
      >
        <Icon
          aria-hidden="true"
          className={cn(state === 'loading' && 'animate-spin', state === 'success' && 'animate-bounce')}
        />
        <span aria-live="polite">{state === 'idle' && soldOut ? 'Pedir pendente' : LABEL[state]}</span>
      </button>
      {soldOut && (
        <>
          <button type="button" className="restock-button" onClick={() => setRestockOpen(true)}>
            <BellRing aria-hidden="true" />
            Avise-me quando chegar
          </button>
          <RestockDialog product={product} open={restockOpen} onOpenChange={setRestockOpen} />
        </>
      )}
    </article>
  )
}
