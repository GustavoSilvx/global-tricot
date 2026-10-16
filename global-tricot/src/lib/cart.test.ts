import {
  addToCart,
  cartTotalCents,
  cartUnits,
  clampQuantity,
  parseStoredCart,
  removeFromCart,
  setQuantity,
  setUnitPrice,
  type CartItem,
} from './cart'

const item = (over: Partial<CartItem> = {}): CartItem => ({
  variantId: 'v1',
  productId: 'p1',
  slug: 'blusa',
  name: 'Blusa',
  code: null,
  color: 'Rosa',
  size: 'P',
  unitPrice: 89.9,
  quantity: 1,
  imagePath: null,
  ...over,
})

describe('carrinho', () => {
  it('trata cada variante como item distinto', () => {
    let cart = addToCart([], item({ variantId: 'v-P', size: 'P', quantity: 2 }))
    cart = addToCart(cart, item({ variantId: 'v-M', size: 'M', quantity: 1 }))
    expect(cart).toHaveLength(2)
    expect(cartUnits(cart)).toBe(3)
  })

  it('soma a quantidade quando a mesma variante é adicionada de novo', () => {
    let cart = addToCart([], item({ quantity: 2 }))
    cart = addToCart(cart, item({ quantity: 3 }))
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(5)
  })

  it('nunca aceita quantidade inválida ou negativa', () => {
    expect(clampQuantity(-3)).toBe(1)
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(2.7)).toBe(2)
    expect(clampQuantity(NaN)).toBe(1)
    expect(clampQuantity(999)).toBe(20)
    expect(setQuantity([item()], 'v1', -10)[0].quantity).toBe(1)
  })

  it('altera quantidade, preço e remove itens', () => {
    const cart = [item(), item({ variantId: 'v2' })]
    expect(setQuantity(cart, 'v2', 4)[1].quantity).toBe(4)
    expect(setUnitPrice(cart, 'v1', 79.9)[0].unitPrice).toBe(79.9)
    expect(removeFromCart(cart, 'v1').map((i) => i.variantId)).toEqual(['v2'])
  })

  it('calcula o total em centavos sem erro de arredondamento', () => {
    const cart = [item({ unitPrice: 19.99, quantity: 3 }), item({ variantId: 'v2', unitPrice: 0.1, quantity: 3 })]
    expect(cartTotalCents(cart)).toBe(1999 * 3 + 10 * 3)
  })
})

describe('parseStoredCart (localStorage)', () => {
  it('lê um carrinho válido', () => {
    expect(parseStoredCart(JSON.stringify([item()]))).toHaveLength(1)
  })
  it('ignora JSON corrompido, formato errado e vazio', () => {
    expect(parseStoredCart('{nao é json')).toEqual([])
    expect(parseStoredCart('{"a":1}')).toEqual([])
    expect(parseStoredCart(null)).toEqual([])
  })
  it('descarta itens adulterados (preço negativo, quantidade absurda) e duplicados', () => {
    const raw = JSON.stringify([
      item({ variantId: 'ok' }),
      item({ variantId: 'neg', unitPrice: -5 }),
      item({ variantId: 'qty', quantity: 500 }),
      item({ variantId: 'ok' }),
      { lixo: true },
    ])
    expect(parseStoredCart(raw).map((i) => i.variantId)).toEqual(['ok'])
  })
})
