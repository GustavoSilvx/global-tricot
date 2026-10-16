import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import { friendlyError } from '../../lib/errors'
import { adminDashboardCounts, type DashboardCounts } from '../../services/adminProducts'
import { Alert, Spinner } from '../../components/ui/Feedback'
import { Button, LinkButton } from '../../components/ui/Button'

export default function DashboardPage() {
  const { store, status } = useSettings()
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setCounts(await adminDashboardCounts())
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível carregar os indicadores.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const cards: { label: string; value: number | undefined; to: string; hint: string }[] = [
    { label: 'Produtos cadastrados', value: counts?.total, to: '/admin/produtos', hint: 'Todos os status' },
    { label: 'Publicados', value: counts?.published, to: '/admin/produtos?status=published', hint: 'Visíveis na loja' },
    { label: 'Rascunhos', value: counts?.draft, to: '/admin/produtos?status=draft', hint: 'Cadastro em andamento' },
    { label: 'Indisponíveis', value: counts?.unavailable, to: '/admin/produtos?status=published', hint: 'Publicados, sem compra' },
    { label: 'Em destaque', value: counts?.featured, to: '/admin/produtos?status=published', hint: 'Aparecem na página inicial' },
  ]

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Painel</h1>
          <p className="text-sm text-ink-soft">Resumo do catálogo, calculado com os dados reais.</p>
        </div>
        <LinkButton to="/admin/produtos/novo"><Plus className="h-4 w-4" aria-hidden /> Adicionar produto</LinkButton>
      </header>

      {status !== 'loading' && !store.whatsapp && (
        <Alert tone="warning" title="WhatsApp da loja não configurado" action={<LinkButton to="/admin/configuracoes" size="sm">Configurar agora</LinkButton>}>
          {store.whatsappRaw ? 'O número cadastrado é inválido.' : 'Sem o número, os clientes não conseguem abrir a conversa com o pedido.'}
        </Alert>
      )}
      {error && <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Tentar de novo</Button>}>{error}</Alert>}
      {!counts && !error && <Spinner label="Carregando indicadores" />}

      {counts && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((c) => (
            <li key={c.label}>
              <Link to={c.to} className="block rounded-sm border border-line bg-white p-5 transition-shadow hover:shadow-md">
                <p className="text-sm text-ink-soft">{c.label}</p>
                <p className="mt-2 font-display text-4xl text-brand-dark">{c.value}</p>
                <p className="mt-1 text-xs text-ink-mute">{c.hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Ações rápidas" className="grid gap-4 md:grid-cols-3">
        {[
          { to: '/admin/produtos/novo', title: 'Novo produto', text: 'Cadastre uma peça com fotos, cores e tamanhos.' },
          { to: '/admin/produtos', title: 'Gerenciar catálogo', text: 'Edite, publique, arquive ou remova produtos.' },
          { to: '/admin/configuracoes', title: 'Configurações da loja', text: 'WhatsApp, Instagram, logo e textos do site.' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="rounded-sm border border-line bg-white p-5 hover:border-brand">
            <h2 className="font-display text-xl">{a.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{a.text}</p>
          </Link>
        ))}
      </section>
      <p className="text-xs text-ink-mute">A versão atual não registra vendas nem faturamento: os pedidos são fechados na conversa do WhatsApp.</p>
    </div>
  )
}
