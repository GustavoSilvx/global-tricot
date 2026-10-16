import { formatBRL } from '../../lib/format'
import { effectivePrice, hasValidPromo } from '../../lib/pricing'
import type { Product } from '../../types/db'
import { cx } from '../../lib/cx'

export function Price({
  product,
  size = 'md',
  className,
}: {
  product: Pick<Product, 'price' | 'promotional_price'>
  size?: 'md' | 'lg'
  className?: string
}) {
  const current = effectivePrice(product)
  if (current == null) return <span className="text-sm text-ink-mute">Preço a consultar</span>
  const promo = hasValidPromo(product)
  return (
    <p className={cx('flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cx('font-display text-brand-dark', size === 'lg' ? 'text-3xl' : 'text-xl')}>{formatBRL(current)}</span>
      {promo && product.price != null && (
        <>
          <span className="text-sm text-ink-mute line-through" aria-hidden>{formatBRL(product.price)}</span>
          <span className="sr-only">preço normal {formatBRL(product.price)}</span>
        </>
      )}
    </p>
  )
}
