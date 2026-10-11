/** Etapas do "Monte seu Bolo", na ordem em que o bolo é montado. */
export type LayerCategory = 'base' | 'recheio' | 'cobertura' | 'decoracao'

export interface BoloLayer {
  /** Slug estável — usado como chave na interface e, depois, no carrinho. */
  id: string
  category: LayerCategory
  name: string
  /** Preço em reais (número, nunca string formatada). */
  price: number
  /** Foto real da camada: PNG com fundo transparente em /public/layers/foto-real-<id>.png. */
  image: string
  /**
   * Ilustração provisória, usada só enquanto a foto real ainda não foi colocada na pasta
   * (se `image` não carregar, o componente troca para esta automaticamente).
   */
  fallbackImage: string
  /** Deslocamento vertical (px) da camada na pilha montada: base 0, recheio -30, cobertura -60... */
  offsetY: number
  description: string
  badge?: 'popular' | 'premium'
}

/** Uma escolha por categoria; `undefined` enquanto a etapa não foi respondida. */
export type BoloSelection = Partial<Record<LayerCategory, BoloLayer>>

/** Bolo com todas as camadas escolhidas — o que o BoloBuilder entrega ao carrinho. */
export type CompleteBoloSelection = Record<LayerCategory, BoloLayer>
