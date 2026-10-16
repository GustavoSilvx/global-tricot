import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../../context/ToastContext'

const auth = vi.hoisted(() => ({ value: { loading: false, user: null as unknown, isAdmin: false, signOut: async () => undefined } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }))
vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))

import RequireAdmin from './RequireAdmin'

const open = () =>
  render(
    <MemoryRouter initialEntries={['/admin/produtos']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/login" element={<p>tela de login</p>} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin/produtos" element={<p>área restrita</p>} />
          </Route>
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('proteção das rotas do painel', () => {
  it('sem sessão redireciona para o login', () => {
    auth.value = { ...auth.value, loading: false, user: null, isAdmin: false }
    open()
    expect(screen.getByText('tela de login')).toBeInTheDocument()
    expect(screen.queryByText('área restrita')).not.toBeInTheDocument()
  })
  it('enquanto verifica, não mostra o conteúdo', () => {
    auth.value = { ...auth.value, loading: true, user: null, isAdmin: false }
    open()
    expect(screen.queryByText('área restrita')).not.toBeInTheDocument()
    expect(screen.getByText(/Verificando acesso/)).toBeInTheDocument()
  })
  it('usuário logado que NÃO é admin vê "Acesso não autorizado"', () => {
    auth.value = { ...auth.value, loading: false, user: { email: 'cliente@x.com' }, isAdmin: false }
    open()
    expect(screen.getByText('Acesso não autorizado')).toBeInTheDocument()
    expect(screen.queryByText('área restrita')).not.toBeInTheDocument()
  })
  it('administrador confirmado acessa a área', () => {
    auth.value = { ...auth.value, loading: false, user: { email: 'admin@x.com' }, isAdmin: true }
    open()
    expect(screen.getByText('área restrita')).toBeInTheDocument()
  })
})
