import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useDocumentMeta } from '../../hooks/useDocumentMeta'
import { friendlyError } from '../../lib/errors'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Alert, Spinner } from '../../components/ui/Feedback'

const schema = z
  .object({ password: z.string().min(8, 'Use pelo menos 8 caracteres.'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem.' })
type Values = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const { loading, user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) })
  useDocumentMeta({ title: 'Nova senha | Painel', noindex: true })

  if (loading) return <Spinner className="min-h-screen" label="Validando o link" />

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await updatePassword(password)
      toast.success('Senha atualizada.')
      navigate('/admin', { replace: true })
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível atualizar a senha.'))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1ECEE] px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {!user ? (
          <Alert tone="error" title="Link inválido ou expirado" action={<Link to="/admin/login" className="font-semibold text-brand">Pedir novo link</Link>}>
            Solicite um novo e-mail de recuperação na tela de login.
          </Alert>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-sm border border-line bg-white p-6 shadow-sm">
            <h1 className="text-2xl">Criar nova senha</h1>
            <Field label="Nova senha" required error={errors.password?.message}>
              <input type="password" autoComplete="new-password" className={inputClass} {...register('password')} />
            </Field>
            <Field label="Repita a senha" required error={errors.confirm?.message}>
              <input type="password" autoComplete="new-password" className={inputClass} {...register('confirm')} />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Salvar nova senha</Button>
          </form>
        )}
      </div>
    </div>
  )
}
