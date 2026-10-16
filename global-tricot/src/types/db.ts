export type ProductStatus = 'draft' | 'published' | 'archived'
export type ProductAvailability = 'available' | 'unavailable'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  cover_image_path: string | null
  active: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  color: string | null
  color_hex: string | null
  size: string | null
  sku: string | null
  stock_quantity: number | null
  available: boolean
  position: number
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  alt_text: string | null
  position: number
  is_main: boolean
  color_variant: string | null
}

export interface Product {
  id: string
  name: string
  slug: string
  code: string | null
  description: string | null
  category_id: string | null
  price: number | null
  promotional_price: number | null
  availability: ProductAvailability
  track_stock: boolean
  featured: boolean
  status: ProductStatus
  main_image_path: string | null
  created_at: string
  updated_at: string
}

export interface ProductWithRelations extends Product {
  category: Pick<Category, 'id' | 'name' | 'slug' | 'active'> | null
  product_variants: ProductVariant[]
  product_images: ProductImage[]
}

export interface StoreSettings {
  id: number
  store_name: string
  logo_path: string | null
  hero_image_path: string | null
  hero_title: string | null
  hero_subtitle: string | null
  about_text: string | null
  whatsapp_number: string | null
  instagram_url: string | null
  city: string | null
  location_text: string | null
  contact_email: string | null
  contact_info: string | null
  delivery_enabled: boolean
  pickup_enabled: boolean
  delivery_info: string | null
  pickup_info: string | null
  order_greeting: string | null
  order_closing: string | null
  updated_at: string
}
