export type WhatsAppParse = { ok: true; value: string } | { ok: false; reason: string }

/**
 * Normaliza um número de WhatsApp brasileiro para somente dígitos com DDI (55).
 * Aceita "(81) 99999-9999", "+55 81 99999-9999", "5581999999999", etc.
 * Remove espaços, parênteses, sinais e traços.
 */
export function normalizeWhatsApp(input: string | null | undefined): WhatsAppParse {
  const digits = (input ?? '').replace(/\D/g, '')
  if (!digits) return { ok: false, reason: 'Informe o número com DDD.' }

  let national: string
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return { ok: false, reason: 'O número deve ser brasileiro (começar com 55 ou DDD).' }
    national = digits.slice(2)
  } else if (digits.length === 10 || digits.length === 11) {
    national = digits
  } else {
    return { ok: false, reason: 'Número incompleto. Use DDD + número, por exemplo (81) 99999-9999.' }
  }

  if (!/^[1-9][1-9]/.test(national)) return { ok: false, reason: 'DDD inválido.' }
  if (national.length === 11 && national[2] !== '9') {
    return { ok: false, reason: 'Celulares têm 9 dígitos e começam com 9 depois do DDD.' }
  }
  return { ok: true, value: `55${national}` }
}

export function isValidWhatsApp(input: string | null | undefined): boolean {
  return normalizeWhatsApp(input).ok
}

/** 5581999999999 -> (81) 99999-9999 */
export function formatWhatsApp(value: string | null | undefined): string {
  const r = normalizeWhatsApp(value)
  if (!r.ok) return value ?? ''
  const n = r.value.slice(2)
  const ddd = n.slice(0, 2)
  const rest = n.slice(2)
  const cut = rest.length === 9 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, cut)}-${rest.slice(cut)}`
}
