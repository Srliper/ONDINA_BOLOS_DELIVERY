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
  image: string
  category: ProductCategory
  isFeatured: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}
