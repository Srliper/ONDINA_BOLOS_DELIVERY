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
import oreo from '@/assets/oreo.jpg'
import doceDeLeite from '@/assets/doce_de_leite.jpg'
import doceLeiteNozes from '@/assets/doce_leite_nozes.jpg'
import choconinho from '@/assets/choconinho.jpg'
import tortaNinhoDanette from '@/assets/torta_ninho_danette.jpg'
import ninhoGanache from '@/assets/ninho_ganache.jpg'
import laranja from '@/assets/laranja.jpg'
import limao from '@/assets/limao.jpg'
import paveKinderBueno from '@/assets/pave_kinder_bueno.jpg'
import beijinhoDoceLeite from '@/assets/beijinho_doce_leite.jpg'
import abacaxi from '@/assets/abacaxi.jpg'
import maca from '@/assets/maca.jpg'
import ninhoDanete from '@/assets/ninho_danete.jpg'
import mousseLimao from '@/assets/mousse_limao.jpg'
import cenoura from '@/assets/cenoura.jpg'
import chocolate from '@/assets/chocolate.jpg'
import maracuja from '@/assets/maracuja.jpg'
import kinderBueno from '@/assets/kinder_bueno.jpg'
import ouroBrancoNinho from '@/assets/ouro_branco_ninho.jpg'
import paveTradicional from '@/assets/pave_tradicional.jpg'
import prestigio1kg from '@/assets/prestigio_1kg.jpg'
import prestigioRedondo from '@/assets/prestigio_redondo.jpg'
import doceLeiteNozes1kg from '@/assets/doce_leite_nozes_1kg.jpg'

/** Preços oficiais do cardápio da Ondina. */
const PARTY_PRICE_PER_KG = 60
const COFFEE_CAKE_PRICE = 25
const SIMPLE_COFFEE_CAKE_PRICE = 20

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  festas: 'Bolos para festas',
  cafes: 'Bolos para café',
  sobremesas: 'Doces e sobremesas',
}

const party = (
  p: Omit<Product, 'price' | 'priceUnit' | 'unit' | 'category' | 'stock'>,
  price = PARTY_PRICE_PER_KG,
): Product => ({
  ...p,
  price,
  priceUnit: 'o quilo',
  unit: 'kg',
  category: 'festas',
  stock: null,
})

const coffee = (
  p: Omit<Product, 'price' | 'priceUnit' | 'unit' | 'category' | 'stock'>,
  price = COFFEE_CAKE_PRICE,
): Product => ({
  ...p,
  price,
  priceUnit: 'até 13 fatias',
  unit: 'un',
  category: 'cafes',
  stock: null,
})

/**
 * Fotos reais dos bolos da Ondina (src/assets), em vez de placeholders do Unsplash,
 * para o cliente ver exatamente o que vai receber.
 */
