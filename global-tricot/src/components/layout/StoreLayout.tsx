import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useSettings } from '../../context/SettingsContext'
import { cx } from '../../lib/cx'
import { formatWhatsApp } from '../../lib/phone'
import { buildWhatsAppUrl } from '../../lib/whatsapp'
import { Alert } from '../ui/Feedback'
import { InstagramIcon, WhatsAppIcon } from '../ui/Icons'

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/catalogo', label: 'Catálogo', end: false },
]

function SearchForm({ className, onDone }: { className?: string; onDone?: () => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : '/catalogo')
    onDone?.()
  }
  return (
    <form role="search" onSubmit={submit} className={className}>
      <label htmlFor="busca-site" className="sr-only">Pesquisar peças pelo nome</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
        <input
          id="busca-site"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar peças"
          className="h-11 w-full rounded-full border border-line-strong bg-white pl-9 pr-4 text-base placeholder:text-ink-mute focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
    </form>
  )
}

function Header() {
  const { store } = useSettings()
  const { units } = useCart()
  const [open, setOpen] = useState(false)
  const link = ({ isActive }: { isActive: boolean }) =>
    cx('rounded px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'text-brand' : 'text-ink hover:text-brand')

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="shell flex h-16 items-center gap-3">
        <button
          type="button"
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded text-ink hover:bg-ink/5 md:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-movel"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        <Link to="/" className="flex items-center gap-2.5" aria-label={`${store.name} - página inicial`}>
          <img src={store.logoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          <span className="font-display text-xl leading-none text-ink">{store.name}</span>
        </Link>

        <nav aria-label="Principal" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>
          ))}
          <Link to="/#sobre" className="rounded px-3 py-2 text-sm font-semibold text-ink hover:text-brand">A loja</Link>
        </nav>

        <SearchForm className="ml-auto hidden w-full max-w-xs md:block" />

        <Link
          to="/sacola"
          className="relative ml-auto inline-flex h-11 w-11 items-center justify-center rounded text-ink hover:bg-ink/5 md:ml-0"
          aria-label={units > 0 ? `Sacola, ${units} ${units === 1 ? 'item' : 'itens'}` : 'Sacola vazia'}
        >
          <ShoppingBag className="h-6 w-6" aria-hidden />
          {units > 0 && (
            <span className="absolute right-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-white">
              {units}
            </span>
          )}
        </Link>
      </div>

      {open && (
        <div id="menu-movel" className="border-t border-line bg-paper md:hidden">
          <div className="shell space-y-3 py-4">
            <SearchForm onDone={() => setOpen(false)} />
            <nav aria-label="Menu móvel" className="flex flex-col">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => cx(link({ isActive }), 'py-3 text-base')}>
                  {n.label}
                </NavLink>
              ))}
              <Link to="/#sobre" onClick={() => setOpen(false)} className="rounded px-3 py-3 text-base font-semibold text-ink hover:text-brand">A loja</Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const { store } = useSettings()
  const wa = buildWhatsAppUrl(store.whatsapp, `Olá, ${store.name}!`)
  const place = [store.location, store.city].filter(Boolean).join(', ')
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img src={store.logoUrl} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 rounded-full object-cover" />
            <span className="font-display text-2xl">{store.name}</span>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            Escolha as peças no site e finalize o pedido pelo WhatsApp. Frete, entrega e formas de pagamento são combinados diretamente com a loja.
          </p>
        </div>

        <nav aria-label="Rodapé" className="space-y-3 text-sm">
          <p className="font-semibold">Navegue</p>
          <ul className="space-y-2 text-ink-soft">
            <li><Link className="hover:text-brand" to="/catalogo">Catálogo completo</Link></li>
            <li><Link className="hover:text-brand" to="/sacola">Minha sacola</Link></li>
            <li><Link className="hover:text-brand" to="/#sobre">Sobre a loja</Link></li>
          </ul>
        </nav>

        <div className="space-y-3 text-sm">
          <p className="font-semibold">Atendimento</p>
          <ul className="space-y-2 text-ink-soft">
            {wa.ok && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-brand" href={wa.url} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp {formatWhatsApp(store.whatsapp)}
                </a>
              </li>
            )}
            {store.instagramUrl && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-brand" href={store.instagramUrl} target="_blank" rel="noopener noreferrer">
                  <InstagramIcon className="h-4 w-4" /> Instagram
                </a>
              </li>
            )}
            {store.email && <li><a className="hover:text-brand" href={`mailto:${store.email}`}>{store.email}</a></li>}
            {place && <li>{place}</li>}
            {store.contactInfo && <li className="whitespace-pre-line">{store.contactInfo}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-ink-mute">
        © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
      </div>
    </footer>
  )
}

export default function StoreLayout() {
  const { status } = useSettings()
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only z-50 rounded bg-white px-4 py-2 font-semibold text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="flex-1">
        {status === 'unconfigured' && (
          <div className="shell pt-6">
            <Alert tone="warning" title="Loja ainda não conectada ao Supabase">
              O catálogo, o painel e as configurações dependem do banco de dados. Preencha <code>VITE_SUPABASE_URL</code> e{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> (veja <code>docs/SETUP.md</code>). Nenhum produto de exemplo é exibido.
            </Alert>
          </div>
        )}
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
