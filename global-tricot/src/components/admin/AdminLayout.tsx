import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ExternalLink, LayoutDashboard, LogOut, Package, Settings, Tags } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { friendlyError } from '../../lib/errors'
import { cx } from '../../lib/cx'

const NAV = [
  { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package, end: false },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags, end: false },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  useDocumentMeta({ title: 'Painel administrativo', noindex: true })

  const logout = async () => {
    try {
      await signOut()
      navigate('/admin/login', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível sair. Tente de novo.'))
    }
  }

  return (
    <div className="min-h-screen bg-[#F1ECEE] lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-6">
          <div>
            <p className="font-display text-xl leading-none">Global Tricot</p>
            <p className="mt-1 text-xs text-white/60">Painel administrativo</p>
          </div>
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 rounded px-3 text-sm text-white/80 hover:bg-white/10 lg:hidden" aria-label="Sair">
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
        <nav aria-label="Painel" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('inline-flex min-h-11 shrink-0 items-center gap-3 rounded px-3 text-sm font-semibold', isActive ? 'bg-brand text-white' : 'text-white/80 hover:bg-white/10')
              }
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden space-y-2 border-t border-white/10 p-4 text-sm lg:block">
          <Link to="/" target="_blank" className="inline-flex items-center gap-2 text-white/80 hover:text-white">
            <ExternalLink className="h-4 w-4" aria-hidden /> Ver a loja
          </Link>
          <p className="truncate text-xs text-white/50" title={user?.email ?? ''}>{user?.email}</p>
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-9 items-center gap-2 text-white/80 hover:text-white">
            <LogOut className="h-4 w-4" aria-hidden /> Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
