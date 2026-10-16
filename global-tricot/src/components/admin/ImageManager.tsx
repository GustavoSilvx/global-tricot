import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, RefreshCw, Star, Trash2 } from 'lucide-react'
import { validateImageFile } from '../../lib/images'
import { cx } from '../../lib/cx'
import { Alert } from '../ui/Feedback'
import { inputClass } from '../ui/Field'

export interface ImageItem {
  key: string
  /** Presente nas imagens já salvas. */
  id?: string
  storage_path?: string
  /** Presente nas imagens novas (ainda não enviadas). */
  file?: File
  previewUrl: string
  alt: string
  color_variant: string
  is_main: boolean
}

interface Props {
  items: ImageItem[]
  onChange: (items: ImageItem[]) => void
  /** Cores cadastradas, para ligar uma foto a uma cor. */
  colors: string[]
  disabled?: boolean
}

const newKey = () => crypto.randomUUID()

export function ImageManager({ items, onChange, colors, disabled }: Props) {
  const [errors, setErrors] = useState<string[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Libera as URLs temporárias das prévias ao sair da tela.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.file && URL.revokeObjectURL(i.previewUrl))
    },
    [],
  )

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const problems: string[] = []
    const added: ImageItem[] = []
    for (const file of files) {
      const problem = validateImageFile(file)
      if (problem) {
        problems.push(`${file.name}: ${problem}`)
        continue
      }
      added.push({ key: newKey(), file, previewUrl: URL.createObjectURL(file), alt: '', color_variant: '', is_main: false })
    }
    setErrors(problems)
    if (!added.length) return
    const next = [...items, ...added]
    if (!next.some((i) => i.is_main)) next[0] = { ...next[0], is_main: true }
    onChange(next)
  }

  const replaceFile = (key: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = validateImageFile(file)
    if (problem) return setErrors([`${file.name}: ${problem}`])
    setErrors([])
    onChange(
      items.map((i) => {
        if (i.key !== key) return i
        if (i.file) URL.revokeObjectURL(i.previewUrl)
        // vira uma imagem nova na mesma posição; a antiga é removida ao salvar
        return { key: newKey(), file, previewUrl: URL.createObjectURL(file), alt: i.alt, color_variant: i.color_variant, is_main: i.is_main }
      }),
    )
  }

  const remove = (key: string) => {
    const target = items.find((i) => i.key === key)
    if (target?.file) URL.revokeObjectURL(target.previewUrl)
    const rest = items.filter((i) => i.key !== key)
    if (target?.is_main && rest.length) rest[0] = { ...rest[0], is_main: true }
    onChange(rest)
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  const patch = (key: string, p: Partial<ImageItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...p } : i)))
  const setMain = (key: string) => onChange(items.map((i) => ({ ...i, is_main: i.key === key })))

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Alert tone="error" title="Algumas imagens foram ignoradas">
          <ul className="list-disc pl-5">{errors.map((er) => <li key={er}>{er}</li>)}</ul>
        </Alert>
      )}

      {items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it, index) => (
            <li key={it.key} className={cx('space-y-2 rounded border bg-white p-3', it.is_main ? 'border-brand' : 'border-line')}>
              <div className="relative">
                <img src={it.previewUrl} alt={it.alt || `Foto ${index + 1}`} className="aspect-[4/5] w-full rounded-sm bg-paper-warm object-cover" />
                {it.is_main && <span className="absolute left-2 top-2 rounded-sm bg-brand px-2 py-0.5 text-xs font-bold text-white">Principal</span>}
                {it.file && <span className="absolute right-2 top-2 rounded-sm bg-ink px-2 py-0.5 text-xs font-bold text-white">Nova</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" disabled={disabled || it.is_main} onClick={() => setMain(it.key)} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold hover:bg-ink/5 disabled:text-ink-mute">
                  <Star className="h-4 w-4" aria-hidden /> Principal
                </button>
                <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Mover foto ${index + 1} para trás`} className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-ink/5 disabled:text-ink-mute"><ArrowLeft className="h-4 w-4" aria-hidden /></button>
                <button type="button" disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Mover foto ${index + 1} para frente`} className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-ink/5 disabled:text-ink-mute"><ArrowRight className="h-4 w-4" aria-hidden /></button>
                <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded hover:bg-ink/5" title="Substituir foto">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Substituir foto {index + 1}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} onChange={(e) => replaceFile(it.key, e)} />
                </label>
                <button type="button" disabled={disabled} onClick={() => remove(it.key)} aria-label={`Remover foto ${index + 1}`} className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
              <input aria-label={`Texto alternativo da foto ${index + 1}`} placeholder="Descrição da foto (acessibilidade)" maxLength={140} value={it.alt} onChange={(e) => patch(it.key, { alt: e.target.value })} className={cx(inputClass, 'py-1.5 text-sm')} />
              {colors.length > 0 && (
                <select aria-label={`Cor da foto ${index + 1}`} value={it.color_variant} onChange={(e) => patch(it.key, { color_variant: e.target.value })} className={cx(inputClass, 'py-1.5 text-sm')}>
                  <option value="">Foto geral (todas as cores)</option>
                  {colors.map((c) => <option key={c} value={c}>Foto da cor {c}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      <label className={cx('flex cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed border-line-strong bg-white px-4 py-8 text-center text-sm hover:border-brand', disabled && 'pointer-events-none opacity-60')}>
        <ImagePlus className="h-7 w-7 text-brand" aria-hidden />
        <span className="font-semibold">Adicionar fotos</span>
        <span className="text-xs text-ink-soft">JPG, PNG ou WebP. As fotos são otimizadas antes do envio.</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={disabled} onChange={addFiles} />
      </label>
    </div>
  )
}
