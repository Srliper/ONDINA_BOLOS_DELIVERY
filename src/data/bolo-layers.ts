import type { BoloLayer, LayerCategory } from '@/types/bolo-layers'

/** Ordem de montagem do bolo — também é a ordem das etapas do BoloBuilder. */
export const LAYER_ORDER: readonly LayerCategory[] = ['base', 'recheio', 'cobertura', 'decoracao']

export const LAYER_LABELS: Record<LayerCategory, string> = {
  base: 'Base',
  recheio: 'Recheio',
  cobertura: 'Cobertura',
  decoracao: 'Decoração',
}

// As imagens em /public/layers são ilustrações provisórias, no lugar das fotos reais das camadas.
export const BOLO_LAYERS: readonly BoloLayer[] = [
  // Base
  {
    id: 'base-redonda',
    category: 'base',
    name: 'Base Redonda Tradicional',
    price: 25,
    image: '/layers/base-redonda.png',
    description: 'Massa fofinha de baunilha, assada no formato redondo clássico.',
    badge: 'popular',
  },
  {
    id: 'base-quadrada',
    category: 'base',
    name: 'Base Quadrada Premium',
    price: 35,
    image: '/layers/base-quadrada.png',
    description: 'Formato quadrado, mais alto, ideal para festas e fotos.',
    badge: 'premium',
  },
  {
    id: 'base-red-velvet',
    category: 'base',
    name: 'Base Red Velvet',
    price: 40,
    image: '/layers/base-red-velvet.png',
    description: 'Massa aveludada de cacau suave, com a cor vermelha marcante.',
  },

  // Recheio
  {
    id: 'recheio-brigadeiro-belga',
    category: 'recheio',
    name: 'Brigadeiro Belga',
    price: 15,
    image: '/layers/recheio-brigadeiro-belga.png',
    description: 'Brigadeiro cremoso feito com chocolate belga.',
    badge: 'popular',
  },
  {
    id: 'recheio-morango-ninho',
    category: 'recheio',
    name: 'Morango com Ninho',
    price: 18,
    image: '/layers/recheio-morango-ninho.png',
    description: 'Mousse de leite Ninho com pedaços de morango fresco.',
    badge: 'popular',
  },
  {
    id: 'recheio-doce-de-leite',
    category: 'recheio',
    name: 'Doce de Leite Argentino',
    price: 16,
    image: '/layers/recheio-doce-de-leite.png',
    description: 'Doce de leite denso e caramelizado, no estilo argentino.',
  },
  {
    id: 'recheio-prestigio',
    category: 'recheio',
    name: 'Prestígio',
    price: 17,
    image: '/layers/recheio-prestigio.png',
    description: 'Creme de coco com brigadeiro de chocolate.',
  },

  // Cobertura
  {
    id: 'cobertura-brigadeiro',
    category: 'cobertura',
    name: 'Cobertura de Brigadeiro',
    price: 12,
    image: '/layers/cobertura-brigadeiro.png',
    description: 'Brigadeiro escorrendo pelas laterais do bolo.',
    badge: 'popular',
  },
  {
    id: 'cobertura-chantilly',
    category: 'cobertura',
    name: 'Chantilly Premium',
    price: 10,
    image: '/layers/cobertura-chantilly.png',
    description: 'Chantilly leve e estável, com acabamento de bicos.',
  },
  {
    id: 'cobertura-ganache',
    category: 'cobertura',
    name: 'Ganache de Chocolate',
    price: 15,
    image: '/layers/cobertura-ganache.png',
    description: 'Ganache brilhante de chocolate meio amargo.',
  },
  {
    id: 'cobertura-pasta-americana',
    category: 'cobertura',
    name: 'Pasta Americana',
    price: 25,
    image: '/layers/cobertura-pasta-americana.png',
    description: 'Acabamento liso e elegante, perfeito para bolos temáticos.',
    badge: 'premium',
  },

  // Decoração
  {
    id: 'decoracao-morangos',
    category: 'decoracao',
    name: 'Morangos Frescos',
    price: 8,
    image: '/layers/decoracao-morangos.png',
    description: 'Morangos selecionados por cima do bolo.',
    badge: 'popular',
  },
  {
    id: 'decoracao-flores',
    category: 'decoracao',
    name: 'Flores Comestíveis',
    price: 15,
    image: '/layers/decoracao-flores.png',
    description: 'Flores delicadas e comestíveis em tons suaves.',
    badge: 'premium',
  },
  {
    id: 'decoracao-lascas-chocolate',
    category: 'decoracao',
    name: 'Lasca de Chocolate',
    price: 6,
    image: '/layers/decoracao-lascas-chocolate.png',
    description: 'Lascas de chocolate ao leite e meio amargo.',
  },
  {
    id: 'decoracao-detalhes-dourados',
    category: 'decoracao',
    name: 'Detalhes Dourados',
    price: 12,
    image: '/layers/decoracao-detalhes-dourados.png',
    description: 'Pérolas e folhas douradas comestíveis.',
    badge: 'premium',
  },
]

export const getLayersByCategory = (category: LayerCategory): BoloLayer[] =>
  BOLO_LAYERS.filter(layer => layer.category === category)
