import { useCallback, useEffect, useRef, useState } from 'react'
import type { CartItem } from '../lib/cart'
import { reconcileCart, type CartLine } from '../lib/cartReconcile'
import { friendlyError } from '../lib/errors'
import { isSupabaseConfigured } from '../lib/supabase'
import { fetchFreshVariants } from '../services/catalog'

export type ValidationStatus = 'idle' | 'checking' | 'done' | 'error'

/**
 * Confere o carrinho com os dados ATUAIS do banco (preço, estoque, disponibilidade).
 * Nunca confia no preço salvo no navegador.
 */
export function useCartValidation(items: CartItem[]) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [status, setStatus] = useState<ValidationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const key = items.map((i) => `${i.variantId}:${i.quantity}:${i.unitPrice}`).join('|')

  const revalidate = useCallback(async (): Promise<CartLine[] | null> => {
    const current = itemsRef.current
    if (!current.length) {
      setLines([])
      setStatus('done')
      return []
    }
    if (!isSupabaseConfigured) {
      setStatus('error')
      setError('Não foi possível confirmar os preços porque a loja ainda não está conectada ao banco de dados.')
      return null
    }
    setStatus('checking')
    try {
      const fresh = await fetchFreshVariants(current.map((i) => i.variantId))
      const result = reconcileCart(current, fresh)
      setLines(result)
      setError(null)
      setStatus('done')
      return result
    } catch (e) {
      setError(friendlyError(e, 'Não conseguimos confirmar preços e disponibilidade agora.'))
      setStatus('error')
      return null
    }
  }, [])

  useEffect(() => {
    void revalidate()
  }, [key, revalidate])

  return { lines, status, error, revalidate }
}
