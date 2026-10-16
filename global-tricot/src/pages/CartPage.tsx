import { Link } from 'react-router-dom'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useCartValidation } from '../hooks/useCartValidation'
import { fromCents, formatBRL } from '../lib/format'
import { itemSubtotalCents } from '../lib/cart'
import { hasBlockingIssues, type CartLine } from '../lib/cartReconcile'
import { MAX_QTY_PER_ITEM } from '../lib/variants'
import { Button, LinkButton } from '../components/ui/Button'
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback'
import { ProductImage } from '../components/ui/ProductImage'
import { QuantityStepper } from '../components/ui/QuantityStepper'

function LineIssue({ line }: { line: CartLine }) {
  const { remove, acceptPrice, setQty } = useCart()
  const id = line.item.variantId
  switch (line.issue) {
    case 'removed':
      return (
        <Alert tone="error" action={<Button size="sm" variant="danger" onClick={() => remove(id)}>Remover da sacola</Button>}>
          Esta peça saiu do catálogo e não pode ser pedida.
        </Alert>
      )
    case 'unavailable':
      return (
        <Alert tone="error" action={<Button size="sm" variant="danger" onClick={() => remove(id)}>Remover da sacola</Button>}>
          Esta opção está indisponível no momento. Remova-a para continuar.
        </Alert>
      )
    case 'over_stock':
      return (
        <Alert tone="warning" action={<Button size="sm" onClick={() => setQty(id, line.maxQuantity ?? 1)}>Ajustar para {line.maxQuantity}</Button>}>
          Só {line.maxQuantity === 1 ? 'resta 1 unidade' : `restam ${line.maxQuantity} unidades`} desta opção.
        </Alert>
      )
    case 'price_changed':
      return (
        <Alert tone="warning" action={<Button size="sm" onClick={() => acceptPrice(id, line.currentPrice as number)}>Aceitar novo preço</Button>}>
          O preço mudou de {formatBRL(line.item.unitPrice)} para <strong>{formatBRL(line.currentPrice as number)}</strong>. Confirme para continuar.
        </Alert>
      )
    default:
      return null
  }
}

export default function CartPage() {
  const { items, units, totalCents, setQty, remove } = useCart()
  const { lines, status, error, revalidate } = useCartValidation(items)
  useDocumentMeta({ title: 'Minha sacola | Global Tricot', noindex: true })

  if (items.length === 0) {
    return (
      <div className="shell py-16">
        <EmptyState title="Sua sacola está vazia" action={<LinkButton to="/catalogo">Explorar coleção</LinkButton>}>
          Escolha as peças que mais gostou e depois finalize o pedido pelo WhatsApp.
        </EmptyState>
      </div>
    )
  }

  const lineFor = (id: string) => lines.find((l) => l.item.variantId === id)
  const blocked = hasBlockingIssues(lines)
  const checking = status === 'checking' || status === 'idle'
  const canCheckout = status === 'done' && !blocked

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="text-4xl">Minha sacola</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section aria-label="Itens da sacola" className="space-y-1">
          {status === 'error' && (
            <Alert tone="error" className="mb-4" title="Não foi possível conferir preços e disponibilidade" action={<Button size="sm" variant="secondary" onClick={() => void revalidate()}>Tentar de novo</Button>}>
              {error}
            </Alert>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {items.map((item) => {
              const line = lineFor(item.variantId)
              const sub = fromCents(itemSubtotalCents(item))
              return (
                <li key={item.variantId} className="space-y-3 py-5">
                  <div className="flex gap-4">
                    <Link to={`/produto/${item.slug}`} className="shrink-0">
                      <ProductImage path={item.imagePath} alt={item.name} className="h-28 w-24 rounded-sm sm:h-32 sm:w-28" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link to={`/produto/${item.slug}`} className="font-semibold leading-snug hover:text-brand">{item.name}</Link>
                      <p className="text-sm text-ink-soft">
                        {[item.code && `Cód. ${item.code}`, item.color, item.size && `Tam. ${item.size}`].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-sm text-ink-soft">Preço unitário: {formatBRL(item.unitPrice)}</p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                        <QuantityStepper value={item.quantity} max={line?.maxQuantity ? Math.max(line.maxQuantity, item.quantity) : MAX_QTY_PER_ITEM} onChange={(n) => setQty(item.variantId, n)} label={`Quantidade de ${item.name}`} />
                        <p className="font-display text-xl text-brand-dark">{formatBRL(sub)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(item.variantId)} aria-label={`Remover ${item.name} da sacola`} className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-mute hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                  {line?.issue && <LineIssue line={line} />}
                </li>
              )
            })}
          </ul>
          <LinkButton to="/catalogo" variant="ghost" className="mt-4">← Continuar comprando</LinkButton>
        </section>

        <aside className="h-fit space-y-4 rounded-sm border border-line bg-white p-6 lg:sticky lg:top-24" aria-label="Resumo do pedido">
          <h2 className="text-2xl">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Unidades</dt><dd className="font-semibold">{units}</dd></div>
            <div className="flex justify-between text-base"><dt className="font-semibold">Total dos produtos</dt><dd className="font-display text-2xl text-brand-dark">{formatBRL(fromCents(totalCents))}</dd></div>
          </dl>
          <p className="text-xs leading-relaxed text-ink-soft">O frete não está incluído: a loja informa o valor, as formas de pagamento e a entrega no atendimento pelo WhatsApp.</p>
          {checking && <Spinner label="Conferindo preços e disponibilidade" className="py-2" />}
          {status === 'done' && blocked && <Alert tone="warning">Resolva os avisos nos itens acima para continuar.</Alert>}
          {canCheckout ? (
            <LinkButton to="/finalizar" size="lg" className="w-full"><ShoppingBag className="h-5 w-5" aria-hidden /> Finalizar pelo WhatsApp</LinkButton>
          ) : (
            <Button size="lg" className="w-full" disabled>Finalizar pelo WhatsApp</Button>
          )}
        </aside>
      </div>
    </div>
  )
}
