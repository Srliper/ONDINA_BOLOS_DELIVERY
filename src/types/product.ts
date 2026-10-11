export type ProductCategory = 'festas' | 'cafes'

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
  /** Imagens das camadas, de baixo para cima — usadas na miniatura empilhada. */
  layerImages: string[]
}

export type CartItem = ReadyCartItem | CustomCartItem
