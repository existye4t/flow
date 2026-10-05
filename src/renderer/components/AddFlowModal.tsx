import React, { useState, useRef, useEffect } from 'react'
import { FlowItem, FlowItemType, IconSource } from '@shared/types'
import { useFlowStore } from '@renderer/store/flow-store'
import { IconGlyph, resolveFlowItemIcon, getKnownAppGlyph } from '@renderer/utils/icons'
import { getSmartAppDescription, getSmartAppKeywords } from '@renderer/data/known-apps'
import { isValidShortcutInput } from '@renderer/utils/platform'
import { useSettings } from '@renderer/store/settings-store'
import ShortcutRecorder from './ShortcutRecorder'

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

interface AddFlowModalProps {
  onClose: () => void
}

type ModalStep = 'type' | 'form' | 'discover'

const TYPE_ICONS: Record<FlowItemType, string> = {
  application: 'app',
  website: 'globe',
  file: 'file',
  folder: 'folder',
  command: 'terminal',
  action: 'bolt',
}

const MANUAL_GLYPHS = [
  'app',
  'globe',
  'file',
  'folder',
  'terminal',
  'bolt',
  'code',
  'camera',
  'gear',
  'star',
  'pencil',
  'shield',
  'chrome',
  'github',
  'discord',
  'spotify',
  'notion',
  'figma',
  'slack',
  'steam',
  'vscode',
]

const TYPES: { type: FlowItemType; label: string; description: string }[] = [
  { type: 'application', label: 'Application', description: 'A desktop app' },
  { type: 'website', label: 'Website', description: 'Any URL' },
  { type: 'file', label: 'File', description: 'A file or document' },
  { type: 'folder', label: 'Folder', description: 'A directory' },
  { type: 'command', label: 'Command', description: 'Shell command' },
  { type: 'action', label: 'Action', description: 'Custom action' },
]

let moduleDiscoveredAppsCache: Array<{
  name: string
  appId: string
  target?: string
  workingDirectory?: string
  icon?: string
  description?: string
  iconDataUrl?: string
}> | null = null

const appIconMemoryCache = new Map<string, string>()
const failedAppIcons = new Set<string>()

// Client-side queue: max 3 concurrent IPC icon requests to keep renderer and main fluid
type IconCallback = (dataUrl: string | null) => void
const pendingIconCallbacks = new Map<string, IconCallback[]>()
const iconRequestQueue: Array<{ appId: string; name: string; target?: string }> = []
let activeIconRequests = 0
const MAX_CONCURRENT_ICON_REQUESTS = 3

function processNextIconRequest() {
  if (activeIconRequests >= MAX_CONCURRENT_ICON_REQUESTS) return
  const next = iconRequestQueue.shift()
  if (!next) return

  activeIconRequests++
  const { appId, name, target } = next

  window.electron?.app
    .extractIcon(appId, name, target)
    .then((res) => {
      const dataUrl = res?.success && res?.dataUrl ? res.dataUrl : null
      if (dataUrl) {
        appIconMemoryCache.set(appId, dataUrl)
      } else {
        failedAppIcons.add(appId)
      }
      const callbacks = pendingIconCallbacks.get(appId) || []
      pendingIconCallbacks.delete(appId)
      for (const cb of callbacks) cb(dataUrl)
    })
    .catch(() => {
      failedAppIcons.add(appId)
      const callbacks = pendingIconCallbacks.get(appId) || []
      pendingIconCallbacks.delete(appId)
      for (const cb of callbacks) cb(null)
    })
    .finally(() => {
      activeIconRequests--
      processNextIconRequest()
    })
}

function requestDiscoveredAppIcon(
  appId: string,
  name: string,
  target: string | undefined,
  callback: IconCallback
) {
  if (appIconMemoryCache.has(appId)) {
    callback(appIconMemoryCache.get(appId)!)
    return
  }
  if (failedAppIcons.has(appId)) {
    callback(null)
    return
  }

  const existing = pendingIconCallbacks.get(appId)
  if (existing) {
    existing.push(callback)
    return
  }

  pendingIconCallbacks.set(appId, [callback])
  iconRequestQueue.push({ appId, name, target })
  processNextIconRequest()
}

function normalizeSearchText(text: string): string {
  if (!text) return ''
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim()
}

