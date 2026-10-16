import { formatBRL, parseMoneyInput, normalizeText, toCents } from './format'

describe('formatBRL', () => {
  it('usa o padrão monetário brasileiro com espaço comum', () => {
    expect(formatBRL(89.9)).toBe('R$ 89,90')
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatBRL(89.9)).not.toContain('\u00a0')
  })
  it('converte para centavos sem erro de ponto flutuante', () => {
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})

describe('parseMoneyInput', () => {
  it.each([
    ['89,90', 89.9],
    ['1.234,56', 1234.56],
    ['R$ 89,90', 89.9],
    ['89.90', 89.9],
    ['120', 120],
    ['1.234', 1234],
    ['0,5', 0.5],
  ])('lê %s', (input, expected) => expect(parseMoneyInput(input)).toBe(expected))

  it.each(['', 'abc', '-5', '12,345', '1,2,3', 'R$'])('rejeita %j', (input) =>
    expect(parseMoneyInput(input)).toBeNull(),
  )
})

describe('normalizeText', () => {
  it('ignora acentos e caixa', () => {
    expect(normalizeText('TRICÔ Básico')).toBe('trico basico')
  })
})
