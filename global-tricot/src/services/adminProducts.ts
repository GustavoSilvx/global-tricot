import { requireSupabase } from '../lib/supabase'
import type { Product, ProductAvailability, ProductStatus, ProductWithRelations } from '../types/db'
import { assertAffected } from '../lib/dbResult'
import { normalizeProduct } from './catalog'
import { removeImages, uploadImage } from './storage'

const PAGE_SIZE = 1000

export interface AdminProductRow
  extends Pick<
    Product,
    | 'id' | 'name' | 'slug' | 'code' | 'price' | 'promotional_price' | 'availability'
    | 'status' | 'featured' | 'main_image_path' | 'updated_at'
  > {
  category: { name: string } | null
}

export async function adminListProducts(): Promise<AdminProductRow[]> {
  const sb = requireSupabase()
  const all: AdminProductRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('products')
      .select('id,name,slug,code,price,promotional_price,availability,status,featured,main_image_path,updated_at,category:categories(name)')
      .order('updated_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as (Omit<AdminProductRow, 'price' | 'promotional_price'> & {
      price: number | string | null
      promotional_price: number | string | null
    })[]
    all.push(
      ...rows.map((r) => ({
        ...r,
        price: r.price == null ? null : Number(r.price),
        promotional_price: r.promotional_price == null ? null : Number(r.promotional_price),
      })),
    )
    if (rows.length < PAGE_SIZE) break
  }
  return all
}

