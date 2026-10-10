import { useMemo, useSyncExternalStore } from 'react'
import { z } from 'zod'
import { getProductById } from '@/data/products'
import type { CartItem } from '@/types/product'

/**
 * Carrinho sem dependências extras: um store externo mínimo + useSyncExternalStore.
 * - Persiste só { productId, quantity } — preço e nome vêm sempre do catálogo atual,
 *   então uma mudança de preço nunca fica "presa" no navegador do cliente.
 * - Seguro para SSR (o servidor sempre vê carrinho vazio) e sincroniza entre abas.
 */

const STORAGE_KEY = 'ondina-bolos:cart:v1'
export const MAX_QUANTITY = 20

const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
})
const cartSchema = z.array(cartLineSchema)

export type CartLine = z.infer<typeof cartLineSchema>

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
    return parsed.success ? parsed.data.filter(line => getProductById(line.productId)) : EMPTY
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

const quantityOf = (productId: string) =>
  current().find(line => line.productId === productId)?.quantity ?? 0

function remove(productId: string): void {
  setLines(current().filter(line => line.productId !== productId))
}

function setQuantity(productId: string, quantity: number): void {
  const next = clamp(quantity)
  if (next === 0) {
    remove(productId)
    return
  }
  const exists = current().some(line => line.productId === productId)
  setLines(
    exists
      ? current().map(line => (line.productId === productId ? { ...line, quantity: next } : line))
      : [...lines, { productId, quantity: next }],
  )
}

function add(productId: string, quantity = 1): void {
  if (!getProductById(productId)) return
  setQuantity(productId, quantityOf(productId) + quantity)
}

export const cartActions = {
  add,
  setQuantity,
  remove,
  increment: (productId: string) => add(productId, 1),
  decrement: (productId: string) => setQuantity(productId, quantityOf(productId) - 1),
  clear: () => setLines(EMPTY),
} as const

/* ---------- Seletores ---------- */

export function toCartItems(source: readonly CartLine[]): CartItem[] {
  return source.flatMap(line => {
    const product = getProductById(line.productId)
    return product ? [{ product, quantity: line.quantity }] : []
  })
}

export const getCartTotal = (items: readonly CartItem[]) =>
  items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

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
