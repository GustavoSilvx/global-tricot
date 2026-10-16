import { requireSupabase } from '../lib/supabase'
import type { StoreSettings } from '../types/db'

export async function fetchStoreSettings(): Promise<StoreSettings | null> {
  const { data, error } = await requireSupabase().from('store_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return (data as StoreSettings | null) ?? null
}

export type SettingsPatch = Partial<Omit<StoreSettings, 'id' | 'updated_at'>>

export async function saveStoreSettings(patch: SettingsPatch): Promise<StoreSettings> {
  const { data, error } = await requireSupabase()
    .from('store_settings')
    .upsert({ id: 1, ...patch }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return data as StoreSettings
}
