import { isValidSlug, slugify } from './slug'

describe('slugify', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Cropped Tricô Básico (Verão!)')).toBe('cropped-trico-basico-verao')
  })
  it('gera slugs válidos para o banco', () => {
    expect(isValidSlug(slugify('  Saia   Listrada  '))).toBe(true)
    expect(isValidSlug(slugify('---'))).toBe(false)
  })
  it('limita o tamanho', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80)
  })
})
