import type { Product } from '../types/db'

type PriceFields = Pick<Product, 'price' | 'promotional_price'>

/** Promoção só vale se for maior que zero e menor que o preço normal. */
export function hasValidPromo(p: PriceFields): boolean {
  return (
    p.promotional_price != null && p.price != null && p.promotional_price > 0 && p.promotional_price < p.price
  )
}

/** Preço que o cliente paga: promocional (quando válido) ou o normal. */
export function effectivePrice(p: PriceFields): number | null {
  if (hasValidPromo(p)) return p.promotional_price
  return p.price != null && p.price > 0 ? p.price : null
}

export function discountPercent(p: PriceFields): number | null {
  if (!hasValidPromo(p) || !p.price || !p.promotional_price) return null
  return Math.round((1 - p.promotional_price / p.price) * 100)
}
