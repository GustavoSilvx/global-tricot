import type { ProductImage, ProductWithRelations } from '../types/db'

/** Galeria ordenada: a imagem principal primeiro, depois pela posição. */
export function orderedImages(product: Pick<ProductWithRelations, 'product_images'>): ProductImage[] {
  return [...product.product_images].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.position - b.position)
}

/** Foto ligada à cor escolhida (se cadastrada); senão, a principal. */
export function imageForColor(
  product: Pick<ProductWithRelations, 'product_images' | 'main_image_path'>,
  color: string | null,
): string | null {
  if (color) {
    const match = orderedImages(product).find((i) => i.color_variant && i.color_variant.toLowerCase() === color.toLowerCase())
    if (match) return match.storage_path
  }
  return orderedImages(product)[0]?.storage_path ?? product.main_image_path
}
