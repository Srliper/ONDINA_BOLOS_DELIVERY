import { ASSEMBLED_HEIGHT, LAYER_STACK, LAYER_WIDTH } from '@/data/bolo-layers'
import { useLayerSrc, type LayerVisual } from '@/lib/layer-photo'
import { cn } from '@/lib/utils'

/**
 * Bolo montado, estático, em qualquer tamanho: as camadas empilhadas com o mesmo encaixe
 * (`offsetY`) do BoloBuilder. Usado na miniatura do carrinho e no banner.
 */
export function StackedCake({
  layers,
  width,
  className,
}: {
  layers: readonly LayerVisual[]
  width: number
  className?: string
}) {
  const scale = width / LAYER_WIDTH
  return (
    <span className={cn('stacked-cake', className)} style={{ width, height: ASSEMBLED_HEIGHT * scale }} aria-hidden="true">
      {layers.map(layer => (
        <StackedLayer key={layer.category} layer={layer} scale={scale} width={width} />
      ))}
    </span>
  )
}

function StackedLayer({ layer, scale, width }: { layer: LayerVisual; scale: number; width: number }) {
  const { src, onError } = useLayerSrc(layer)
  const { height, z } = LAYER_STACK[layer.category]
  return (
    <img
      src={src}
      onError={onError}
      alt=""
      draggable={false}
      style={{ bottom: -layer.offsetY * scale, height: height * scale, width, zIndex: z }}
    />
  )
}
