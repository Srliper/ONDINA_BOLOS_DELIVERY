import { useMemo, useSyncExternalStore } from 'react'
import { z } from 'zod'
import { getLayerById, LAYER_ORDER } from '@/data/bolo-layers'
import { getProductById } from '@/data/products'
import type { BoloLayer, CompleteBoloSelection } from '@/types/bolo-layers'
import type { CartItem, CustomCartItem } from '@/types/product'

/**
 * Carrinho sem dependências extras: um store externo mínimo + useSyncExternalStore.
 * - Persiste só ids e quantidades — { productId } para bolos prontos, { custom: ids das camadas }
 *   para bolos montados. Preço e nome vêm sempre do catálogo atual, então uma mudança de
 *   preço nunca fica "presa" no navegador do cliente.
 * - Seguro para SSR (o servidor sempre vê carrinho vazio) e sincroniza entre abas.
 */

const STORAGE_KEY = 'ondina-bolos:cart:v1'
export const MAX_QUANTITY = 20

const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY)
const readyLineSchema = z.object({ productId: z.string().min(1), quantity: quantitySchema })
const customLineSchema = z.object({
  custom: z.object({ base: z.string(), recheio: z.string(), cobertura: z.string(), decoracao: z.string() }),
  quantity: quantitySchema,
})
const cartSchema = z.array(z.union([readyLineSchema, customLineSchema]))

type ReadyLine = z.infer<typeof readyLineSchema>
type CustomLine = z.infer<typeof customLineSchema>
export type CustomLayerIds = CustomLine['custom']
export type CartLine = ReadyLine | CustomLine

const isCustomLine = (line: CartLine): line is CustomLine => 'custom' in line

/** Id estável da linha: o mesmo bolo montado duas vezes soma quantidade em vez de duplicar. */
export const lineIdOf = (line: CartLine): string =>
  isCustomLine(line) ? customLineId(line.custom) : line.productId

const CUSTOM_PREFIX = 'custom:'
const customLineId = (ids: CustomLayerIds) => CUSTOM_PREFIX + LAYER_ORDER.map(key => ids[key]).join('+')

/** Cada id precisa existir no cardápio de camadas e pertencer à etapa certa. */
const isValidCustom = (ids: CustomLayerIds) =>
  LAYER_ORDER.every(key => getLayerById(ids[key])?.category === key)

const isValidLine = (line: CartLine) =>
  isCustomLine(line) ? isValidCustom(line.custom) : getProductById(line.productId) !== undefined

const EMPTY: readonly CartLine[] = Object.freeze([])

let lines: readonly CartLine[] = EMPTY
let hydrated = false
const listeners = new Set<() => void>()

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window

function readStorage(): readonly CartLine[] {
  if (!canUseStorage()) return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = cartSchema.safeParse(JSON.parse(raw))
    // Descarta dados corrompidos e produtos que saíram do cardápio.
    return parsed.success ? parsed.data.filter(isValidLine) : EMPTY
  } catch {
    return EMPTY
  }
}

function writeStorage(next: readonly CartLine[]) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Modo privado / cota cheia: o carrinho continua funcionando em memória.
  }
}

function setLines(next: readonly CartLine[]) {
  lines = next
  writeStorage(next)
  listeners.forEach(listener => listener())
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return
  lines = readStorage()
  listeners.forEach(listener => listener())
}

/** Lê o localStorage uma única vez, no primeiro uso no navegador. */
function current(): readonly CartLine[] {
  if (!hydrated && canUseStorage()) {
    hydrated = true
    lines = readStorage()
  }
  return lines
}

function subscribe(listener: () => void) {
  current()
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = () => lines
const getServerSnapshot = () => EMPTY

const clamp = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(0, Math.trunc(quantity)))

/* ---------- Ações (funções puras sobre o store, utilizáveis fora de React) ---------- */

const quantityOf = (lineId: string) =>
  current().find(line => lineIdOf(line) === lineId)?.quantity ?? 0

function remove(lineId: string): void {
  setLines(current().filter(line => lineIdOf(line) !== lineId))
}

/** Cria a linha (se ainda não existe) ou troca a quantidade; 0 remove. */
function upsert(newLine: CartLine, quantity: number): void {
  const lineId = lineIdOf(newLine)
  const next = clamp(quantity)
  if (next === 0) {
    remove(lineId)
    return
  }
  const exists = current().some(line => lineIdOf(line) === lineId)
  setLines(
    exists
      ? current().map(line => (lineIdOf(line) === lineId ? { ...line, quantity: next } : line))
      : [...current(), { ...newLine, quantity: next }],
  )
}