export const DEFAULT_PRODUCTS: readonly Product[] = [
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
    description: 'Recheio de leite Ninho com Nutella, cobertura com raspas de chocolate branco, fios de Nutella e morangos.',
    image: ninhoNutella,
    isFeatured: true,
  }),
  party({
    id: 'prestigio',
    name: 'Prestígio',
    description: 'Massa de chocolate, recheio de prestígio e cobertura de brigadeiro com raspas de chocolate preto e morangos.',
    image: prestigio,
    gallery: [prestigioRedondo, prestigio1kg],
    isFeatured: true,
  }),
  party(
    {
      id: 'kinder-bueno',
      name: 'Kinder Bueno',
      description: 'Novidade! Cobertura com raspas de chocolate branco, fios de chocolate, Kinder Bueno e morangos.',
      image: kinderBueno,
      isFeatured: true,
    },
    80,
  ),
  {
    id: 'ouro-branco-brigadeiro-ninho',
    name: 'Ouro Branco com brigadeiro de Ninho',
    description: 'Cobertura de brigadeiro de Ninho com pedaços de Ouro Branco, chocolate branco ralado e morangos.',
    price: 100,
    priceUnit: 'bolo de 1,5 kg',
    unit: 'un',
    image: ouroBrancoNinho,
    category: 'festas',
    isFeatured: false,
    stock: null,
  },
  party({
    id: 'oreo',
    name: 'Oreo',
    description: 'Massa de chocolate, brigadeiro branco com pedaços de Oreo e cobertura com raspas de chocolate ao leite e branco, Oreo e morangos.',
    image: oreo,
    isFeatured: true,
  }),
  party({
    id: 'doce-de-leite-nozes',
    name: 'Doce de leite com nozes',
    description: 'Massa branca, doce de leite com pedaços de nozes e cobertura de chantilly com raspas de chocolate branco, nozes e morangos.',
    image: doceLeiteNozes,
    gallery: [doceLeiteNozes1kg],
    isFeatured: false,
  }),
  party({
    id: 'torta-ninho-danette',
    name: 'Torta de Ninho com Danette',
    description: 'Base de chocolate com Danette, creme de Ninho e cobertura de chantilly com morangos.',
    image: tortaNinhoDanette,
    isFeatured: false,
  }),
  party({
    id: 'doce-de-leite',
    name: 'Doce de leite',
    description: 'Massa branca, recheio de doce de leite e cobertura de chantilly com raspas de chocolate branco, fios de doce de leite e morangos.',
    image: doceDeLeite,
    isFeatured: false,
  }),
  party({
    id: 'choconinho',
    name: 'Choconinho',
    description: 'Massa de chocolate, recheio de ninho e cobertura de brigadeiro com raspas de chocolate ao leite, chocolate branco e morangos.',
    image: choconinho,
    isFeatured: false,
  }),
  party({
    id: 'ninho-ganache',
    name: 'Ninho com ganache de chocolate',
    description: 'Recheio de Ninho, cobertura com raspas de chocolate branco, fios de ganache de chocolate e morangos.',
    image: ninhoGanache,
    isFeatured: false,
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
    id: 'beijinho-doce-de-leite',
    name: 'Beijinho com doce de leite',
    description: 'Massa branca, recheio duplo de beijinho e doce de leite, cobertura de chantilly com raspas de chocolate branco, fios de doce de leite e morangos.',
    image: beijinhoDoceLeite,
    isFeatured: false,
  }),
  party({
    id: 'abacaxi',
    name: 'Abacaxi',
    description: 'Massa branca, creme belga com pedaços de abacaxi e cobertura de chantilly com raspas de chocolate branco e morangos.',
    image: abacaxi,
    isFeatured: false,
  }),
  party({
    id: 'ninho-danete',
    name: 'Ninho com Danete',
    description: 'Recheio de Ninho com Danete, cobertura com raspas de chocolate branco, fios de chocolate e morangos.',
    image: ninhoDanete,
    isFeatured: false,
  }),
  party({
    id: 'mousse-de-limao',
    name: 'Mousse de limão',
    description: 'Massa branca, mousse de limão e cobertura de mousse de limão com raspas de chocolate branco e rodelas de limão.',
    image: mousseLimao,
    isFeatured: false,
  }),
  party({
    id: 'maracuja',
    name: 'Maracujá',
    description: 'Massa branca, brigadeiro branco com calda de maracujá e cobertura de chantilly com raspas de chocolate branco e geleia de maracujá.',
    image: maracuja,
    isFeatured: false,
  }),
  party({
    id: 'chocolate-morangos',
    name: 'Chocolate com morangos',
    description: 'Massa de chocolate com cobertura de raspas de chocolate ao leite, granulado e morangos frescos. Recheio combinado pelo WhatsApp.',
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
  coffee({
    id: 'limao',
    name: 'Limão',
    description: 'Com cobertura de mousse de limão e raspas de limão.',
    image: limao,
    isFeatured: false,
  }),
  coffee({
    id: 'cenoura',
    name: 'Cenoura com chocolate',
    description: 'Bolo de cenoura com cobertura de chocolate.',
    image: cenoura,
    isFeatured: false,
  }),
  coffee({
    id: 'chocolate',
    name: 'Chocolate',
    description: 'Bolo de chocolate com cobertura de chocolate e granulado.',
    image: chocolate,
    isFeatured: false,
  }),
  coffee({
    id: 'maca',
    name: 'Maçã',
    description: 'Com pedaços de maçã na massa e açúcar de confeiteiro com canela por cima.',
    image: maca,
    isFeatured: false,
  }),
  coffee(
    {
      id: 'laranja',
      name: 'Laranja',
      description: 'Bolo simples de laranja com açúcar de confeiteiro por cima.',
      image: laranja,
      isFeatured: false,
    },
    SIMPLE_COFFEE_CAKE_PRICE,
  ),
  {
    id: 'pave-tradicional',
    name: 'Pavê tradicional',
    description: 'Camadas de creme e chocolate, coberto com raspas de chocolate ao leite e morangos.',
    price: PARTY_PRICE_PER_KG,
    priceUnit: 'o quilo',
    unit: 'kg',
    image: paveTradicional,
    category: 'sobremesas',
    isFeatured: false,
    stock: null,
  },
  {
    id: 'pave-kinder-bueno',
    name: 'Pavê de Kinder Bueno',
    description: 'Camadas de creme e chocolate, cobertura com raspas de chocolate branco, fios de chocolate e Kinder Bueno.',
    price: 40,
    priceUnit: 'pote de 500 g',
    unit: 'un',
    image: paveKinderBueno,
    category: 'sobremesas',
    isFeatured: false,
    stock: null,
  },
]

const defaultImages = new Map(DEFAULT_PRODUCTS.map(product => [product.id, product.image]))

/** Foto padrão (src/assets) de um bolo do cardápio original, se houver. */
export const defaultProductImage = (id: string): string | undefined => defaultImages.get(id)

const defaultGalleries = new Map(DEFAULT_PRODUCTS.flatMap(product => (product.gallery ? [[product.id, product.gallery]] : [])))

/** Fotos extras (src/assets) de um bolo do cardápio original. */
export const defaultProductGallery = (id: string): readonly string[] | undefined => defaultGalleries.get(id)

/**
 * Cardápio em uso. Começa com o padrão acima e é trocado pelo do banco de dados
 * (painel /admin) via applyProducts — os imports veem sempre a lista atual.
 */
export let products: readonly Product[] = DEFAULT_PRODUCTS
let productsById = new Map(products.map(product => [product.id, product]))

export function applyProducts(next: readonly Product[]): void {
  products = next
  productsById = new Map(next.map(product => [product.id, product]))
}

export const getProductById = (id: string): Product | undefined => productsById.get(id)

/** "2 kg" para bolos de festa, "2 bolos" para bolos de café, "2 unidades" para doces. */
export const formatQuantity = (product: Product, quantity: number): string => {
  if (product.unit === 'kg') return `${quantity} kg`
  const [one, many] = product.category === 'sobremesas' ? ['unidade', 'unidades'] : ['bolo', 'bolos']
  return `${quantity} ${quantity === 1 ? one : many}`
}
