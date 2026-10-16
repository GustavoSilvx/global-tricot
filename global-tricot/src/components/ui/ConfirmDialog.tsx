import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação para ações destrutivas, usando <dialog> nativo (foco e ESC tratados pelo navegador). */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancelar', danger, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      aria-labelledby="confirm-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <div className="space-y-3 p-6">
        <h2 id="confirm-title" className="font-display text-2xl">{title}</h2>
        {children && <div className="text-sm leading-relaxed text-ink-soft">{children}</div>}
      </div>
      <div className="flex justify-end gap-3 border-t border-line bg-paper px-6 py-4">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </dialog>
  )
}
