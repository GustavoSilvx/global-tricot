import type { Product, ProductVariant, ProductWithRelations } from '../types/db'

export const MAX_QTY_PER_ITEM = 20

type StockFields = Pick<Product, 'availability' | 'track_stock'>
type VariantStockFields = Pick<ProductVariant, 'available' | 'stock_quantity'>

export function sortVariants(variants: ProductVariant[]): ProductVariant[] {
  return [...variants].sort((a, b) => a.position - b.position)
}

export function variantLabel(v: Pick<ProductVariant, 'color' | 'size'>): string {
  return [v.color, v.size].filter(Boolean).join(' / ') || 'Peça única'
}

export function isVariantPurchasable(product: StockFields, v: VariantStockFields): boolean {
  if (product.availability !== 'available' || !v.available) return false
  if (product.track_stock) return (v.stock_quantity ?? 0) > 0
  return true
}

/** Quantidade máxima que o cliente pode pedir desta variante. */
export function maxQuantityFor(product: StockFields, v: VariantStockFields): number {
  if (product.track_stock) return Math.max(0, Math.min(MAX_QTY_PER_ITEM, v.stock_quantity ?? 0))
  return MAX_QTY_PER_ITEM
}

export function hasPurchasableVariant(product: ProductWithRelations): boolean {
  return product.product_variants.some((v) => isVariantPurchasable(product, v))
}

function uniqueInOrder(values: (string | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (!v) continue
    const key = v.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(v)
    }
  }
  return out
}

export function distinctColors(variants: ProductVariant[]): { name: string; hex: string | null }[] {
  const names = uniqueInOrder(sortVariants(variants).map((v) => v.color))
  return names.map((name) => ({
    name,
    hex: variants.find((v) => v.color?.toLowerCase() === name.toLowerCase() && v.color_hex)?.color_hex ?? null,
  }))
}

export function distinctSizes(variants: ProductVariant[]): string[] {
  return uniqueInOrder(sortVariants(variants).map((v) => v.size))
}

export function findVariant(
  variants: ProductVariant[],
  color: string | null,
  size: string | null,
): ProductVariant | undefined {
  const eq = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()
  return variants.find((v) => eq(v.color, color) && eq(v.size, size))
}