export async function adminGetProduct(id: string): Promise<ProductWithRelations | null> {
  const { data, error } = await requireSupabase()
    .from('products')
    .select('*, category:categories(id,name,slug,active), product_variants(*), product_images(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeProduct(data as never) : null
}

export interface DashboardCounts {
  total: number
  published: number
  draft: number
  archived: number
  unavailable: number
  featured: number
}

/** Indicadores calculados com contagens reais do banco (sem estatísticas inventadas). */
export async function adminDashboardCounts(): Promise<DashboardCounts> {
  const sb = requireSupabase()
  const count = async (build: (q: ReturnType<typeof base>) => unknown): Promise<number> => {
    const q = build(base()) as PromiseLike<{ count: number | null; error: unknown }>
    const { count: c, error } = await q
    if (error) throw error
    return c ?? 0
  }
  const base = () => sb.from('products').select('id', { count: 'exact', head: true })
  const [total, published, draft, archived, unavailable, featured] = await Promise.all([
    count((q) => q),
    count((q) => q.eq('status', 'published')),
    count((q) => q.eq('status', 'draft')),
    count((q) => q.eq('status', 'archived')),
    count((q) => q.eq('status', 'published').eq('availability', 'unavailable')),
    count((q) => q.eq('status', 'published').eq('featured', true)),
  ])
  return { total, published, draft, archived, unavailable, featured }
}

// ---------------------------------------------------------------------------
// Salvar produto (produto + variantes + imagens)
// ---------------------------------------------------------------------------

export interface ProductInput {
  id?: string
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
}

export interface VariantInput {
  id?: string
  color: string | null
  color_hex: string | null
  size: string | null
  sku: string | null
  stock_quantity: number | null
  available: boolean
}

export interface ImageInput {
  id?: string
  /** Caminho já salvo no Storage (imagens existentes). */
  storage_path?: string
  /** Arquivo novo, ainda não enviado. */
  file?: File
  alt_text: string | null
  color_variant: string | null
  is_main: boolean
}

export interface SaveOriginal {
  status: ProductStatus
  variantIds: string[]
  images: { id: string; storage_path: string }[]
}

export interface SaveResult {
  id: string
  /** Status efetivamente gravado. */
  status: ProductStatus
  /** Preenchido quando o produto foi salvo, mas a publicação foi recusada pelo banco. */
  publishError?: string
}

/** Erro com a etapa em que falhou, para orientar a pessoa. */
export class SaveStageError extends Error {
  constructor(
    public stage: 'produto' | 'opções' | 'imagens',
    public cause: unknown,
  ) {
    super(`Falha ao salvar ${stage}`)
  }
}

const stage = async <T>(name: SaveStageError['stage'], fn: () => PromiseLike<T>): Promise<T> => {
  try {
    return await fn()
  } catch (e) {
    throw new SaveStageError(name, e)
  }
}

/**
 * Ordem pensada para nunca deixar um produto PUBLICADO sem imagens/opções:
 * 1) salva o produto (novo ou "ainda não publicado" entra como rascunho),
 * 2) cria/atualiza opções e só depois remove as antigas,
 * 3) envia imagens novas, ajusta ordem/principal e só depois remove as antigas,
 * 4) por fim tenta publicar; o banco valida as regras e recusa se algo faltar.
 */
export async function saveProduct(
  input: ProductInput,
  variants: VariantInput[],
  images: ImageInput[],
  original?: SaveOriginal,
): Promise<SaveResult> {
  const sb = requireSupabase()
  const id = input.id ?? crypto.randomUUID()
  const wasPublished = original?.status === 'published'
  const wantsPublish = input.status === 'published'
  const rowStatus: ProductStatus = wantsPublish && !wasPublished ? (original?.status ?? 'draft') : input.status

  const { id: _ignore, status: _status, ...fields } = input
  void _ignore
  void _status

  // 1) produto
  await stage('produto', async () => {
    if (original) {
      assertAffected(await sb.from('products').update({ ...fields, status: rowStatus }).eq('id', id).select('id'), 'o produto')
    } else {
      const res = await sb.from('products').insert({ id, ...fields, status: rowStatus })
      if (res.error) throw res.error
    }
  })

  // 2) opções (variantes)
  await stage('opções', async () => {
    const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id as string))
    const toInsert = variants
      .map((v, position) => ({ v, position }))
      .filter(({ v }) => !v.id)
      .map(({ v, position }) => ({ product_id: id, ...stripId(v), position }))
    const toUpdate = variants.map((v, position) => ({ v, position })).filter(({ v }) => v.id)

    for (const { v, position } of toUpdate) {
      assertAffected(
        await sb.from('product_variants').update({ ...stripId(v), position }).eq('id', v.id as string).select('id'),
        'as opções',
      )
    }
    if (toInsert.length) {
      const { error } = await sb.from('product_variants').insert(toInsert)
      if (error) throw error
    }
    const removed = (original?.variantIds ?? []).filter((vid) => !keepIds.has(vid))
    if (removed.length) {
      assertAffected(await sb.from('product_variants').delete().in('id', removed).select('id'), 'as opções')
    }
  })

  // 3) imagens
  const uploaded: string[] = []
  try {
    await stage('imagens', async () => {
      // envia arquivos novos
      const resolved: { input: ImageInput; path: string; position: number }[] = []
      for (let position = 0; position < images.length; position++) {
        const img = images[position]
        let path = img.storage_path
        if (!path && img.file) {
          path = await uploadImage('products', id, img.file)
          uploaded.push(path)
        }
        if (!path) continue
        resolved.push({ input: img, path, position })
      }
      // garante exatamente uma principal
      const hasMain = resolved.some((r) => r.input.is_main)
      resolved.forEach((r, i) => {
        r.input = { ...r.input, is_main: hasMain ? r.input.is_main : i === 0 }
      })
      let mainSeen = false
      resolved.forEach((r) => {
        if (r.input.is_main) {
          if (mainSeen) r.input = { ...r.input, is_main: false }
          mainSeen = true
        }
      })

      // novas linhas entram sem "principal" para não colidir com o índice único
      const newOnes = resolved.filter((r) => !r.input.id)
      const idByPath = new Map<string, string>()
      if (newOnes.length) {
        const { data, error } = await sb
          .from('product_images')
          .insert(
            newOnes.map((r) => ({
              product_id: id,
              storage_path: r.path,
              alt_text: r.input.alt_text,
              color_variant: r.input.color_variant,
              position: r.position,
              is_main: false,
            })),
          )
          .select('id,storage_path')
        if (error) throw error
        for (const row of (data ?? []) as { id: string; storage_path: string }[]) idByPath.set(row.storage_path, row.id)
      }

      // zera a principal e aplica a definitiva
      {
        const { error } = await sb.from('product_images').update({ is_main: false }).eq('product_id', id).eq('is_main', true)
        if (error) throw error // pode não haver linha principal ainda: 0 linhas é normal aqui
      }
      for (const r of resolved) {
        const rowId = r.input.id ?? idByPath.get(r.path)
        if (!rowId) continue
        assertAffected(
          await sb
            .from('product_images')
            .update({ position: r.position, alt_text: r.input.alt_text, color_variant: r.input.color_variant, is_main: r.input.is_main })
            .eq('id', rowId)
            .select('id'),
          'as imagens',
        )
      }

      // remove as imagens que saíram da galeria (depois de garantir as novas)
      const keep = new Set(resolved.map((r) => r.input.id).filter(Boolean) as string[])
      const removedRows = (original?.images ?? []).filter((i) => !keep.has(i.id))
      if (removedRows.length) {
        assertAffected(await sb.from('product_images').delete().in('id', removedRows.map((i) => i.id)).select('id'), 'as imagens')
        await removeImages(removedRows.map((i) => i.storage_path))
      }
    })
  } catch (e) {
    await removeImages(uploaded) // não deixa arquivos órfãos de um salvamento que falhou
    throw e
  }

  // 4) publicação
  if (wantsPublish && !wasPublished) {
    const res = await sb.from('products').update({ status: 'published' }).eq('id', id).select('id')
    if (res.error) {
      if ((res.error as { code?: string }).code === 'P0001') return { id, status: rowStatus, publishError: res.error.message }
      throw new SaveStageError('produto', res.error)
    }
    try {
      assertAffected(res, 'a publicação')
    } catch (e) {
      throw new SaveStageError('produto', e)
    }
    return { id, status: 'published' }
  }
  return { id, status: rowStatus }
}

function stripId(v: VariantInput) {
  return {
    color: v.color,
    color_hex: v.color_hex,
    size: v.size,
    sku: v.sku,
    stock_quantity: v.stock_quantity,
    available: v.available,
  }
}

/** Ações rápidas da tabela: publicar, arquivar, destacar, marcar indisponível. */
export async function updateProductFlags(
  id: string,
  patch: Partial<Pick<Product, 'status' | 'featured' | 'availability'>>,
): Promise<void> {
  assertAffected(await requireSupabase().from('products').update(patch).eq('id', id).select('id'), 'o produto')
}

export async function deleteProduct(id: string): Promise<void> {
  const sb = requireSupabase()
  const { data: imgs, error: imgErr } = await sb.from('product_images').select('storage_path').eq('product_id', id)
  if (imgErr) throw imgErr
  assertAffected(await sb.from('products').delete().eq('id', id).select('id'), 'o produto')
  await removeImages(((imgs ?? []) as { storage_path: string }[]).map((i) => i.storage_path))
}
