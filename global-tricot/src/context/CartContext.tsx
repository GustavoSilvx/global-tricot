import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addToCart, CART_STORAGE_KEY, cartTotalCents, cartUnits, parseStoredCart, removeFromCart, setQuantity, setUnitPrice,
  type CartItem,
} from '../lib/cart'

interface CartApi {
  items: CartItem[]
  units: number
  totalCents: number
  add: (item: CartItem) => void
  setQty: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  /** Cliente confirmou o novo preço de um item. */
  acceptPrice: (variantId: string, price: number) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

function readStorage(): CartItem[] {
  try {
    return parseStoredCart(localStorage.getItem(CART_STORAGE_KEY))
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStorage)

  // O carrinho fica só neste dispositivo (localStorage); não é banco compartilhado.
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* armazenamento cheio ou bloqueado: o carrinho segue funcionando na sessão */
    }
  }, [items])

  // Mantém várias abas do mesmo navegador em sincronia.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setItems(parseStoredCart(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((item: CartItem) => setItems((cur) => addToCart(cur, item)), [])
  const setQty = useCallback((id: string, q: number) => setItems((cur) => setQuantity(cur, id, q)), [])
  const remove = useCallback((id: string) => setItems((cur) => removeFromCart(cur, id)), [])
  const acceptPrice = useCallback((id: string, price: number) => setItems((cur) => setUnitPrice(cur, id, price)), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartApi>(
    () => ({ items, units: cartUnits(items), totalCents: cartTotalCents(items), add, setQty, remove, acceptPrice, clear }),
    [items, add, setQty, remove, acceptPrice, clear],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>')
  return ctx
}
