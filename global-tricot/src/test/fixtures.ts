import type { ProductVariant, ProductWithRelations } from '../types/db'

let n = 0
export function makeVariant(over: Partial<ProductVariant> = {}): ProductVariant {
  n += 1
  return {
    id: `v${n}`,
    product_id: 'p1',
    color: 'Rosa',
    color_hex: null,
    size: 'P',
    sku: null,
    stock_quantity: null,
    available: true,
    position: n,
    ...over,
  }
}

export function makeProduct(over: Partial<ProductWithRelations> = {}): ProductWithRelations {
  n += 1
  return {
    id: `p${n}`,
    name: `Blusa ${n}`,
    slug: `blusa-${n}`,
    code: null,
    description: null,
    category_id: 'c1',
    price: 100,
    promotional_price: null,
    availability: 'available',
    track_stock: false,
    featured: false,
    status: 'published',
    main_image_path: null,
    created_at: `2026-01-${String(10 + (n % 18)).padStart(2, '0')}T10:00:00Z`,
    updated_at: '2026-01-10T10:00:00Z',
    category: { id: 'c1', name: 'Tricô', slug: 'trico', active: true },
    product_variants: [makeVariant()],
    product_images: [],
    ...over,
  }
}
