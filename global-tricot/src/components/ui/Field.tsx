import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

export const inputClass =
  'block w-full rounded border border-line-strong bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-mute focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-paper-warm disabled:text-ink-mute aria-[invalid=true]:border-red-600'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
  children: ReactElement
}

/** Rótulo + campo + dica/erro, com ids ligados para leitores de tela. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand" aria-hidden> *</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-ink-soft">{hint}</p>}
      {error && <p id={errId} role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  )
}
