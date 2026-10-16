import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderPage, baseSettings } from '../test/utils'
import { CART_STORAGE_KEY, type CartItem } from '../lib/cart'
import type { FreshVariant } from '../lib/cartReconcile'
import type { StoreSettings } from '../types/db'

const h = vi.hoisted(() => ({ fresh: [] as unknown[], settings: null as unknown, fail: false }))
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true, supabase: null, STORAGE_BUCKET: 'catalog',
  publicImageUrl: (p: string | null) => (p ? `https://img.test/${p}` : null),
  requireSupabase: () => { throw new Error('não usar') },
}))
vi.mock('../services/settings', () => ({ fetchStoreSettings: async () => h.settings }))
vi.mock('../services/catalog', () => ({
  fetchFreshVariants: async () => { if (h.fail) throw new Error('Failed to fetch'); return h.fresh },
  fetchPublishedProducts: async () => [], fetchProductBySlug: async () => null,
}))

import CartPage from './CartPage'
import CheckoutPage from './CheckoutPage'

const item = (over: Partial<CartItem> = {}): CartItem => ({
  variantId: 'v1', productId: 'p1', slug: 'blusa', name: 'Blusa Açaí', code: 'BL-1', color: 'Vermelho', size: 'P',
  unitPrice: 100, quantity: 2, imagePath: null, ...over,
})
const fresh = (over: Partial<FreshVariant> = {}): FreshVariant => ({
  variantId: 'v1', productId: 'p1', productName: 'Blusa Açaí', slug: 'blusa', code: 'BL-1', color: 'Vermelho', size: 'P',
  price: 100, promotionalPrice: null, availability: 'available', trackStock: false, stockQuantity: null,
  variantAvailable: true, productStatus: 'published', imagePath: null, ...over,
})
const seed = (items: CartItem[]) => localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
const setup = (settings: Partial<StoreSettings> = {}) => { h.settings = { ...baseSettings, ...settings }; h.fail = false }

describe('sacola', () => {
  beforeEach(() => setup())

  it('sacola vazia mostra estado vazio', async () => {
    h.fresh = []
    renderPage(<CartPage />)
    expect(await screen.findByText('Sua sacola está vazia')).toBeInTheDocument()
  })

  it('calcula subtotal e total em R$ e libera a finalização quando tudo confere', async () => {
    seed([item(), item({ variantId: 'v2', name: 'Regata', unitPrice: 49.9, quantity: 1, color: null, size: 'M' })])
    h.fresh = [fresh(), fresh({ variantId: 'v2', productName: 'Regata', price: 49.9, color: null, size: 'M' })]
    renderPage(<CartPage />)
    expect(await screen.findByText('R$ 249,90')).toBeInTheDocument() // 2*100 + 49,90
    const finish = await screen.findByRole('link', { name: /Finalizar pelo WhatsApp/ })
    expect(finish).toHaveAttribute('href', '/finalizar')
  })

  it('preço alterado exige aceitar o novo valor antes de finalizar', async () => {
    seed([item()])
    h.fresh = [fresh({ price: 120 })]
    renderPage(<CartPage />)
    expect(await screen.findByText(/O preço mudou de R\$ 100,00 para/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' })).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Aceitar novo preço' }))
    expect(await screen.findByRole('link', { name: /Finalizar pelo WhatsApp/ })).toBeInTheDocument()
    expect(screen.getAllByText('R$ 240,00').length).toBeGreaterThan(0) // subtotal e total
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) as string)[0].unitPrice).toBe(120)
  })

  it('item removido do catálogo ou indisponível bloqueia até ser removido da sacola', async () => {
    seed([item(), item({ variantId: 'gone', name: 'Saia' })])
    h.fresh = [fresh({ variantAvailable: false })] // v1 indisponível; "gone" sumiu
    renderPage(<CartPage />)
    expect(await screen.findByText(/saiu do catálogo/)).toBeInTheDocument()
    expect(screen.getByText(/opção está indisponível/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' })).toBeDisabled()
    for (const b of screen.getAllByRole('button', { name: 'Remover da sacola' })) await userEvent.setup().click(b)
    expect(await screen.findByText('Sua sacola está vazia')).toBeInTheDocument()
  })

  it('quantidade nunca fica abaixo de 1', async () => {
    seed([item({ quantity: 1 })])
    h.fresh = [fresh()]
    renderPage(<CartPage />)
    expect(await screen.findByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled()
  })

  it('falha de rede na conferência bloqueia a finalização e oferece tentar de novo', async () => {
    seed([item()])
    h.fresh = []
    h.fail = true
    renderPage(<CartPage />)
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar pelo WhatsApp' })).toBeDisabled()
    h.fail = false
    h.fresh = [fresh()]
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('link', { name: /Finalizar pelo WhatsApp/ })).toBeInTheDocument()
  })
})