function setQuantity(lineId: string, quantity: number): void {
  const existing = current().find(line => lineIdOf(line) === lineId)
  if (existing) {
    upsert(existing, quantity)
    return
  }
  // Linha nova só para bolo pronto (o bolo montado entra por addCustom).
  if (!lineId.startsWith(CUSTOM_PREFIX) && getProductById(lineId)) upsert({ productId: lineId, quantity: 1 }, quantity)
}

function add(productId: string, quantity = 1): void {
  if (!getProductById(productId)) return
  setQuantity(productId, quantityOf(productId) + quantity)
}

/** Adiciona um bolo montado no BoloBuilder; devolve o id da linha (ou undefined se inválido). */
function addCustom(ids: CustomLayerIds, quantity = 1): string | undefined {
  if (!isValidCustom(ids)) return undefined
  const lineId = customLineId(ids)
  upsert({ custom: ids, quantity: 1 }, quantityOf(lineId) + quantity)
  return lineId
}

export const cartActions = {
  add,
  addCustom,
  setQuantity,
  remove,
  increment: (lineId: string) => setQuantity(lineId, quantityOf(lineId) + 1),
  decrement: (lineId: string) => setQuantity(lineId, quantityOf(lineId) - 1),
  clear: () => setLines(EMPTY),
} as const

/** Converte a escolha completa do BoloBuilder nos ids que o carrinho guarda. */
export const selectionToLayerIds = (selection: CompleteBoloSelection): CustomLayerIds => ({
  base: selection.base.id,
  recheio: selection.recheio.id,
  cobertura: selection.cobertura.id,
  decoracao: selection.decoracao.id,
})

/* ---------- Seletores ---------- */

function toCustomItem(line: CustomLine): CustomCartItem | undefined {
  const layers = LAYER_ORDER.map(key => getLayerById(line.custom[key]))
  if (!layers.every((layer): layer is BoloLayer => layer !== undefined)) return undefined
  const [base, recheio, cobertura, decoracao] = layers as [BoloLayer, BoloLayer, BoloLayer, BoloLayer]
  return {
    id: customLineId(line.custom),
    type: 'custom',
    name: 'Bolo Personalizado',
    price: layers.reduce((sum, layer) => sum + layer.price, 0),
    quantity: line.quantity,
    image: base.image,
    customConfig: { base: base.name, recheio: recheio.name, cobertura: cobertura.name, decoracao: decoracao.name },
    layerIds: line.custom,
    layers: layers.map(({ category, image, fallbackImage, offsetY }) => ({ category, image, fallbackImage, offsetY })),
  }
}

export function toCartItems(source: readonly CartLine[]): CartItem[] {
  return source.flatMap((line): CartItem[] => {
    if (isCustomLine(line)) {
      const item = toCustomItem(line)
      return item ? [item] : []
    }
    const product = getProductById(line.productId)
    return product
      ? [
          {
            id: product.id,
            type: 'ready',
            name: product.name,
            price: product.price,
            quantity: line.quantity,
            image: product.image,
            product,
          },
        ]
      : []
  })
}

export const getCartTotal = (items: readonly CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0)

export const getCartCount = (items: readonly CartItem[]) =>
  items.reduce((sum, item) => sum + item.quantity, 0)

/* ---------- Hook ---------- */

export function useCart() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return useMemo(() => {
    const items = toCartItems(snapshot)
    return {
      items,
      count: getCartCount(items),
      total: getCartTotal(items),
      isEmpty: items.length === 0,
      ...cartActions,
    }
  }, [snapshot])
}

/* ---------- Gaveta do carrinho (aberta/fechada), compartilhada entre componentes ---------- */

let drawerOpen = false
const drawerListeners = new Set<() => void>()

export function setCartOpen(open: boolean): void {
  if (drawerOpen === open) return
  drawerOpen = open
  drawerListeners.forEach(listener => listener())
}

const subscribeDrawer = (listener: () => void) => {
  drawerListeners.add(listener)
  return () => {
    drawerListeners.delete(listener)
  }
}

export function useCartOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribeDrawer, () => drawerOpen, () => false)
  return [open, setCartOpen]
}
