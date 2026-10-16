import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProduct, makeVariant } from '../test/fixtures'
import { baseSettings, renderPage } from '../test/utils'
import { CART_STORAGE_KEY } from '../lib/cart'
import type { ProductWithRelations } from '../types/db'

const state = vi.hoisted(() => ({ product: null as unknown }))
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true, supabase: null, STORAGE_BUCKET: 'catalog',
  publicImageUrl: (p: string | null) => (p ? `https://img.test/${p}` : null),
  requireSupabase: () => { throw new Error('não usar') },
}))
vi.mock('../services/settings', async () => ({ fetchStoreSettings: async () => (await import('../test/utils')).baseSettings }))
vi.mock('../services/catalog', () => ({ fetchProductBySlug: async () => state.product, fetchPublishedProducts: async () => [], fetchFreshVariants: async () => [] }))

import ProductPage from './ProductPage'

const product = (over: Partial<ProductWithRelations> = {}): ProductWithRelations =>
  makeProduct({
    id: 'prod-1', slug: 'blusa-x', name: 'Blusa X', code: 'BX-1', price: 100, promotional_price: 80,
    product_variants: [
      makeVariant({ id: 'v-rosa-p', color: 'Rosa', size: 'P' }),
      makeVariant({ id: 'v-rosa-m', color: 'Rosa', size: 'M', available: false }),
      makeVariant({ id: 'v-azul-p', color: 'Azul', size: 'P' }),
    ],
    product_images: [
      { id: 'i1', product_id: 'prod-1', storage_path: 'a/main.webp', alt_text: null, position: 0, is_main: true, color_variant: null },
      { id: 'i2', product_id: 'prod-1', storage_path: 'a/azul.webp', alt_text: 'Blusa azul', position: 1, is_main: false, color_variant: 'Azul' },
    ],
    ...over,
  })

const open = () => renderPage(<ProductPage />, { route: '/produto/blusa-x', path: '/produto/:slug' })

describe('página do produto', () => {
  it('mostra preço promocional, código e exige escolher as opções antes de adicionar', async () => {
    state.product = product()
    open()
    expect(await screen.findByRole('heading', { name: 'Blusa X' })).toBeInTheDocument()
    expect(screen.getByText('R$ 80,00')).toBeInTheDocument()
    expect(screen.getByText(/Código BX-1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Adicionar à sacola/ })).toBeDisabled()
    expect(screen.getByText(/Escolha a cor e o tamanho/)).toBeInTheDocument()
  })

  it('combinação indisponível fica desabilitada e não entra na sacola', async () => {
    state.product = product()
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: 'Rosa' }))
    expect(screen.getByRole('radio', { name: 'M' })).toBeDisabled() // rosa/M indisponível
    expect(screen.getByRole('radio', { name: 'P' })).toBeEnabled()
  })

  it('adiciona a variante certa ao carrinho e salva no localStorage', async () => {
    state.product = product()
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: 'Azul' }))
    await user.click(screen.getByRole('radio', { name: 'P' }))
    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    await user.click(screen.getByRole('button', { name: /Adicionar à sacola/ }))
    expect(await screen.findByText(/2 unidades adicionadas/)).toBeInTheDocument()
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ variantId: 'v-azul-p', color: 'Azul', size: 'P', quantity: 2, unitPrice: 80, imagePath: 'a/azul.webp' })
    })
  })

  it('escolher uma cor com foto cadastrada troca a imagem exibida', async () => {
    state.product = product()
    open()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Blusa X' })
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', 'https://img.test/a/main.webp')
    await user.click(screen.getByRole('radio', { name: 'Azul' }))
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', 'https://img.test/a/azul.webp')
  })

  it('produto indisponível desabilita a compra e avisa claramente', async () => {
    state.product = product({ availability: 'unavailable' })
    open()
    expect(await screen.findByText('Peça indisponível no momento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Adicionar à sacola/ })).toBeDisabled()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('peça sem cores/tamanhos (única) já pode ser adicionada', async () => {
    state.product = product({ product_variants: [makeVariant({ id: 'v-unica', color: null, size: null })] })
    open()
    const user = userEvent.setup()
    const add = await screen.findByRole('button', { name: /Adicionar à sacola/ })
    expect(add).toBeEnabled()
    await user.click(add)
    expect(await screen.findByText(/1 unidade adicionada/)).toBeInTheDocument()
  })

  it('slug inexistente mostra "Peça não encontrada"', async () => {
    state.product = null
    open()
    expect(await screen.findByText('Peça não encontrada')).toBeInTheDocument()
  })
})
void baseSettings
