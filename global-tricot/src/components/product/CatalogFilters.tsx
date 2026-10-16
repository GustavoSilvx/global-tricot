import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { CatalogFilters as Filters, Facets } from '../../lib/catalogFilters'
import { parseMoneyInput } from '../../lib/format'
import { cx } from '../../lib/cx'
import { inputClass } from '../ui/Field'
import type { Category } from '../../types/db'

interface Props {
  filters: Filters
  facets: Facets
  categories: Category[]
  onChange: (patch: Partial<Filters>) => void
}

const chip = (active: boolean) =>
  cx(
    'min-h-9 min-w-9 rounded border px-3 text-sm font-semibold transition-colors',
    active ? 'border-brand bg-brand text-white' : 'border-line-strong bg-white text-ink hover:border-ink',
  )

function PriceInput({ label, value, placeholder, onCommit }: { label: string; value: number | null; placeholder?: string; onCommit: (n: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','))
  useEffect(() => setText(value == null ? '' : String(value).replace('.', ',')), [value])
  const commit = () => {
    const parsed = parseMoneyInput(text)
    onCommit(text.trim() === '' ? null : parsed)
    if (text.trim() !== '' && parsed == null) setText(value == null ? '' : String(value).replace('.', ','))
  }
  return (
    <label className="block flex-1 text-xs font-semibold text-ink-soft">
      {label}
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={cx(inputClass, 'mt-1 py-2')}
      />
    </label>
  )
}

export function CatalogFiltersPanel({ filters, facets, categories, onChange }: Props) {
  const [q, setQ] = useState(filters.q)
  useEffect(() => setQ(filters.q), [filters.q])
  useEffect(() => {
    if (q === filters.q) return
    const t = window.setTimeout(() => onChange({ q }), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="filtro-busca" className="mb-2 block text-sm font-semibold">Pesquisar por nome</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input id="filtro-busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: blusa canelada" className={cx(inputClass, 'pl-9')} />
        </div>
      </div>

      {categories.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Categoria</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!filters.category} className={chip(!filters.category)} onClick={() => onChange({ category: '' })}>Todas</button>
            {categories.map((c) => (
              <button key={c.id} type="button" aria-pressed={filters.category === c.slug} className={chip(filters.category === c.slug)} onClick={() => onChange({ category: filters.category === c.slug ? '' : c.slug })}>
                {c.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Tamanho</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} type="button" aria-pressed={filters.size.toLowerCase() === s.toLowerCase()} className={chip(filters.size.toLowerCase() === s.toLowerCase())} onClick={() => onChange({ size: filters.size.toLowerCase() === s.toLowerCase() ? '' : s })}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button key={c} type="button" aria-pressed={filters.color.toLowerCase() === c.toLowerCase()} className={chip(filters.color.toLowerCase() === c.toLowerCase())} onClick={() => onChange({ color: filters.color.toLowerCase() === c.toLowerCase() ? '' : c })}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {facets.minPrice != null && facets.maxPrice != null && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Faixa de preço (R$)</legend>
          <div className="flex gap-3">
            <PriceInput label="De" value={filters.minPrice} placeholder={String(Math.floor(facets.minPrice))} onCommit={(n) => onChange({ minPrice: n })} />
            <PriceInput label="Até" value={filters.maxPrice} placeholder={String(Math.ceil(facets.maxPrice))} onCommit={(n) => onChange({ maxPrice: n })} />
          </div>
        </fieldset>
      )}
    </div>
  )
}
