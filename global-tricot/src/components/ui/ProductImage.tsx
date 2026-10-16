import { publicImageUrl } from '../../lib/supabase'
import { cx } from '../../lib/cx'

// React 18 não conhece `fetchPriority`; o atributo em minúsculas chega ao navegador normalmente.
const priorityAttr = (eager?: boolean) => ({ fetchpriority: eager ? 'high' : 'auto' }) as Record<string, string>

interface Props {
  path: string | null | undefined
  alt: string
  className?: string
  /** Primeira imagem da página: carrega com prioridade. */
  eager?: boolean
  sizes?: string
}

/** Foto real do produto (Supabase Storage). Sem foto, mostra um bloco neutro, nunca uma imagem genérica. */
export function ProductImage({ path, alt, className, eager, sizes }: Props) {
  const url = publicImageUrl(path)
  if (!url) {
    return (
      <div role="img" aria-label={`${alt} (foto em breve)`} className={cx('rib-soft flex items-center justify-center text-sm font-medium text-brand-dark/70', className)}>
        Foto em breve
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...priorityAttr(eager)}
      className={cx('bg-paper-warm object-cover', className)}
    />
  )
}
