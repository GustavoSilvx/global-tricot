import type { ProductWithRelations } from '../types/db'
import { normalizeText } from './format'
import { effectivePrice } from './pricing'

export type SortKey = 'novidades' | 'menor-preco' | 'maior-preco'

export interface CatalogFilters {
  q: string
  category: string
  size: string
  color: string
  minPrice: number | null
  maxPrice: number | null
  sort: SortKey
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  size: '',
  color: '',
  minPrice: null,
  maxPrice: null,
  sort: 'novidades',
}

const SORTS: SortKey[] = ['novidades', 'menor-preco', 'maior-preco']

const numParam = (v: string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function filtersFromParams(sp: URLSearchParams): CatalogFilters {
  const sort = sp.get('ordem') as SortKey | null
  return {
    q: sp.get('q') ?? '',
    category: sp.get('categoria') ?? '',
    size: sp.get('tamanho') ?? '',
    color: sp.get('cor') ?? '',
    minPrice: numParam(sp.get('min')),
    maxPrice: numParam(sp.get('max')),
    sort: sort && SORTS.includes(sort) ? sort : 'novidades',
  }
}

export function filtersToParams(f: CatalogFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.q.trim()) sp.set('q', f.q.trim())
  if (f.category) sp.set('categoria', f.category)
  if (f.size) sp.set('tamanho', f.size)
  if (f.color) sp.set('cor', f.color)
  if (f.minPrice != null) sp.set('min', String(f.minPrice))
  if (f.maxPrice != null) sp.set('max', String(f.maxPrice))
  if (f.sort !== 'novidades') sp.set('ordem', f.sort)
  return sp
}

/** Quantidade de filtros ativos (a ordenação não conta). */
export function countActiveFilters(f: CatalogFilters): number {
  return [f.q.trim(), f.category, f.size, f.color, f.minPrice, f.maxPrice].filter(
    (v) => v !== '' && v !== null,
  ).length
}

const same = (a: string | null, b: string) => (a ?? '').toLowerCase() === b.toLowerCase()

export function filterProducts(products: ProductWithRelations[], f: CatalogFilters): ProductWithRelations[] {
  const q = normalizeText(f.q)
  return products.filter((p) => {
    if (q) {
      const hay = normalizeText(`${p.name} ${p.code ?? ''}`)
      if (!q.split(/\s+/).every((word) => hay.includes(word))) return false
    }
    if (f.category && p.category?.slug !== f.category) return false
    if (f.size && !p.product_variants.some((v) => v.available && same(v.size, f.size))) return false
    if (f.color && !p.product_variants.some((v) => v.available && same(v.color, f.color))) return false
    const price = effectivePrice(p)
    if (f.minPrice != null && (price == null || price < f.minPrice)) return false
    if (f.maxPrice != null && (price == null || price > f.maxPrice)) return false
    return true
  })
}

export function sortProducts(products: ProductWithRelations[], sort: SortKey): ProductWithRelations[] {
  const list = [...products]
  const byName = (a: ProductWithRelations, b: ProductWithRelations) => a.name.localeCompare(b.name, 'pt-BR')
  if (sort === 'novidades') {
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b))
  }
  const dir = sort === 'menor-preco' ? 1 : -1
  return list.sort((a, b) => {
    const pa = effectivePrice(a)
    const pb = effectivePrice(b)
    if (pa == null && pb == null) return byName(a, b)
    if (pa == null) return 1
    if (pb == null) return -1
    return (pa - pb) * dir || byName(a, b)
  })
}

export const applyFilters = (products: ProductWithRelations[], f: CatalogFilters): ProductWithRelations[] =>
  sortProducts(filterProducts(products, f), f.sort)

export interface Facets {
  sizes: string[]
  colors: string[]
  minPrice: number | null
  maxPrice: number | null
}

/** Opções de filtro derivadas dos produtos reais (nada fixo no código). */
export function buildFacets(products: ProductWithRelations[]): Facets {
  const sizes = new Map<string, string>()
  const colors = new Map<string, string>()
  let min: number | null = null
  let max: number | null = null
  for (const p of products) {
    for (const v of p.product_variants) {
      if (!v.available) continue
      if (v.size) sizes.set(v.size.toLowerCase(), v.size)
      if (v.color) colors.set(v.color.toLowerCase(), v.color)
    }
    const price = effectivePrice(p)
    if (price != null) {
      min = min == null ? price : Math.min(min, price)
      max = max == null ? price : Math.max(max, price)
    }
  }
  const order = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'U', 'ÚNICO', 'UNICO']
  const sizeList = [...sizes.values()].sort((a, b) => {
    const ia = order.indexOf(a.toUpperCase())
    const ib = order.indexOf(b.toUpperCase())
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b, 'pt-BR', { numeric: true })
  })
  return {
    sizes: sizeList,
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    minPrice: min,
    maxPrice: max,
  }
}
