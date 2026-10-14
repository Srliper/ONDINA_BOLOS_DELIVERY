import type { LayerVisual } from '@/lib/layer-photo'

export type ProductCategory = 'festas' | 'cafes' | 'sobremesas'

export interface Product {
  /** Slug estável — usado como chave no carrinho e no localStorage. */
  id: string
  name: string
  description: string
  /** Preço em reais (número, nunca string formatada). */
  price: number
  /** Como o preço é cobrado, ex.: "o quilo", "até 13 fatias". */
  priceUnit: string
  /** Unidade da quantidade no carrinho: bolos de festa são pedidos por quilo. */
  unit: 'kg' | 'un'
  image: string
  category: ProductCategory
  isFeatured: boolean
  /**
   * Quantidade em estoque, na mesma unidade do carrinho (kg ou bolos), marcada pela equipe no /admin.
   * null = sem controle de estoque (sempre disponível). Sem estoque, o pedido vai como pendente.
   */
  stock: number | null
}

/** Nomes das camadas escolhidas no Monte seu Bolo. */
export interface CustomCakeConfig {
  base: string
  recheio: string
  cobertura: string
  decoracao: string
}

interface CartItemBase {
  /** Id da linha no carrinho: o id do produto, ou `custom:<camadas>` para bolos montados. */
  id: string
  name: string
  /** Preço unitário em reais (o do quilo, para bolos de festa). */
  price: number
  quantity: number
  image?: string
}

/** Bolo pronto do cardápio. */
export interface ReadyCartItem extends CartItemBase {
  type: 'ready'
  product: Product
}

/** Bolo montado camada por camada no BoloBuilder. */
export interface CustomCartItem extends CartItemBase {
  type: 'custom'
  customConfig: CustomCakeConfig
  /** Ids das camadas (o servidor recalcula o preço por eles). */
  layerIds: Record<keyof CustomCakeConfig, string>
  /** Camadas de baixo para cima (foto, ilustração provisória e encaixe) — para a miniatura. */
  layers: LayerVisual[]
}

export type CartItem = ReadyCartItem | CustomCartItem
