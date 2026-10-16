import type { CartItem } from './cart'
import { buildOrderMessage, buildProductInquiryMessage, buildWhatsAppUrl, DEFAULT_CLOSING } from './whatsapp'

const items: CartItem[] = [
  { variantId: 'a', productId: 'p1', slug: 'blusa-canelada', name: 'Blusa Canelada Açaí', code: 'BL-012',
    color: 'Vermelho', size: 'P', unitPrice: 89.9, quantity: 2, imagePath: null },
  { variantId: 'b', productId: 'p2', slug: 'regata', name: 'Regata Básica', code: null,
    color: null, size: 'M', unitPrice: 49.5, quantity: 1, imagePath: null },
]
const opts = { storeName: 'Global Tricot' }

describe('buildOrderMessage', () => {
  const msg = buildOrderMessage(
    items,
    { name: 'Maria José', city: 'Caruaru', method: 'delivery', address: 'Rua das Flores, 10', reference: 'Perto da praça', notes: 'Ligar antes' },
    opts,
  )

  it('contém todos os produtos com código, cor, tamanho, quantidade e valores', () => {
    expect(msg).toContain('1. Blusa Canelada Açaí')
    expect(msg).toContain('Código: BL-012')
    expect(msg).toContain('Cor: Vermelho')
    expect(msg).toContain('Tamanho: P')
    expect(msg).toContain('Quantidade: 2')
    expect(msg).toContain('Preço unitário: R$ 89,90')
    expect(msg).toContain('Subtotal: R$ 179,80')
    expect(msg).toContain('2. Regata Básica')
    expect(msg).toContain('Subtotal: R$ 49,50')
  })
  it('omite linhas de código/cor que não existem (sem itens de demonstração)', () => {
    const second = msg.split('2. Regata Básica')[1]
    expect(second).not.toContain('Código:')
    expect(second).not.toContain('Cor:')
  })
  it('traz totais corretos e frete a confirmar sem somar frete', () => {
    expect(msg).toContain('Quantidade total de unidades: 3')
    expect(msg).toContain('Total dos produtos: R$ 229,30')
    expect(msg).toContain('Frete: a confirmar.')
    expect(msg).toContain('Valor final com entrega: a confirmar pela loja.')
  })
  it('inclui dados do cliente e endereço na entrega', () => {
    expect(msg).toContain('Nome: Maria José')
    expect(msg).toContain('Recebimento: Entrega')
    expect(msg).toContain('Endereço: Rua das Flores, 10')
    expect(msg).toContain('Complemento/Referência: Perto da praça')
    expect(msg).toContain('Observações: Ligar antes')
  })
  it('na retirada não pede endereço nem frete', () => {
    const m = buildOrderMessage(items, { name: 'Ana', city: 'Toritama', method: 'pickup', address: 'ignorado' }, opts)
    expect(m).toContain('Recebimento: Retirada')
    expect(m).not.toContain('Endereço:')
    expect(m).not.toContain('Frete: a confirmar')
    expect(m).toContain('Retirada: sem frete.')
  })
  it('usa a mensagem final padrão ou a configurada na loja', () => {
    expect(msg.endsWith(DEFAULT_CLOSING)).toBe(true)
    const custom = buildOrderMessage(items, { name: 'A', city: 'B', method: 'pickup' }, { ...opts, closing: 'Aguardo retorno!', greeting: 'Oi, tudo bem?' })
    expect(custom.startsWith('Oi, tudo bem?')).toBe(true)
    expect(custom.endsWith('Aguardo retorno!')).toBe(true)
  })
})

describe('buildWhatsAppUrl', () => {
  it('gera URL oficial wa.me com mensagem codificada (acentos, quebras de linha, símbolos)', () => {
    const text = 'Olá! Pedido nº 1 — Blusa Açaí & Cia\nR$ 89,90 100%'
    const r = buildWhatsAppUrl('(81) 99999-9999', text)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.url.startsWith('https://wa.me/5581999999999?text=')).toBe(true)
      const encoded = r.url.split('?text=')[1]
      expect(decodeURIComponent(encoded)).toBe(text)
      expect(encoded).not.toMatch(/[\s&]/)
      expect(encoded).toContain('%0A')
    }
  })
  it('número ausente não gera URL e informa a pendência', () => {
    const r = buildWhatsAppUrl(null, 'x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/ainda não foi configurado/)
  })
  it('número inválido não gera URL', () => {
    const r = buildWhatsAppUrl('12345', 'x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/inválido/)
  })
  it('avisa quando a mensagem é longa demais para o link', () => {
    const r = buildWhatsAppUrl('5581999999999', 'á'.repeat(3000))
    expect(r.ok && r.tooLong).toBe(true)
  })
})

describe('buildProductInquiryMessage', () => {
  it('cita a peça e o código', () => {
    expect(buildProductInquiryMessage('Global Tricot', 'Blusa X', 'B1')).toContain('"Blusa X" (código B1)')
  })
})
