import { requireSupabase, STORAGE_BUCKET } from '../lib/supabase'
import { extensionForMime, prepareImageForUpload } from '../lib/images'

/** Reduz a imagem, envia ao bucket "catalog" e devolve o caminho salvo. */
export async function uploadImage(scope: 'products' | 'store' | 'categories', ownerId: string, file: File): Promise<string> {
  const sb = requireSupabase()
  const prepared = await prepareImageForUpload(file)
  const path = `${scope}/${ownerId}/${crypto.randomUUID()}.${extensionForMime(prepared.type)}`
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, prepared, {
    cacheControl: '31536000',
    contentType: prepared.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

/** Remoção de arquivos é "melhor esforço": falhar aqui não deve desfazer o que já foi salvo. */
export async function removeImages(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return
  try {
    await requireSupabase().storage.from(STORAGE_BUCKET).remove(unique)
  } catch {
    /* arquivos órfãos não afetam a loja */
  }
}
