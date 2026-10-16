import { Check } from 'lucide-react'
import type { Product, ProductVariant } from '../../types/db'
import { distinctColors, distinctSizes, isVariantPurchasable } from '../../lib/variants'
import { cx } from '../../lib/cx'

interface Props {
  product: Pick<Product, 'availability' | 'track_stock'>
  variants: ProductVariant[]
  color: string | null
  size: string | null
  onColor: (c: string) => void
  onSize: (s: string) => void
}

const same = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase()

/** Cores e tamanhos vêm das variantes cadastradas; combinações sem estoque/indisponíveis ficam desabilitadas. */
export function VariantPicker({ product, variants, color, size, onColor, onSize }: Props) {
  const colors = distinctColors(variants)
  const sizes = distinctSizes(variants)

  const colorEnabled = (c: string) =>
    variants.some((v) => same(v.color, c) && (size == null || same(v.size, size)) && isVariantPurchasable(product, v))
  const sizeEnabled = (s: string) =>
    variants.some((v) => same(v.size, s) && (color == null || same(v.color, color)) && isVariantPurchasable(product, v))

  return (
    <div className="space-y-6">
      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Cor{color ? <span className="ml-2 font-normal text-ink-soft">{color}</span> : <span className="ml-2 font-normal text-brand">escolha uma cor</span>}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
            {colors.map((c) => {
              const selected = same(color, c.name)
              const enabled = colorEnabled(c.name)
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!enabled}
                  onClick={() => onColor(c.name)}
                  title={enabled ? c.name : `${c.name} (indisponível)`}
                  className={cx(
                    'inline-flex min-h-11 items-center gap-2 rounded border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-mute disabled:line-through',
                    selected ? 'border-brand bg-brand-tint text-brand-deep ring-2 ring-brand' : 'border-line-strong bg-white hover:border-ink',
                  )}
                >
                  {c.hex && <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: c.hex }} aria-hidden />}
                  {c.name}
                  {selected && <Check className="h-4 w-4" aria-hidden />}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Tamanho{size ? <span className="ml-2 font-normal text-ink-soft">{size}</span> : <span className="ml-2 font-normal text-brand">escolha um tamanho</span>}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tamanho">
            {sizes.map((s) => {
              const selected = same(size, s)
              const enabled = sizeEnabled(s)
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!enabled}
                  onClick={() => onSize(s)}
                  title={enabled ? s : `${s} (indisponível)`}
                  className={cx(
                    'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-mute disabled:line-through',
                    selected ? 'border-brand bg-brand text-white' : 'border-line-strong bg-white hover:border-ink',
                  )}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
    </div>
  )
}
