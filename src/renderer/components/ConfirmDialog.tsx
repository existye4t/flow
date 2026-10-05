import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onCancel, onConfirm])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-backdrop"
      onClick={onCancel}
    >
      <div
        className="w-[320px] rounded-xl border border-flow-border bg-flow-surface p-4 shadow-flow-modal modal-content select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-flow-primary">{title}</h3>
        <p className="mt-1 text-xs text-flow-muted leading-relaxed">{description}</p>

        <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-flow-muted hover:text-flow-secondary transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`rounded px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              danger
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
                : 'btn-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
