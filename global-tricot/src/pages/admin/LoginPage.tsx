import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../context/AuthContext'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { friendlyError } from '../../lib/errors'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Button, LinkButton } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Alert } from '../../components/ui/Feedback'

const schema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const { loading, user, isAdmin, signIn, signOut, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const { register, handleSubmit, getValues, trigger, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) })
  useDocumentMeta({ title: 'Entrar | Painel', noindex: true })

  useEffect(() => {
    if (!loading && user && isAdmin) navigate(from, { replace: true })
  }, [loading, user, isAdmin, from, navigate])

  const onLogin = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await signIn(email, password)
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível entrar. Tente novamente.'))
    }
  })

  const onReset = async () => {
    setError(null)
    if (!(await trigger('email'))) return
    try {
      await sendPasswordReset(getValues('email'))
      setResetSent(true)
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível enviar o e-mail de recuperação.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1ECEE] px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="font-display text-3xl">Global Tricot</p>
          <p className="mt-1 text-sm text-ink-soft">Painel administrativo</p>
        </div>

        {!isSupabaseConfigured ? (
          <Alert tone="warning" title="Supabase não configurado">Preencha as variáveis do arquivo <code>.env</code> (veja <code>docs/SETUP.md</code>) para entrar.</Alert>
        ) : user && !isAdmin && !loading ? (
          <Alert tone="error" title="Sem permissão de administrador" action={<Button size="sm" variant="secondary" onClick={() => void signOut()}>Sair desta conta</Button>}>
            A conta {user.email} não está autorizada a gerenciar a loja.
          </Alert>
        ) : (
          <form onSubmit={mode === 'login' ? onLogin : (e) => { e.preventDefault(); void onReset() }} noValidate className="space-y-5 rounded-sm border border-line bg-white p-6 shadow-sm">
            <h1 className="text-2xl">{mode === 'login' ? 'Entrar' : 'Recuperar acesso'}</h1>
            <Field label="E-mail" error={errors.email?.message} required>
              <input type="email" autoComplete="username" className={inputClass} {...register('email')} />
            </Field>
            {mode === 'login' && (
              <Field label="Senha" error={errors.password?.message} required>
                <input type="password" autoComplete="current-password" className={inputClass} {...register('password')} />
              </Field>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            {resetSent && <Alert tone="success">Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.</Alert>}
            {mode === 'login' ? (
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting || loading}>Entrar</Button>
            ) : (
              <Button type="submit" size="lg" className="w-full">Enviar link de recuperação</Button>
            )}
            <button type="button" className="block w-full text-center text-sm font-semibold text-brand hover:text-brand-dark" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(null); setResetSent(false) }}>
              {mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}
            </button>
          </form>
        )}
        <LinkButton to="/" variant="ghost" className="w-full">← Voltar à loja</LinkButton>
      </div>
    </div>
  )
}
