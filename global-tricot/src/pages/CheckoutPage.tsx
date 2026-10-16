import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Pencil } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useCartValidation } from '../hooks/useCartValidation'
import { copyText } from '../lib/clipboard'
import { itemSubtotalCents } from '../lib/cart'
import { hasBlockingIssues } from '../lib/cartReconcile'
import { formatBRL, fromCents } from '../lib/format'
import { buildOrderMessage, buildWhatsAppUrl, type WhatsAppUrlResult } from '../lib/whatsapp'
import { AnchorButton, Button, LinkButton } from '../components/ui/Button'
import { Field, inputClass } from '../components/ui/Field'
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback'
import { WhatsAppIcon } from '../components/ui/Icons'
import { ProductImage } from '../components/ui/ProductImage'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome.').max(80, 'O nome está muito longo.'),
    city: z.string().trim().min(2, 'Informe sua cidade.').max(80, 'O nome da cidade está muito longo.'),
    method: z.enum(['delivery', 'pickup']),
    address: z.string().trim().max(200, 'Endereço muito longo.'),
    reference: z.string().trim().max(120, 'Texto muito longo.'),
    notes: z.string().trim().max(500, 'Máximo de 500 caracteres.'),
  })
  .superRefine((v, ctx) => {
    // O endereço só é obrigatório quando há entrega.
    if (v.method === 'delivery' && v.address.length < 5) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: 'Informe o endereço para entrega (rua, número e bairro).' })
    }
  })
type FormValues = z.infer<typeof schema>

interface Review {
  message: string
  link: WhatsAppUrlResult
}

