import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ItemAction } from '@renderer/actions/itemActions'
import { IconGlyph } from '@renderer/utils/icons'

interface FlowItemMenuProps {
  actions: ItemAction[]
  onRun: (action: ItemAction) => void
  children: React.ReactNode
}

interface MenuPosition {
  x: number
  y: number
  origin: string
}

interface MenuEntry {
  close: () => void
}

// Only one context menu can be open at a time (module-level registry)
let activeMenu: MenuEntry | null = null

export default function FlowItemMenu({ actions, onRun, children }: FlowItemMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  // Stable registry entry per component instance; impl refreshed each render
  const entryRef = useRef<MenuEntry | null>(null)
  if (!entryRef.current) entryRef.current = { close: () => {} }

  function close() {
    if (!mountedRef.current) return
    activeMenu = null
    setShowMenu(false)
    setPosition(null)
    document.body.removeAttribute('data-context-menu')
  }
  entryRef.current.close = close

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    activeMenu?.close()
    activeMenu = entryRef.current
    document.body.setAttribute('data-context-menu', 'open')

    const rowRect = e.currentTarget.getBoundingClientRect()
    const margin = 8
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const approxWidth = 176
    const approxHeight = Math.min(actions.length * 32 + 16, 220)

    // Position relative to clicked row, preferring the right side of the row / cursor
    let targetX = e.clientX
    // If aligning to cursor or right side would overflow window, flip left
    if (targetX + approxWidth + margin > windowWidth) {
      targetX = targetX - approxWidth
    }
    // Clamp horizontally within viewport
    targetX = Math.max(margin, Math.min(targetX, windowWidth - approxWidth - margin))

    // Anchor vertically to the row bounds
    let targetY = rowRect.top
    let originY = 'top'
    if (targetY + approxHeight + margin > windowHeight) {
      targetY = Math.max(margin, rowRect.bottom - approxHeight)
      originY = 'bottom'
    } else {
      targetY = Math.max(margin, targetY)
    }

    const originX = targetX < e.clientX ? 'right' : 'left'

    setPosition({
      x: targetX,
      y: targetY,
      origin: `${originY} ${originX}`,
    })
    setShowMenu(true)
  }

  useEffect(() => {
    mountedRef.current = true
    const entry = entryRef.current
    return () => {
      mountedRef.current = false
      if (activeMenu === entry) {
        activeMenu = null
        document.body.removeAttribute('data-context-menu')
      }
    }
  }, [])

  // Clamp inside viewport after paint, flip transform origin when clamped
  useLayoutEffect(() => {
    if (showMenu && menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect()
      const margin = 8
      const maxX = window.innerWidth - rect.width - margin
      const maxY = window.innerHeight - rect.height - margin
      const cx = Math.max(margin, Math.min(position.x, maxX))
      const cy = Math.max(margin, Math.min(position.y, maxY))
      if (cx !== position.x || cy !== position.y) {
        setPosition((prev) =>
          prev
            ? {
                x: cx,
                y: cy,
                origin: `${cy < prev.y ? 'bottom' : 'top'} ${cx < prev.x ? 'right' : 'left'}`,
              }
            : null
        )
      }
    }
  }, [showMenu, position?.x, position?.y])

  // Global listeners while open: outside click, outside right-click, Escape
  useEffect(() => {
    if (!showMenu) return

    const isInside = (target: EventTarget | null) =>
      menuRef.current != null && target instanceof Node && menuRef.current.contains(target)

    const onDocClick = (e: MouseEvent) => {
      if (isInside(e.target)) return
      e.stopPropagation()
      e.preventDefault()
      close()
    }

    const onDocContextMenu = (e: MouseEvent) => {
      if (isInside(e.target)) return
      // Close now; do NOT swallow — the row under the cursor handles
      // this event and opens its own menu (old closes, new opens).
      close()
    }

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        close()
        return
      }
      // Any other key dismisses the menu but lets the key through
      // (modifier-only presses shouldn't dismiss it)
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
        close()
      }
    }

    document.addEventListener('click', onDocClick, true)
    document.addEventListener('contextmenu', onDocContextMenu, true)
    document.addEventListener('keydown', onDocKeyDown, true)
    return () => {
      document.removeEventListener('click', onDocClick, true)
      document.removeEventListener('contextmenu', onDocContextMenu, true)
      document.removeEventListener('keydown', onDocKeyDown, true)
    }
  }, [showMenu])

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>

      {showMenu &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-lg border border-flow-border bg-flow-surface p-1 context-menu select-none"
            style={{
              left: position.x,
              top: position.y,
              transformOrigin: position.origin,
              animation: 'flowScaleIn var(--duration-fast) var(--ease-out-expo) both',
              boxShadow:
                '0 12px 32px -8px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            {actions.map((action, index) => (
              <React.Fragment key={action.id}>
                {action.separatorBefore && index > 0 && (
                  <div className="mx-2 my-1 h-px bg-flow-border" />
                )}
                <button
                  onClick={() => {
                    close()
                    onRun(action)
                  }}
                  className={[
                    'flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left text-xs',
                    'flow-transition-colors-fast',
                    action.danger
                      ? 'text-flow-danger hover:bg-flow-danger/10'
                      : 'text-flow-secondary hover:bg-flow-hover hover:text-flow-primary',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex w-4 justify-center',
                      action.danger ? 'text-flow-danger/80' : 'text-flow-muted',
                    ].join(' ')}
                  >
                    <IconGlyph name={action.glyph} size={12} />
                  </span>
                  <span className="flex-1 truncate">{action.label}</span>
                  {action.hint && (
                    <span className="text-[10px] text-flow-muted/60">{action.hint}</span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
