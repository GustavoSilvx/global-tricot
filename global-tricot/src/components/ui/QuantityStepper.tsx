import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (n: number) => void
  label?: string
}

export function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantidade' }: Props) {
  const btn =
    'inline-flex h-11 w-11 items-center justify-center text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:text-ink/30'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded border border-line-strong bg-white">
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuir quantidade">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-10 text-center text-base font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Aumentar quantidade">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
