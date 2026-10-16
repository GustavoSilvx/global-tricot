import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { StoreSettings } from '../types/db'
import { isSupabaseConfigured } from '../lib/supabase'
import { resolveStore, type StoreInfo } from '../lib/store'
import { fetchStoreSettings } from '../services/settings'
import { friendlyError } from '../lib/errors'

interface SettingsApi {
  settings: StoreSettings | null
  store: StoreInfo
  status: 'loading' | 'ready' | 'error' | 'unconfigured'
  error: string | null
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [status, setStatus] = useState<SettingsApi['status']>(isSupabaseConfigured ? 'loading' : 'unconfigured')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      setSettings(await fetchStoreSettings())
      setError(null)
      setStatus('ready')
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível carregar as informações da loja.'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<SettingsApi>(
    () => ({ settings, store: resolveStore(settings), status, error, reload }),
    [settings, status, error, reload],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>')
  return ctx
}
