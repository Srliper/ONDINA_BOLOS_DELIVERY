import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_LABEL } from '@/data/products'
import { cartActions, setCartOpen } from '@/lib/cart-store'
import { flyToCart } from '@/lib/fly-to-cart'
import { formatBRL } from '@/lib/format'
import { stagger } from '@/lib/motion'
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

  const Icon = state === 'loading' ? Loader2 : state === 'success' ? Check : ShoppingBag

  return (
    <article className="cake-item" data-reveal style={stagger(index)}>
      <div className="cake-media">
        <img
          ref={imageRef}
          className="cake-image"
          src={product.image}
          alt={`Bolo ${product.name} da Ondina Bolos`}
          loading="lazy"
          decoding="async"
          width={600}
          height={600}
        />
      </div>
      <p className="cake-category">{CATEGORY_LABEL[product.category]}</p>
      <h3>{product.name}</h3>
      <p className="cake-description">{product.description}</p>
      <p className="cake-price">
        <strong>{formatBRL(product.price)}</strong> {product.priceUnit}
      </p>
      <button
        type="button"
        className={cn('add-button', `is-${state}`)}
        onClick={handleAdd}
        aria-label={state === 'idle' ? `Adicionar ${product.name} ao carrinho` : undefined}
        aria-disabled={state === 'loading'}
      >
        <Icon
          aria-hidden="true"
          className={cn(state === 'loading' && 'animate-spin', state === 'success' && 'animate-bounce')}
        />
        <span aria-live="polite">{LABEL[state]}</span>
      </button>
    </article>
  )
}
