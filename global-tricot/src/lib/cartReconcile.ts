import type { CartItem } from './cart'
import { effectivePrice } from './pricing'
import { isVariantPurchasable, maxQuantityFor } from './variants'
import type { ProductAvailability, ProductStatus } from '../types/db'

/** Dados atuais (vindos do banco) de uma variante que está no carrinho. */
export interface FreshVariant {
  variantId: string
  productId: string
  productName: string
  slug: string
  code: string | null
  color: string | null
  size: string | null
  price: number | null
  promotionalPrice: number | null
  availability: ProductAvailability
  trackStock: boolean
  stockQuantity: number | null
  variantAvailable: boolean
  productStatus: ProductStatus
  imagePath: string | null
}

export type LineIssue = 'removed' | 'unavailable' | 'over_stock' | 'price_changed'

export interface CartLine {
  item: CartItem
  fresh?: FreshVariant
  issue?: LineIssue
  /** Preço atual no banco (para price_changed). */
  currentPrice?: number
  /** Limite atual de unidades (para over_stock). */
  maxQuantity?: number
}

export function reconcileCart(items: CartItem[], fresh: FreshVariant[]): CartLine[] {
  const byId = new Map(fresh.map((f) => [f.variantId, f]))
  return items.map<CartLine>((item) => {
    const f = byId.get(item.variantId)
    if (!f || f.productStatus !== 'published') return { item, issue: 'removed' }

    const productStock = { availability: f.availability, track_stock: f.trackStock }
    const variantStock = { available: f.variantAvailable, stock_quantity: f.stockQuantity }

    if (!isVariantPurchasable(productStock, variantStock)) return { item, fresh: f, issue: 'unavailable' }

    const max = maxQuantityFor(productStock, variantStock)
    if (item.quantity > max) return { item, fresh: f, issue: 'over_stock', maxQuantity: max }

    const price = effectivePrice({ price: f.price, promotional_price: f.promotionalPrice })
    if (price == null) return { item, fresh: f, issue: 'unavailable' }
    if (Math.round(price * 100) !== Math.round(item.unitPrice * 100)) {
      return { item, fresh: f, issue: 'price_changed', currentPrice: price }
    }
    return { item, fresh: f }
  })
}

export const hasBlockingIssues = (lines: CartLine[]): boolean => lines.some((l) => l.issue)
