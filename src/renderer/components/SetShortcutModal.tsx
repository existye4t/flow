import { useState, useEffect } from 'react'
import ShortcutRecorder from './ShortcutRecorder'
import { isValidShortcutInput } from '@renderer/utils/platform'
import { useFlowStore } from '@renderer/store/flow-store'
import { useSettings } from '@renderer/store/settings-store'

interface SetShortcutModalProps {
  isOpen: boolean
  title: string
  subtitle?: string
  initialShortcut?: string
  targetId: string
  targetType: 'project' | 'item'
  onSave: (shortcut?: string) => void
  onClose: () => void
}

export default function SetShortcutModal({
  isOpen,
  title,
  subtitle,
  initialShortcut = '',
  targetId,
  targetType,
  onSave,
  onClose,
}: SetShortcutModalProps) {
  const [shortcut, setShortcut] = useState(initialShortcut)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const projects = useFlowStore((s) => s.projects)
  const items = useFlowStore((s) => s.items)

  useEffect(() => {
    if (isOpen) {
      setShortcut(initialShortcut)
      setError(null)
      setIsValidating(false)
    }
  }, [isOpen, initialShortcut])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = async () => {
    const trimmed = shortcut.trim()
    if (!trimmed) {
      onSave(undefined)
      onClose()
      return
    }

    const lower = trimmed.toLowerCase()
    if (!isValidShortcutInput(lower)) {
      setError('Lütfen geçerli bir kombinasyon kullanın (ör. Ctrl+Alt+D)')
      return
    }

    // Check collisions with other projects
    const conflictProj = projects.find(
      (p) => (targetType !== 'project' || p.id !== targetId) && p.shortcut?.toLowerCase() === lower
    )
    if (conflictProj) {
      setError(`Zaten "${conflictProj.name}" projesine atanmış`)
      return
    }

    // Check collisions with flow items
    const conflictItem = items.find(
      (i) => (targetType !== 'item' || i.id !== targetId) && i.shortcut?.toLowerCase() === lower
    )
    if (conflictItem) {
      setError(`Zaten "${conflictItem.name}" akışına atanmış`)
      return
    }

    // Check system shortcuts
    const st = useSettings.getState()
    if (
      lower === st.globalShortcut.toLowerCase() ||
      lower === st.settingsShortcut.toLowerCase() ||
      lower === st.actionShortcut.toLowerCase() ||
      lower === st.screenshotShortcut.toLowerCase()
    ) {
      setError('Mevcut bir sistem kısayolu ile çakışıyor')
      return
    }

    setIsValidating(true)
    try {
      if (window.electron?.shortcuts?.validate) {
        const val = await window.electron.shortcuts.validate(trimmed, targetId)
        if (!val.success) {
          setError(val.error || 'Bu kısayol başka bir uygulama tarafından kullanılıyor')
          setIsValidating(false)
          return
        }
      }
    } catch {
      // ignore
    } finally {
      setIsValidating(false)
    }

    onSave(trimmed)
    onClose()
  }

  const handleClear = () => {
    setShortcut('')
    setError(null)
    onSave(undefined)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-backdrop select-none"
      onClick={onClose}
    >
      <div
        className="w-[360px] rounded-xl border border-flow-border bg-flow-surface p-4 shadow-flow-modal modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-flow-primary">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-flow-muted">{subtitle}</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-flow-muted">
              {targetType === 'project'
                ? 'Pressing this hotkey opens Flow focused directly on this workspace.'
                : 'Pressing this hotkey launches this item directly without opening the launcher.'}
            </p>
          )}
        </div>

        <div className="my-3">
          <label className="block text-[11px] text-flow-muted mb-1.5">
            Key Combination
          </label>
          <ShortcutRecorder
            value={shortcut}
            onChange={(val) => {
              setShortcut(val)
              setError(null)
            }}
            hasError={Boolean(error)}
            widthClass="w-full"
            placeholder="Click to record (e.g. Ctrl + Alt + D)"
          />
          {error ? (
            <p className="mt-1.5 text-[11px] text-red-400">{error}</p>
          ) : (
            <p className="mt-1.5 text-[10px] text-flow-muted leading-tight">
              Hold modifier keys like <span className="text-flow-secondary">Ctrl</span>,{' '}
              <span className="text-flow-secondary">Alt</span>, or{' '}
              <span className="text-flow-secondary">Shift</span> and press a letter or function key.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between pt-2.5 border-t border-white/[0.06]">
          {initialShortcut ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-red-400/80 hover:text-red-400 transition-colors cursor-pointer"
            >
              Clear Shortcut
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-flow-muted hover:text-flow-secondary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isValidating}
              onClick={handleSave}
              className="btn-primary text-xs px-3.5 py-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isValidating ? 'Checking...' : 'Save Shortcut'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
