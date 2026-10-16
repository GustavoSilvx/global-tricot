import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleCheck, CircleDashed, Plus, X } from 'lucide-react'
import type { ProductStatus, ProductWithRelations } from '../../types/db'
import { useToast } from '../../context/ToastContext'
import { friendlyError } from '../../lib/errors'
import { parseMoneyInput } from '../../lib/format'
import { publicImageUrl } from '../../lib/supabase'
import { getBlockingErrors, getPublishIssues } from '../../lib/publish'
import { SLUG_REGEX, slugify } from '../../lib/slug'
import { distinctColors, distinctSizes } from '../../lib/variants'
import { orderedImages } from '../../lib/productImages'
import { buildMatrix, defaultRow, hasInvalidStock, hasMissingStock, matrixToInputs, variantKey, type ColorOption, type RowData } from '../../lib/variantMatrix'
import { adminGetProduct, deleteProduct, saveProduct, SaveStageError } from '../../services/adminProducts'
import { adminListCategories, type CategoryWithCount } from '../../services/categories'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../components/ui/Field'
import { Alert, Spinner } from '../../components/ui/Feedback'
import { ImageManager, type ImageItem } from '../../components/admin/ImageManager'

const moneyOk = (v: string) => v.trim() === '' || parseMoneyInput(v) !== null
const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do produto.').max(160, 'Máximo de 160 caracteres.'),
  slug: z.string().trim().min(1, 'Informe o endereço (slug).').max(80).regex(SLUG_REGEX, 'Use letras minúsculas, números e hífens (ex.: blusa-canelada).'),
  code: z.string().trim().max(40, 'Máximo de 40 caracteres.'),
  description: z.string().trim().max(5000, 'Máximo de 5000 caracteres.'),
  category_id: z.string(),
  price: z.string().refine(moneyOk, 'Preço inválido. Exemplo: 89,90'),
  promotional_price: z.string().refine(moneyOk, 'Preço inválido. Exemplo: 69,90'),
  availability: z.enum(['available', 'unavailable']),
  track_stock: z.boolean(),
  featured: z.boolean(),
  status: z.enum(['draft', 'published', 'archived']),
})
type Values = z.infer<typeof schema>

const COMMON_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'Único']
const STATUS_LABEL: Record<ProductStatus, string> = { draft: 'Rascunho (não aparece na loja)', published: 'Publicado (visível na loja)', archived: 'Arquivado (fora da loja)' }

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'notfound' | 'error'; product?: ProductWithRelations; error?: string }>({ status: 'loading' })
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [cats, product] = await Promise.all([adminListCategories(), id ? adminGetProduct(id) : Promise.resolve(null)])
      setCategories(cats)
      if (id && !product) return setState({ status: 'notfound' })
      setState({ status: 'ready', product: product ?? undefined })
    } catch (e) {
      setState({ status: 'error', error: friendlyError(e, 'Não foi possível carregar o produto.') })
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load, version])

  if (state.status === 'loading') return <Spinner label="Carregando" />
  if (state.status === 'notfound') return <Alert tone="error" title="Produto não encontrado" action={<Link to="/admin/produtos" className="font-semibold text-brand">Voltar à lista</Link>}>Ele pode ter sido removido.</Alert>
  if (state.status === 'error') return <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => setVersion((v) => v + 1)}>Tentar de novo</Button>}>{state.error}</Alert>

  return (
    <ProductEditor
      key={`${id ?? 'novo'}-${version}`}
      product={state.product}
      categories={categories}
      onSaved={(savedId) => (id ? setVersion((v) => v + 1) : navigate(`/admin/produtos/${savedId}`, { replace: true }))}
    />
  )
}

