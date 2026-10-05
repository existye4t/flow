import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ItemAction } from '@renderer/actions/itemActions'
import { getUtilityActions } from '@renderer/actions/registry'
import { IconGlyph } from '@renderer/utils/icons'
import { formatShortcut } from '@renderer/utils/platform'

interface ActionPanelProps {
  /** Actions for the selected flow item (empty when nothing is selected). */
  itemActions: ItemAction[]
  itemLabel?: string
  onRunItemAction: (action: ItemAction) => void
  onRunUtility: (run: () => void | Promise<void>) => void
  onClose: () => void
}

type PanelEntry =
  | { kind: 'item'; action: ItemAction }
  | { kind: 'utility'; id: string; title: string; subtitle?: string; glyph: string; run: () => void | Promise<void> }

export default function ActionPanel({
  itemActions,
  itemLabel,
  onRunItemAction,
  onRunUtility,
  onClose,
}: ActionPanelProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    document.body.setAttribute('data-context-menu', 'open')
    return () => {
      document.body.removeAttribute('data-context-menu')
    }
  }, [])

  const entries = useMemo<PanelEntry[]>(() => {
    const q = query.trim().toLowerCase()
    if (itemActions.length > 0) {
      const filtered = q
        ? itemActions.filter((a) => a.label.toLowerCase().includes(q))
        : itemActions
      return filtered.map((action) => ({ kind: 'item' as const, action }))
    }
    return getUtilityActions(q).map((u) => ({
      kind: 'utility' as const,
      id: u.id,
      title: u.title,
      subtitle: u.subtitle,
      glyph: u.glyph,
      run: u.run,
    }))
  }, [itemActions, query])

  // Reset selection when the entry list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query, itemActions])

  // Keep active row visible
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const row = list.querySelector<HTMLElement>(`[data-action-index="${activeIndex}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const [isExiting, setIsExiting] = useState(false)

  const handleClose = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 100)
  }

  const runEntry = (entry: PanelEntry) => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      if (entry.kind === 'item') {
        onRunItemAction(entry.action)
      } else {
        onRunUtility(entry.run)
      }
    }, 80)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+K toggles the panel closed
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      e.stopPropagation()
      handleClose()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      handleClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex((i) => (entries.length ? (i + 1) % entries.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setActiveIndex((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const entry = entries[activeIndex]
      if (entry) runEntry(entry)
      return
    }
    // Swallow other keys so the launcher beneath doesn't react
    if (e.key.length === 1 || e.key === 'Backspace') {
      e.stopPropagation()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-40 modal-backdrop ${isExiting ? 'exiting' : ''}`}
      onMouseDown={handleClose}
      onKeyDown={handleKeyDown}
      data-action-panel="open"
    >
      <div
        className={`absolute left-1/2 top-[112px] w-[440px] -translate-x-1/2 overflow-hidden rounded-xl border border-flow-border bg-flow-surface context-menu ${
          isExiting ? 'exiting' : ''
        }`}
        style={{
          boxShadow: '0 16px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-2.5 border-b border-flow-border px-3.5 py-2.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="flex-shrink-0 text-flow-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={itemActions.length > 0 ? 'Type a command...' : 'Type a utility...'}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium tracking-[-0.012em] text-flow-primary placeholder:font-normal placeholder:tracking-[-0.005em] placeholder:text-flow-tertiary outline-none border-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>{formatShortcut('K')}</kbd>
        </div>

        {/* Group label */}
        {itemActions.length === 0 && entries.length > 0 && (
          <div className="px-3.5 pb-0.5 pt-2">
            <span className="text-label">Utilities</span>
          </div>
        )}
        {itemActions.length > 0 && itemLabel && (
          <div className="px-3.5 pb-0.5 pt-2">
            <span className="text-label">{itemLabel}</span>
          </div>
        )}

        {/* Entries */}
        <div ref={listRef} className="max-h-[264px] overflow-y-auto p-1">
          {entries.length === 0 ? (
            <div className="flex h-14 items-center justify-center text-xs text-flow-muted">
              No actions
            </div>
          ) : (
            entries.map((entry, index) => {
              const active = index === activeIndex
              const title = entry.kind === 'item' ? entry.action.label : entry.title
              const glyph = entry.kind === 'item' ? entry.action.glyph : entry.glyph
              const subtitle = entry.kind === 'utility' ? entry.subtitle : undefined
              const danger = entry.kind === 'item' ? entry.action.danger : undefined
              const hint = entry.kind === 'item' ? entry.action.hint : undefined
              return (
                <button
                  key={entry.kind === 'item' ? entry.action.id : entry.id}
                  data-action-index={index}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => runEntry(entry)}
                  className={[
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left',
                    'flow-transition-colors-fast',
                    active ? 'bg-flow-hover' : '',
                    danger
                      ? active ? 'text-flow-danger' : 'text-flow-danger/85'
                      : active
                        ? 'text-flow-primary'
                        : 'text-flow-secondary',
                  ].join(' ')}
                >
                  <span className={active ? 'text-flow-secondary' : 'text-flow-muted'}>
                    <IconGlyph name={glyph} size={14} />
                  </span>
                  <span className="flex-1 truncate text-[12.5px] tracking-[-0.005em]">{title}</span>
                  {subtitle && (
                    <span className="max-w-[160px] truncate text-[11px] text-flow-muted">
                      {subtitle}
                    </span>
                  )}
                  {hint && !subtitle && (
                    <span className="text-[10px] text-flow-muted">{hint}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
