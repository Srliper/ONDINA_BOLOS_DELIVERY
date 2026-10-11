/** Etapas do "Monte seu Bolo", na ordem em que o bolo é montado. */
export type LayerCategory = 'base' | 'recheio' | 'cobertura' | 'decoracao'

export interface BoloLayer {
  /** Slug estável — usado como chave na interface e, depois, no carrinho. */
  id: string
  category: LayerCategory
  name: string
  /** Preço em reais (número, nunca string formatada). */
  price: number
  /** Caminho público da imagem da camada (PNG transparente). */
  image: string
  description: string
  badge?: 'popular' | 'premium'
}

/** Uma escolha por categoria; `undefined` enquanto a etapa não foi respondida. */
export type BoloSelection = Partial<Record<LayerCategory, BoloLayer>>

/** Bolo com todas as camadas escolhidas — o que o BoloBuilder entrega ao carrinho. */
export type CompleteBoloSelection = Record<LayerCategory, BoloLayer>
