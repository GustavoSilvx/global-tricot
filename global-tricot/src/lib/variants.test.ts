import { makeProduct, makeVariant } from '../test/fixtures'
import { distinctColors, distinctSizes, findVariant, isVariantPurchasable, maxQuantityFor, variantLabel } from './variants'

describe('variantes', () => {
  const p = { availability: 'available' as const, track_stock: false }
  it('compra bloqueada quando produto ou variante está indisponível', () => {
    expect(isVariantPurchasable(p, makeVariant())).toBe(true)
    expect(isVariantPurchasable({ ...p, availability: 'unavailable' }, makeVariant())).toBe(false)
    expect(isVariantPurchasable(p, makeVariant({ available: false }))).toBe(false)
  })
  it('estoque controlado limita a quantidade; sem controle usa o máximo padrão', () => {
    const tracked = { ...p, track_stock: true }
    expect(isVariantPurchasable(tracked, makeVariant({ stock_quantity: 0 }))).toBe(false)
    expect(maxQuantityFor(tracked, makeVariant({ stock_quantity: 3 }))).toBe(3)
    expect(maxQuantityFor(p, makeVariant({ stock_quantity: 1 }))).toBe(20)
  })
  it('cada produto tem suas próprias cores e tamanhos (sem presumir iguais)', () => {
    const x = makeProduct({ product_variants: [makeVariant({ color: 'Rosa', size: 'P' }), makeVariant({ color: 'rosa', size: 'M' }), makeVariant({ color: 'Azul', size: 'P', color_hex: '#0000ff' })] })
    expect(distinctColors(x.product_variants).map((c) => c.name)).toEqual(['Rosa', 'Azul'])
    expect(distinctColors(x.product_variants)[1].hex).toBe('#0000ff')
    expect(distinctSizes(x.product_variants)).toEqual(['P', 'M'])
  })
  it('acha a combinação exata e rotula peça única', () => {
    const vs = [makeVariant({ color: 'Rosa', size: 'P' }), makeVariant({ color: 'Rosa', size: 'M' })]
    expect(findVariant(vs, 'rosa', 'm')?.size).toBe('M')
    expect(findVariant(vs, 'Rosa', 'G')).toBeUndefined()
    expect(variantLabel({ color: null, size: null })).toBe('Peça única')
  })
})
