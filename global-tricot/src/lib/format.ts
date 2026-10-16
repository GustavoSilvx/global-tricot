const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formata no padrão brasileiro: R$ 89,90 (com espaço comum, seguro para mensagens). */
export function formatBRL(value: number): string {
  return brl.format(value).replace(/\u00a0/g, ' ')
}

export const toCents = (value: number): number => Math.round(value * 100)
export const fromCents = (cents: number): number => cents / 100

/**
 * Lê valores digitados em formato brasileiro ou simples:
 * "89,90", "1.234,56", "89.90", "R$ 89,90", "120". Retorna null se inválido.
 */
export function parseMoneyInput(input: string): number | null {
  let s = input.replace(/R\$/gi, '').replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Remove acentos e caixa, para busca tolerante ("tricô" encontra "trico"). */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
