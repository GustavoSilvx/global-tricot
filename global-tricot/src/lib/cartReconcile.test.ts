import type { CartItem } from './cart'
import { hasBlockingIssues, reconcileCart, type FreshVariant } from './cartReconcile'

const item = (over: Partial<CartItem> = {}): CartItem => ({
  variantId: 'v1', productId: 'p1', slug: 'blusa', name: 'Blusa', code: null,
  color: 'Rosa', size: 'P', unitPrice: 100, quantity: 2, imagePath: null, ...over,
})
const fresh = (over: Partial<FreshVariant> = {}): FreshVariant => ({
  variantId: 'v1', productId: 'p1', productName: 'Blusa', slug: 'blusa', code: null,
  color: 'Rosa', size: 'P', price: 100, promotionalPrice: null, availability: 'available',
  trackStock: false, stockQuantity: null, variantAvailable: true, productStatus: 'published',
  imagePath: null, ...over,
})

describe('reconcileCart', () => {
  it('item igual ao banco não tem problema', () => {
    const [line] = reconcileCart([item()], [fresh()])
    expect(line.issue).toBeUndefined()
    expect(hasBlockingIssues([line])).toBe(false)
  })
  it('produto removido/despublicado/arquivado => removed', () => {
    expect(reconcileCart([item()], [])[0].issue).toBe('removed')
    expect(reconcileCart([item()], [fresh({ productStatus: 'archived' })])[0].issue).toBe('removed')
    expect(reconcileCart([item()], [fresh({ productStatus: 'draft' })])[0].issue).toBe('removed')
  })
  it('produto ou variante indisponível => unavailable', () => {
    expect(reconcileCart([item()], [fresh({ availability: 'unavailable' })])[0].issue).toBe('unavailable')
    expect(reconcileCart([item()], [fresh({ variantAvailable: false })])[0].issue).toBe('unavailable')
  })
  it('estoque controlado: zerado => unavailable; menor que a quantidade => over_stock', () => {
    expect(reconcileCart([item()], [fresh({ trackStock: true, stockQuantity: 0 })])[0].issue).toBe('unavailable')
    const [line] = reconcileCart([item({ quantity: 5 })], [fresh({ trackStock: true, stockQuantity: 3 })])
    expect(line.issue).toBe('over_stock')
    expect(line.maxQuantity).toBe(3)
  })
  it('preço alterado => price_changed com o preço atual', () => {
    const [line] = reconcileCart([item()], [fresh({ price: 120 })])
    expect(line.issue).toBe('price_changed')
    expect(line.currentPrice).toBe(120)
  })
  it('promoção ativa passa a valer como preço atual', () => {
    const [line] = reconcileCart([item()], [fresh({ price: 100, promotionalPrice: 80 })])
    expect(line.issue).toBe('price_changed')
    expect(line.currentPrice).toBe(80)
  })
  it('sem estoque controlado, não promete quantidade: aceita qualquer quantidade válida', () => {
    expect(reconcileCart([item({ quantity: 20 })], [fresh({ stockQuantity: 1 })])[0].issue).toBeUndefined()
  })
})
