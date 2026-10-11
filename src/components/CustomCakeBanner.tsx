import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRight, Layers } from 'lucide-react'
import { BoloBuilder, type BoloBuilderProps } from '@/components/BoloBuilder'
import { StackedCake } from '@/components/StackedCake'
import { getLayerById } from '@/data/bolo-layers'
import { cartActions, selectionToLayerIds } from '@/lib/cart-store'
import { flyToCart } from '@/lib/fly-to-cart'

/** Combinação mostrada no banner como exemplo do que dá para montar. */
const SHOWCASE = ['base-red-velvet', 'recheio-morango-ninho', 'cobertura-brigadeiro', 'decoracao-morangos']
const showcaseImages = SHOWCASE.flatMap(id => getLayerById(id)?.image ?? [])

/** Chamada para o Monte seu Bolo em camadas + o diálogo que abre o BoloBuilder. */
export function CustomCakeBanner() {
  const [open, setOpen] = useState(false)

  const handleAddToCart: BoloBuilderProps['onAddToCart'] = (selection, _total, preview) => {
    // A foto do bolo voa até o carrinho e o item entra quando ela chega, como nos bolos prontos.
    // O clone da foto é criado antes de o diálogo fechar, então dá para fechar na hora.
    void flyToCart(preview).then(() => cartActions.addCustom(selectionToLayerIds(selection)))
    setOpen(false)
  }

  return (
    <section className="custom-cake-banner" aria-labelledby="custom-cake-title">
      <div className="bakery-container custom-cake-banner-inner">
        <div className="custom-cake-banner-copy">
          <p className="custom-cake-banner-eyebrow">
            <Layers aria-hidden="true" /> Novo · Monte em camadas
          </p>
          <h2 id="custom-cake-title">
            Seu bolo, <em>camada por camada.</em>
          </h2>
          <p>Escolha a base, o recheio, a cobertura e a decoração e veja o bolo ganhar forma na hora.</p>
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
              <button type="button" className="custom-cake-banner-cta">
                Montar meu bolo <ArrowRight aria-hidden="true" />
              </button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="bolo-dialog-overlay" />
              <DialogPrimitive.Content
                className="bolo-dialog"
                aria-describedby={undefined}
                // Toque fora do cartão (na área livre do diálogo) fecha, como no fundo escuro.
                onPointerDown={event => {
                  if (event.target === event.currentTarget) setOpen(false)
                }}
              >
                <DialogPrimitive.Title className="sr-only">Monte seu Bolo em camadas</DialogPrimitive.Title>
                <BoloBuilder onClose={() => setOpen(false)} onAddToCart={handleAddToCart} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
        <div className="custom-cake-banner-art">
          <StackedCake images={showcaseImages} width={260} />
        </div>
      </div>
    </section>
  )
}
