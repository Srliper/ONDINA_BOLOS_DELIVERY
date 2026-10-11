import { useState } from 'react'
import type { BoloLayer } from '@/types/bolo-layers'

/** O mínimo de uma camada para desenhá-la na pilha. */
export type LayerVisual = Pick<BoloLayer, 'category' | 'image' | 'fallbackImage' | 'offsetY'>

/** Fotos que já falharam nesta visita: não pedimos de novo a cada miniatura. */
const missingPhotos = new Set<string>()

/**
 * Usa a foto real da camada e, se ela ainda não existir (404), troca para a ilustração
 * provisória. Assim basta colocar `foto-real-<id>.png` em /public/layers para a foto entrar.
 */
export function useLayerSrc({ image, fallbackImage }: Pick<LayerVisual, 'image' | 'fallbackImage'>) {
  const [failed, setFailed] = useState(() => missingPhotos.has(image))
  return {
    src: failed ? fallbackImage : image,
    onError: () => {
      if (failed) return
      missingPhotos.add(image)
      setFailed(true)
    },
  }
}
