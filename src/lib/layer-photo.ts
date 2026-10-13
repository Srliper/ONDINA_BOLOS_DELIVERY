import { useCallback, useState } from 'react'
import type { BoloLayer } from '@/types/bolo-layers'

/** O mínimo de uma camada para desenhá-la na pilha. */
export type LayerVisual = Pick<BoloLayer, 'category' | 'image' | 'fallbackImage' | 'offsetY'>

/** Endereços que já falharam nesta visita: não pedimos de novo a cada miniatura. */
const brokenUrls = new Set<string>()

/**
 * Imagem da camada com reserva: tenta `image`; se falhar, `fallbackImage`; se essa também
 * falhar, devolve `src: undefined` para o componente mostrar um espaço neutro em vez do
 * ícone de imagem quebrada.
 */
export function useLayerSrc({ image, fallbackImage }: Pick<LayerVisual, 'image' | 'fallbackImage'>) {
  const pick = () => [image, fallbackImage].find(url => url && !brokenUrls.has(url))
  const [src, setSrc] = useState<string | undefined>(pick)

  const onError = useCallback(() => {
    if (!src) return
    brokenUrls.add(src)
    setSrc([image, fallbackImage].find(url => url && !brokenUrls.has(url)))
  }, [src, image, fallbackImage])

  // Imagem que veio pronta do servidor pode falhar (404) antes de o React assumir a página:
  // aí o onError nunca dispara. Ao montar, confere se ela já quebrou e troca na hora.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0 && img.getAttribute('src')) onError()
    },
    [onError],
  )
  return { src, onError, ref }
}
