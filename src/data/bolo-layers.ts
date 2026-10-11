import type { BoloLayer, LayerCategory } from '@/types/bolo-layers'

/** Ordem de montagem do bolo — também é a ordem das etapas do BoloBuilder. */
export const LAYER_ORDER: readonly LayerCategory[] = ['base', 'recheio', 'cobertura', 'decoracao']

export const LAYER_LABELS: Record<LayerCategory, string> = {
  base: 'Base',
  recheio: 'Recheio',
  cobertura: 'Cobertura',
  decoracao: 'Decoração',
}

/**
 * Geometria da pilha (px, antes da escala). Enquanto o bolo é montado, as camadas
 * flutuam separadas (`floating`) com etiquetas; no resumo elas se encaixam no `offsetY`
 * de cada camada. `focus` é a altura, dentro da imagem, para onde a etiqueta aponta, e
 * `depth` é a profundidade (translateZ) que dá paralaxe quando o bolo gira em 3D.
 */
export const LAYER_STACK: Record<
  LayerCategory,
  { floating: number; height: number; focus: number; z: number; depth: number; side: 'left' | 'right' }
> = {
  base: { floating: 0, height: 150, focus: 75, z: 1, depth: 0, side: 'left' },
  recheio: { floating: 168, height: 40, focus: 20, z: 2, depth: 35, side: 'right' },
  cobertura: { floating: 222, height: 100, focus: 77, z: 3, depth: 70, side: 'left' },
  decoracao: { floating: 300, height: 120, focus: 80, z: 4, depth: 105, side: 'right' },
}

/**
 * Deslocamento vertical de cada camada na pilha montada (px; negativo = para cima).
 * Ajuste aqui se as fotos reais pedirem outro encaixe.
 */
export const LAYER_OFFSET_Y: Record<LayerCategory, number> = {
  base: 0,
  recheio: -30,
  cobertura: -60,
  decoracao: -80,
}
/** Largura (px) de todas as imagens de camada e altura do bolo já montado. */
export const LAYER_WIDTH = 260
export const ASSEMBLED_HEIGHT = 200

/** Foto real esperada e ilustração provisória (usada até a foto existir). */
const pictures = (id: string, category: LayerCategory) => ({
  image: `/layers/foto-real-${id}.png`,
  fallbackImage: `/layers/${id}.png`,
  offsetY: LAYER_OFFSET_Y[category],
})

export const BOLO_LAYERS: readonly BoloLayer[] = [
  // Base
  {
    id: 'base-redonda',
    category: 'base',
    name: 'Base Redonda Tradicional',
    price: 25,
    ...pictures('base-redonda', 'base'),
    description: 'Massa fofinha de baunilha, assada no formato redondo clássico.',
    badge: 'popular',
  },
  {
    id: 'base-quadrada',
    category: 'base',
    name: 'Base Quadrada Premium',
    price: 35,
    ...pictures('base-quadrada', 'base'),
    description: 'Formato quadrado, mais alto, ideal para festas e fotos.',
    badge: 'premium',
  },
  {
    id: 'base-red-velvet',
    category: 'base',
    name: 'Base Red Velvet',
    price: 40,
    ...pictures('base-red-velvet', 'base'),
    description: 'Massa aveludada de cacau suave, com a cor vermelha marcante.',
  },

  // Recheio
  {
    id: 'recheio-brigadeiro-belga',
    category: 'recheio',
    name: 'Brigadeiro Belga',
    price: 15,
    ...pictures('recheio-brigadeiro-belga', 'recheio'),
    description: 'Brigadeiro cremoso feito com chocolate belga.',
    badge: 'popular',
  },
  {
    id: 'recheio-morango-ninho',
    category: 'recheio',
    name: 'Morango com Ninho',
    price: 18,
    ...pictures('recheio-morango-ninho', 'recheio'),
    description: 'Mousse de leite Ninho com pedaços de morango fresco.',
    badge: 'popular',
  },
  {
    id: 'recheio-doce-de-leite',
    category: 'recheio',
    name: 'Doce de Leite Argentino',
    price: 16,
    ...pictures('recheio-doce-de-leite', 'recheio'),
    description: 'Doce de leite denso e caramelizado, no estilo argentino.',
  },
  {
    id: 'recheio-prestigio',
    category: 'recheio',
    name: 'Prestígio',
    price: 17,
    ...pictures('recheio-prestigio', 'recheio'),
    description: 'Creme de coco com brigadeiro de chocolate.',
  },

  // Cobertura
  {
    id: 'cobertura-brigadeiro',
    category: 'cobertura',
    name: 'Cobertura de Brigadeiro',
    price: 12,
    ...pictures('cobertura-brigadeiro', 'cobertura'),
    description: 'Brigadeiro escorrendo pelas laterais do bolo.',
    badge: 'popular',
  },
  {
    id: 'cobertura-chantilly',
    category: 'cobertura',
    name: 'Chantilly Premium',
    price: 10,
    ...pictures('cobertura-chantilly', 'cobertura'),
    description: 'Chantilly leve e estável, com acabamento de bicos.',
  },
  {
    id: 'cobertura-ganache',
    category: 'cobertura',
    name: 'Ganache de Chocolate',
    price: 15,
    ...pictures('cobertura-ganache', 'cobertura'),
    description: 'Ganache brilhante de chocolate meio amargo.',
  },
  {
    id: 'cobertura-pasta-americana',
    category: 'cobertura',
    name: 'Pasta Americana',
    price: 25,
    ...pictures('cobertura-pasta-americana', 'cobertura'),
    description: 'Acabamento liso e elegante, perfeito para bolos temáticos.',
    badge: 'premium',
  },

  // Decoração
  {
    id: 'decoracao-morangos',
    category: 'decoracao',
    name: 'Morangos Frescos',
    price: 8,
    ...pictures('decoracao-morangos', 'decoracao'),
    description: 'Morangos selecionados por cima do bolo.',
    badge: 'popular',
  },
  {
    id: 'decoracao-flores',
    category: 'decoracao',
    name: 'Flores Comestíveis',
    price: 15,
    ...pictures('decoracao-flores', 'decoracao'),
    description: 'Flores delicadas e comestíveis em tons suaves.',
    badge: 'premium',
  },
  {
    id: 'decoracao-lascas-chocolate',
    category: 'decoracao',
    name: 'Lasca de Chocolate',
    price: 6,
    ...pictures('decoracao-lascas-chocolate', 'decoracao'),
    description: 'Lascas de chocolate ao leite e meio amargo.',
  },
  {
    id: 'decoracao-detalhes-dourados',
    category: 'decoracao',
    name: 'Detalhes Dourados',
    price: 12,
    ...pictures('decoracao-detalhes-dourados', 'decoracao'),
    description: 'Pérolas e folhas douradas comestíveis.',
    badge: 'premium',
  },
]

export const getLayersByCategory = (category: LayerCategory): BoloLayer[] =>
  BOLO_LAYERS.filter(layer => layer.category === category)

const layersById = new Map(BOLO_LAYERS.map(layer => [layer.id, layer]))

export const getLayerById = (id: string): BoloLayer | undefined => layersById.get(id)
