import { z } from 'zod'
import {
  applyLayers,
  DEFAULT_LAYERS,
  hasDefaultLayerArt,
  LAYER_OFFSET_Y,
  LAYER_ORDER,
} from '@/data/bolo-layers'
import { applyProducts, DEFAULT_PRODUCTS, defaultProductImage } from '@/data/products'
import type { BoloLayer } from '@/types/bolo-layers'
import type { Product } from '@/types/product'

/**
 * Catálogo editável pelo painel /admin: Product (bolos), Filling (recheios) e Layer (camadas:
 * base, cobertura e decoração). Fica num documento JSON no banco (src/lib/catalog-store.ts);
 * enquanto ninguém editou, vale o cardápio padrão do código.
 */

/* ---------- Esquemas ---------- */

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífen (ex.: bolo-de-cenoura).')
  .max(60)

/** Vazio = usar a foto padrão; senão um endereço https:// ou um caminho do site (/...). */
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(value => value === '' || value.startsWith('/') || /^https:\/\/\S+$/.test(value), {
    message: 'Use um endereço que comece com https:// (ou deixe vazio para a foto padrão).',
  })

const badgeSchema = z.enum(['popular', 'premium']).nullable()

const common = {
  id: slugSchema,
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  price: z.number({ invalid_type_error: 'Informe o preço.' }).finite().min(0, 'O preço não pode ser negativo.').max(10_000),
  description: z.string().trim().max(300, 'Use no máximo 300 caracteres.'),
  image_url: imageUrlSchema,
}

export const productSchema = z.object({
  ...common,
  category: z.enum(['festas', 'cafes']),
  price_unit: z.string().trim().min(1, 'Informe como o preço é cobrado.').max(40),
  unit: z.enum(['kg', 'un']),
  featured: z.boolean(),
  /** Estoque (kg ou bolos); null = sem controle. Catálogos salvos antes do estoque entram como null. */
  stock: z
    .number({ invalid_type_error: 'Informe o estoque em números (ou deixe vazio).' })
    .int('Use um número inteiro no estoque.')
    .min(0, 'O estoque não pode ser negativo.')
    .max(9999)
    .nullable()
    .default(null),
})

export const fillingSchema = z.object({ ...common, badge: badgeSchema })

export const layerSchema = z.object({
  ...common,
  category: z.enum(['base', 'cobertura', 'decoracao']),
  badge: badgeSchema,
})

export const catalogSchema = z.object({
  version: z.number().int().min(0),
  updated_at: z.string(),
  products: z.array(productSchema),
  fillings: z.array(fillingSchema),
  layers: z.array(layerSchema),
})

export type CatalogProduct = z.infer<typeof productSchema>
export type CatalogFilling = z.infer<typeof fillingSchema>
export type CatalogLayer = z.infer<typeof layerSchema>
export type Catalog = z.infer<typeof catalogSchema>

export const ENTITY_SCHEMAS = { products: productSchema, fillings: fillingSchema, layers: layerSchema } as const
export type EntityName = keyof typeof ENTITY_SCHEMAS
export type EntityItem<E extends EntityName> = Catalog[E][number]

export const ENTITY_NAMES = Object.keys(ENTITY_SCHEMAS) as EntityName[]
export const isEntityName = (value: string): value is EntityName => value in ENTITY_SCHEMAS

export const ENTITY_LABELS: Record<EntityName, { one: string; many: string }> = {
  products: { one: 'Bolo', many: 'Bolos' },
  fillings: { one: 'Recheio', many: 'Recheios' },
  layers: { one: 'Camada', many: 'Camadas' },
}

/* ---------- Catálogo padrão (o que já existe no código) ---------- */

export function seedCatalog(): Catalog {
  const badge = (layer: BoloLayer) => layer.badge ?? null
  return {
    version: 0,
    updated_at: new Date(0).toISOString(),
    products: DEFAULT_PRODUCTS.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      description: product.description,
      image_url: '',
      category: product.category,
      price_unit: product.priceUnit,
      unit: product.unit,
      featured: product.isFeatured,
      stock: product.stock,
    })),
    fillings: DEFAULT_LAYERS.filter(layer => layer.category === 'recheio').map(layer => ({
      id: layer.id,
      name: layer.name,
      price: layer.price,
      description: layer.description,
      image_url: '',
      badge: badge(layer),
    })),
    layers: DEFAULT_LAYERS.flatMap(layer =>
      layer.category === 'recheio'
        ? []
        : [
            {
              id: layer.id,
              name: layer.name,
              price: layer.price,
              description: layer.description,
              image_url: '',
              category: layer.category,
              badge: badge(layer),
            },
          ],
    ),
  }
}

/* ---------- Do banco para o site ---------- */

const FALLBACK_IMAGE = '/favicon.png'

export function toProducts(catalog: Catalog): Product[] {
  return catalog.products.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    priceUnit: item.price_unit,
    unit: item.unit,
    image: item.image_url || defaultProductImage(item.id) || FALLBACK_IMAGE,
    category: item.category,
    isFeatured: item.featured,
    stock: item.stock,
  }))
}

const defaultLayerImage = (id: string) => (hasDefaultLayerArt(id) ? `/layers/${id}.png` : FALLBACK_IMAGE)

