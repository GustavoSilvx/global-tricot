import { formatWhatsApp, isValidWhatsApp, normalizeWhatsApp } from './phone'

describe('normalizeWhatsApp', () => {
  it.each([
    ['(81) 99999-9999', '5581999999999'],
    ['+55 81 99999-9999', '5581999999999'],
    ['5581999999999', '5581999999999'],
    ['81 9999-9999', null], // 10 dígitos: fixo/antigo, aceito abaixo
    ['55 (81) 3333-4444', '558133334444'],
  ])('normaliza %s', (input, expected) => {
    const r = normalizeWhatsApp(input)
    if (expected === null) {
      // 10 dígitos com DDD válido é aceito e recebe o DDI 55
      expect(r).toEqual({ ok: true, value: '558199999999' })
    } else {
      expect(r).toEqual({ ok: true, value: expected })
    }
  })

  it('remove espaços, parênteses, sinais e traços', () => {
    expect(normalizeWhatsApp(' +55 (81) 9 9999-9999 ')).toEqual({ ok: true, value: '5581999999999' })
  })

  it.each(['', '   ', '123', '55', '0199999999', '5581888888888888', '81 88888-8888', 'abc'])(
    'rejeita %j',
    (input) => {
      expect(isValidWhatsApp(input)).toBe(false)
    },
  )

  it('trata ausente (null/undefined) como inválido', () => {
    expect(normalizeWhatsApp(null).ok).toBe(false)
    expect(normalizeWhatsApp(undefined).ok).toBe(false)
  })

  it('formata para exibição', () => {
    expect(formatWhatsApp('5581999999999')).toBe('(81) 99999-9999')
    expect(formatWhatsApp('558133334444')).toBe('(81) 3333-4444')
  })
})
