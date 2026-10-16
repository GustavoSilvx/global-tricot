import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../../context/ToastContext'

const h = vi.hoisted(() => ({ update: vi.fn(), del: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null, STORAGE_BUCKET: 'catalog', requireSupabase: () => null, publicImageUrl: () => null }))
vi.mock('../../services/adminProducts', () => ({
  adminListProducts: async () => [
    { id: 'p1', name: 'Blusa Pronta', slug: 'blusa-pronta', code: 'B1', price: 90, promotional_price: null, availability: 'available', status: 'draft', featured: false, main_image_path: null, updated_at: '2026-03-01T10:00:00Z', category: { name: 'Tricô' } },
    { id: 'p2', name: 'Regata Antiga', slug: 'regata', code: null, price: null, promotional_price: null, availability: 'available', status: 'archived', featured: true, main_image_path: null, updated_at: '2026-02-01T10:00:00Z', category: null },
  ],
  updateProductFlags: h.update, deleteProduct: h.del,
}))

import AdminProductsPage from './AdminProductsPage'

const open = (route = '/admin/produtos') => render(<MemoryRouter initialEntries={[route]}><ToastProvider><AdminProductsPage /></ToastProvider></MemoryRouter>)
beforeEach(() => { h.update.mockReset(); h.del.mockReset() })

describe('lista de produtos do painel', () => {
  it('mostra os dados e filtra por situação e pesquisa', async () => {
    open()
    expect(await screen.findByText('Blusa Pronta')).toBeInTheDocument()
    expect(screen.getByText('R$ 90,00')).toBeInTheDocument()
    expect(screen.getByText('Sem preço')).toBeInTheDocument()
    expect(screen.getByText('Sem categoria')).toBeInTheDocument()
    await userEvent.setup().selectOptions(screen.getByLabelText('Filtrar por situação'), 'archived')
    expect(screen.queryByText('Blusa Pronta')).not.toBeInTheDocument()
    expect(screen.getByText('Regata Antiga')).toBeInTheDocument()
  })

  it('publicar: só atualiza a tela depois que o banco confirma', async () => {
    h.update.mockResolvedValue(undefined)
    open()
    const user = userEvent.setup()
    const select = await screen.findByLabelText('Situação de Blusa Pronta')
    await user.selectOptions(select, 'published')
    await waitFor(() => expect(h.update).toHaveBeenCalledWith('p1', { status: 'published' }))
    expect(await screen.findByText(/Produto movido para publicado/)).toBeInTheDocument()
    expect(screen.getByLabelText('Situação de Blusa Pronta')).toHaveValue('published')
  })

  it('banco recusa a publicação: mostra a mensagem e a tela NÃO muda', async () => {
    h.update.mockRejectedValue({ code: 'P0001', message: 'Não é possível publicar: falta ao menos uma imagem.' })
    open()
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText('Situação de Blusa Pronta'), 'published')
    expect(await screen.findByText(/falta ao menos uma imagem/)).toBeInTheDocument()
    expect(screen.getByLabelText('Situação de Blusa Pronta')).toHaveValue('draft')
  })

  it('excluir pede confirmação e só remove da lista após sucesso', async () => {
    h.del.mockResolvedValue(undefined)
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Excluir Blusa Pronta' }))
    expect(h.del).not.toHaveBeenCalled() // ainda só a confirmação
    const dialog = screen.getByRole('dialog', { hidden: true })
    await user.click(within(dialog).getByRole('button', { name: 'Excluir', hidden: true }))
    await waitFor(() => expect(h.del).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(screen.queryByText('Blusa Pronta')).not.toBeInTheDocument())
  })

  it('cancelar a confirmação não exclui nada', async () => {
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Excluir Blusa Pronta' }))
    await user.click(within(screen.getByRole('dialog', { hidden: true })).getByRole('button', { name: 'Cancelar', hidden: true }))
    expect(h.del).not.toHaveBeenCalled()
    expect(screen.getByText('Blusa Pronta')).toBeInTheDocument()
  })
})
