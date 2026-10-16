import type { ReactNode } from 'react'
import { CircleAlert, Info, Loader2, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { cx } from '../../lib/cx'

type Tone = 'info' | 'warning' | 'error' | 'success'

const TONES: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-line-strong bg-white text-ink', icon: Info },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-950', icon: TriangleAlert },
  error: { box: 'border-red-300 bg-red-50 text-red-900', icon: CircleAlert },
  success: { box: 'border-emerald-300 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const { box, icon: Icon } = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded border p-4 text-sm', box, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Carregando', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('flex items-center justify-center gap-2 py-12 text-ink-soft', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}...</span>
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('mx-auto max-w-md rounded border border-dashed border-line-strong bg-white/60 px-6 py-12 text-center', className)}>
      <h2 className="font-display text-2xl">{title}</h2>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'muted' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-paper-warm text-ink',
    brand: 'bg-brand text-white',
    success: 'bg-emerald-100 text-emerald-900',
    warning: 'bg-amber-100 text-amber-900',
    muted: 'bg-line text-ink-soft',
    danger: 'bg-red-100 text-red-900',
  }
  return <span className={cx('inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>
}
