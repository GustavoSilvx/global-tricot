import { cartTotalCents, cartUnits, itemSubtotalCents, type CartItem } from './cart'
import { formatBRL, fromCents } from './format'
import { normalizeWhatsApp } from './phone'

export type FulfillmentMethod = 'delivery' | 'pickup'

export interface CustomerData {
  name: string
  city: string
  method: FulfillmentMethod
  /** Obrigatório somente quando method === 'delivery'. */
  address?: string
  reference?: string
  notes?: string
}

export interface MessageOptions {
  storeName: string
  greeting?: string | null
  closing?: string | null
}

export const DEFAULT_CLOSING =
  'Poderiam confirmar a disponibilidade das peças, o valor do frete e as formas de pagamento disponíveis?\n\nObrigado(a)!'

const clean = (s: string | undefined | null): string => (s ?? '').replace(/\s+/g, ' ').trim()

/** Monta o texto do pedido. Todos os dados vêm do carrinho e do formulário. */
export function buildOrderMessage(items: CartItem[], customer: CustomerData, opts: MessageOptions): string {
  const delivery = customer.method === 'delivery'
  const lines: string[] = []

  lines.push(clean(opts.greeting) || `Olá, ${opts.storeName}! Gostaria de fazer um pedido.`)
  lines.push('')
  lines.push('DADOS DO CLIENTE')
  lines.push(`Nome: ${clean(customer.name)}`)
  lines.push(`Cidade: ${clean(customer.city)}`)
  lines.push(`Recebimento: ${delivery ? 'Entrega' : 'Retirada'}`)
  if (delivery && clean(customer.address)) lines.push(`Endereço: ${clean(customer.address)}`)
  if (delivery && clean(customer.reference)) lines.push(`Complemento/Referência: ${clean(customer.reference)}`)
  if (clean(customer.notes)) lines.push(`Observações: ${clean(customer.notes)}`)
  lines.push('')
  lines.push('MEU PEDIDO')
  lines.push('')

  items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name}`)
    if (item.code) lines.push(`Código: ${item.code}`)
    if (item.color) lines.push(`Cor: ${item.color}`)
    if (item.size) lines.push(`Tamanho: ${item.size}`)
    lines.push(`Quantidade: ${item.quantity}`)
    lines.push(`Preço unitário: ${formatBRL(item.unitPrice)}`)
    lines.push(`Subtotal: ${formatBRL(fromCents(itemSubtotalCents(item)))}`)
    lines.push('')
  })

  lines.push('RESUMO')
  lines.push(`Quantidade total de unidades: ${cartUnits(items)}`)
  lines.push(`Total dos produtos: ${formatBRL(fromCents(cartTotalCents(items)))}`)
  if (delivery) {
    lines.push('Frete: a confirmar.')
    lines.push('Valor final com entrega: a confirmar pela loja.')
  } else {
    lines.push('Retirada: sem frete.')
  }
  lines.push('')
  lines.push(clean(opts.closing) ? (opts.closing as string).trim() : DEFAULT_CLOSING)

  return lines.join('\n')
}

/** Acima disso alguns navegadores/apps podem truncar o link: sugerimos copiar o pedido. */
export const WHATSAPP_URL_SOFT_LIMIT = 6000

export type WhatsAppUrlResult =
  | { ok: true; url: string; tooLong: boolean }
  | { ok: false; reason: string }

export function buildWhatsAppUrl(rawNumber: string | null | undefined, message: string): WhatsAppUrlResult {
  const parsed = normalizeWhatsApp(rawNumber)
  if (!parsed.ok) {
    return {
      ok: false,
      reason: rawNumber
        ? `O número de WhatsApp da loja está inválido. ${parsed.reason}`
        : 'O número de WhatsApp da loja ainda não foi configurado.',
    }
  }
  const url = `https://wa.me/${parsed.value}?text=${encodeURIComponent(message)}`
  return { ok: true, url, tooLong: url.length > WHATSAPP_URL_SOFT_LIMIT }
}

export function buildProductInquiryMessage(storeName: string, productName: string, code?: string | null): string {
  const ref = code ? ` (código ${code})` : ''
  return `Olá, ${storeName}! Tenho interesse na peça "${productName}"${ref}. Ela está disponível?`
}
