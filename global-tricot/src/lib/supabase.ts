import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ConfigError } from './errors'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** Só a chave pública (anon/publishable) é usada aqui. Nunca use service_role no navegador. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new ConfigError()
  return supabase
}

export const STORAGE_BUCKET = 'catalog'

/** URL pública de uma imagem do bucket. Retorna null quando não há caminho ou Supabase. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path || !supabase) return null
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
