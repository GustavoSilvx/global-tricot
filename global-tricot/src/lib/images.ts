export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Limite do bucket no Supabase (veja migrations/0003_storage.sql). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
/** Limite do arquivo original escolhido; ele é reduzido antes do envio. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024
export const MAX_IMAGE_SIDE = 1600

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'
  }
  if (file.size > MAX_SOURCE_BYTES) return 'A imagem é muito grande (máximo 15 MB).'
  if (file.size === 0) return 'O arquivo está vazio.'
  return null
}

export function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function buildStoragePath(
  scope: 'products' | 'store' | 'categories',
  ownerId: string,
  uid: string,
  ext: string,
): string {
  return `${scope}/${ownerId}/${uid}.${ext}`
}

/**
 * Reduz a imagem para no máximo 1600 px no maior lado e converte para WebP,
 * deixando o catálogo mais leve. Se o navegador não conseguir, envia o original (se couber).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const invalid = validateImageFile(file)
  if (invalid) throw new Error(invalid)

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84))
    if (blob && blob.type === 'image/webp' && blob.size < file.size) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
    }
  } catch {
    /* segue para o arquivo original */
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Não foi possível reduzir a imagem para menos de 5 MB. Escolha uma foto menor.')
  }
  return file
}