export default function CheckoutPage() {
  const { store } = useSettings()
  const { items, units, totalCents, clear } = useCart()
  const { lines, status, error, revalidate } = useCartValidation(items)
  const toast = useToast()
  const navigate = useNavigate()
  const [review, setReview] = useState<Review | null>(null)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  useDocumentMeta({ title: `Finalizar pedido | ${store.name}`, noindex: true })

  const noMethod = !store.deliveryEnabled && !store.pickupEnabled
  const {
    register, handleSubmit, watch, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', city: '', method: store.deliveryEnabled ? 'delivery' : 'pickup', address: '', reference: '', notes: '' },
  })
  const method = watch('method')

  if (items.length === 0) {
    return (
      <div className="shell py-16">
        <EmptyState title="Sua sacola está vazia" action={<LinkButton to="/catalogo">Explorar coleção</LinkButton>}>
          Adicione ao menos uma peça para finalizar o pedido.
        </EmptyState>
      </div>
    )
  }

  const blocked = hasBlockingIssues(lines)
  const summaryTotal = formatBRL(fromCents(totalCents))

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setBusy(true)
    // Confere TUDO de novo no banco antes de montar o pedido.
    const fresh = await revalidate()
    setBusy(false)
    if (!fresh) return setFormError('Não conseguimos confirmar os preços agora. Verifique a conexão e tente novamente.')
    if (hasBlockingIssues(fresh)) return setFormError('Algum item da sacola mudou (preço, estoque ou disponibilidade). Volte à sacola para ajustar.')
    const message = buildOrderMessage(
      items,
      { name: values.name, city: values.city, method: values.method, address: values.address, reference: values.reference, notes: values.notes },
      { storeName: store.name, greeting: store.greeting, closing: store.closing },
    )
    setOpened(false)
    setReview({ message, link: buildWhatsAppUrl(store.whatsappRaw, message) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  const copy = async () => {
    if (!review) return
    if (await copyText(review.message)) toast.success('Pedido copiado. Cole na conversa do WhatsApp.')
    else toast.error('Não foi possível copiar. Selecione o texto acima e copie manualmente.')
  }

  const summary = (
    <aside className="h-fit space-y-4 rounded-sm border border-line bg-white p-6 lg:sticky lg:top-24" aria-label="Resumo do pedido">
      <h2 className="text-2xl">Resumo do pedido</h2>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.variantId} className="flex gap-3 py-3 text-sm">
            <ProductImage path={i.imagePath} alt="" className="h-16 w-14 shrink-0 rounded-sm" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{i.name}</p>
              <p className="text-ink-soft">{[i.code && `Cód. ${i.code}`, i.color, i.size && `Tam. ${i.size}`].filter(Boolean).join(' · ')}</p>
              <p className="text-ink-soft">{i.quantity} × {formatBRL(i.unitPrice)}</p>
            </div>
            <p className="shrink-0 font-semibold">{formatBRL(fromCents(itemSubtotalCents(i)))}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-soft">Unidades</dt><dd className="font-semibold">{units}</dd></div>
        <div className="flex justify-between"><dt className="font-semibold">Total dos produtos</dt><dd className="font-display text-2xl text-brand-dark">{summaryTotal}</dd></div>
      </dl>
      <p className="text-xs leading-relaxed text-ink-soft">Frete a confirmar pela loja. O valor final com entrega e as formas de pagamento são combinados no WhatsApp.</p>
      <Link to="/sacola" className="inline-block text-sm font-semibold text-brand hover:text-brand-dark">Editar sacola</Link>
    </aside>
  )

  return (
    <div className="shell py-8 md:py-12">
      <h1 className="text-4xl">Finalizar pedido</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Preencha os dados para o atendimento. Nada é cobrado aqui: o pedido segue para a conversa no WhatsApp da loja.</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {status === 'checking' && <Spinner label="Conferindo preços e disponibilidade" className="py-3" />}
          {status === 'error' && (
            <Alert tone="error" title="Não foi possível conferir os preços" action={<Button size="sm" variant="secondary" onClick={() => void revalidate()}>Tentar de novo</Button>}>{error}</Alert>
          )}
          {status === 'done' && blocked && (
            <Alert tone="warning" title="Há itens que precisam de ajuste" action={<LinkButton to="/sacola" size="sm">Voltar à sacola</LinkButton>}>
              Preço, estoque ou disponibilidade mudaram. Resolva na sacola para continuar.
            </Alert>
          )}
          {!store.whatsapp && (
            <Alert tone="warning" title="WhatsApp da loja ainda não configurado">
              {store.whatsappRaw ? 'O número cadastrado é inválido.' : 'A loja ainda não cadastrou o número.'} Você pode revisar e copiar o pedido, mas não será possível abrir a conversa automaticamente.
            </Alert>
          )}
          {noMethod && <Alert tone="error" title="Formas de recebimento não definidas">A loja ainda não definiu se faz entrega ou retirada. Fale com a loja pelo Instagram ou WhatsApp.</Alert>}

          {review ? (
            <section aria-label="Revisão do pedido" className="space-y-5">
              <Alert tone="warning" title="Seu pedido ainda não foi enviado">
                Confira a mensagem abaixo. Ao tocar em “Abrir WhatsApp”, a conversa abre com o texto pronto e <strong>você precisa tocar em Enviar</strong> dentro do WhatsApp.
              </Alert>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-white p-4 text-sm leading-relaxed" tabIndex={0} aria-label="Mensagem do pedido">{review.message}</pre>

              {review.link.ok ? (
                <>
                  {review.link.tooLong && <Alert tone="info">Seu pedido é grande e o WhatsApp pode cortar o texto. Se isso acontecer, use “Copiar pedido” e cole na conversa.</Alert>}
                  <div className="flex flex-wrap gap-3">
                    <AnchorButton href={review.link.url} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg" onClick={() => setOpened(true)}>
                      <WhatsAppIcon /> Abrir WhatsApp
                    </AnchorButton>
                    <Button variant="secondary" size="lg" onClick={() => void copy()}><Copy className="h-5 w-5" aria-hidden /> Copiar pedido</Button>
                    <Button variant="ghost" size="lg" onClick={() => setReview(null)}><Pencil className="h-5 w-5" aria-hidden /> Editar dados</Button>
                  </div>
                </>
              ) : (
                <>
                  <Alert tone="error" title="Não foi possível abrir o WhatsApp">{review.link.reason} Copie o pedido e envie pelo Instagram ou outro canal da loja.</Alert>
                  <div className="flex flex-wrap gap-3">
                    <Button size="lg" onClick={() => void copy()}><Copy className="h-5 w-5" aria-hidden /> Copiar pedido</Button>
                    <Button variant="ghost" size="lg" onClick={() => setReview(null)}><Pencil className="h-5 w-5" aria-hidden /> Editar dados</Button>
                  </div>
                </>
              )}

              {opened && (
                <Alert tone="info" title="Falta só enviar a mensagem">
                  Abrimos o WhatsApp em outra aba. O pedido só chega à loja depois que você tocar em Enviar na conversa. Quando tiver enviado, você pode esvaziar a sacola.
                  <div className="pt-3">
                    <Button size="sm" variant="secondary" onClick={() => { clear(); toast.info('Sacola esvaziada.'); navigate('/') }}>Já enviei, esvaziar sacola</Button>
                  </div>
                </Alert>
              )}
            </section>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-sm border border-line bg-white p-6">
              <h2 className="text-2xl">Seus dados</h2>
              <Field label="Nome" required error={errors.name?.message}>
                <input className={inputClass} autoComplete="name" {...register('name')} />
              </Field>
              <Field label="Cidade" required error={errors.city?.message}>
                <input className={inputClass} autoComplete="address-level2" {...register('city')} />
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Forma de recebimento <span className="text-brand" aria-hidden>*</span></legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {store.deliveryEnabled && (
                    <label className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${method === 'delivery' ? 'border-brand bg-brand-tint' : 'border-line-strong'}`}>
                      <input type="radio" value="delivery" className="mt-1 accent-brand" {...register('method')} />
                      <span><span className="block font-semibold">Entrega</span><span className="block text-xs text-ink-soft">{store.deliveryInfo ?? 'Frete combinado com a loja.'}</span></span>
                    </label>
                  )}
                  {store.pickupEnabled && (
                    <label className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${method === 'pickup' ? 'border-brand bg-brand-tint' : 'border-line-strong'}`}>
                      <input type="radio" value="pickup" className="mt-1 accent-brand" {...register('method')} />
                      <span><span className="block font-semibold">Retirada</span><span className="block text-xs text-ink-soft">{store.pickupInfo ?? 'Retire na loja, sem frete.'}</span></span>
                    </label>
                  )}
                </div>
              </fieldset>

              {method === 'delivery' && (
                <>
                  <Field label="Endereço" required error={errors.address?.message} hint="Rua, número e bairro.">
                    <input className={inputClass} autoComplete="street-address" {...register('address')} />
                  </Field>
                  <Field label="Complemento ou ponto de referência" error={errors.reference?.message}>
                    <input className={inputClass} {...register('reference')} />
                  </Field>
                </>
              )}
              <Field label="Observações" error={errors.notes?.message} hint="Opcional. Ex.: cor alternativa, horário para contato.">
                <textarea rows={3} className={inputClass} {...register('notes')} />
              </Field>

              {formError && <Alert tone="error">{formError}</Alert>}
              <p className="text-xs text-ink-soft">Não pedimos CPF, senha nem dados de cartão. Seus dados só vão para a mensagem do WhatsApp e não ficam salvos no site.</p>
              <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy} disabled={noMethod || blocked || status !== 'done'}>Revisar pedido</Button>
            </form>
          )}
        </div>
        {summary}
      </div>
    </div>
  )
}