export function toBoloLayers(catalog: Catalog): BoloLayer[] {
  const toLayer = (item: CatalogFilling | CatalogLayer, category: BoloLayer['category']): BoloLayer => ({
    id: item.id,
    category,
    name: item.name,
    price: item.price,
    // Foto cadastrada no painel; sem ela, a imagem padrão (só existe para as camadas originais).
    image: item.image_url || defaultLayerImage(item.id),
    fallbackImage: defaultLayerImage(item.id),
    offsetY: LAYER_OFFSET_Y[category],
    description: item.description,
    ...(item.badge ? { badge: item.badge } : {}),
  })
  const all = [
    ...catalog.fillings.map(item => toLayer(item, 'recheio')),
    ...catalog.layers.map(item => toLayer(item, item.category)),
  ]
  // Mantém a ordem de montagem (base, recheio, cobertura, decoração).
  return LAYER_ORDER.flatMap(category => all.filter(layer => layer.category === category))
}

let appliedKey = ''

/** Troca o cardápio em uso pelo do banco (idempotente: só refaz quando o catálogo mudou). */
export function applyCatalog(catalog: Catalog): void {
  const key = `${catalog.version}:${catalog.updated_at}`
  if (key === appliedKey) return
  appliedKey = key
  applyProducts(toProducts(catalog))
  applyLayers(toBoloLayers(catalog))
}

/* ---------- CRUD (funções puras sobre o catálogo) ---------- */

export class CatalogError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    message: string,
    readonly issues?: Record<string, string>,
  ) {
    super(message)
    this.name = 'CatalogError'
  }
}

export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

function issuesOf(error: z.ZodError): Record<string, string> {
  const issues: Record<string, string> = {}
  for (const issue of error.issues) issues[issue.path.join('.') || 'body'] ??= issue.message
  return issues
}

function parseItem<E extends EntityName>(entity: E, value: unknown): EntityItem<E> {
  const result = ENTITY_SCHEMAS[entity].safeParse(value)
  if (!result.success) throw new CatalogError(400, 'Dados inválidos.', issuesOf(result.error))
  return result.data as EntityItem<E>
}

const hasDefaultImage = (entity: EntityName, id: string) =>
  entity === 'products' ? defaultProductImage(id) !== undefined : hasDefaultLayerArt(id)

function bump(catalog: Catalog, patch: Partial<Catalog>, now: Date): Catalog {
  return { ...catalog, ...patch, version: catalog.version + 1, updated_at: now.toISOString() }
}

export function findItem<E extends EntityName>(catalog: Catalog, entity: E, id: string): EntityItem<E> | undefined {
  return (catalog[entity] as EntityItem<E>[]).find(item => item.id === id)
}

export function createItem<E extends EntityName>(
  catalog: Catalog,
  entity: E,
  input: unknown,
  now = new Date(),
): { catalog: Catalog; item: EntityItem<E> } {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const id = typeof body['id'] === 'string' && body['id'] ? body['id'] : slugify(String(body['name'] ?? ''))
  const item = parseItem(entity, { ...body, id })
  if (findItem(catalog, entity, item.id)) {
    throw new CatalogError(409, `Já existe um item com o id "${item.id}".`, { id: 'Escolha outro id ou nome.' })
  }
  if (!item.image_url && !hasDefaultImage(entity, item.id)) {
    throw new CatalogError(400, 'Dados inválidos.', { image_url: 'Informe o endereço da imagem.' })
  }
  const list = [...(catalog[entity] as EntityItem<E>[]), item]
  return { catalog: bump(catalog, { [entity]: list } as Partial<Catalog>, now), item }
}

export function updateItem<E extends EntityName>(
  catalog: Catalog,
  entity: E,
  id: string,
  patch: unknown,
  now = new Date(),
): { catalog: Catalog; item: EntityItem<E> } {
  const current = findItem(catalog, entity, id)
  if (!current) throw new CatalogError(404, 'Item não encontrado.')
  const changes = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>
  // O id não muda (carrinhos e pedidos guardam o id).
  const item = parseItem(entity, { ...current, ...changes, id })
  if (!item.image_url && !hasDefaultImage(entity, item.id)) {
    throw new CatalogError(400, 'Dados inválidos.', { image_url: 'Informe o endereço da imagem.' })
  }
  const list = (catalog[entity] as EntityItem<E>[]).map(existing => (existing.id === id ? item : existing))
  return { catalog: bump(catalog, { [entity]: list } as Partial<Catalog>, now), item }
}

export function deleteItem(catalog: Catalog, entity: EntityName, id: string, now = new Date()): Catalog {
  const current = findItem(catalog, entity, id)
  if (!current) throw new CatalogError(404, 'Item não encontrado.')
  const rest = (catalog[entity] as { id: string }[]).filter(item => item.id !== id)

  // O cardápio e o Monte seu Bolo precisam de pelo menos uma opção em cada lugar.
  if (rest.length === 0) throw new CatalogError(409, `É preciso manter pelo menos um item em ${ENTITY_LABELS[entity].many}.`)
  if (entity === 'layers') {
    const category = (current as CatalogLayer).category
    if (!(rest as CatalogLayer[]).some(item => item.category === category)) {
      throw new CatalogError(409, 'É preciso manter pelo menos uma opção nessa etapa do Monte seu Bolo.')
    }
  }
  return bump(catalog, { [entity]: rest } as Partial<Catalog>, now)
}
