import type { CartItem } from './cart'
import { effectivePrice } from './pricing'
import { imageForColor } from './productImages'
import { isVariantPurchasable, maxQuantityFor } from './variants'
import type { ProductVariant, ProductWithRelations } from '../types/db'

/** Cria o item do carrinho a partir de um produto e uma variante. Nulo se não puder ser comprado. */
export function buildCartItem(product: ProductWithRelations, variant: ProductVariant, quantity: number): CartItem | null {
  const price = effectivePrice(product)
  if (price == null || !isVariantPurchasable(product, variant)) return null
  const max = maxQuantityFor(product, variant)
  return {
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    code: product.code,
    color: variant.color,
    size: variant.size,
    unitPrice: price,
    quantity: Math.max(1, Math.min(quantity, max)),
    imagePath: imageForColor(product, variant.color),
  }
}