function ProductEditor({ product, categories, onSaved }: { product?: ProductWithRelations; categories: CategoryWithCount[]; onSaved: (id: string) => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const isEdit = Boolean(product)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      code: product?.code ?? '',
      description: product?.description ?? '',
      category_id: product?.category_id ?? '',
      price: product?.price != null ? String(product.price).replace('.', ',') : '',
      promotional_price: product?.promotional_price != null ? String(product.promotional_price).replace('.', ',') : '',
      availability: product?.availability ?? 'available',
      track_stock: product?.track_stock ?? false,
      featured: product?.featured ?? false,
      status: product?.status ?? 'draft',
    },
  })

  // ---- opções (cores x tamanhos) ----
  const [colors, setColors] = useState<ColorOption[]>(() => distinctColors(product?.product_variants ?? []).map((c) => ({ name: c.name, hex: c.hex ?? '' })))
  const [sizes, setSizes] = useState<string[]>(() => distinctSizes(product?.product_variants ?? []))
  const [rowData, setRowData] = useState<Record<string, RowData>>(() =>
    Object.fromEntries(
      (product?.product_variants ?? []).map((v) => [
        variantKey(v.color, v.size),
        { id: v.id, available: v.available, stock: v.stock_quantity == null ? '' : String(v.stock_quantity), sku: v.sku ?? '' },
      ]),
    ),
  )
  const [colorInput, setColorInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')
  // "Peça única" é uma escolha explícita: sem cores, sem tamanhos e sem essa marca, não há opção de compra.
  const [singlePiece, setSinglePiece] = useState(() => {
    const vs = product?.product_variants ?? []
    return vs.length === 1 && !vs[0].color && !vs[0].size
  })
  const matrix = useMemo(
    () => (colors.length || sizes.length ? buildMatrix(colors, sizes) : singlePiece ? buildMatrix([], []) : []),
    [colors, sizes, singlePiece],
  )

  const addColor = () => {
    const name = colorInput.trim()
    if (!name || colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setColorInput('')
    setColors([...colors, { name, hex: '' }])
    setColorInput('')
  }
  const addSize = (raw: string) => {
    const s = raw.trim()
    if (!s || sizes.some((x) => x.toLowerCase() === s.toLowerCase())) return setSizeInput('')
    setSizes([...sizes, s])
    setSizeInput('')
  }
  const patchRow = (key: string, p: Partial<RowData>) => setRowData((d) => ({ ...d, [key]: { ...(d[key] ?? defaultRow()), ...p } }))

  // ---- imagens ----
  const [images, setImages] = useState<ImageItem[]>(() =>
    product ? orderedImages(product).map((i) => ({ key: i.id, id: i.id, storage_path: i.storage_path, previewUrl: publicImageUrl(i.storage_path) ?? '', alt: i.alt_text ?? '', color_variant: i.color_variant ?? '', is_main: i.is_main })) : [],
  )

  // ---- slug automático (só em produtos novos, enquanto não for editado à mão) ----
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const name = watch('name')
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name), { shouldValidate: false })
  }, [name, slugTouched, setValue])

  // ---- checklist de publicação ao vivo ----
  const w = watch()
  const priceNum = w.price.trim() === '' ? null : parseMoneyInput(w.price)
  const promoNum = w.promotional_price.trim() === '' ? null : parseMoneyInput(w.promotional_price)
  const publishIssues = getPublishIssues({
    name: w.name, price: priceNum, promotionalPrice: promoNum, categoryId: w.category_id || null,
    imageCount: images.length, variantCount: matrix.length, trackStock: w.track_stock, stockMissing: hasMissingStock(matrix, rowData),
  })

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [blockedPublish, setBlockedPublish] = useState<string[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const submit = (override?: ProductStatus) =>
    handleSubmit(async (v) => {
      setSaveError(null)
      setBlockedPublish(null)
      const price = v.price.trim() === '' ? null : parseMoneyInput(v.price)
      const promo = v.promotional_price.trim() === '' ? null : parseMoneyInput(v.promotional_price)
      const status = override ?? v.status

      const blocking = getBlockingErrors({ name: v.name, price, promotionalPrice: promo })
      if (v.track_stock && hasInvalidStock(matrix, rowData)) blocking.push('A quantidade em estoque deve ser um número inteiro, maior ou igual a zero.')
      if (blocking.length) return setSaveError(blocking.join(' '))
      if (status === 'published' && publishIssues.length) {
        setBlockedPublish(publishIssues)
        return window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      setSaving(true)
      try {
        const result = await saveProduct(
          {
            id: product?.id, name: v.name, slug: v.slug, code: v.code || null, description: v.description || null,
            category_id: v.category_id || null, price, promotional_price: promo, availability: v.availability,
            track_stock: v.track_stock, featured: v.featured, status,
          },
          matrixToInputs(matrix, rowData),
          images.map((i) => ({ id: i.id, storage_path: i.storage_path, file: i.file, alt_text: i.alt.trim() || null, color_variant: i.color_variant || null, is_main: i.is_main })),
          product && {
            status: product.status,
            variantIds: product.product_variants.map((x) => x.id),
            images: product.product_images.map((x) => ({ id: x.id, storage_path: x.storage_path })),
          },
        )
        if (result.publishError) toast.error(`Produto salvo como rascunho. ${result.publishError}`)
        else toast.success(status === 'published' ? 'Produto salvo e publicado.' : 'Produto salvo.')
        images.forEach((i) => i.file && URL.revokeObjectURL(i.previewUrl))
        onSaved(result.id)
      } catch (e) {
        // Os dados continuam no formulário para você corrigir e tentar de novo.
        if (e instanceof SaveStageError) {
          const cause = e.cause as { message?: string } | undefined
          setSaveError(`Não foi possível salvar ${e.stage}. ${friendlyError(e.cause, cause?.message ?? 'Tente novamente.')} Seus dados continuam aqui no formulário.`)
        } else setSaveError(`${friendlyError(e)} Seus dados continuam aqui no formulário.`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } finally {
        setSaving(false)
      }
    })

  const doDelete = async () => {
    if (!product) return
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      toast.success('Produto excluído.')
      navigate('/admin/produtos', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível excluir o produto.'))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const noCategories = categories.filter((c) => c.active || c.id === product?.category_id).length === 0

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit()() }} noValidate className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/produtos" className="text-sm font-semibold text-brand hover:text-brand-dark">← Produtos</Link>
          <h1 className="text-3xl">{isEdit ? 'Editar produto' : 'Novo produto'}</h1>
        </div>
      </header>

      {saveError && <Alert tone="error" title="Não foi possível salvar">{saveError}</Alert>}
      {blockedPublish && (
        <Alert tone="warning" title="Ainda falta informação para publicar" action={<Button size="sm" variant="secondary" onClick={() => void submit('draft')()}>Salvar como rascunho</Button>}>
          <ul className="list-disc pl-5">{blockedPublish.map((i) => <li key={i}>{i}</li>)}</ul>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6" aria-labelledby="s-info">
            <h2 id="s-info" className="text-2xl">Informações</h2>
            <Field label="Nome do produto" required error={errors.name?.message}><input className={inputClass} {...register('name')} /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Endereço da página (slug)" required error={errors.slug?.message} hint={`/produto/${w.slug || '...'}`}>
                <input className={inputClass} {...register('slug', { onChange: () => setSlugTouched(true) })} />
              </Field>
              <Field label="Código interno" error={errors.code?.message} hint="Aparece na mensagem do pedido. Não pode repetir.">
                <input className={inputClass} {...register('code')} />
              </Field>
            </div>
            <Field label="Categoria" error={errors.category_id?.message} hint={noCategories ? 'Crie uma categoria antes de publicar.' : 'Obrigatória para publicar.'}>
              <select className={inputClass} {...register('category_id')}>
                <option value="">Sem categoria</option>
                {categories.filter((c) => c.active || c.id === product?.category_id).map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (desativada)'}</option>)}
              </select>
            </Field>
            <Field label="Descrição" error={errors.description?.message}><textarea rows={5} className={inputClass} {...register('description')} /></Field>
          </section>

          <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6" aria-labelledby="s-preco">
            <h2 id="s-preco" className="text-2xl">Preço</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Preço normal (R$)" error={errors.price?.message} hint="Obrigatório para publicar."><input inputMode="decimal" placeholder="89,90" className={inputClass} {...register('price')} /></Field>
              <Field label="Preço promocional (R$)" error={errors.promotional_price?.message} hint="Opcional. Precisa ser menor que o normal.">
                <input inputMode="decimal" placeholder="69,90" className={inputClass} {...register('promotional_price')} />
              </Field>
            </div>
            {priceNum != null && promoNum != null && promoNum >= priceNum && <Alert tone="error">O preço promocional precisa ser menor que o preço normal.</Alert>}
          </section>

          <section className="space-y-4 rounded-sm border border-line bg-white p-5 sm:p-6" aria-labelledby="s-fotos">
            <h2 id="s-fotos" className="text-2xl">Fotos</h2>
            <p className="text-sm text-ink-soft">Use fotos reais da peça. A foto <strong>principal</strong> aparece no catálogo. Você pode ligar uma foto a uma cor.</p>
            <ImageManager items={images} onChange={setImages} colors={colors.map((c) => c.name)} disabled={saving} />
          </section>

          <section className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6" aria-labelledby="s-opcoes">
            <h2 id="s-opcoes" className="text-2xl">Cores e tamanhos</h2>
            <p className="text-sm text-ink-soft">Cada peça tem suas próprias opções. Informe cores e/ou tamanhos, ou marque “peça única”.</p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label htmlFor="nova-cor" className="text-sm font-semibold">Cores</label>
                <div className="flex gap-2">
                  <input id="nova-cor" className={inputClass} value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor() } }} placeholder="Ex.: Vermelho" maxLength={40} />
                  <Button variant="secondary" onClick={addColor}><Plus className="h-4 w-4" aria-hidden /> Adicionar</Button>
                </div>
                <ul className="space-y-2">
                  {colors.map((c) => (
                    <li key={c.name} className="flex items-center gap-2 rounded border border-line bg-paper px-3 py-1.5 text-sm">
                      <input type="color" aria-label={`Cor de amostra de ${c.name}`} value={c.hex || '#cccccc'} onChange={(e) => setColors(colors.map((x) => (x.name === c.name ? { ...x, hex: e.target.value } : x)))} className="h-7 w-7 cursor-pointer rounded border border-line bg-transparent p-0" />
                      <span className="flex-1 font-semibold">{c.name}</span>
                      <button type="button" aria-label={`Remover cor ${c.name}`} onClick={() => setColors(colors.filter((x) => x.name !== c.name))} className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-mute hover:bg-red-50 hover:text-red-700"><X className="h-4 w-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <label htmlFor="novo-tamanho" className="text-sm font-semibold">Tamanhos</label>
                <div className="flex gap-2">
                  <input id="novo-tamanho" className={inputClass} value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(sizeInput) } }} placeholder="Ex.: M" maxLength={20} />
                  <Button variant="secondary" onClick={() => addSize(sizeInput)}><Plus className="h-4 w-4" aria-hidden /> Adicionar</Button>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Atalhos de tamanhos">
                  {COMMON_SIZES.filter((s) => !sizes.some((x) => x.toLowerCase() === s.toLowerCase())).map((s) => (
                    <button key={s} type="button" onClick={() => addSize(s)} className="min-h-8 rounded border border-dashed border-line-strong px-2.5 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">+ {s}</button>
                  ))}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <li key={s} className="inline-flex items-center gap-1 rounded border border-line bg-paper py-1 pl-3 pr-1 text-sm font-semibold">
                      {s}
                      <button type="button" aria-label={`Remover tamanho ${s}`} onClick={() => setSizes(sizes.filter((x) => x !== s))} className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-mute hover:bg-red-50 hover:text-red-700"><X className="h-4 w-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {colors.length === 0 && sizes.length === 0 && (
              <label className="flex items-start gap-3 rounded border border-line bg-paper p-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" checked={singlePiece} onChange={(e) => setSinglePiece(e.target.checked)} />
                <span><span className="font-semibold">Esta é uma peça única</span><span className="block text-xs text-ink-soft">Sem escolha de cor nem de tamanho. Sem essa marca (e sem cores/tamanhos), o produto fica sem opção de compra e só pode ser salvo como rascunho.</span></span>
              </label>
            )}

            {matrix.length > 0 && <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <caption className="sr-only">Opções de compra do produto</caption>
                <thead className="text-left text-xs uppercase tracking-wide text-ink-mute">
                  <tr><th className="py-2 pr-3">Opção</th><th className="px-3 py-2">Disponível</th>{w.track_stock && <th className="px-3 py-2">Estoque</th>}<th className="px-3 py-2">Código da opção</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {matrix.map((cell) => {
                    const row = rowData[cell.key] ?? defaultRow()
                    const label = [cell.color, cell.size].filter(Boolean).join(' / ') || 'Peça única'
                    return (
                      <tr key={cell.key}>
                        <td className="py-2 pr-3 font-semibold">{label}</td>
                        <td className="px-3 py-2"><input type="checkbox" aria-label={`${label} disponível`} checked={row.available} onChange={(e) => patchRow(cell.key, { available: e.target.checked })} className="h-5 w-5 accent-brand" /></td>
                        {w.track_stock && <td className="px-3 py-2"><input inputMode="numeric" aria-label={`Estoque de ${label}`} value={row.stock} onChange={(e) => patchRow(cell.key, { stock: e.target.value })} className={`${inputClass} w-24 py-1.5`} /></td>}
                        <td className="px-3 py-2"><input aria-label={`Código de ${label}`} value={row.sku} maxLength={40} onChange={(e) => patchRow(cell.key, { sku: e.target.value })} className={`${inputClass} w-36 py-1.5`} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="space-y-4 rounded-sm border border-line bg-white p-5" aria-labelledby="s-pub">
            <h2 id="s-pub" className="text-2xl">Publicação</h2>
            <Field label="Situação no site"><select className={inputClass} {...register('status')}>{(Object.keys(STATUS_LABEL) as ProductStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
            <Field label="Disponibilidade para compra"><select className={inputClass} {...register('availability')}><option value="available">Disponível</option><option value="unavailable">Indisponível (não pode ser comprado)</option></select></Field>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" {...register('featured')} /><span><span className="font-semibold">Produto em destaque</span><span className="block text-xs text-ink-soft">Aparece na página inicial.</span></span></label>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" {...register('track_stock')} /><span><span className="font-semibold">Controlar estoque</span><span className="block text-xs text-ink-soft">Informe a quantidade de cada opção.</span></span></label>

            <div>
              <p className="mb-2 text-sm font-semibold">Para publicar</p>
              <ul className="space-y-1.5 text-sm">
                {[
                  ['Nome', w.name.trim() !== ''],
                  ['Preço válido', priceNum != null && priceNum > 0],
                  ['Categoria', Boolean(w.category_id)],
                  ['Ao menos uma foto', images.length > 0],
                  ['Opções de compra', matrix.length > 0],
                  ...(w.track_stock ? [['Estoque informado', !hasMissingStock(matrix, rowData)] as [string, boolean]] : []),
                ].map(([label, ok]) => (
                  <li key={label as string} className={`flex items-center gap-2 ${ok ? 'text-emerald-800' : 'text-ink-soft'}`}>
                    {ok ? <CircleCheck className="h-4 w-4" aria-hidden /> : <CircleDashed className="h-4 w-4" aria-hidden />}
                    {label as string}<span className="sr-only">{ok ? ' (ok)' : ' (falta)'}</span>
                  </li>
                ))}
              </ul>
              {publishIssues.length > 0 && <p className="mt-2 text-xs text-ink-soft">Enquanto faltar algo, salve como rascunho.</p>}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" size="lg" loading={saving}>Salvar</Button>
              <Button variant="secondary" disabled={saving} onClick={() => void submit('draft')()}>Salvar como rascunho</Button>
              <Button variant="ghost" disabled={saving} onClick={() => navigate('/admin/produtos')}>Cancelar alterações</Button>
            </div>
          </section>

          {isEdit && (
            <section className="rounded-sm border border-red-200 bg-white p-5">
              <h2 className="text-xl text-red-800">Excluir produto</h2>
              <p className="mt-1 text-sm text-ink-soft">Remove o produto e suas fotos. Para só tirar da loja, use Arquivado ou Rascunho.</p>
              <Button variant="danger" className="mt-3" onClick={() => setConfirmDelete(true)}>Excluir produto</Button>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog open={confirmDelete} title="Excluir este produto?" confirmLabel="Excluir" danger busy={deleting} onConfirm={() => void doDelete()} onCancel={() => setConfirmDelete(false)}>
        “{product?.name}” e todas as suas fotos serão removidos de forma definitiva.
      </ConfirmDialog>
    </form>
  )
}
