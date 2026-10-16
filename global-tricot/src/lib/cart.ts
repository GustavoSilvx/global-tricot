import { z } from 'zod'
import { MAX_QTY_PER_ITEM } from './variants'
import { toCents } from './format'

export interface CartItem {
  /** A variante identifica o item: mesma blusa em P e em M são itens diferentes. */
  variantId: string
  productId: string
  slug: string
  name: string
  code: string | null
  color: string | null
  size: string | null
  unitPrice: number
  quantity: number
  imagePath: string | null
}

export const CART_STORAGE_KEY = 'globaltricot:cart:v1'

const itemSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1).max(200),
  code: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  unitPrice: z.number().finite().positive(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
  imagePath: z.string().nullable(),
})

/** Lê o carrinho salvo, descartando qualquer item corrompido ou adulterado. */
export function parseStoredCart(raw: string | null | undefined): CartItem[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const items: CartItem[] = []
  for (const entry of data) {
    const parsed = itemSchema.safeParse(entry)
    if (parsed.success && !seen.has(parsed.data.variantId)) {
      seen.add(parsed.data.variantId)
      items.push(parsed.data)
    }
  }
  return items
}

export const clampQuantity = (q: number): number => {
  if (!Number.isFinite(q)) return 1
  return Math.min(MAX_QTY_PER_ITEM, Math.max(1, Math.floor(q)))
}

export function addToCart(items: CartItem[], incoming: CartItem): CartItem[] {
  const qty = clampQuantity(incoming.quantity)
  const existing = items.find((i) => i.variantId === incoming.variantId)
  if (!existing) return [...items, { ...incoming, quantity: qty }]
  return items.map((i) =>
    i.variantId === incoming.variantId
      ? { ...i, unitPrice: incoming.unitPrice, quantity: clampQuantity(i.quantity + qty) }
      : i,
  )
}

export function setQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity: clampQuantity(quantity) } : i))
}

export const removeFromCart = (items: CartItem[], variantId: string): CartItem[] =>
  items.filter((i) => i.variantId !== variantId)

export function setUnitPrice(items: CartItem[], variantId: string, unitPrice: number): CartItem[] {
  return items.map((i) => (i.variantId === variantId ? { ...i, unitPrice } : i))
}

export const itemSubtotalCents = (i: Pick<CartItem, 'unitPrice' | 'quantity'>): number =>
  toCents(i.unitPrice) * i.quantity

export const cartUnits = (items: CartItem[]): number => items.reduce((n, i) => n + i.quantity, 0)

export const cartTotalCents = (items: CartItem[]): number =>
  items.reduce((sum, i) => sum + itemSubtotalCents(i), 0)
