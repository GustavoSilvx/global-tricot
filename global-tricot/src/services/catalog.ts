import { requireSupabase } from '../lib/supabase'
import type { ProductWithRelations } from '../types/db'
import type { FreshVariant } from '../lib/cartReconcile'

const PAGE_SIZE = 1000 // limite padrão do PostgREST: buscamos em páginas, sem teto artificial
const PRODUCT_SELECT = '*, category:categories(id,name,slug,active), product_variants(*), product_images(*)'

type Raw = Omit<ProductWithRelations, 'price' | 'promotional_price'> & {
  price: number | string | null
  promotional_price: number | string | null
}

const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

export function normalizeProduct(raw: Raw): ProductWithRelations {
  return {
    ...raw,
    price: num(raw.price),
    promotional_price: num(raw.promotional_price),
    product_variants: [...(raw.product_variants ?? [])].sort((a, b) => a.position - b.position),
    product_images: [...(raw.product_images ?? [])].sort((a, b) => a.position - b.position),
  }
}

/** Todos os produtos publicados (o RLS já esconde rascunhos, arquivados e categorias inativas). */
export async function fetchPublishedProducts(): Promise<ProductWithRelations[]> {
  const sb = requireSupabase()
  const all: ProductWithRelations[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as Raw[]
    all.push(...rows.map(normalizeProduct))
    if (rows.length < PAGE_SIZE) break
  }
  // Defesa extra: um administrador logado enxerga categorias inativas; a loja pública não as mostra.
  return all.filter((p) => !p.category || p.category.active)
}

export async function fetchProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const { data, error } = await requireSupabase()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const product = normalizeProduct(data as unknown as Raw)
  return product.category && !product.category.active ? null : product
}

interface FreshRow {
  id: string
  color: string | null
  size: string | null
  available: boolean
  stock_quantity: number | null
  product: {
    id: string
    name: string
    slug: string
    code: string | null
    price: number | string | null
    promotional_price: number | string | null
    availability: FreshVariant['availability']
    track_stock: boolean
    status: FreshVariant['productStatus']
    main_image_path: string | null
  }
}

/**
 * Dados ATUAIS das variantes que estão no carrinho (preço, estoque, disponibilidade).
 * Variantes de produtos despublicados/removidos simplesmente não voltam (RLS) => "removed".
 */
export async function fetchFreshVariants(variantIds: string[]): Promise<FreshVariant[]> {
  if (!variantIds.length) return []
  const { data, error } = await requireSupabase()
    .from('product_variants')
    .select(
      'id,color,size,available,stock_quantity,product:products!inner(id,name,slug,code,price,promotional_price,availability,track_stock,status,main_image_path)',
    )
    .in('id', variantIds)
  if (error) throw error
  return ((data ?? []) as unknown as FreshRow[]).map((r) => ({
    variantId: r.id,
    productId: r.product.id,
    productName: r.product.name,
    slug: r.product.slug,
    code: r.product.code,
    color: r.color,
    size: r.size,
    price: num(r.product.price),
    promotionalPrice: num(r.product.promotional_price),
    availability: r.product.availability,
    trackStock: r.product.track_stock,
    stockQuantity: r.stock_quantity,
    variantAvailable: r.available,
    productStatus: r.product.status,
    imagePath: r.product.main_image_path,
  }))
}
