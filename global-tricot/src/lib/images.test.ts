import { buildStoragePath, extensionForMime, validateImageFile } from './images'

describe('imagens', () => {
  it('aceita só JPG, PNG e WebP', () => {
    expect(validateImageFile({ type: 'image/webp', size: 1000 })).toBeNull()
    expect(validateImageFile({ type: 'image/gif', size: 1000 })).toMatch(/Tipo de arquivo/)
    expect(validateImageFile({ type: 'application/pdf', size: 1000 })).not.toBeNull()
  })
  it('rejeita vazio e gigante', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 })).not.toBeNull()
    expect(validateImageFile({ type: 'image/png', size: 16 * 1024 * 1024 })).toMatch(/muito grande/)
  })
  it('monta caminhos previsíveis', () => {
    expect(buildStoragePath('products', 'abc', 'u1', extensionForMime('image/webp'))).toBe('products/abc/u1.webp')
    expect(extensionForMime('image/jpeg')).toBe('jpg')
  })
})
