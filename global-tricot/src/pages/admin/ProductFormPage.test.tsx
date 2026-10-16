import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../../context/ToastContext'

const h = vi.hoisted(() => ({ save: vi.fn(), get: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null, STORAGE_BUCKET: 'catalog', requireSupabase: () => null, publicImageUrl: (p: string | null) => (p ? `https://img.test/${p}` : null) }))
vi.mock('../../services/categories', () => ({ adminListCategories: async () => [{ id: 'c1', name: 'Tricô', slug: 'trico', description: null, cover_image_path: null, active: true, position: 1, created_at: '', updated_at: '', product_count: 0 }] }))
vi.mock('../../services/adminProducts', async (orig) => ({ ...(await orig<typeof import('../../services/adminProducts')>()), saveProduct: h.save, adminGetProduct: h.get, deleteProduct: vi.fn() }))

import ProductFormPage from './ProductFormPage'

const open = (route = '/admin/produtos/novo') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/produtos/novo" element={<ProductFormPage />} />
          <Route path="/admin/produtos/:id" element={<ProductFormPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

beforeEach(() => { h.save.mockReset(); h.get.mockReset(); h.save.mockResolvedValue({ id: 'new-id', status: 'draft' }); h.get.mockResolvedValue(null) })
beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn() })

describe('formulário de produto', () => {
  it('permite salvar rascunho só com o nome (sem preço, categoria, fotos ou opções)', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Blusa Rosa Canelada')
    expect(screen.getByLabelText(/Endereço da página/)).toHaveValue('blusa-rosa-canelada') // slug automático
    await user.click(screen.getByRole('button', { name: 'Salvar como rascunho' }))
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    const [product, variants, images] = h.save.mock.calls[0]
    expect(product).toMatchObject({ name: 'Blusa Rosa Canelada', slug: 'blusa-rosa-canelada', status: 'draft', price: null, category_id: null })
    expect(variants).toEqual([]) // sem opções definidas, nada é inventado
    expect(images).toEqual([])
  })

  it('tentar publicar incompleto NÃO salva e lista o que falta', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Blusa')
    await user.selectOptions(screen.getByLabelText('Situação no site'), 'published')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Ainda falta informação para publicar')).toBeInTheDocument()
    expect(screen.getByText('Informe um preço válido, maior que zero.')).toBeInTheDocument()
    expect(screen.getByText('Escolha uma categoria.')).toBeInTheDocument()
    expect(screen.getByText('Envie pelo menos uma imagem.')).toBeInTheDocument()
    expect(screen.getByText(/Cadastre pelo menos uma opção de compra/)).toBeInTheDocument()
    expect(h.save).not.toHaveBeenCalled()
  })

  it('cores x tamanhos geram as combinações; estoque só aparece quando controlado', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Blusa')
    await user.type(screen.getByLabelText('Cores'), 'Rosa{Enter}')
    await user.type(screen.getByLabelText('Cores'), 'Preto{Enter}')
    await user.click(screen.getByRole('button', { name: '+ P' }))
    await user.click(screen.getByRole('button', { name: '+ M' }))
    expect(screen.getByRole('checkbox', { name: 'Rosa / P disponível' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Preto / M disponível' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: /disponível$/ })).toHaveLength(4)
    expect(screen.queryByLabelText('Estoque de Rosa / P')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Controlar estoque/ }))
    expect(screen.getByLabelText('Estoque de Rosa / P')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar como rascunho' }))
    await waitFor(() => expect(h.save).toHaveBeenCalled())
    const variants = h.save.mock.calls[0][1]
    expect(variants).toHaveLength(4)
    expect(variants.map((v: { color: string; size: string }) => `${v.color}/${v.size}`)).toEqual(['Rosa/P', 'Rosa/M', 'Preto/P', 'Preto/M'])
  })

  it('"peça única" é escolha explícita: sem ela e sem cores/tamanhos não há opção de compra', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Echarpe')
    expect(screen.queryByRole('checkbox', { name: /disponível$/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Esta é uma peça única/ }))
    expect(screen.getByRole('checkbox', { name: 'Peça única disponível' })).toBeInTheDocument()
  })

  it('preço promocional maior ou igual ao normal bloqueia o salvamento', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Blusa')
    await user.type(screen.getByLabelText(/Preço normal/), '50,00')
    await user.type(screen.getByLabelText(/Preço promocional/), '50,00')
    await user.click(screen.getByRole('button', { name: 'Salvar como rascunho' }))
    expect((await screen.findAllByText('O preço promocional precisa ser menor que o preço normal.')).length).toBeGreaterThan(0)
    expect(h.save).not.toHaveBeenCalled()
  })

  it('erro ao salvar mantém os dados digitados e orienta a pessoa', async () => {
    const { SaveStageError } = await import('../../services/adminProducts')
    h.save.mockRejectedValue(new SaveStageError('imagens', { code: '42501', message: 'row-level security' }))
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Nome do produto/), 'Blusa Teste')
    await user.type(screen.getByLabelText(/Preço normal/), '89,90')
    await user.click(screen.getByRole('button', { name: 'Salvar como rascunho' }))
    expect(await screen.findByText(/Não foi possível salvar imagens/)).toBeInTheDocument()
    expect(screen.getByText(/Seus dados continuam aqui no formulário/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do produto/)).toHaveValue('Blusa Teste')
    expect(screen.getByLabelText(/Preço normal/)).toHaveValue('89,90')
  })

  it('edição carrega os dados do banco no formulário', async () => {
    h.get.mockResolvedValue({
      id: 'p9', name: 'Blusa Salva', slug: 'blusa-salva', code: 'BS-9', description: 'desc', category_id: 'c1', price: 120.5, promotional_price: 99, availability: 'available',
      track_stock: false, featured: true, status: 'published', main_image_path: 'p/a.webp', created_at: '', updated_at: '', category: null,
      product_variants: [{ id: 'v1', product_id: 'p9', color: 'Azul', color_hex: null, size: 'G', sku: null, stock_quantity: null, available: true, position: 0 }],
      product_images: [{ id: 'i1', product_id: 'p9', storage_path: 'p/a.webp', alt_text: 'Foto', position: 0, is_main: true, color_variant: null }],
    })
    open('/admin/produtos/p9')
    expect(await screen.findByDisplayValue('Blusa Salva')).toBeInTheDocument()
    expect(screen.getByLabelText(/Preço normal/)).toHaveValue('120,5')
    expect(screen.getByLabelText(/Código interno/)).toHaveValue('BS-9')
    expect(screen.getByRole('checkbox', { name: 'Azul / G disponível' })).toBeChecked()
    expect(screen.getByAltText('Foto')).toHaveAttribute('src', 'https://img.test/p/a.webp')
    expect(screen.getByRole('button', { name: 'Excluir produto' })).toBeInTheDocument()
  })
})