function isGenericIcon(dataUrl?: string | null): boolean {
  return Boolean(
    dataUrl &&
    (dataUrl.length < 200 ||
      dataUrl.includes('AAAB4UlEQVRYhe2WSy8DURTH') ||
      dataUrl.includes('AAAB5UlEQVRYhe') ||
      dataUrl.includes('AAAByUlEQVRYhe1WQUoDQRCs2UTwEBS8R') ||
      dataUrl.includes('Ah9JREFUWEftV8lOAkEQ'))
  )
}

function DiscoveredAppItemIcon({
  app,
}: {
  app: { name: string; appId: string; target?: string; iconDataUrl?: string }
}) {
  if (app.iconDataUrl && !isGenericIcon(app.iconDataUrl) && !appIconMemoryCache.has(app.appId)) {
    appIconMemoryCache.set(app.appId, app.iconDataUrl)
  }
  const [iconSrc, setIconSrc] = useState<string | null>(() => {
    if (app.iconDataUrl && !isGenericIcon(app.iconDataUrl)) return app.iconDataUrl
    const mem = appIconMemoryCache.get(app.appId)
    if (mem && !isGenericIcon(mem)) return mem
    return null
  })
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (app.iconDataUrl && !iconSrc) {
      setIconSrc(app.iconDataUrl)
      return
    }
    if (iconSrc) return
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '80px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [iconSrc, app.iconDataUrl])

  useEffect(() => {
    if (!isVisible || iconSrc || failedAppIcons.has(app.appId)) return
    let active = true

    requestDiscoveredAppIcon(app.appId, app.name, app.target, (dataUrl) => {
      if (active && dataUrl) {
        setIconSrc(dataUrl)
      }
    })

    return () => {
      active = false
    }
  }, [isVisible, iconSrc, app.appId, app.name, app.target])

  const knownGlyph = getKnownAppGlyph(app.name, app.target || app.appId)

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="h-4 w-4 object-contain rounded-[3px]"
          onError={() => {
            appIconMemoryCache.delete(app.appId)
            failedAppIcons.add(app.appId)
            setIconSrc(null)
          }}
        />
      ) : (
        <IconGlyph name={knownGlyph || 'app'} size={13} className="text-flow-muted" />
      )}
    </div>
  )
}

