import { makeProduct, makeVariant } from '../test/fixtures'
import { buildCartItem } from './cartFromProduct'
import { imageForColor } from './productImages'

describe('buildCartItem', () => {
  it('usa o preço promocional válido e a foto da cor', () => {
    const v = makeVariant({ color: 'Azul', size: 'M' })
    const p = makeProduct({
      price: 100, promotional_price: 80, code: 'B1', main_image_path: 'products/x/main.webp', product_variants: [v],
      product_images: [
        { id: 'i1', product_id: 'p', storage_path: 'products/x/main.webp', alt_text: null, position: 0, is_main: true, color_variant: null },
        { id: 'i2', product_id: 'p', storage_path: 'products/x/azul.webp', alt_text: null, position: 1, is_main: false, color_variant: 'azul' },
      ],
    })
    const item = buildCartItem(p, v, 2)
    expect(item).toMatchObject({ unitPrice: 80, quantity: 2, code: 'B1', color: 'Azul', size: 'M', imagePath: 'products/x/azul.webp' })
  })
  it('recusa variante indisponível, produto sem preço e limita ao estoque', () => {
    const v = makeVariant({ available: false })
    expect(buildCartItem(makeProduct({ product_variants: [v] }), v, 1)).toBeNull()
    const v2 = makeVariant()
    expect(buildCartItem(makeProduct({ price: null, product_variants: [v2] }), v2, 1)).toBeNull()
    const v3 = makeVariant({ stock_quantity: 2 })
    expect(buildCartItem(makeProduct({ track_stock: true, product_variants: [v3] }), v3, 9)?.quantity).toBe(2)
  })
  it('sem foto por cor, volta para a principal', () => {
    expect(imageForColor({ product_images: [], main_image_path: 'a.webp' }, 'Rosa')).toBe('a.webp')
  })
})
