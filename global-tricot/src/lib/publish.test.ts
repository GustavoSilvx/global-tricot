import { getBlockingErrors, getPublishIssues } from './publish'

const ready = { name: 'Blusa', price: 89.9, promotionalPrice: null, categoryId: 'c1', imageCount: 1, variantCount: 1, trackStock: false, stockMissing: false }

describe('regras de publicação', () => {
  it('produto completo está pronto', () => expect(getPublishIssues(ready)).toEqual([]))
  it('lista tudo o que falta', () => {
    const issues = getPublishIssues({ ...ready, name: '', price: null, categoryId: null, imageCount: 0, variantCount: 0 })
    expect(issues).toHaveLength(5)
  })
  it('preço zero ou negativo não publica', () => {
    expect(getPublishIssues({ ...ready, price: 0 })).toHaveLength(1)
    expect(getPublishIssues({ ...ready, price: -1 })).toHaveLength(1)
  })
  it('estoque controlado exige quantidade em todas as opções', () => {
    expect(getPublishIssues({ ...ready, trackStock: true, stockMissing: true })).toHaveLength(1)
    expect(getPublishIssues({ ...ready, trackStock: false, stockMissing: true })).toEqual([])
  })
  it('rascunho só exige nome e promoção coerente', () => {
    expect(getBlockingErrors({ name: 'Blusa', price: null, promotionalPrice: null })).toEqual([])
    expect(getBlockingErrors({ name: ' ', price: null, promotionalPrice: null })).toHaveLength(1)
    expect(getBlockingErrors({ name: 'x', price: 50, promotionalPrice: 50 })).toHaveLength(1)
  })
})