export default function AddFlowModal({ onClose }: AddFlowModalProps) {
  const editingItem = useFlowStore((s) => s.editingItem)
  const setEditingItem = useFlowStore((s) => s.setEditingItem)
  const addItem = useFlowStore((s) => s.addItem)
  const updateItem = useFlowStore((s) => s.updateItem)
  const projects = useFlowStore((s) => s.projects)
  const activeProjectId = useFlowStore((s) => s.activeProjectId)
  const addItemToProject = useFlowStore((s) => s.addItemToProject)

  const [step, setStep] = useState<ModalStep>(editingItem ? 'form' : 'type')
  const [selectedType, setSelectedType] = useState<FlowItemType | null>(editingItem ? editingItem.type : null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || '')

  const [form, setForm] = useState({
    name: editingItem ? editingItem.name : '',
    target: editingItem ? editingItem.target : '',
    arguments: editingItem?.arguments ? editingItem.arguments.join(', ') : '',
    workingDirectory: editingItem?.workingDirectory || '',
    description: editingItem ? editingItem.description || '' : '',
    keywords: editingItem?.keywords ? editingItem.keywords.join(', ') : '',
    aliases: editingItem?.aliases ? editingItem.aliases.join(', ') : '',
    shortcut: editingItem?.shortcut || '',
  })

  // Track selection sequence to prevent async icon callbacks from overwriting newer selections
  const selectionSeqRef = useRef(0)

  // Smart metadata must never clobber what the user wrote themselves manually
  const [descTouched, setDescTouched] = useState(Boolean(editingItem?.description))
  const [keywordsTouched, setKeywordsTouched] = useState(
    Boolean(editingItem?.keywords && editingItem.keywords.length > 0)
  )
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  useEffect(() => {
    setFormError(null)
  }, [form.name, form.target])

  // Icon mode (edit only): auto-resolve vs. an explicit user-chosen glyph
  const currentGlyphName =
    editingItem?.icon?.type === 'glyph'
      ? editingItem.icon.name
      : getKnownAppGlyph(editingItem?.name || '', editingItem?.target || '') ||
        TYPE_ICONS[editingItem?.type || 'application']
  const [iconMode, setIconMode] = useState<'auto' | 'manual'>(
    editingItem?.iconManual ? 'manual' : 'auto'
  )
  const [iconGlyph, setIconGlyph] = useState<string>(currentGlyphName)

  const [discoveredApps, setDiscoveredApps] = useState<
    Array<{
      name: string
      appId: string
      target?: string
      workingDirectory?: string
      icon?: string
      description?: string
      iconDataUrl?: string
    }>
  >(() => moduleDiscoveredAppsCache || [])
  const [pickedIconDataUrl, setPickedIconDataUrl] = useState<string | null>(null)
  const [loadingApps, setLoadingApps] = useState(false)
  const [appSearch, setAppSearch] = useState('')
  const [isExiting, setIsExiting] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const handleDiscover = async () => {
    // Open immediately without blocking UI
    setStep('discover')
    setAppSearch('')
    if (!window.electron) return

    if (moduleDiscoveredAppsCache && moduleDiscoveredAppsCache.length > 0) {
      setDiscoveredApps(moduleDiscoveredAppsCache)
      return
    }

    setLoadingApps(true)
    try {
      const apps = await window.electron.app.discover()
      moduleDiscoveredAppsCache = apps
      setDiscoveredApps(apps)
    } catch (err) {
      console.error('Failed to discover apps:', err)
    } finally {
      setLoadingApps(false)
    }
  }

  const resolveIconInBackground = (item: FlowItem) => {
    resolveFlowItemIcon(item)
      .then((icon) => {
        if (icon && icon.type !== 'glyph') {
          updateItem(item.id, { icon })
        }
      })
      .catch(() => {})
  }

  // Offline known-app metadata: fills description/keywords the user has
  // not typed over. Never runs when editing an existing item.
  const applySmartMetadata = (name: string, target: string) => {
    if (editingItem) return
    const smartDesc = getSmartAppDescription(name, target)
    const smartKeys = getSmartAppKeywords(name, target).join(', ')

    setForm((prev) => {
      const description = descTouched ? prev.description : (smartDesc || prev.description)
      const keywords = keywordsTouched || prev.keywords.trim() ? prev.keywords : smartKeys
      if (description === prev.description && keywords === prev.keywords) return prev
      return { ...prev, description, keywords }
    })
  }

  const handleSelectDiscoveredApp = (app: {
    name: string
    appId: string
    target?: string
    workingDirectory?: string
    icon?: string
    description?: string
    iconDataUrl?: string
  }) => {
    const seq = ++selectionSeqRef.current
    const target = app.target || `explorer.exe shell:AppsFolder\\${app.appId}`
    setSelectedType('application')

    // Completely fresh draft state for the selected app (no carryover from previous app)
    const smartDesc = app.description || getSmartAppDescription(app.name, target)
    const smartKeywords = getSmartAppKeywords(app.name, target).join(', ')

    // Determine initial icon from memory/cache
    const cachedData = app.iconDataUrl || appIconMemoryCache.get(app.appId)
    if (cachedData && !isGenericIcon(cachedData)) {
      setPickedIconDataUrl(cachedData)
    } else {
      setPickedIconDataUrl(null)
      // Asynchronously fetch icon with race-condition guard
      requestDiscoveredAppIcon(app.appId, app.name, target, (dataUrl) => {
        if (selectionSeqRef.current === seq && dataUrl && !isGenericIcon(dataUrl)) {
          setPickedIconDataUrl(dataUrl)
        }
      })
    }

    // Overwrite the form completely with fresh app values
    setForm({
      name: app.name,
      target,
      arguments: '',
      workingDirectory: app.workingDirectory || '',
      description: smartDesc || '',
      keywords: smartKeywords || '',
      aliases: '',
      shortcut: '',
    })

    setDescTouched(false)
    setKeywordsTouched(false)
    setShortcutError(null)
    setFormError(null)
    setStep('form')
  }

  const handleSubmit = () => {
    if (!selectedType) {
      setFormError('Choose a type first')
      return
    }
    if (!form.name.trim()) {
      setFormError('Name is required')
      return
    }
    if (!form.target.trim()) {
      setFormError(
        selectedType === 'website' ? 'URL is required' : 'Target path or command is required'
      )
      return
    }
    setFormError(null)
    try {
      submitItem()
    } catch (err) {
      console.error('[AddFlow] submit failed:', err)
      setFormError('Could not save this flow. Please try again.')
    }
  }

  const submitItem = () => {
    if (!selectedType) return

    const shortcutValue = form.shortcut.trim().toLowerCase()
    if (shortcutValue && !isValidShortcutInput(shortcutValue)) {
      setShortcutError('Use a combo like ctrl+shift+g')
      return
    }

    const currentSettings = useSettings.getState()
    const isScreenshotCollision =
      shortcutValue === currentSettings.screenshotShortcut.toLowerCase() ||
      shortcutValue === 'print screen' ||
      shortcutValue === 'printscreen'
    if (
      shortcutValue &&
      (shortcutValue === currentSettings.globalShortcut.toLowerCase() ||
        shortcutValue === currentSettings.settingsShortcut.toLowerCase() ||
        shortcutValue === currentSettings.actionShortcut.toLowerCase() ||
        isScreenshotCollision)
    ) {
      setShortcutError('Conflicts with an existing system shortcut')
      return
    }

    const itemData = {
      name: form.name.trim(),
      type: selectedType,
      description: form.description.trim() || undefined,
      keywords: form.keywords
        ? form.keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [],
      aliases: form.aliases
        ? form.aliases.split(',').map((a) => a.trim()).filter(Boolean)
        : [],
      shortcut: shortcutValue || undefined,
      target: form.target.trim(),
      arguments: form.arguments
        ? form.arguments.split(',').map((a) => a.trim()).filter(Boolean)
        : [],
      workingDirectory: form.workingDirectory.trim() || undefined,
    }

    if (editingItem) {
      updateItem(editingItem.id, itemData)
      setEditingItem(null)

      const merged: FlowItem = { ...editingItem, ...itemData, updatedAt: Date.now() }
      if (iconMode === 'manual') {
        const icon: IconSource = { type: 'glyph', name: iconGlyph }
        updateItem(editingItem.id, { icon, iconManual: true })
      } else {
        updateItem(editingItem.id, { icon: undefined, iconManual: false })
        resolveFlowItemIcon({ ...merged, icon: undefined, iconManual: false })
          .then((icon) => {
            if (icon && icon.type !== 'glyph') updateItem(editingItem.id, { icon })
          })
          .catch(() => {})
      }
    } else {
      const item: FlowItem = {
        id: generateId(),
        ...itemData,
        icon: pickedIconDataUrl ? { type: 'cached', dataUrl: pickedIconDataUrl } : undefined,
        iconManual: false,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addItem(item)
      if (selectedProjectId) {
        addItemToProject(selectedProjectId, item.id)
      }
      resolveIconInBackground(item)
    }
    void window.electron?.shortcuts.sync()
    onClose()
  }

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setEditingItem(null)
      setIsExiting(false)
      onClose()
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (step === 'type' || editingItem) {
        handleClose()
      } else if (step === 'discover') {
        setStep('form')
      } else {
        setStep('type')
        setSelectedType(null)
      }
    }
  }

  const backdropClass = `modal-backdrop ${isExiting ? 'exiting' : ''}`
  const contentClass = `modal-content ${isExiting ? 'exiting' : ''}`

  if (step === 'type') {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${backdropClass}`}
        onClick={handleClose}
        onKeyDown={handleKeyDown}
      >
        <div
          className={`w-[420px] rounded-xl border border-flow-border bg-flow-surface p-1 shadow-flow-modal ${contentClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-title">Add to Flow</h2>
            <p className="mt-0.5 text-xs text-flow-muted">Choose what you want to add</p>
          </div>

          <div className="px-2 pb-2">
            {TYPES.map((t, idx) => (
              <button
                key={t.type}
                onClick={() => {
                  setSelectedType(t.type)
                  setStep('form')
                }}
                className="flow-focus-ring group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left flow-transition-colors-standard hover:bg-flow-hover active:bg-flow-active"
                style={{ animationDelay: `${idx * 15}ms` }}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-flow-border bg-flow-bg-elevated flow-transition-colors-standard group-hover:border-flow-border-strong">
                  <IconGlyph name={TYPE_ICONS[t.type]} size={15} className="text-flow-muted group-hover:text-flow-secondary" />
                </div>
                <div>
                  <p className="text-[13px] font-medium leading-tight text-flow-primary">{t.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-flow-muted">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'discover') {
    const normalizedQuery = normalizeSearchText(appSearch)
    const filteredApps = discoveredApps.filter((a) => {
      if (!normalizedQuery) return true
      const normalizedName = normalizeSearchText(a.name)
      return (
        normalizedName.includes(normalizedQuery) ||
        a.name.toLocaleLowerCase('tr-TR').includes(appSearch.toLocaleLowerCase('tr-TR')) ||
        a.name.toLowerCase().includes(appSearch.toLowerCase())
      )
    })

    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${backdropClass}`}
        onClick={() => setStep('form')}
        onKeyDown={handleKeyDown}
      >
        <div
          className={`w-[440px] max-h-[80vh] flex flex-col rounded-xl border border-flow-border bg-flow-surface p-5 shadow-flow-modal ${contentClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flow-focus-ring -ml-1.5 -mt-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-flow-muted hover:text-flow-secondary hover:bg-flow-hover flow-transition-colors-fast cursor-pointer select-none pointer-events-auto"
            >
              <span className="text-[13px] leading-none">←</span>
              <span className="font-medium">Back to Form</span>
            </button>
            <h2 className="mt-1 text-title">Select Installed Application</h2>
          </div>

          <div className="mb-3">
            <input
              ref={inputRef}
              type="text"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              placeholder="Search installed apps..."
              className="input-base py-2 text-xs"
            />
          </div>

          <div className="min-h-[240px] max-h-[320px] flex-1 space-y-0.5 overflow-y-auto pr-1">
            {loadingApps && discoveredApps.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-flow-muted">
                Discovering apps from Windows...
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-flow-muted">
                No apps found
              </div>
            ) : (
              filteredApps.map((app) => (
                <button
                  key={app.appId}
                  onClick={() => handleSelectDiscoveredApp(app)}
                  className="flow-focus-ring flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left flow-transition-colors-standard hover:bg-flow-hover"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-flow-bg-elevated border border-flow-border">
                    <DiscoveredAppItemIcon app={app} />
                  </div>
                  <span className="flex-1 truncate text-[12px] text-flow-secondary">{app.name}</span>
                  {app.description && (
                    <span className="flex-shrink-0 text-[10px] text-flow-muted tracking-tight px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.04]">
                      {app.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${backdropClass}`}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={`w-[440px] max-h-[80vh] overflow-y-auto rounded-xl border border-flow-border bg-flow-surface p-5 shadow-flow-modal ${contentClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            {!editingItem && (
              <button
                onClick={() => {
                  setStep('type')
                  setSelectedType(null)
                }}
                className="text-[11px] text-flow-muted hover:text-flow-secondary flow-transition-colors-fast"
              >
                ← Back
              </button>
            )}
            <h2 className="mt-1 text-title">
              {editingItem ? `Edit ${editingItem.name}` : `Add ${selectedType}`}
            </h2>
          </div>

          {selectedType === 'application' && !editingItem && (
            <button onClick={handleDiscover} className="btn-secondary px-3 py-1.5">
              Discover Apps...
            </button>
          )}
        </div>

        <div className="space-y-3">
          <Field
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            onBlur={() => applySmartMetadata(form.name, form.target)}
            placeholder="e.g. GitHub"
            autoFocus={!editingItem}
          />

          {selectedType === 'website' && (
            <Field
              label="URL"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v })}
              onBlur={() => applySmartMetadata(form.name, form.target)}
              placeholder="https://github.com/"
            />
          )}

          {selectedType === 'command' && (
            <>
              <Field
                label="Command"
                value={form.target}
                onChange={(v) => setForm({ ...form, target: v })}
                onBlur={() => applySmartMetadata(form.name, form.target)}
                placeholder="pnpm dev"
              />
              <Field
                label="Working Directory"
                value={form.workingDirectory}
                onChange={(v) => setForm({ ...form, workingDirectory: v })}
                placeholder="C:\Projects\my-app"
              />
              <Field
                label="Arguments (comma separated)"
                value={form.arguments}
                onChange={(v) => setForm({ ...form, arguments: v })}
                placeholder="--port 3000"
              />
            </>
          )}

          {selectedType === 'application' && (
            <Field
              label="Application Path or Command"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v })}
              onBlur={() => applySmartMetadata(form.name, form.target)}
              placeholder="C:\Program Files\App\app.exe or explorer.exe shell:AppsFolder\..."
            />
          )}

          {selectedType === 'file' && (
            <Field
              label="File Path"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v })}
              onBlur={() => applySmartMetadata(form.name, form.target)}
              placeholder="C:\Users\Username\Documents\file.pdf"
            />
          )}

          {selectedType === 'folder' && (
            <Field
              label="Folder Path"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v })}
              onBlur={() => applySmartMetadata(form.name, form.target)}
              placeholder="C:\Users\Username\Projects"
            />
          )}

          {selectedType === 'action' && (
            <Field
              label="Action Target / Command"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v })}
              onBlur={() => applySmartMetadata(form.name, form.target)}
              placeholder="explorer or powershell"
            />
          )}

          {!editingItem && projects.length > 0 && (
            <div>
              <label className="mb-1 block text-label">Add to Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="input-base py-1.5 text-xs text-flow-secondary bg-flow-surface border border-flow-border rounded-md w-full cursor-pointer"
              >
                <option value="">None (All Flows only)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field
            label="Description"
            value={form.description}
            onChange={(v) => {
              setDescTouched(true)
              setForm({ ...form, description: v })
            }}
            placeholder="Brief description"
          />

          <Field
            label="Keywords (comma separated)"
            value={form.keywords}
            onChange={(v) => {
              setKeywordsTouched(true)
              setForm({ ...form, keywords: v })
            }}
            placeholder="git, code, repository"
          />

          <Field
            label="Aliases (comma separated)"
            value={form.aliases}
            onChange={(v) => setForm({ ...form, aliases: v })}
            placeholder="alternate names for search"
          />

          <div>
            <label className="mb-1 block text-label">Global Shortcut (optional)</label>
            <ShortcutRecorder
              value={form.shortcut}
              onChange={(v) => {
                setShortcutError(null)
                setForm({ ...form, shortcut: v })
              }}
              hasError={Boolean(shortcutError)}
              widthClass="w-full"
              placeholder="Click to record (e.g. Ctrl + Alt + C)"
            />
            <p className={`mt-1 text-[10px] ${shortcutError ? 'text-red-400' : 'text-flow-muted'}`}>
              {shortcutError || 'Works anywhere in Windows while Flow is running. Leave empty for none.'}
            </p>
          </div>

          {editingItem && (
            <div>
              <label className="mb-1.5 block text-label">Icon</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-md border border-flow-border p-0.5">
                  {(['auto', 'manual'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setIconMode(mode)}
                      className={[
                        'rounded px-2.5 py-1 text-[11px] flow-transition-colors-fast',
                        iconMode === mode
                          ? 'bg-flow-hover text-flow-primary'
                          : 'text-flow-muted hover:text-flow-secondary',
                      ].join(' ')}
                    >
                      {mode === 'auto' ? 'Auto' : 'Glyph'}
                    </button>
                  ))}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-flow-border bg-flow-bg-elevated">
                  <IconGlyph
                    name={iconMode === 'manual' ? iconGlyph : currentGlyphName}
                    size={14}
                    className="text-flow-secondary"
                  />
                </div>
                <span className="text-[11px] text-flow-muted">
                  {iconMode === 'manual' ? 'User-chosen glyph' : 'Auto-detected'}
                </span>
              </div>
              {iconMode === 'manual' && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {MANUAL_GLYPHS.map((glyph) => (
                    <button
                      key={glyph}
                      type="button"
                      onClick={() => setIconGlyph(glyph)}
                      title={glyph}
                      className={[
                        'flex h-7 w-7 items-center justify-center rounded-md border flow-transition-colors-fast',
                        iconGlyph === glyph
                          ? 'border-flow-border-strong bg-flow-hover text-flow-primary'
                          : 'border-flow-border text-flow-muted hover:text-flow-secondary',
                      ].join(' ')}
                    >
                      <IconGlyph name={glyph} size={14} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {formError && (
            <p id="add-flow-error" role="alert" className="text-[11px] leading-tight text-flow-danger">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-ghost px-3 py-1.5">
              Cancel
            </button>
            <button
              id="add-flow-submit"
              type="button"
              onClick={handleSubmit}
              aria-disabled={!form.name.trim() || !form.target.trim()}
              className={`btn-primary px-4 py-1.5 ${
                !form.name.trim() || !form.target.trim() ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {editingItem ? 'Save Changes' : 'Add to Flow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  onBlur,
  hint,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onBlur?: () => void
  hint?: string
  error?: boolean
}) {
  // Focus once on mount. An inline callback ref here would be re-invoked on
  // every render, re-focusing (and scrolling to) this input whenever the form
  // state changed — which moved the submit button out from under the cursor.
  const inputEl = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) inputEl.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <label className="mb-1.5 block text-label">{label}</label>
      <input
        ref={inputEl}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="input-base"
      />
      {hint && (
        <p
          className={`mt-1 text-[11px] leading-tight ${error ? 'text-flow-danger' : 'text-flow-muted'}`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