describe('finalização (WhatsApp)', () => {
  beforeEach(() => setup())
  const fill = async (user: ReturnType<typeof userEvent.setup>, v: { name?: string; city?: string; address?: string } = {}) => {
    await user.type(await screen.findByLabelText(/^Nome/), v.name ?? 'Maria José')
    await user.type(screen.getByLabelText(/^Cidade/), v.city ?? 'Caruaru')
    if (v.address) await user.type(screen.getByLabelText(/^Endereço/), v.address)
  }

  it('carrinho vazio não permite finalizar', async () => {
    renderPage(<CheckoutPage />)
    expect(await screen.findByText('Sua sacola está vazia')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar pedido' })).not.toBeInTheDocument()
  })

  it('valida campos obrigatórios e exige endereço só na entrega', async () => {
    seed([item()]); h.fresh = [fresh()]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup()
    const submit = await screen.findByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua cidade.')).toBeInTheDocument()
    expect(screen.getByText(/Informe o endereço para entrega/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Retirada/ }))
    expect(screen.queryByLabelText(/^Endereço/)).not.toBeInTheDocument()
  })

  it('monta a revisão com todos os dados, link wa.me codificado e aviso de que ainda não foi enviado', async () => {
    seed([item(), item({ variantId: 'v2', name: 'Regata', code: null, color: null, size: 'M', unitPrice: 49.9, quantity: 1 })])
    h.fresh = [fresh(), fresh({ variantId: 'v2', productName: 'Regata', price: 49.9, color: null, size: 'M', code: null })]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup()
    await fill(user, { address: 'Rua das Flores, 10 - Centro' })
    const submit = screen.getByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    expect(await screen.findByText('Seu pedido ainda não foi enviado')).toBeInTheDocument()
    const preview = screen.getByLabelText('Mensagem do pedido')
    expect(preview.textContent).toContain('Nome: Maria José')
    expect(preview.textContent).toContain('1. Blusa Açaí')
    expect(preview.textContent).toContain('Código: BL-1')
    expect(preview.textContent).toContain('Subtotal: R$ 200,00')
    expect(preview.textContent).toContain('2. Regata')
    expect(preview.textContent).toContain('Total dos produtos: R$ 249,90')
    expect(preview.textContent).toContain('Frete: a confirmar.')

    const open = screen.getByRole('link', { name: /Abrir WhatsApp/ })
    const href = open.getAttribute('href') as string
    expect(href.startsWith('https://wa.me/5581999999999?text=')).toBe(true)
    expect(decodeURIComponent(href.split('?text=')[1])).toBe(preview.textContent)
    expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'))
    // abrir o link NÃO esvazia a sacola nem declara envio
    await user.click(open)
    expect(await screen.findByText('Falta só enviar a mensagem')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) as string)).toHaveLength(2)
    expect(screen.queryByText(/pedido enviado|enviado com sucesso/i)).not.toBeInTheDocument()
  })

  it('re-confere preços ao revisar: se mudou, bloqueia e não gera mensagem', async () => {
    seed([item()]); h.fresh = [fresh()]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup()
    await fill(user, { address: 'Rua das Flores, 10' })
    const submit = screen.getByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    h.fresh = [fresh({ price: 130 })] // preço mudou entre a abertura e o clique
    await user.click(submit)
    expect(await screen.findByText(/Algum item da sacola mudou/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Mensagem do pedido')).not.toBeInTheDocument()
  })

  it('número de WhatsApp ausente informa a pendência, sem URL, e ainda permite copiar', async () => {
    setup({ whatsapp_number: null })
    seed([item()]); h.fresh = [fresh()]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup() // instala o clipboard de teste; o espião vem depois
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    expect(await screen.findByText('WhatsApp da loja ainda não configurado')).toBeInTheDocument()
    await fill(user, { address: 'Rua das Flores, 10' })
    const submit = screen.getByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(await screen.findByText('Não foi possível abrir o WhatsApp')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir WhatsApp/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Copiar pedido/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('Blusa Açaí')
  })

  it('número inválido também não gera URL', async () => {
    setup({ whatsapp_number: '123' })
    seed([item()]); h.fresh = [fresh()]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup()
    await fill(user, { address: 'Rua das Flores, 10' })
    const submit = await screen.findByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    const alert = await screen.findByText('Não foi possível abrir o WhatsApp')
    expect(within(alert.closest('[role="alert"]') as HTMLElement).getByText(/inválido/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir WhatsApp/ })).not.toBeInTheDocument()
  })

  it('retirada não inclui endereço nem frete na mensagem', async () => {
    seed([item()]); h.fresh = [fresh()]
    renderPage(<CheckoutPage />)
    const user = userEvent.setup()
    await fill(user)
    await user.click(screen.getByRole('radio', { name: /Retirada/ }))
    const submit = screen.getByRole('button', { name: 'Revisar pedido' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    const preview = await screen.findByLabelText('Mensagem do pedido')
    expect(preview.textContent).toContain('Recebimento: Retirada')
    expect(preview.textContent).not.toContain('Endereço:')
  })
})
