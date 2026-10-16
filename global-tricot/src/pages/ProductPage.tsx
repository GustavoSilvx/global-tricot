import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import type { ProductWithRelations } from '../types/db'
import { useCart } from '../context/CartContext'
import { useSettings } from '../context/SettingsContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { friendlyError } from '../lib/errors'
import { isSupabaseConfigured, publicImageUrl } from '../lib/supabase'
import { buildCartItem } from '../lib/cartFromProduct'
import { effectivePrice } from '../lib/pricing'
import { orderedImages } from '../lib/productImages'
import { absoluteUrl } from '../lib/site'
import { distinctColors, distinctSizes, findVariant, hasPurchasableVariant, isVariantPurchasable, maxQuantityFor, MAX_QTY_PER_ITEM } from '../lib/variants'
import { buildProductInquiryMessage, buildWhatsAppUrl } from '../lib/whatsapp'
import { fetchProductBySlug } from '../services/catalog'
import { AnchorButton, Button, LinkButton } from '../components/ui/Button'
import { Alert, Badge, EmptyState, Spinner } from '../components/ui/Feedback'
import { WhatsAppIcon } from '../components/ui/Icons'
import { Price } from '../components/ui/Price'
import { ProductImage } from '../components/ui/ProductImage'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { VariantPicker } from '../components/product/VariantPicker'

type State =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; product: ProductWithRelations }

export default function ProductPage() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<State>(isSupabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    setState({ status: 'loading' })
    fetchProductBySlug(slug)
      .then((p) => alive && setState(p ? { status: 'ready', product: p } : { status: 'notfound' }))
      .catch((e) => alive && setState({ status: 'error', message: friendlyError(e, 'Não foi possível carregar esta peça.') }))
    return () => {
      alive = false
    }
  }, [slug, attempt])

  if (state.status === 'loading') return <Spinner label="Carregando a peça" className="min-h-[50vh]" />
  if (state.status === 'unconfigured') {
    return <div className="shell py-16"><EmptyState title="Catálogo indisponível">Conecte a loja ao Supabase para ver os produtos.</EmptyState></div>
  }
  if (state.status === 'error') {
    return (
      <div className="shell py-16">
        <Alert tone="error" title="Não foi possível abrir a peça" action={<Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</Button>}>
          {state.message}
        </Alert>
      </div>
    )
  }
  if (state.status === 'notfound') return <NotFoundProduct />
  return <ProductDetail key={state.product.id} product={state.product} />
}

function NotFoundProduct() {
  useDocumentMeta({ title: 'Peça não encontrada', noindex: true })
  return (
    <div className="shell py-16">
      <EmptyState title="Peça não encontrada" action={<LinkButton to="/catalogo">Ver o catálogo</LinkButton>}>
        Esta peça não está mais disponível no catálogo ou o endereço está incorreto.
      </EmptyState>
    </div>
  )
}

