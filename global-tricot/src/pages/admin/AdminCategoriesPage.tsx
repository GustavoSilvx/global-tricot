import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { friendlyError } from '../../lib/errors'
import { validateImageFile } from '../../lib/images'
import { SLUG_REGEX, slugify } from '../../lib/slug'
import { publicImageUrl } from '../../lib/supabase'
import { adminListCategories, deleteCategory, saveCategory, type CategoryWithCount } from '../../services/categories'
import { removeImages, uploadImage } from '../../services/storage'
import { Badge, Alert, EmptyState, Spinner } from '../../components/ui/Feedback'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, inputClass } from '../../components/ui/Field'

interface Draft {
  id?: string
  name: string
  slug: string
  description: string
  active: boolean
  position: string
  cover_image_path: string | null
  coverFile: File | null
  coverPreview: string | null
}
const blank = (position: number): Draft => ({ name: '', slug: '', description: '', active: true, position: String(position), cover_image_path: null, coverFile: null, coverPreview: null })

export default function AdminCategoriesPage() {
  const toast = useToast()
  const [rows, setRows] = useState<CategoryWithCount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CategoryWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await adminListCategories())
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível carregar as categorias.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const edit = (c?: CategoryWithCount) => {
    setFormError(null)
    setSlugTouched(Boolean(c))
    setDraft(c ? { id: c.id, name: c.name, slug: c.slug, description: c.description ?? '', active: c.active, position: String(c.position), cover_image_path: c.cover_image_path, coverFile: null, coverPreview: publicImageUrl(c.cover_image_path) } : blank((rows?.length ?? 0) + 1))
  }
  const close = () => {
    if (draft?.coverFile && draft.coverPreview) URL.revokeObjectURL(draft.coverPreview)
    setDraft(null)
  }

  const pickCover = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !draft) return
    const problem = validateImageFile(file)
    if (problem) return setFormError(problem)
    setFormError(null)
    if (draft.coverFile && draft.coverPreview) URL.revokeObjectURL(draft.coverPreview)
    setDraft({ ...draft, coverFile: file, coverPreview: URL.createObjectURL(file) })
  }

  const save = async () => {
    if (!draft) return
    const name = draft.name.trim()
    const slug = draft.slug.trim()
    if (!name) return setFormError('Informe o nome da categoria.')
    if (!SLUG_REGEX.test(slug)) return setFormError('O endereço (slug) deve ter letras minúsculas, números e hífens.')
    const position = Number.parseInt(draft.position, 10)
    if (!Number.isFinite(position)) return setFormError('A ordem deve ser um número.')

    setSaving(true)
    setFormError(null)
    let uploaded: string | null = null
    try {
      let cover = draft.cover_image_path
      if (draft.coverFile) {
        uploaded = await uploadImage('categories', draft.id ?? 'nova', draft.coverFile)
        cover = uploaded
      }
      await saveCategory({ id: draft.id, name, slug, description: draft.description.trim() || null, cover_image_path: cover, active: draft.active, position })
      if (uploaded && draft.cover_image_path) await removeImages([draft.cover_image_path])
      toast.success('Categoria salva.')
      close()
      await load()
    } catch (e) {
      if (uploaded) await removeImages([uploaded])
      setFormError(friendlyError(e, 'Não foi possível salvar a categoria.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: CategoryWithCount) => {
    try {
      await saveCategory({ id: c.id, name: c.name, slug: c.slug, description: c.description, cover_image_path: c.cover_image_path, active: !c.active, position: c.position })
      setRows((cur) => (cur ?? []).map((r) => (r.id === c.id ? { ...r, active: !c.active } : r)))
      toast.success(c.active ? 'Categoria desativada. Ela e seus produtos saíram da loja.' : 'Categoria ativada.')
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível atualizar a categoria.'))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteCategory(pendingDelete)
      toast.success('Categoria excluída.')
      setPendingDelete(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error && !('code' in e) ? e.message : friendlyError(e, 'Não foi possível excluir a categoria.'))
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl">Categorias</h1><p className="text-sm text-ink-soft">Organize o catálogo. Desativar uma categoria também esconde os produtos dela da loja.</p></div>
        <Button onClick={() => edit()}><Plus className="h-4 w-4" aria-hidden /> Nova categoria</Button>
      </header>

      {draft && (
        <section aria-label={draft.id ? 'Editar categoria' : 'Nova categoria'} className="space-y-5 rounded-sm border border-line bg-white p-5 sm:p-6">
          <h2 className="text-2xl">{draft.id ? 'Editar categoria' : 'Nova categoria'}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome" required><input className={inputClass} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugTouched ? draft.slug : slugify(e.target.value) })} /></Field>
            <Field label="Endereço (slug)" required hint={`/catalogo?categoria=${draft.slug || '...'}`}><input className={inputClass} value={draft.slug} onChange={(e) => { setSlugTouched(true); setDraft({ ...draft, slug: e.target.value }) }} /></Field>
            <Field label="Descrição (opcional)" className="sm:col-span-2"><textarea rows={2} className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Ordem de exibição"><input inputMode="numeric" className={inputClass} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} /></Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-brand" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Categoria ativa</label>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Imagem de capa (opcional)</p>
            <div className="flex items-center gap-4">
              {draft.coverPreview ? <img src={draft.coverPreview} alt="Prévia da capa" className="h-24 w-32 rounded-sm object-cover" /> : <div className="rib-soft flex h-24 w-32 items-center justify-center rounded-sm text-xs text-brand-dark/70">Sem capa</div>}
              <div className="flex flex-col gap-2">
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded border border-ink/25 bg-white px-3 text-sm font-semibold hover:border-ink">{draft.coverPreview ? 'Trocar imagem' : 'Escolher imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickCover} /></label>
                {draft.coverPreview && <button type="button" className="text-left text-sm font-semibold text-red-700" onClick={() => setDraft({ ...draft, coverFile: null, coverPreview: null, cover_image_path: null })}>Remover capa</button>}
              </div>
            </div>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex gap-3"><Button onClick={() => void save()} loading={saving}>Salvar categoria</Button><Button variant="secondary" onClick={close} disabled={saving}>Cancelar</Button></div>
        </section>
      )}

      {error && <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Tentar de novo</Button>}>{error}</Alert>}
      {!rows && !error && <Spinner label="Carregando categorias" />}
      {rows && rows.length === 0 && <EmptyState title="Nenhuma categoria">Crie categorias como Tricô, Blusas, Regatas ou Moda Academia.</EmptyState>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Lista de categorias</caption>
            <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-3">Categoria</th><th className="px-3 py-3">Endereço</th><th className="px-3 py-3">Produtos</th><th className="px-3 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-3 py-3 text-ink-soft">{c.slug}</td>
                  <td className="px-3 py-3">{c.product_count}</td>
                  <td className="px-3 py-3"><button type="button" onClick={() => void toggleActive(c)} aria-label={`${c.active ? 'Desativar' : 'Ativar'} categoria ${c.name}`}>{c.active ? <Badge tone="success">Ativa</Badge> : <Badge tone="muted">Desativada</Badge>}</button></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <button type="button" onClick={() => edit(c)} aria-label={`Editar ${c.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded hover:bg-ink/5"><Pencil className="h-4 w-4" aria-hidden /></button>
                    <button type="button" disabled={c.product_count > 0} onClick={() => setPendingDelete(c)} aria-label={`Excluir ${c.name}`} title={c.product_count > 0 ? 'Mova os produtos para outra categoria antes de excluir' : 'Excluir categoria'} className="inline-flex h-10 w-10 items-center justify-center rounded text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-ink-mute disabled:hover:bg-transparent"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={Boolean(pendingDelete)} title="Excluir esta categoria?" confirmLabel="Excluir" danger busy={deleting} onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)}>
        A categoria “{pendingDelete?.name}” não tem produtos e será removida.
      </ConfirmDialog>
    </div>
  )
}
