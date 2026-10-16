import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProduct, makeVariant } from '../test/fixtures'
import { baseSettings, renderPage } from '../test/utils'
import { resetCatalogCache } from '../hooks/useCatalog'
import type { ProductWithRelations } from '../types/db'

const h = vi.hoisted(() => ({ products: [] as unknown[], error: false }))
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true, supabase: null, STORAGE_BUCKET: 'catalog',
  publicImageUrl: (p: string | null) => (p ? `https://img.test/${p}` : null),
  requireSupabase: () => { throw new Error('não usar') },
}))
vi.mock('../services/settings', () => ({ fetchStoreSettings: async () => (await import('../test/utils')).baseSettings }))
vi.mock('../services/categories', () => ({ fetchActiveCategories: async () => [
  { id: 'c1', name: 'Tricô', slug: 'trico', description: null, cover_image_path: null, active: true, position: 1, created_at: '', updated_at: '' },
  { id: 'c2', name: 'Regatas', slug: 'regatas', description: null, cover_image_path: null, active: true, position: 2, created_at: '', updated_at: '' },
] }))
vi.mock('../services/catalog', () => ({
  fetchPublishedProducts: async () => { if (h.error) throw new Error('Failed to fetch'); return h.products },
  fetchProductBySlug: async () => null, fetchFreshVariants: async () => [],
}))

import CatalogPage from './CatalogPage'
import HomePage from './HomePage'

const mk = (n: number, over: Partial<ProductWithRelations> = {}) =>
  makeProduct({ id: `p${n}`, slug: `p-${n}`, name: `Peça ${String(n).padStart(2, '0')}`, price: 50 + n,
    created_at: `2026-02-${String(1 + (n % 27)).padStart(2, '0')}T10:00:00Z`, ...over })

beforeEach(() => { resetCatalogCache(); h.error = false; h.products = [] })

describe('catálogo', () => {
  it('lista todos os publicados, sem limite artificial, com carregamento progressivo', async () => {
    h.products = Array.from({ length: 30 }, (_, i) => mk(i + 1))
    renderPage(<CatalogPage />, { route: '/catalogo' })
    expect(await screen.findByText('30 peças encontradas')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 24 de 30')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Carregar mais peças' }))
    expect(screen.getByText('Mostrando 30 de 30')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais peças' })).not.toBeInTheDocument()
  })

  it('filtros vêm da URL, mostram a quantidade e o estado vazio permite limpar', async () => {
    h.products = [
      mk(1, { name: 'Blusa Rosa', product_variants: [makeVariant({ color: 'Rosa', size: 'P' })] }),
      mk(2, { name: 'Regata Preta', category: { id: 'c2', name: 'Regatas', slug: 'regatas', active: true }, product_variants: [makeVariant({ color: 'Preto', size: 'M' })] }),
    ]
    renderPage(<CatalogPage />, { route: '/catalogo?categoria=regatas' })
    expect(await screen.findByText('1 peça encontrada')).toBeInTheDocument()
    expect(screen.getAllByText('Regata Preta').length).toBeGreaterThan(0)
    expect(screen.queryByText('Blusa Rosa')).not.toBeInTheDocument()
    const user = userEvent.setup()
    await user.type(screen.getAllByLabelText('Pesquisar por nome')[0], 'zzzz')
    expect(await screen.findByText('Nenhuma peça encontrada')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[0])
    expect(await screen.findByText('2 peças encontradas')).toBeInTheDocument()
  })

  it('filtro por tamanho e ordenação por menor preço', async () => {
    h.products = [mk(1, { name: 'Cara', price: 200, product_variants: [makeVariant({ size: 'M' })] }), mk(2, { name: 'Barata', price: 40, product_variants: [makeVariant({ size: 'M' })] }), mk(3, { name: 'Outra', product_variants: [makeVariant({ size: 'G' })] })]
    renderPage(<CatalogPage />, { route: '/catalogo?tamanho=M&ordem=menor-preco' })
    await screen.findByText('2 peças encontradas')
    const titles = screen.getAllByRole('heading', { level: 3 }).map((e) => e.textContent)
    expect(titles).toEqual(['Barata', 'Cara'])
  })

  it('erro de rede mostra mensagem e botão de tentar de novo (nunca produtos de exemplo)', async () => {
    h.error = true
    renderPage(<CatalogPage />, { route: '/catalogo' })
    expect(await screen.findByText('Não foi possível carregar o catálogo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('produto indisponível aparece com aviso e sem ação de compra', async () => {
    h.products = [mk(1, { name: 'Esgotada', availability: 'unavailable' })]
    renderPage(<CatalogPage />, { route: '/catalogo' })
    const card = (await screen.findByRole('heading', { name: 'Esgotada' })).closest('article') as HTMLElement
    expect(within(card).getAllByText(/Indisponível/).length).toBeGreaterThan(0)
    expect(within(card).queryByRole('button', { name: /Adicionar/ })).not.toBeInTheDocument()
  })
})

describe('página inicial', () => {
  it('destaques vêm do banco (flag featured), nada fixo no código', async () => {
    h.products = [mk(1, { name: 'Destaque Um', featured: true }), mk(2, { name: 'Comum Dois', featured: false })]
    renderPage(<HomePage />, { route: '/' })
    const section = (await screen.findByRole('heading', { name: 'Em destaque' })).closest('section') as HTMLElement
    expect(within(section).getByText('Destaque Um')).toBeInTheDocument()
    expect(within(section).queryByText('Comum Dois')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Novidades' })).toBeInTheDocument()
  })

  it('sem destaques não inventa a seção; sem produtos mostra "novas peças em breve"', async () => {
    h.products = []
    renderPage(<HomePage />, { route: '/' })
    expect(await screen.findByText('Novas peças em breve')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Em destaque' })).not.toBeInTheDocument()
    // sem depoimentos/estatísticas inventadas
    expect(screen.queryByText(/clientes satisfeitos|avaliações|vendas/i)).not.toBeInTheDocument()
  })

  it('mostra a chamada sugerida, o botão "Explorar coleção" e links para Instagram e WhatsApp', async () => {
    renderPage(<HomePage />, { route: '/' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Seu estilo, seu conforto, sua Global Tricot.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar coleção' })).toHaveAttribute('href', '/catalogo')
    expect(screen.getByRole('link', { name: /Conhecer o Instagram/ })).toHaveAttribute('href', baseSettings.instagram_url)
    expect(screen.getAllByRole('link', { name: /WhatsApp/ })[0].getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5581999999999\?text=/)
  })
})
