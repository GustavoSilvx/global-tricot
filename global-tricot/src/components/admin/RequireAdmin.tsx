import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useToast } from '../../context/ToastContext'
import { Button, LinkButton } from '../ui/Button'
import { Alert, EmptyState, Spinner } from '../ui/Feedback'

/**
 * Guarda de rota do painel. Importante: isto é só experiência de uso.
 * A segurança real está no banco (RLS + admin_users) e no Storage.
 */
export default function RequireAdmin() {
  const { loading, user, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const toast = useToast()

  if (!isSupabaseConfigured) {
    return (
      <div className="shell py-16">
        <Alert tone="warning" title="Supabase não configurado">
          Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (veja <code>docs/SETUP.md</code>) para usar o painel.
        </Alert>
      </div>
    )
  }
  if (loading) return <Spinner label="Verificando acesso" className="min-h-screen" />
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) {
    return (
      <div className="shell py-16">
        <EmptyState
          title="Acesso não autorizado"
          action={
            <>
              <Button onClick={() => signOut().catch((e) => toast.error(friendlyError(e)))}>Sair</Button>
              <LinkButton to="/" variant="secondary">Voltar à loja</LinkButton>
            </>
          }
        >
          <LockKeyhole className="mx-auto mb-3 h-8 w-8 text-ink-mute" aria-hidden />
          A conta <strong>{user.email}</strong> não tem permissão de administrador. Peça a quem configurou o sistema para autorizar este usuário (veja <code>docs/SETUP.md</code>).
        </EmptyState>
      </div>
    )
  }
  return <Outlet />
}