function ProductDetail({ product }: { product: ProductWithRelations }) {
  const { store } = useSettings()
  const { add } = useCart()
  const variants = product.product_variants
  const colors = distinctColors(variants)
  const sizes = distinctSizes(variants)
  const images = useMemo(() => orderedImages(product), [product])

  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0].name : null)
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null)
  const [qty, setQty] = useState(1)
  const [active, setActive] = useState(0)
  const [added, setAdded] = useState(false)

  const needsColor = colors.length > 0
  const needsSize = sizes.length > 0
  const ready = (!needsColor || color != null) && (!needsSize || size != null)
  const selected = ready ? findVariant(variants, needsColor ? color : null, needsSize ? size : null) : undefined
  const purchasable = selected ? isVariantPurchasable(product, selected) : false
  const maxQty = selected ? maxQuantityFor(product, selected) : MAX_QTY_PER_ITEM
  const productAvailable = product.availability === 'available' && hasPurchasableVariant(product)

  // A foto muda quando o cliente escolhe uma cor que tenha foto cadastrada.
  useEffect(() => {
    if (!color) return
    const i = images.findIndex((im) => im.color_variant?.toLowerCase() === color.toLowerCase())
    if (i >= 0) setActive(i)
  }, [color, images])
  useEffect(() => setQty((q) => Math.min(q, Math.max(1, maxQty))), [maxQty])
  useEffect(() => setAdded(false), [color, size, qty])

  const price = effectivePrice(product)
  const mainUrl = publicImageUrl(images[0]?.storage_path ?? product.main_image_path)
  useDocumentMeta({
    title: `${product.name} | ${store.name}`,
    description: (product.description ?? `${product.name} na ${store.name}.`).replace(/\s+/g, ' ').slice(0, 155),
    image: mainUrl,
    path: `/produto/${product.slug}`,
    jsonLd:
      price != null
        ? {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            ...(mainUrl ? { image: images.map((i) => publicImageUrl(i.storage_path)).filter(Boolean) } : {}),
            ...(product.description ? { description: product.description } : {}),
            ...(product.code ? { sku: product.code } : {}),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'BRL',
              price: price.toFixed(2),
              availability: productAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              ...(absoluteUrl(`/produto/${product.slug}`) ? { url: absoluteUrl(`/produto/${product.slug}`) } : {}),
            },
          }
        : null,
  })

  const missing = [needsColor && !color && 'a cor', needsSize && !size && 'o tamanho'].filter(Boolean).join(' e ')
  const wa = buildWhatsAppUrl(store.whatsapp, buildProductInquiryMessage(store.name, product.name, product.code))
  const activeImage = images[active]

  const addToBag = () => {
    if (!selected) return
    const item = buildCartItem(product, selected, qty)
    if (!item) return
    add(item)
    setAdded(true)
  }

  let helper: string | null = null
  if (!productAvailable) helper = 'Esta peça está indisponível no momento.'
  else if (!ready) helper = `Escolha ${missing} para continuar.`
  else if (!selected || !purchasable) helper = 'Esta combinação está indisponível. Escolha outra opção.'

  return (
    <div className="shell py-6 md:py-10">
      <nav aria-label="Você está em" className="mb-6 text-sm text-ink-soft">
        <Link to="/catalogo" className="hover:text-brand">Catálogo</Link>
        {product.category && (<> <span aria-hidden>/</span> <Link to={`/catalogo?categoria=${product.category.slug}`} className="hover:text-brand">{product.category.name}</Link></>)}
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <div>
          <ProductImage path={activeImage?.storage_path ?? product.main_image_path} alt={activeImage?.alt_text || product.name} eager className="aspect-[4/5] w-full rounded-sm" />
          {images.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Fotos da peça">
              {images.map((im, i) => (
                <li key={im.id}>
                  <button type="button" onClick={() => setActive(i)} aria-label={`Ver foto ${i + 1} de ${images.length}`} aria-current={i === active} className={`block w-full overflow-hidden rounded-sm border-2 ${i === active ? 'border-brand' : 'border-transparent'}`}>
                    <ProductImage path={im.storage_path} alt="" className="aspect-square w-full" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <header className="space-y-3">
            {product.code && <p className="text-xs uppercase tracking-wider text-ink-mute">Código {product.code}</p>}
            <h1 className="text-3xl leading-tight sm:text-4xl">{product.name}</h1>
            <Price product={product} size="lg" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {productAvailable ? <Badge tone="success">Disponível</Badge> : <Badge tone="muted">Indisponível</Badge>}
              {product.category && <span className="text-ink-soft">{product.category.name}</span>}
            </div>
          </header>

          {product.description && <p className="whitespace-pre-line leading-relaxed text-ink-soft">{product.description}</p>}

          {productAvailable && <VariantPicker product={product} variants={variants} color={color} size={size} onColor={setColor} onSize={setSize} />}

          {!productAvailable && <Alert tone="warning" title="Peça indisponível no momento">Fale com a loja para saber quando ela volta ou conhecer alternativas.</Alert>}

          <div className="sticky bottom-0 z-10 -mx-4 space-y-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <div className="flex flex-wrap items-center gap-3">
              <QuantityStepper value={qty} max={Math.max(1, maxQty)} onChange={setQty} />
              <Button size="lg" className="min-w-0 flex-1" onClick={addToBag} disabled={!selected || !purchasable || !productAvailable}>
                <ShoppingBag className="h-5 w-5" aria-hidden /> Adicionar à sacola
              </Button>
            </div>
            {helper && <p className="text-sm text-ink-soft" role="status">{helper}</p>}
            {added && (
              <Alert tone="success" action={<LinkButton to="/sacola" size="sm">Ver sacola</LinkButton>}>
                {qty} {qty === 1 ? 'unidade adicionada' : 'unidades adicionadas'} à sacola.
              </Alert>
            )}
          </div>

          {selected && productAvailable && purchasable && product.track_stock && (selected.stock_quantity ?? 0) <= 3 && (
            <p className="text-sm font-medium text-amber-800">Restam poucas unidades desta opção.</p>
          )}
          <p className="text-xs leading-relaxed text-ink-mute">A loja confirma a disponibilidade, o frete e as formas de pagamento no atendimento pelo WhatsApp.</p>

          {wa.ok && (
            <AnchorButton href={wa.url} target="_blank" rel="noopener noreferrer" variant="secondary" size="lg" className="w-full">
              <WhatsAppIcon /> Tirar dúvidas pelo WhatsApp
            </AnchorButton>
          )}
        </div>
      </div>
    </div>
  )
}
