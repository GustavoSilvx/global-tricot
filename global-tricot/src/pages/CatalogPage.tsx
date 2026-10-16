import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { useCatalog } from '../hooks/useCatalog'
import { useCategories } from '../hooks/useCategories'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useSettings } from '../context/SettingsContext'
import {
  applyFilters, buildFacets, countActiveFilters, DEFAULT_FILTERS, filtersFromParams, filtersToParams,
  type CatalogFilters, type SortKey,
} from '../lib/catalogFilters'
import { Button } from '../components/ui/Button'
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback'
import { inputClass } from '../components/ui/Field'
import { ProductCard } from '../components/product/ProductCard'
import { CatalogFiltersPanel } from '../components/product/CatalogFilters'

const PAGE = 24

export default function CatalogPage() {
  const { store } = useSettings()
  const { products, status, error, reload } = useCatalog()
  const categories = useCategories()
  const [sp, setSp] = useSearchParams()
  const filters = useMemo(() => filtersFromParams(sp), [sp])
  const [visible, setVisible] = useState(PAGE)
  const drawer = useRef<HTMLDialogElement>(null)

  useDocumentMeta({
    title: `Catálogo | ${store.name}`,
    description: `Veja todas as peças de tricô e moda feminina da ${store.name}.`,
    path: '/catalogo',
  })

  const update = (patch: Partial<CatalogFilters>) => setSp(filtersToParams({ ...filters, ...patch }), { replace: true })
  const clear = () => setSp(filtersToParams({ ...DEFAULT_FILTERS, sort: filters.sort }), { replace: true })

  const facets = useMemo(() => buildFacets(products), [products])
  const results = useMemo(() => applyFilters(products, filters), [products, filters])
  const active = countActiveFilters(filters)
  const shown = results.slice(0, visible)

  const visibleCategories = useMemo(() => {
    const slugs = new Set(products.map((p) => p.category?.slug))
    return categories.filter((c) => slugs.has(c.slug))
  }, [categories, products])

  // volta ao primeiro lote quando os filtros mudam
  const key = sp.toString()
  useEffect(() => setVisible(PAGE), [key])

  const panel = <CatalogFiltersPanel filters={filters} facets={facets} categories={visibleCategories} onChange={update} />

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="text-4xl">Catálogo</h1>

      {status === 'loading' && <Spinner label="Carregando o catálogo" />}
      {status === 'error' && (
        <Alert tone="error" className="mt-6" title="Não foi possível carregar o catálogo" action={<Button size="sm" variant="secondary" onClick={() => void reload()}>Tentar de novo</Button>}>
          {error}
        </Alert>
      )}
      {status === 'unconfigured' && (
        <EmptyState title="Catálogo indisponível" className="mt-8">
          Conecte a loja ao Supabase para carregar os produtos cadastrados no painel.
        </EmptyState>
      )}

      {status === 'ready' && (
        <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_1fr]">
          <aside className="hidden lg:block" aria-label="Filtros">{panel}</aside>

          <section aria-label="Resultados">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="text-sm text-ink-soft" role="status" aria-live="polite">
                {results.length} {results.length === 1 ? 'peça encontrada' : 'peças encontradas'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => drawer.current?.showModal()}>
                  <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros{active > 0 ? ` (${active})` : ''}
                </Button>
                {active > 0 && <Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button>}
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only sm:not-sr-only">Ordenar por</span>
                  <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })} className={`${inputClass} w-auto py-1.5 text-sm`}>
                    <option value="novidades">Novidades</option>
                    <option value="menor-preco">Menor preço</option>
                    <option value="maior-preco">Maior preço</option>
                  </select>
                </label>
              </div>
            </div>

            {products.length === 0 ? (
              <EmptyState title="Ainda não há peças publicadas" className="mt-10">Volte em breve: novas peças serão adicionadas ao catálogo.</EmptyState>
            ) : results.length === 0 ? (
              <EmptyState title="Nenhuma peça encontrada" className="mt-10" action={<Button onClick={clear}>Limpar filtros</Button>}>
                Tente outros termos ou remova alguns filtros.
              </EmptyState>
            ) : (
              <>
                <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 4} />)}
                </div>
                <div className="mt-12 text-center">
                  <p className="text-sm text-ink-soft">Mostrando {shown.length} de {results.length}</p>
                  {shown.length < results.length && (
                    <Button variant="secondary" className="mt-3" onClick={() => setVisible((v) => v + PAGE)}>Carregar mais peças</Button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <dialog ref={drawer} aria-label="Filtros" className="m-0 ml-auto h-full max-h-none w-[min(22rem,100%)] max-w-none bg-paper p-0 backdrop:bg-ink/50">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-2xl">Filtros</h2>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-ink/5" aria-label="Fechar filtros" onClick={() => drawer.current?.close()}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="space-y-6 overflow-y-auto px-5 py-6">{panel}</div>
        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-paper px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={clear}>Limpar</Button>
          <Button className="flex-1" onClick={() => drawer.current?.close()}>Ver {results.length} {results.length === 1 ? 'peça' : 'peças'}</Button>
        </div>
      </dialog>
    </div>
  )
}
