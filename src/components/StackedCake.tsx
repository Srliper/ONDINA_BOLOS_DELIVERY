import type { CSSProperties } from 'react'
import { ASSEMBLED_HEIGHT, LAYER_ORDER, LAYER_STACK, LAYER_WIDTH } from '@/data/bolo-layers'
import { cn } from '@/lib/utils'

/**
 * Bolo montado, estático, em qualquer tamanho: as imagens das camadas (de baixo para cima)
 * empilhadas com a mesma geometria do BoloBuilder. Usado na miniatura do carrinho.
 */
export function StackedCake({ images, width, className }: { images: readonly string[]; width: number; className?: string }) {
  const scale = width / LAYER_WIDTH
  return (
    <span
      className={cn('stacked-cake', className)}
      style={{ width, height: ASSEMBLED_HEIGHT * scale } as CSSProperties}
      aria-hidden="true"
    >
      {LAYER_ORDER.map((key, index) => {
        const src = images[index]
        if (!src) return null
        const { bottom, height, z } = LAYER_STACK[key]
        return (
          <img
            key={key}
            src={src}
            alt=""
            draggable={false}
            style={{ bottom: bottom * scale, height: height * scale, width, zIndex: z }}
          />
        )
      })}
    </span>
  )
}
