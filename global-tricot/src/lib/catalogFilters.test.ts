import { makeProduct, makeVariant } from '../test/fixtures'
import {
  applyFilters, buildFacets, countActiveFilters, DEFAULT_FILTERS, filtersFromParams, filtersToParams,
} from './catalogFilters'

const a = makeProduct({ id: 'a', name: 'Blusa Tricô Rosa', price: 90, created_at: '2026-03-01T00:00:00Z',
  product_variants: [makeVariant({ color: 'Rosa', size: 'P' }), makeVariant({ color: 'Rosa', size: 'M' })] })
const b = makeProduct({ id: 'b', name: 'Regata Academia', price: 60, promotional_price: 45, created_at: '2026-03-05T00:00:00Z',
  category: { id: 'c2', name: 'Moda Academia', slug: 'moda-academia', active: true },
  product_variants: [makeVariant({ color: 'Preto', size: 'G' })] })
const c = makeProduct({ id: 'c', name: 'Saia Listrada', price: 150, created_at: '2026-02-01T00:00:00Z',
  product_variants: [makeVariant({ color: 'Bege', size: 'M', available: false })] })
const all = [a, b, c]
const ids = (l: typeof all) => l.map((p) => p.id)

describe('filtros do catálogo', () => {
  it('pesquisa por nome ignora acento e caixa, sem casar o nome da categoria', () => {
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, q: 'trico' }))).toEqual(['a'])
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, q: 'REGATA academia' }))).toEqual(['b'])
    // "moda" só existe no nome da categoria de b, não no nome do produto
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, q: 'moda' }))).toEqual([])
  })
  it('filtra por categoria, tamanho e cor (só variantes ativas)', () => {
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, category: 'moda-academia' }))).toEqual(['b'])
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, size: 'm' }))).toEqual(['a']) // c está inativa
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, color: 'preto' }))).toEqual(['b'])
  })
  it('faixa de preço usa o preço promocional quando existe', () => {
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, maxPrice: 50 }))).toEqual(['b'])
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, minPrice: 100 }))).toEqual(['c'])
  })
  it('ordena por novidades, menor e maior preço', () => {
    expect(ids(applyFilters(all, DEFAULT_FILTERS))).toEqual(['b', 'a', 'c'])
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, sort: 'menor-preco' }))).toEqual(['b', 'a', 'c'])
    expect(ids(applyFilters(all, { ...DEFAULT_FILTERS, sort: 'maior-preco' }))).toEqual(['c', 'a', 'b'])
  })
  it('sem resultados retorna lista vazia', () => {
    expect(applyFilters(all, { ...DEFAULT_FILTERS, q: 'zzz' })).toEqual([])
  })
  it('conta filtros ativos e limpa ao voltar ao padrão', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...DEFAULT_FILTERS, q: 'a', size: 'P', sort: 'maior-preco' })).toBe(2)
  })
  it('ida e volta pela URL', () => {
    const f = { ...DEFAULT_FILTERS, q: 'blusa', category: 'trico', minPrice: 10, maxPrice: 99, sort: 'menor-preco' as const }
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams('ordem=hack&min=-5')).sort).toBe('novidades')
    expect(filtersFromParams(new URLSearchParams('min=-5')).minPrice).toBeNull()
  })
  it('facetas vêm dos produtos reais', () => {
    const f = buildFacets(all)
    expect(f.sizes).toEqual(['P', 'M', 'G'])
    expect(f.colors).toEqual(['Preto', 'Rosa'])
    expect(f.minPrice).toBe(45)
    expect(f.maxPrice).toBe(150)
  })
})
