import { requireSupabase } from '../lib/supabase'
import type { Category } from '../types/db'
import { assertAffected } from '../lib/dbResult'
import { removeImages } from './storage'

export async function fetchActiveCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('position')
    .order('name')
  if (error) throw error
  return (data ?? []) as Category[]
}

export interface CategoryWithCount extends Category {
  product_count: number
}

export async function adminListCategories(): Promise<CategoryWithCount[]> {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('*, products(count)')
    .order('position')
    .order('name')
  if (error) throw error
  return ((data ?? []) as unknown as (Category & { products: { count: number }[] })[]).map(({ products, ...c }) => ({
    ...c,
    product_count: products?.[0]?.count ?? 0,
  }))
}

export interface CategoryInput {
  id?: string
  name: string
  slug: string
  description: string | null
  cover_image_path: string | null
  active: boolean
  position: number
}

export async function saveCategory(input: CategoryInput): Promise<Category> {
  const sb = requireSupabase()
  const { id, ...fields } = input
  const query = id ? sb.from('categories').update(fields).eq('id', id) : sb.from('categories').insert(fields)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data as Category
}

/** Bloqueia a exclusão quando ainda há produtos vinculados, evitando perda acidental de dados. */
export async function deleteCategory(category: Pick<Category, 'id' | 'cover_image_path'>): Promise<void> {
  const sb = requireSupabase()
  const { count, error: countError } = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', category.id)
  if (countError) throw countError
  if ((count ?? 0) > 0) {
    throw new Error(
      `Esta categoria ainda tem ${count} produto(s). Mova os produtos para outra categoria antes de excluir, ou apenas desative a categoria.`,
    )
  }
  assertAffected(await sb.from('categories').delete().eq('id', category.id).select('id'), 'a categoria')
  if (category.cover_image_path) await removeImages([category.cover_image_path])
}
