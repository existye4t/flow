import { useEffect, useCallback, useRef, useState } from 'react'
import { useFlowStore } from '@renderer/store/flow-store'
import { useSettings } from '@renderer/store/settings-store'
import { searchItems } from '@renderer/utils/search'
import { useDataLoader } from '@renderer/hooks/useDataLoader'
import SearchInput from '@renderer/components/SearchInput'
import ResultsList from '@renderer/components/ResultsList'
import KeyboardHints from '@renderer/components/KeyboardHints'
import AddFlowModal from '@renderer/components/AddFlowModal'
import WindowHeader from '@renderer/components/WindowHeader'
import AmbientCode from '@renderer/components/AmbientCode'
import SettingsPanel from '@renderer/components/SettingsPanel'
import ActionPanel from '@renderer/components/ActionPanel'
import ProjectsView from '@renderer/components/ProjectsView'
import ConfirmDialog from '@renderer/components/ConfirmDialog'
import SetShortcutModal from '@renderer/components/SetShortcutModal'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { getItemActions, ActionContext } from '@renderer/actions/itemActions'
import { runItemAction } from '@renderer/components/FlowItemRow'
import { FlowItem } from '@shared/types'

export default function App() {
  useDataLoader()
  const [itemToDelete, setItemToDelete] = useState<FlowItem | null>(null)
  const [itemForShortcut, setItemForShortcut] = useState<FlowItem | null>(null)
  const query = useFlowStore((s) => s.query)
  const setQuery = useFlowStore((s) => s.setQuery)
  const selectedIndex = useFlowStore((s) => s.selectedIndex)
  const setSelectedIndex = useFlowStore((s) => s.setSelectedIndex)
  const results = useFlowStore((s) => s.results)
  const setResults = useFlowStore((s) => s.setResults)
  const items = useFlowStore((s) => s.items)
  const addRecent = useFlowStore((s) => s.addRecent)
  const setShowAddModal = useFlowStore((s) => s.setShowAddModal)
  const showAddModal = useFlowStore((s) => s.showAddModal)
  const favorites = useFlowStore((s) => s.favorites)
  const recentIds = useFlowStore((s) => s.recentIds)
  const toggleFavorite = useFlowStore((s) => s.toggleFavorite)
  const deleteItem = useFlowStore((s) => s.deleteItem)
  const updateItem = useFlowStore((s) => s.updateItem)
  const setEditingItem = useFlowStore((s) => s.setEditingItem)
  const activeTab = useFlowStore((s) => s.activeTab)
  const setActiveProjectId = useFlowStore((s) => s.setActiveProjectId)

  const theme = useSettings((s) => s.theme)
  const animationsEnabled = useSettings((s) => s.animationsEnabled)
  const reduceMotion = useSettings((s) => s.reduceMotion)
  const showShortcutHints = useSettings((s) => s.showShortcutHints)
  const actionShortcut = useSettings((s) => s.actionShortcut)
  const settingsShortcut = useSettings((s) => s.settingsShortcut)
  const fuzzySearch = useSettings((s) => s.fuzzySearch)
  const maxResults = useSettings((s) => s.maxResults)

  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [resultsKey, setResultsKey] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const focusSearch = useCallback(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const openSettings = useCallback(() => {
    setShowActions(false)
    setShowSettings(true)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])

  const closeSettings = useCallback(() => {
    setShowSettings(false)
    focusSearch()
  }, [focusSearch])

  const closeActions = useCallback(() => {
    setShowActions(false)
    focusSearch()
  }, [focusSearch])

  // Single entry point for "Add to Flow" — shared by Ctrl+N and the visible buttons
  const openAddModal = useCallback(() => {
    setShowSettings(false)
    setShowActions(false)
    setShowAddModal(true)
  }, [setShowAddModal])

  const handleOpen = useCallback(
    async (item: FlowItem) => {
      if (!window.electron) return
      await window.electron.app.open(item.target, item.arguments, item.workingDirectory, item.type)
      addRecent(item.id)
      window.electron.hideWindow()
    },
    [addRecent]
  )

  const handleClearSearch = useCallback(() => {
    setQuery('')
    setSelectedIndex(0)
  }, [setQuery, setSelectedIndex])

  // Exit window immediately, clearing search and selection state
  const exitWindow = useCallback(() => {
    handleClearSearch()
    setIsExiting(true)
    void window.electron?.hideWindow()
    window.setTimeout(() => {
      setIsExiting(false)
    }, 50)
  }, [handleClearSearch])

  // Document-level presentation: theme + motion policy
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('no-animations', !animationsEnabled || reduceMotion)
    root.classList.toggle('force-reduced-motion', reduceMotion)
  }, [theme, animationsEnabled, reduceMotion])

  // Search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      const searchResults = searchItems(items, query)
      setResults(searchResults)
      setResultsKey((k) => k + 1)
    }, 60)
    return () => clearTimeout(timer)
  }, [query, items, setResults, fuzzySearch, maxResults])

  // Focus lifecycle: focus input, reset exit state, and retrigger the
  // entrance animation each time the window is shown/focused (Ctrl+Space).
  useEffect(() => {
    inputRef.current?.focus()
    if (!window.electron) return

    const off = window.electron.onWindowFocus(() => {
      inputRef.current?.focus()
      setIsExiting(false)
      const el = rootRef.current
      if (el) {
        el.classList.remove('launcher-entrance')
        void el.offsetWidth // force reflow so the animation restarts
        el.classList.add('launcher-entrance')
      }
    })
    return () => off()
  }, [])

  // Global settings shortcut (Ctrl+, by default): the main process reveals
  // the launcher when hidden, then asks us to open the settings panel.
  useEffect(() => {
    if (!window.electron?.onOpenSettings) return
    const off = window.electron.onOpenSettings(() => openSettings())
    return () => off()
  }, [openSettings])

  // Project shortcut listener: reveals launcher focused on the specific project
  useEffect(() => {
    if (!window.electron?.onOpenProject) return
    const off = window.electron.onOpenProject((projectId) => {
      setShowSettings(false)
      setShowActions(false)
      setShowAddModal(false)
      setActiveProjectId(projectId)
    })
    return () => off()
  }, [setActiveProjectId, setShowAddModal])

  // ---------------------------------------------------------------------------
  // Derived list state — one flat list drives selection across sections so
  // arrow keys, Enter and the action panel always agree on what is selected.
  // ---------------------------------------------------------------------------
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const favoriteItems = favorites
    .map((id) => itemsById.get(id))
    .filter((item): item is FlowItem => Boolean(item))
  // Recent shows only items that aren't already in Favorites (no duplicates)
  const recentItems = recentIds
    .filter((id) => !favorites.includes(id))
    .map((id) => itemsById.get(id))
    .filter((item): item is FlowItem => Boolean(item))

  // Exclude items already shown in favorites/recent from the main list
  const shownIds = new Set([...favoriteItems.map((i) => i.id), ...recentItems.map((i) => i.id)])
  const remainingItems = items.filter((item) => !shownIds.has(item.id))

  const isSearching = Boolean(query.trim())
  const flatList: FlowItem[] = isSearching
    ? results
    : [...favoriteItems, ...recentItems, ...remainingItems]
  const safeIndex = flatList.length
    ? Math.min(Math.max(selectedIndex, 0), flatList.length - 1)
    : -1
  const selectedItem = safeIndex >= 0 ? flatList[safeIndex] ?? null : null

  // Section-local indices for per-section rendering
  const recentStart = favoriteItems.length
  const remainingStart = recentStart + recentItems.length
  const localIndex = (start: number, count: number) =>
    safeIndex >= start && safeIndex < start + count ? safeIndex - start : -1

  // Action context shared by the row menus and the action panel
  const actionCtx: ActionContext = {
    isFavorite: selectedItem ? favorites.includes(selectedItem.id) : false,
    onOpen: () => {
      if (selectedItem) {
        setShowActions(false)
        void handleOpen(selectedItem)
      }
    },
    onToggleFavorite: () => {
      if (selectedItem) toggleFavorite(selectedItem.id)
    },
    onEdit: () => {
      if (selectedItem) {
        setShowActions(false)
        setEditingItem(selectedItem)
      }
    },
    onDelete: () => {
      if (selectedItem) {
        setShowActions(false)
        setItemToDelete(selectedItem)
      }
    },
    onSetShortcut: () => {
      if (selectedItem) {
        setShowActions(false)
        setItemForShortcut(selectedItem)
      }
    },
    onClearShortcut: () => {
      if (selectedItem) {
        setShowActions(false)
        updateItem(selectedItem.id, { shortcut: undefined })
        void window.electron?.shortcuts.sync()
      }
    },
  }
  const itemActions = selectedItem ? getItemActions(selectedItem, actionCtx) : []

  // Keyboard navigation
  useEffect(() => {
    const matchesShortcut = (e: KeyboardEvent, shortcutStr: string): boolean => {
      const parts = shortcutStr
        .toLowerCase()
        .split('+')
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length < 2) return false
      const rawKey = parts[parts.length - 1]
      const mods = parts.slice(0, -1)

      const keyOk =
        e.key.toLowerCase() === rawKey ||
        (rawKey === 'comma' && (e.key === ',' || e.code === 'Comma')) ||
        (rawKey === ',' && (e.key === ',' || e.code === 'Comma')) ||
        (rawKey === 'space' && (e.key === ' ' || e.code === 'Space'))
      if (!keyOk) return false

      for (const mod of mods) {
        if (mod === 'ctrl' || mod === 'control' || mod === 'cmdorctrl' || mod === 'commandorcontrol') {
          if (!e.ctrlKey && !e.metaKey) return false
        } else if (mod === 'cmd' || mod === 'command' || mod === 'meta' || mod === 'super') {
          if (!e.metaKey) return false
        } else if (mod === 'alt' || mod === 'option') {
          if (!e.altKey) return false
        } else if (mod === 'shift') {
          if (!e.shiftKey) return false
        } else {
          return false
        }
      }
      return true
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Components that own the event (modal backdrop, action panel) mark it
      // handled — we stay out of the way.
      if (e.defaultPrevented) return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (showAddModal) {
          // Modal focus can sit outside its backdrop — act as fallback
          setShowAddModal(false)
          return
        }
        if (showSettings) {
          closeSettings()
          return
        }
        if (showActions) {
          closeActions()
          return
        }
        exitWindow()
        return
      }

      if (showAddModal) return

      // Action panel toggle (default Ctrl+K, configurable in Settings)
      if (matchesShortcut(e, actionShortcut)) {
        e.preventDefault()
        if (showActions) closeActions()
        else if (showSettings) closeSettings()
        else {
          setShowSettings(false)
          setShowActions(true)
        }
        return
      }

      // Settings shortcut (Ctrl+, / ⌘+, or user-configured)
      if (
        matchesShortcut(e, settingsShortcut) ||
        ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma'))
      ) {
        e.preventDefault()
        if (showSettings) closeSettings()
        else openSettings()
        return
      }

      // Ctrl+N = Add new item
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        if (!showSettings && !showActions) {
          e.preventDefault()
          openAddModal()
        }
        return
      }

      if (showSettings || showActions) return

      const isInputFocused = document.activeElement === inputRef.current
      if (!isInputFocused) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          Math.min(prev + 1, Math.max(flatList.length - 1, 0))
        )
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatList[safeIndex]
        if (item) {
          handleOpen(item)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    flatList,
    safeIndex,
    handleOpen,
    setSelectedIndex,
    showAddModal,
    showSettings,
    showActions,
    actionShortcut,
    settingsShortcut,
    closeSettings,
    closeActions,
    openSettings,
    openAddModal,
    exitWindow,
  ])

  // Scroll selected into view
  useEffect(() => {
    if (safeIndex >= 0) {
      const el = document.querySelector('[data-selected="true"]')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [safeIndex])

  // Persist data on changes — debounced, and never before the initial load
  // has completed (otherwise the first render would wipe stored data).
  useEffect(() => {
    if (!window.electron) return
    if (!useFlowStore.getState().isLoaded) return

    const write = () => {
      const state = useFlowStore.getState()
      window.electron.store.set('flow-data', {
        items: state.items,
        recentIds: state.recentIds,
        favorites: state.favorites,
        projects: state.projects,
      })
      // Keep item-level global shortcuts in sync with the latest data
      void window.electron.shortcuts.sync()
    }

    const timer = setTimeout(write, 150)
    const flush = () => write()
    window.addEventListener('beforeunload', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeunload', flush)
    }
  })

  return (
    <div
      ref={rootRef}
      className={`relative isolate flex h-full w-full flex-col bg-flow-bg text-flow-primary launcher-root launcher-entrance ${isExiting ? 'exiting' : ''}`}
    >
      {/* Ambient monochrome code texture (behind everything) */}
      <ErrorBoundary name="AmbientCode">
        <AmbientCode />
      </ErrorBoundary>

      {/* Header + Search (draggable region) */}
      <div className="flex-shrink-0 flow-drag-region">
        <WindowHeader onSettings={openSettings} onAddFlow={openAddModal} />
        <div className="px-4 pb-3">
          <div style={{ WebkitAppRegion: 'no-drag' } as any}>
            <SearchInput
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              resultCount={query.trim() ? results.length : 0}
              onClear={handleClearSearch}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isSearching ? (
          <ResultsList
            key={resultsKey}
            items={results}
            selectedIndex={safeIndex}
            onSelect={handleOpen}
            onDeleteRequest={(item) => setItemToDelete(item)}
            onSetShortcut={(item) => setItemForShortcut(item)}
            emptyMessage="No flows matching your search"
          />
        ) : activeTab === 'projects' ? (
          <ProjectsView onSelectFlowItem={handleOpen} onOpenAddFlow={openAddModal} />
        ) : (
          <div className="h-full overflow-y-auto px-1">
            {favoriteItems.length > 0 && (
              <div>
                <SectionLabel>Favorites</SectionLabel>
                <ResultsList
                  items={favoriteItems}
                  selectedIndex={localIndex(0, favoriteItems.length)}
                  onSelect={handleOpen}
                  onDeleteRequest={(item) => setItemToDelete(item)}
                  onSetShortcut={(item) => setItemForShortcut(item)}
                />
              </div>
            )}
            {recentItems.length > 0 && (
              <div>
                {favoriteItems.length > 0 && <SectionDivider />}
                <SectionLabel>Recent</SectionLabel>
                <ResultsList
                  items={recentItems}
                  selectedIndex={localIndex(recentStart, recentItems.length)}
                  onSelect={handleOpen}
                  onDeleteRequest={(item) => setItemToDelete(item)}
                  onSetShortcut={(item) => setItemForShortcut(item)}
                />
              </div>
            )}
            {remainingItems.length > 0 && (
              <div>
                {(favoriteItems.length > 0 || recentItems.length > 0) && <SectionDivider />}
                <SectionLabel>All flows</SectionLabel>
                <ResultsList
                  items={remainingItems}
                  selectedIndex={localIndex(remainingStart, remainingItems.length)}
                  onSelect={handleOpen}
                  onDeleteRequest={(item) => setItemToDelete(item)}
                  onSetShortcut={(item) => setItemForShortcut(item)}
                />
              </div>
            )}
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <p className="mb-1 text-sm text-flow-secondary">Nothing in your Flow yet</p>
                <p className="mb-5 text-xs text-flow-muted">Add apps, websites, files, or commands</p>
                <button
                  id="empty-add-flow-button"
                  type="button"
                  onClick={openAddModal}
                  className="btn-primary flow-focus-ring px-4 py-2"
                >
                  Add to Flow
                </button>
              </div>
            ) : (
              <div className="px-2 pb-2 pt-1">
                <button
                  id="add-flow-button"
                  type="button"
                  onClick={openAddModal}
                  title="Add to Flow (Ctrl+N)"
                  className="flow-focus-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-flow-muted flow-transition-colors-standard hover:bg-flow-hover hover:text-flow-secondary"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Add to Flow</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Keyboard Hints */}
      {showShortcutHints && <KeyboardHints />}

      {/* Add Modal */}
      {showAddModal && (
        <ErrorBoundary name="AddFlowModal">
          <AddFlowModal onClose={() => setShowAddModal(false)} />
        </ErrorBoundary>
      )}

      {/* Action panel (Ctrl+K) */}
      {showActions && (
        <ActionPanel
          itemActions={itemActions}
          itemLabel={selectedItem?.name}
          onRunItemAction={(action) => {
            if (selectedItem) runItemAction(action, selectedItem, actionCtx)
          }}
          onRunUtility={(run) => {
            setShowActions(false)
            void Promise.resolve(run()).catch((err) => {
              console.error('[Flow] utility action failed:', err)
            })
          }}
          onClose={closeActions}
        />
      )}

      {/* Settings (Ctrl+, or the gear button) */}
      {showSettings && <SettingsPanel onClose={closeSettings} />}

      {/* Item Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title={`Delete "${itemToDelete?.name}"?`}
        description="This will remove this item from your flows and any projects it belongs to."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        onConfirm={() => {
          if (itemToDelete) {
            deleteItem(itemToDelete.id)
            setItemToDelete(null)
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Item Shortcut Modal */}
      <SetShortcutModal
        isOpen={Boolean(itemForShortcut)}
        title={`Shortcut for "${itemForShortcut?.name}"`}
        subtitle="Global shortcut to launch this item directly in Windows without opening the launcher."
        initialShortcut={itemForShortcut?.shortcut}
        targetId={itemForShortcut?.id || ''}
        targetType="item"
        onSave={async (newShortcut) => {
          if (itemForShortcut) {
            updateItem(itemForShortcut.id, { shortcut: newShortcut })
            const state = useFlowStore.getState()
            const updatedItems = state.items.map((i) =>
              i.id === itemForShortcut.id ? { ...i, shortcut: newShortcut, updatedAt: Date.now() } : i
            )
            await window.electron?.store.set('flow-data', {
              items: updatedItems,
              recentIds: state.recentIds,
              favorites: state.favorites,
              projects: state.projects,
            })
            await window.electron?.shortcuts.sync()
          }
          setItemForShortcut(null)
        }}
        onClose={() => setItemForShortcut(null)}
      />
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2">
      <span className="text-[11px] font-medium tracking-tight text-flow-tertiary select-none">
        {children}
      </span>
    </div>
  )
}

function SectionDivider() {
  return <div className="mx-2 my-1 h-px bg-flow-border" />
}
