import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Truck } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useCatalog } from '../hooks/useCatalog'
import { useCategories } from '../hooks/useCategories'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { sortProducts } from '../lib/catalogFilters'
import { buildWhatsAppUrl } from '../lib/whatsapp'
import { publicImageUrl } from '../lib/supabase'
import { AnchorButton, Button, buttonClass, LinkButton } from '../components/ui/Button'
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback'
import { InstagramIcon, WhatsAppIcon } from '../components/ui/Icons'
import { ProductCard } from '../components/product/ProductCard'

export default function HomePage() {
  const { store } = useSettings()
  const { products, status, error, reload } = useCatalog()
  const categories = useCategories()
  const wa = buildWhatsAppUrl(store.whatsapp, `Olá, ${store.name}! Vim pelo site e gostaria de ajuda.`)

  useDocumentMeta({
    title: `${store.name} | Tricô e moda feminina`,
    description: store.heroSubtitle,
    path: '/',
    image: store.heroImageUrl,
  })

  const featured = useMemo(() => products.filter((p) => p.featured).slice(0, 8), [products])
  const novelties = useMemo(() => sortProducts(products, 'novidades').slice(0, 8), [products])
  const withProducts = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach((p) => p.category && counts.set(p.category.slug, (counts.get(p.category.slug) ?? 0) + 1))
    return categories.filter((c) => counts.has(c.slug))
  }, [products, categories])

  return (
    <>
      <section className="rib text-white">
        <div className={`shell grid items-center gap-10 py-16 md:py-24 ${store.heroImageUrl ? 'md:grid-cols-[1.15fr_1fr]' : ''}`}>
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl leading-[1.08] text-white sm:text-5xl lg:text-6xl">{store.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">{store.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/catalogo" variant="onBrand" size="lg">Explorar coleção</LinkButton>
              {wa.ok && (
                <AnchorButton href={wa.url} target="_blank" rel="noopener noreferrer" variant="ghost" size="lg" className="border border-white/70 text-white hover:bg-white/10">
                  <WhatsAppIcon /> Falar no WhatsApp
                </AnchorButton>
              )}
            </div>
            {withProducts.length > 0 && (
              <ul className="mt-10 flex flex-wrap gap-2" aria-label="Categorias">
                {withProducts.map((c) => (
                  <li key={c.id}>
                    <Link to={`/catalogo?categoria=${c.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-white/50 px-4 text-sm font-semibold text-white hover:bg-white hover:text-brand-dark">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {store.heroImageUrl && (
            <img src={store.heroImageUrl} alt="" {...({ fetchpriority: 'high' } as Record<string, string>)} className="mx-auto aspect-[4/5] w-full max-w-md rounded-sm object-cover shadow-2xl" />
          )}
        </div>
      </section>

      {status === 'loading' && <Spinner label="Carregando as peças" />}
      {status === 'error' && (
        <div className="shell py-10">
          <Alert tone="error" title="Não foi possível carregar as peças" action={<Button size="sm" variant="secondary" onClick={() => void reload()}>Tentar de novo</Button>}>
            {error}
          </Alert>
        </div>
      )}
      {status === 'ready' && products.length === 0 && (
        <div className="shell py-16">
          <EmptyState
            title="Novas peças em breve"
            action={
              <>
                {wa.ok && <AnchorButton href={wa.url} target="_blank" rel="noopener noreferrer" variant="whatsapp"><WhatsAppIcon /> Chamar no WhatsApp</AnchorButton>}
                {store.instagramUrl && <AnchorButton href={store.instagramUrl} target="_blank" rel="noopener noreferrer" variant="secondary"><InstagramIcon /> Ver no Instagram</AnchorButton>}
              </>
            }
          >
            Estamos organizando o catálogo. Enquanto isso, fale com a loja ou acompanhe as novidades pelo Instagram.
          </EmptyState>
        </div>
      )}

      {withProducts.length > 0 && (
        <section className="shell mt-16" aria-labelledby="h-categorias">
          <h2 id="h-categorias" className="text-3xl">Compre por categoria</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {withProducts.map((c) => {
              const cover = publicImageUrl(c.cover_image_path)
              return (
                <li key={c.id}>
                  <Link to={`/catalogo?categoria=${c.slug}`} className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-sm bg-brand-soft rib-soft p-4">
                    {cover && <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                    {cover && <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" aria-hidden />}
                    <span className={`relative font-display text-xl ${cover ? 'text-white' : 'text-brand-deep'}`}>{c.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section className="shell mt-16" aria-labelledby="h-destaques">
          <div className="flex items-end justify-between gap-4">
            <h2 id="h-destaques" className="text-3xl">Em destaque</h2>
            <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark">Ver tudo <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {featured.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 4} />)}
          </div>
        </section>
      )}

      {novelties.length > 0 && (
        <section className="shell mt-16" aria-labelledby="h-novidades">
          <div className="flex items-end justify-between gap-4">
            <h2 id="h-novidades" className="text-3xl">Novidades</h2>
            <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark">Ver catálogo completo <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {novelties.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section id="sobre" className="shell mt-20 scroll-mt-24" aria-labelledby="h-sobre">
        <div className="grid gap-8 rounded-sm bg-white p-6 md:grid-cols-[1.3fr_1fr] md:p-10">
          <div>
            <h2 id="h-sobre" className="text-3xl">Sobre a {store.name}</h2>
            <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-ink-soft">{store.about}</p>
          </div>
          <ul className="space-y-4 text-sm text-ink-soft">
            {(store.location || store.city) && (
              <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><span>{[store.location, store.city].filter(Boolean).join(', ')}</span></li>
            )}
            {store.deliveryEnabled && store.deliveryInfo && (
              <li className="flex gap-3"><Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><span className="whitespace-pre-line">{store.deliveryInfo}</span></li>
            )}
            {store.pickupEnabled && store.pickupInfo && (
              <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><span className="whitespace-pre-line">{store.pickupInfo}</span></li>
            )}
          </ul>
        </div>
      </section>

      <section className="shell mt-6 grid gap-4 md:grid-cols-2" aria-label="Contato">
        {store.instagramUrl && (
          <div className="rib-soft flex flex-col items-start gap-4 rounded-sm p-6 md:p-8">
            <h2 className="text-2xl">Acompanhe as novidades no Instagram</h2>
            <p className="text-sm text-ink-soft">Lançamentos, reposições e bastidores da loja.</p>
            <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}><InstagramIcon /> Conhecer o Instagram</a>
          </div>
        )}
        {wa.ok && (
          <div className="flex flex-col items-start gap-4 rounded-sm border border-line bg-white p-6 md:p-8">
            <h2 className="text-2xl">Ficou com dúvida?</h2>
            <p className="text-sm text-ink-soft">Fale direto com a loja para tirar dúvidas sobre medidas, cores e entrega.</p>
            <a href={wa.url} target="_blank" rel="noopener noreferrer" className={buttonClass('whatsapp')}><WhatsAppIcon /> Chamar no WhatsApp</a>
          </div>
        )}
      </section>
    </>
  )
}
