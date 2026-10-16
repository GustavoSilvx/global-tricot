import { useEffect, useState } from 'react'
import type { Category } from '../types/db'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchActiveCategories } from '../services/categories'

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    fetchActiveCategories()
      .then((c) => alive && setCategories(c))
      .catch(() => alive && setCategories([])) // a falha de rede já é sinalizada pelo catálogo
    return () => {
      alive = false
    }
  }, [])
  return categories
}
