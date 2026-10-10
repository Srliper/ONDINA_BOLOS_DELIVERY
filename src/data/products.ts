import type { Product, ProductCategory } from '@/types/product'
import nakedHero from '@/assets/naked_hero.jpg'
import ninhoNutella from '@/assets/ninho_nutella.jpg'
import ninhoMorango from '@/assets/ninho_morango.jpg'
import prestigio from '@/assets/prestigio.jpg'
import sonhoValsa from '@/assets/sonho_valsa.jpg'
import beijinhoAbacaxi from '@/assets/beijinho_abacaxi.jpg'
import chocolateMorangos from '@/assets/chocolate_morangos.jpg'
import fubaGoiabada from '@/assets/fuba_goiabada.jpg'
import amendoimDoceLeite from '@/assets/amendoim_doce_leite.jpg'

/** Preços oficiais do cardápio da Ondina. */
const PARTY_PRICE_PER_KG = 60
const COFFEE_CAKE_PRICE = 25

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  festas: 'Bolos para festas',
  cafes: 'Bolos para café',
}

const party = (p: Omit<Product, 'price' | 'priceUnit' | 'unit' | 'category'>): Product => ({
  ...p,
  price: PARTY_PRICE_PER_KG,
  priceUnit: 'o quilo',
  unit: 'kg',
  category: 'festas',
})

const coffee = (p: Omit<Product, 'price' | 'priceUnit' | 'unit' | 'category'>): Product => ({
  ...p,
  price: COFFEE_CAKE_PRICE,
  priceUnit: 'até 13 fatias',
  unit: 'un',
  category: 'cafes',
})

/**
 * Fotos reais dos bolos da Ondina (src/assets), em vez de placeholders do Unsplash,
 * para o cliente ver exatamente o que vai receber.
 */
export const products: readonly Product[] = [
  party({
    id: 'naked-cake',
    name: 'Naked cake com frutas',
    description: 'Camadas de massa e recheio aparentes, finalizado com frutas frescas. Decoração combinada pelo WhatsApp.',
    image: nakedHero,
    isFeatured: true,
  }),
  party({
    id: 'ninho-nutella',
    name: 'Ninho com Nutella',
    description: 'Recheio de leite Ninho com Nutella. Tamanho e decoração combinados pelo WhatsApp.',
    image: ninhoNutella,
    isFeatured: true,
  }),
  party({
    id: 'prestigio',
    name: 'Prestígio',
    description: 'Massa de chocolate, recheio de prestígio e cobertura de brigadeiro com raspas de chocolate preto e morangos.',
    image: prestigio,
    isFeatured: true,
  }),
  party({
    id: 'ninho-morango',
    name: 'Ninho com morango',
    description: 'Massa branca, mousse de ninho com morango e cobertura de mousse de ninho com raspas de chocolate branco e morangos.',
    image: ninhoMorango,
    isFeatured: false,
  }),
  party({
    id: 'sonho-de-valsa',
    name: 'Sonho de valsa',
    description: 'Massa de chocolate, mousse de chocolate com Sonho de Valsa e cobertura de ganache com raspas de chocolate e morangos.',
    image: sonhoValsa,
    isFeatured: false,
  }),
  party({
    id: 'beijinho-abacaxi',
    name: 'Beijinho com abacaxi',
    description: 'Massa branca, recheio de beijinho e pedaços de abacaxi, cobertura de chantilly com raspas de chocolate branco e morangos.',
    image: beijinhoAbacaxi,
    isFeatured: false,
  }),
  party({
    id: 'chocolate-morangos',
    name: 'Chocolate com morangos',
    description: 'Bolo de chocolate finalizado com morangos frescos. Recheio e tamanho combinados pelo WhatsApp.',
    image: chocolateMorangos,
    isFeatured: false,
  }),
  coffee({
    id: 'fuba-goiabada',
    name: 'Fubá com goiabada',
    description: 'Bolo de fubá com pedaços de goiabada, para o café da tarde.',
    image: fubaGoiabada,
    isFeatured: false,
  }),
  coffee({
    id: 'amendoim-doce-de-leite',
    name: 'Amendoim com doce de leite',
    description: 'Com cobertura de doce de leite e amendoim triturado.',
    image: amendoimDoceLeite,
    isFeatured: false,
  }),
]

const productsById = new Map(products.map(product => [product.id, product]))

export const getProductById = (id: string): Product | undefined => productsById.get(id)

/** "2 kg" para bolos de festa, "2 bolos" para bolos de café. */
export const formatQuantity = (product: Product, quantity: number): string =>
  product.unit === 'kg' ? `${quantity} kg` : `${quantity} ${quantity === 1 ? 'bolo' : 'bolos'}`
