import { useCallback, useEffect, useState } from 'react'
import type { ProductWithRelations } from '../types/db'
import { isSupabaseConfigured } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { fetchPublishedProducts } from '../services/catalog'

const STALE_MS = 5 * 60 * 1000
let cache: { data: ProductWithRelations[]; at: number } | null = null
let inflight: Promise<ProductWithRelations[]> | null = null

async function load(force: boolean): Promise<ProductWithRelations[]> {
  if (!force && cache && Date.now() - cache.at < STALE_MS) return cache.data
  if (!inflight) {
    inflight = fetchPublishedProducts()
      .then((data) => {
        cache = { data, at: Date.now() }
        return data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Só para testes: limpa o cache em memória. */
export function resetCatalogCache(): void {
  cache = null
  inflight = null
}

export type CatalogStatus = 'loading' | 'ready' | 'error' | 'unconfigured'

/** Produtos publicados, vindos do Supabase (nunca de arquivo local nem de dados de exemplo). */
export function useCatalog() {
  const [products, setProducts] = useState<ProductWithRelations[]>(cache?.data ?? [])
  const [status, setStatus] = useState<CatalogStatus>(
    !isSupabaseConfigured ? 'unconfigured' : cache ? 'ready' : 'loading',
  )
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (force: boolean) => {
    if (!isSupabaseConfigured) return
    if (force || !cache) setStatus('loading')
    try {
      const data = await load(force)
      setProducts(data)
      setError(null)
      setStatus('ready')
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível carregar os produtos.'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void run(false)
  }, [run])

  return { products, status, error, reload: () => run(true) }
}
