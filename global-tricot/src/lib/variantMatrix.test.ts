import { buildMatrix, defaultRow, hasInvalidStock, hasMissingStock, matrixToInputs, variantKey } from './variantMatrix'

describe('matriz de variantes', () => {
  it('gera todas as combinações cor x tamanho', () => {
    const m = buildMatrix([{ name: 'Rosa', hex: '#ff00aa' }, { name: 'Preto', hex: '' }], ['P', 'M', 'G'])
    expect(m).toHaveLength(6)
    expect(m[0]).toMatchObject({ color: 'Rosa', size: 'P', hex: '#ff00aa' })
    expect(m[5]).toMatchObject({ color: 'Preto', size: 'G', hex: null })
  })
  it('só tamanhos, só cores ou peça única', () => {
    expect(buildMatrix([], ['P', 'M'])).toHaveLength(2)
    expect(buildMatrix([{ name: 'Azul', hex: '' }], [])).toEqual([{ key: 'azul|', color: 'Azul', hex: null, size: null }])
    expect(buildMatrix([], [])).toEqual([{ key: '|', color: null, hex: null, size: null }])
  })
  it('chave ignora caixa e espaços', () => {
    expect(variantKey(' Rosa ', 'p')).toBe(variantKey('rosa', 'P'))
  })
  it('preserva ids e dados das linhas existentes ao converter', () => {
    const m = buildMatrix([{ name: 'Rosa', hex: '#ff00aa' }], ['P', 'M'])
    const data = { [m[0].key]: { id: 'v-1', available: false, stock: '4', sku: ' BL-1 ' } }
    const out = matrixToInputs(m, data)
    expect(out[0]).toMatchObject({ id: 'v-1', available: false, stock_quantity: 4, sku: 'BL-1', color_hex: '#ff00aa' })
    expect(out[1]).toMatchObject({ id: undefined, available: true, stock_quantity: null })
  })
  it('detecta estoque ausente e inválido', () => {
    const m = buildMatrix([], ['P', 'M'])
    expect(hasMissingStock(m, {})).toBe(true)
    // só a primeira opção tem quantidade: a segunda ainda falta
    expect(hasMissingStock(m, { [m[0].key]: { ...defaultRow(), stock: '1' } })).toBe(true)
    const full = Object.fromEntries(m.map((c) => [c.key, { ...defaultRow(), stock: '2' }]))
    expect(hasMissingStock(m, full)).toBe(false)
    expect(hasInvalidStock(m, { [m[0].key]: { ...defaultRow(), stock: '-1' } })).toBe(true)
    expect(hasInvalidStock(m, { [m[0].key]: { ...defaultRow(), stock: '1.5' } })).toBe(true)
  })
})
