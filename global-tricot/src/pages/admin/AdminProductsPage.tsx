import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { ProductAvailability, ProductStatus } from '../../types/db'
import { useToast } from '../../context/ToastContext'
import { friendlyError } from '../../lib/errors'
import { formatBRL, formatDate, normalizeText } from '../../lib/format'
import { effectivePrice, hasValidPromo } from '../../lib/pricing'
import { adminListProducts, deleteProduct, updateProductFlags, type AdminProductRow } from '../../services/adminProducts'
import { Button, LinkButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputClass } from '../../components/ui/Field'
import { Alert, Badge, EmptyState, Spinner } from '../../components/ui/Feedback'
import { ProductImage } from '../../components/ui/ProductImage'

const STATUS_LABEL: Record<ProductStatus, string> = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' }

export default function AdminProductsPage() {
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const [rows, setRows] = useState<AdminProductRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [pendingDelete, setPendingDelete] = useState<AdminProductRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const statusFilter = sp.get('status') ?? ''
  const categoryFilter = sp.get('categoria') ?? ''

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await adminListProducts())
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível carregar os produtos.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(() => [...new Set((rows ?? []).map((r) => r.category?.name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows])
  const filtered = useMemo(() => {
    const term = normalizeText(q)
    return (rows ?? []).filter((r) => {
      if (term && !normalizeText(`${r.name} ${r.code ?? ''}`).includes(term)) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (categoryFilter && r.category?.name !== categoryFilter) return false
      return true
    })
  }, [rows, q, statusFilter, categoryFilter])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(sp)
    if (value) next.set(key, value)
    else next.delete(key)
    setSp(next, { replace: true })
  }

  // Só atualiza a tela depois que o banco confirmou a mudança.
  const change = async (row: AdminProductRow, patch: Partial<{ status: ProductStatus; featured: boolean; availability: ProductAvailability }>, okMessage: string) => {
    setBusyId(row.id)
    try {
      await updateProductFlags(row.id, patch)
      setRows((cur) => (cur ?? []).map((r) => (r.id === row.id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r)))
      toast.success(okMessage)
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível atualizar o produto.'))
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteProduct(pendingDelete.id)
      setRows((cur) => (cur ?? []).filter((r) => r.id !== pendingDelete.id))
      toast.success('Produto excluído.')
      setPendingDelete(null)
    } catch (e) {
      toast.error(friendlyError(e, 'Não foi possível excluir o produto.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Produtos</h1>
          <p className="text-sm text-ink-soft">{rows ? `${filtered.length} de ${rows.length} produtos` : 'Carregando...'}</p>
        </div>
        <LinkButton to="/admin/produtos/novo"><Plus className="h-4 w-4" aria-hidden /> Adicionar produto</LinkButton>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <div><label htmlFor="adm-busca" className="sr-only">Pesquisar por nome ou código</label><input id="adm-busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por nome ou código" className={inputClass} /></div>
        <div><label htmlFor="adm-status" className="sr-only">Filtrar por situação</label><select id="adm-status" value={statusFilter} onChange={(e) => setFilter('status', e.target.value)} className={inputClass}><option value="">Todas as situações</option>{(Object.keys(STATUS_LABEL) as ProductStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        <div><label htmlFor="adm-cat" className="sr-only">Filtrar por categoria</label><select id="adm-cat" value={categoryFilter} onChange={(e) => setFilter('categoria', e.target.value)} className={inputClass}><option value="">Todas as categorias</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>

      {error && <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Tentar de novo</Button>}>{error}</Alert>}
      {!rows && !error && <Spinner label="Carregando produtos" />}
      {rows && rows.length === 0 && <EmptyState title="Nenhum produto ainda" action={<LinkButton to="/admin/produtos/novo">Cadastrar o primeiro produto</LinkButton>}>Você pode salvar rascunhos incompletos e publicar quando tudo estiver pronto.</EmptyState>}
      {rows && rows.length > 0 && filtered.length === 0 && <EmptyState title="Nada encontrado">Ajuste a pesquisa ou os filtros.</EmptyState>}

      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-sm border border-line bg-white">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">Lista de produtos</caption>
            <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-mute">
              <tr>
                <th className="px-4 py-3">Produto</th><th className="px-3 py-3">Código</th><th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Preço</th><th className="px-3 py-3">Disponibilidade</th><th className="px-3 py-3">Situação</th>
                <th className="px-3 py-3">Atualizado</th><th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => {
                const price = effectivePrice(r)
                return (
                  <tr key={r.id} className={busyId === r.id ? 'opacity-60' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage path={r.main_image_path} alt="" className="h-14 w-12 shrink-0 rounded-sm text-[10px]" />
                        <div className="min-w-0"><Link to={`/admin/produtos/${r.id}`} className="font-semibold hover:text-brand">{r.name}</Link>{r.featured && <Badge tone="brand" className="ml-2">Destaque</Badge>}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{r.code ?? '-'}</td>
                    <td className="px-3 py-3 text-ink-soft">{r.category?.name ?? <span className="text-amber-800">Sem categoria</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{price != null ? formatBRL(price) : <span className="text-ink-mute">Sem preço</span>}{hasValidPromo(r) && <Badge tone="warning" className="ml-1">Promo</Badge>}</td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`av-${r.id}`}>Disponibilidade de {r.name}</label>
                      <select id={`av-${r.id}`} value={r.availability} disabled={busyId === r.id} onChange={(e) => void change(r, { availability: e.target.value as ProductAvailability }, 'Disponibilidade atualizada.')} className={`${inputClass} w-auto py-1.5 text-sm`}>
                        <option value="available">Disponível</option><option value="unavailable">Indisponível</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`st-${r.id}`}>Situação de {r.name}</label>
                      <select id={`st-${r.id}`} value={r.status} disabled={busyId === r.id} onChange={(e) => void change(r, { status: e.target.value as ProductStatus }, `Produto movido para ${STATUS_LABEL[e.target.value as ProductStatus].toLowerCase()}.`)} className={`${inputClass} w-auto py-1.5 text-sm`}>
                        {(Object.keys(STATUS_LABEL) as ProductStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-soft">{formatDate(r.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" disabled={busyId === r.id} onClick={() => void change(r, { featured: !r.featured }, r.featured ? 'Removido dos destaques.' : 'Produto em destaque.')} aria-pressed={r.featured} aria-label={`${r.featured ? 'Remover destaque de' : 'Destacar'} ${r.name}`} className={`inline-flex h-10 w-10 items-center justify-center rounded hover:bg-ink/5 ${r.featured ? 'text-brand' : 'text-ink-mute'}`}><Star className="h-4 w-4" fill={r.featured ? 'currentColor' : 'none'} aria-hidden /></button>
                        <Link to={`/admin/produtos/${r.id}`} aria-label={`Editar ${r.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded hover:bg-ink/5"><Pencil className="h-4 w-4" aria-hidden /></Link>
                        <button type="button" onClick={() => setPendingDelete(r)} aria-label={`Excluir ${r.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={Boolean(pendingDelete)} title="Excluir este produto?" confirmLabel="Excluir" danger busy={deleting} onConfirm={() => void confirmDelete()} onCancel={() => setPendingDelete(null)}>
        “{pendingDelete?.name}” e suas fotos serão removidos de forma definitiva. Para apenas tirar da loja, mude a situação para Arquivado ou Rascunho.
      </ConfirmDialog>
    </div>
  )
}
