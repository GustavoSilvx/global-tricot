import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import type { ProductWithRelations } from '../../types/db'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { buildCartItem } from '../../lib/cartFromProduct'
import { discountPercent } from '../../lib/pricing'
import { isVariantPurchasable } from '../../lib/variants'
import { Badge } from '../ui/Feedback'
import { Price } from '../ui/Price'
import { ProductImage } from '../ui/ProductImage'
import { buttonClass } from '../ui/Button'

export function ProductCard({ product, eager }: { product: ProductWithRelations; eager?: boolean }) {
  const { add } = useCart()
  const toast = useToast()
  const purchasable = product.product_variants.filter((v) => isVariantPurchasable(product, v))
  const unavailable = purchasable.length === 0
  // Peça sem escolhas (uma única opção): adiciona direto. Com escolhas: abre a página para selecionar.
  const single = product.product_variants.length === 1 && purchasable.length === 1 ? purchasable[0] : null
  const discount = discountPercent(product)
  const href = `/produto/${product.slug}`

  const addSingle = () => {
    if (!single) return
    const item = buildCartItem(product, single, 1)
    if (!item) return toast.error('Esta peça não pode ser adicionada agora.')
    add(item)
    toast.success(`${product.name} foi para a sacola.`)
  }

  return (
    <article className="group flex flex-col">
      <Link to={href} className="relative block overflow-hidden rounded-sm" aria-label={`Ver detalhes de ${product.name}`}>
        <ProductImage path={product.main_image_path} alt={product.name} eager={eager} sizes="(min-width: 1024px) 25vw, 50vw" className={`aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03] ${unavailable ? 'opacity-60' : ''}`} />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {discount != null && !unavailable && <Badge tone="brand">-{discount}%</Badge>}
          {unavailable && <Badge tone="muted">Indisponível</Badge>}
        </div>
      </Link>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        {product.category && <p className="text-xs text-ink-mute">{product.category.name}</p>}
        <h3 className="font-sans text-base font-semibold leading-snug">
          <Link to={href} className="hover:text-brand">{product.name}</Link>
        </h3>
        <Price product={product} />
        <p className="text-xs text-ink-soft">{unavailable ? 'Indisponível no momento' : 'Disponível'}</p>
      </div>
      <div className="mt-3">
        {single ? (
          <button type="button" onClick={addSingle} className={buttonClass('secondary', 'md', 'w-full')}>
            <ShoppingBag className="h-4 w-4" aria-hidden /> Adicionar à sacola
          </button>
        ) : (
          <Link to={href} className={buttonClass('secondary', 'md', `w-full ${unavailable ? 'pointer-events-none opacity-50' : ''}`)} aria-disabled={unavailable || undefined} tabIndex={unavailable ? -1 : undefined}>
            {unavailable ? 'Indisponível' : 'Escolher opções'}
          </Link>
        )}
      </div>
    </article>
  )
}
