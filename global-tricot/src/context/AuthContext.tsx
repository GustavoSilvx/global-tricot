import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase'

interface AuthApi {
  loading: boolean
  user: User | null
  /** Confirmado no banco (tabela admin_users), não apenas no navegador. */
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

async function checkAdmin(userId: string): Promise<boolean> {
  // O RLS só deixa o usuário enxergar a própria linha em admin_users.
  const { data, error } = await requireSupabase().from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
  return !error && Boolean(data)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true

    const apply = async (s: Session | null) => {
      if (!active) return
      setSession(s)
      setIsAdmin(s ? await checkAdmin(s.user.id) : false)
      if (active) setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Não faça chamadas ao Supabase dentro do callback: adiamos para o próximo ciclo.
      setTimeout(() => void apply(s), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
    setIsAdmin(false)
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${base}/admin/redefinir-senha`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireSupabase().auth.updateUser({ password })
    if (error) throw error
  }, [])

  const value = useMemo<AuthApi>(
    () => ({ loading, user: session?.user ?? null, isAdmin, signIn, signOut, sendPasswordReset, updatePassword }),
    [loading, session, isAdmin, signIn, signOut, sendPasswordReset, updatePassword],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
