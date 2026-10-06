import React, { useEffect, useState } from 'react'
import { useSettings } from '@renderer/store/settings-store'
import { DEFAULT_SETTINGS } from '@shared/types'
import { clearMonochromeCache } from '@renderer/utils/monochrome'
import { IconGlyph } from '@renderer/utils/icons'
import { formatRawShortcut } from '@renderer/utils/platform'
import ShortcutRecorder from './ShortcutRecorder'

interface SettingsPanelProps {
  onClose: () => void
}

/** Configurable Discord handle placeholder for About section */
export const ABOUT_DISCORD_HANDLE = 'existofficial'

/** Configurable GitHub URL and handle for About section */
export const ABOUT_GITHUB_URL = 'https://github.com/existye4t'
export const ABOUT_GITHUB_HANDLE = 'existye4t'

/* ------------------------------ Controls ------------------------------- */

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-[16px] w-[28px] flex-shrink-0 rounded-full border transition-colors duration-100 flow-focus-ring',
        checked ? 'border-flow-border-strong bg-white/10' : 'border-flow-border bg-black/20',
        disabled ? 'pointer-events-none opacity-40' : '',
      ].join(' ')}
    >
      <span
        className={[
          'absolute left-[2px] top-[2px] h-[10px] w-[10px] rounded-full transition-all duration-100',
          checked ? 'translate-x-[12px] bg-flow-primary' : 'bg-flow-muted',
        ].join(' ')}
      />
    </button>
  )
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      className={[
        'flex flex-shrink-0 items-center gap-0.5 rounded-md border border-flow-border p-0.5',
        disabled ? 'pointer-events-none opacity-40' : '',
      ].join(' ')}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            'rounded px-2 py-[3px] text-[10.5px] leading-none flow-transition-colors-fast',
            value === option.value
              ? 'bg-flow-hover text-flow-primary'
              : 'text-flow-muted hover:text-flow-secondary',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-4 px-4 py-1.5">
      <div className="min-w-0">
        <p className="text-[12.5px] leading-[1.4] tracking-[-0.005em] text-flow-secondary">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-[1.35] text-flow-muted">{hint}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center">{children}</div>
    </div>
  )
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-2 pt-3 first:pt-2">
      <div className="px-4 pb-1">
        <span className="text-label">{label}</span>
      </div>
      {children}
    </div>
  )
}

function SettingsDivider() {
  return <div className="mx-4 h-px bg-flow-border" />
}

/* ------------------------------ Panel ---------------------------------- */

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const settings = useSettings()
  const set = useSettings((s) => s.set)
  const [status, setStatus] = useState<string | null>(null)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [screenshotShortcutError, setScreenshotShortcutError] = useState<string | null>(null)
  const [actionInput, setActionInput] = useState(settings.actionShortcut)
  const [isExiting, setIsExiting] = useState(false)

  const handleClose = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 110)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null
        if (target?.closest('[role="button"]') || target?.tagName === 'INPUT') {
          return
        }
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), 2200)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    window.electron?.settings
      .getGlobalShortcutStatus?.()
      .then((status) => {
        if (status && !status.registered && settings.globalShortcut) {
          setShortcutError(status.error || 'Bu kısayol başka bir uygulama tarafından kullanılıyor')
        }
      })
      .catch(() => {})
  }, [settings.globalShortcut])

  useEffect(() => {
    window.electron?.settings
      .getSettingsShortcutStatus?.()
      .then((status) => {
        if (status && !status.registered && settings.settingsShortcut) {
          setSettingsError(status.error || 'Bu kısayol başka bir uygulama tarafından kullanılıyor')
        }
      })
      .catch(() => {})
  }, [settings.settingsShortcut])

  useEffect(() => {
    if (!settings.screenshotEnabled) {
      setScreenshotShortcutError(null)
      return
    }
    window.electron?.settings
      .getScreenshotShortcutStatus?.()
      .then((status) => {
        if (status && !status.registered && status.enabled !== false && settings.screenshotShortcut) {
          setScreenshotShortcutError('Shortcut registration failed (claimed by OS or another app)')
        } else if (status?.registered) {
          setScreenshotShortcutError(null)
        }
      })
      .catch(() => {})
  }, [settings.screenshotShortcut, settings.screenshotEnabled])

  const applyGlobalShortcut = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setShortcutError('Global shortcut cannot be empty')
      return
    }
    const lower = trimmed.toLowerCase().replace(/\s+/g, '')
    const currentScreenshot = useSettings.getState().screenshotShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentScreenshot || lower === 'printscreen') {
      setShortcutError('Conflicts with screenshot shortcut')
      return
    }
    const currentSettings = useSettings.getState().settingsShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentSettings || lower === 'ctrl+,') {
      setShortcutError('Conflicts with settings shortcut')
      return
    }
    const currentAction = useSettings.getState().actionShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentAction || lower === 'ctrl+k') {
      setShortcutError('Conflicts with action panel shortcut')
      return
    }

    const result = await window.electron?.settings.setGlobalShortcut(trimmed)
    if (result?.success) {
      set('globalShortcut', trimmed)
      setShortcutError(null)
      setStatus('Shortcut updated')
    } else {
      setShortcutError(result?.error || 'Bu kısayol başka bir uygulama tarafından kullanılıyor')
    }
  }

  const applySettingsShortcut = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setSettingsError('Settings shortcut cannot be empty')
      return
    }
    const lower = trimmed.toLowerCase().replace(/\s+/g, '')
    const currentLauncher = useSettings.getState().globalShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentLauncher || lower === 'ctrl+space') {
      setSettingsError('Conflicts with launcher shortcut')
      return
    }
    const currentScreenshot = useSettings.getState().screenshotShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentScreenshot || lower === 'printscreen') {
      setSettingsError('Conflicts with screenshot shortcut')
      return
    }
    const currentAction = useSettings.getState().actionShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentAction || lower === 'ctrl+k') {
      setSettingsError('Conflicts with action panel shortcut')
      return
    }

    const result = await window.electron?.settings.setSettingsShortcut(trimmed)
    if (result?.success) {
      set('settingsShortcut', trimmed)
      setSettingsError(null)
      setStatus('Shortcut updated')
    } else {
      setSettingsError(result?.error || 'Bu kısayol başka bir uygulama tarafından kullanılıyor')
    }
  }

  const applyScreenshotShortcut = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      const result = await window.electron?.settings.setScreenshotShortcut('')
      if (result?.success) {
        set('screenshotShortcut', '')
        setScreenshotShortcutError(null)
        setStatus('Screenshot shortcut cleared')
      }
      return
    }

    const lower = trimmed.toLowerCase().replace(/\s+/g, '')
    const currentLauncher = useSettings.getState().globalShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentLauncher || lower === 'ctrl+space') {
      setScreenshotShortcutError('Conflicts with launcher shortcut')
      return
    }
    const currentSettings = useSettings.getState().settingsShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentSettings || lower === 'ctrl+,') {
      setScreenshotShortcutError('Conflicts with settings shortcut')
      return
    }
    const currentAction = useSettings.getState().actionShortcut.toLowerCase().replace(/\s+/g, '')
    if (lower === currentAction || lower === 'ctrl+k') {
      setScreenshotShortcutError('Conflicts with action panel shortcut')
      return
    }

    const result = await window.electron?.settings.setScreenshotShortcut(trimmed)
    if (result?.success) {
      set('screenshotShortcut', trimmed)
      setScreenshotShortcutError(null)
      setStatus('Shortcut updated')
    } else {
      setScreenshotShortcutError(result?.error || 'Invalid shortcut')
    }
  }

  const applyActionShortcut = () => {
    const value = actionInput.trim().toLowerCase()
    if (!/^(ctrl|cmd|alt|shift|ctrl\+shift|ctrl\+alt|cmd\+shift)(\+[a-z0-9])$/.test(value)) {
      setActionInput(useSettings.getState().actionShortcut)
      setStatus('Invalid shortcut')
      return
    }
    set('actionShortcut', value)
    setStatus('Shortcut updated')
  }

  const clearCache = async () => {
    setStatus('Clearing cache…')
    try {
      await window.electron?.store.delete('iconCache')
      await window.electron?.icon.clearCache()
      const data = (await window.electron?.store.get()) as Record<string, unknown> | undefined
      const flowData = data?.['flow-data'] as
        | { items?: { icon?: unknown; [k: string]: unknown }[]; [k: string]: unknown }
        | undefined
      if (flowData && Array.isArray(flowData.items)) {
        const stripped = flowData.items.map((item) => ({ ...item, icon: undefined }))
        await window.electron?.store.set('flow-data', { ...flowData, items: stripped })
      }
      clearMonochromeCache()
      setTimeout(() => window.location.reload(), 250)
    } catch {
      setStatus('Failed to clear cache')
    }
  }

  const resetSettings = async () => {
    useSettings.getState().reset()
    setActionInput(DEFAULT_SETTINGS.actionShortcut)
    setShortcutError(null)
    setSettingsError(null)
    setScreenshotShortcutError(null)
    await window.electron?.settings.setGlobalShortcut(DEFAULT_SETTINGS.globalShortcut)
    await window.electron?.settings.setSettingsShortcut(DEFAULT_SETTINGS.settingsShortcut)
    await window.electron?.settings.setScreenshotShortcut(DEFAULT_SETTINGS.screenshotShortcut)
    await window.electron?.settings.setTray(DEFAULT_SETTINGS.closeToTray)
    await window.electron?.settings.setLaunchAtStartup(DEFAULT_SETTINGS.launchAtStartup)
    setStatus('Settings reset')
  }

  const exportData = async () => {
    const result = await window.electron?.data.exportJson()
    if (result?.success) setStatus('Exported')
    else if (result && !result.canceled) setStatus(result.error || 'Export failed')
  }

  const importData = async () => {
    const result = await window.electron?.data.importJson()
    if (result?.success) {
      setStatus('Imported — reloading…')
      setTimeout(() => window.location.reload(), 350)
    } else if (result && !result.canceled) {
      setStatus(result.error || 'Import failed')
    }
  }

  const chooseDirectory = async () => {
    const dir = await window.electron?.settings.chooseDirectory()
    if (dir) set('screenshotDirectory', dir)
  }

  const noDrag = { WebkitAppRegion: 'no-drag' } as const

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col bg-flow-bg ${
        isExiting ? 'panel-exiting' : 'panel-entering'
      }`}
    >
      {/* Header */}
      <div className="flow-drag-region flex h-9 flex-shrink-0 items-center justify-between px-3 select-none">
        <button
          onClick={handleClose}
          className="flow-focus-ring flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px] text-flow-muted flow-transition-colors-fast hover:text-flow-secondary"
          style={noDrag}
        >
          <IconGlyph name="arrowLeft" size={12} />
          <span>Back</span>
        </button>
        <span className="text-[11.5px] font-medium tracking-[-0.005em] text-flow-tertiary">
          Settings
        </span>
        <span className="min-w-[80px] text-right text-[10px] text-flow-muted">{status || ''}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-3">
        <SettingsSection label="General">
          <SettingsRow label="Start with Windows">
            <Toggle
              checked={settings.launchAtStartup}
              onChange={(value) => {
                set('launchAtStartup', value)
                void window.electron?.settings.setLaunchAtStartup(value)
              }}
            />
          </SettingsRow>
          <SettingsRow label="Start minimized" hint="Opens hidden until the shortcut is pressed">
            <Toggle
              checked={settings.startMinimized}
              onChange={(value) => set('startMinimized', value)}
            />
          </SettingsRow>
          <SettingsRow label="Close to tray" hint="Closing keeps Flow running in the tray">
            <Toggle
              checked={settings.closeToTray}
              onChange={(value) => {
                set('closeToTray', value)
                void window.electron?.settings.setTray(value)
              }}
            />
          </SettingsRow>
          <SettingsRow
            label="Global shortcut"
            hint={shortcutError || `Launcher toggle — ${formatRawShortcut(settings.globalShortcut)}`}
          >
            <ShortcutRecorder
              value={formatRawShortcut(settings.globalShortcut)}
              onChange={applyGlobalShortcut}
              hasError={Boolean(shortcutError)}
              widthClass="w-[155px]"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="Appearance">
          <SettingsRow label="Ambient background">
            <Toggle checked={settings.ambientEnabled} onChange={(v) => set('ambientEnabled', v)} />
          </SettingsRow>
          <SettingsRow label="Ambient intensity">
            <Segmented
              disabled={!settings.ambientEnabled}
              value={settings.ambientIntensity}
              onChange={(v) => set('ambientIntensity', v)}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Med' },
                { value: 'high', label: 'High' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Animations">
            <Toggle
              checked={settings.animationsEnabled}
              onChange={(v) => set('animationsEnabled', v)}
            />
          </SettingsRow>
          <SettingsRow label="Reduce motion" hint="Static background, no transitions">
            <Toggle checked={settings.reduceMotion} onChange={(v) => set('reduceMotion', v)} />
          </SettingsRow>
          <SettingsRow label="Theme">
            <Segmented
              value={settings.theme}
              onChange={(v) => set('theme', v)}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'oled', label: 'OLED' },
              ]}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="Search">
          <SettingsRow label="Fuzzy search" hint="Loose matching for partial words">
            <Toggle checked={settings.fuzzySearch} onChange={(v) => set('fuzzySearch', v)} />
          </SettingsRow>
          <SettingsRow label="Result count">
            <Segmented
              value={settings.maxResults}
              onChange={(v) => set('maxResults', v)}
              options={[
                { value: 0, label: 'All' },
                { value: 5, label: '5' },
                { value: 8, label: '8' },
                { value: 12, label: '12' },
              ]}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="Keyboard">
          <SettingsRow
            label="Settings shortcut"
            hint={settingsError || `Opens Flow settings — ${formatRawShortcut(settings.settingsShortcut)}`}
          >
            <ShortcutRecorder
              value={formatRawShortcut(settings.settingsShortcut)}
              onChange={applySettingsShortcut}
              hasError={Boolean(settingsError)}
              widthClass="w-[155px]"
            />
          </SettingsRow>
          <SettingsRow label="Action panel shortcut" hint="Opens actions for the selected item">
            <input
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              onBlur={applyActionShortcut}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              spellCheck={false}
              className="input-base w-[155px] py-1 pl-2.5 pr-2 text-[11.5px]"
            />
          </SettingsRow>
          <SettingsRow label="Show shortcut hints" hint="Footer key hints and inline kbd labels">
            <Toggle
              checked={settings.showShortcutHints}
              onChange={(v) => set('showShortcutHints', v)}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="Screenshot">
          <SettingsRow
            label="Shortcut"
            hint={
              !settings.screenshotEnabled
                ? 'Disabled'
                : screenshotShortcutError ||
                  (settings.screenshotShortcut
                    ? `Triggers screenshot capture — ${formatRawShortcut(settings.screenshotShortcut)}`
                    : 'No shortcut configured')
            }
          >
            <ShortcutRecorder
              value={formatRawShortcut(settings.screenshotShortcut)}
              onChange={applyScreenshotShortcut}
              hasError={Boolean(screenshotShortcutError)}
              widthClass="w-[155px]"
            />
          </SettingsRow>
          <SettingsRow
            label="Behavior"
            hint={
              settings.screenshotBehavior === 'instant'
                ? 'Directly executes copy/save upon selection and dismisses overlay'
                : 'Freezes selection with toolbar for review, copying or saving'
            }
          >
            <Segmented
              value={settings.screenshotBehavior}
              onChange={(v) => set('screenshotBehavior', v)}
              options={[
                { value: 'review', label: 'Review' },
                { value: 'instant', label: 'Instant' },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Automatically save screenshots"
            hint={
              settings.screenshotAutoSave
                ? 'Saves directly to disk upon region selection'
                : 'Manual saving via toolbar'
            }
          >
            <Toggle
              checked={settings.screenshotAutoSave}
              onChange={(v) => set('screenshotAutoSave', v)}
            />
          </SettingsRow>
          <SettingsRow
            label="Save location"
            hint={settings.screenshotDirectory || 'Pictures\\Screenshots'}
          >
            <button onClick={chooseDirectory} className="btn-secondary px-2.5 py-1.5 text-[11px] cursor-pointer">
              Change
            </button>
          </SettingsRow>
          <SettingsRow label="Image format">
            <Segmented
              value={settings.screenshotFormat}
              onChange={(v) => set('screenshotFormat', v)}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Copy to clipboard" hint="Places captured region into clipboard">
            <Toggle checked={settings.screenshotCopy} onChange={(v) => set('screenshotCopy', v)} />
          </SettingsRow>
          <SettingsRow
            label="Enable screenshot"
            hint={
              settings.screenshotEnabled
                ? 'Print Screen hotkey and region capture are active'
                : 'Screenshot hotkey and capture are disabled'
            }
          >
            <Toggle
              checked={settings.screenshotEnabled ?? true}
              onChange={(v) => {
                set('screenshotEnabled', v)
                void window.electron?.settings?.setScreenshotEnabled?.(v)
              }}
            />
          </SettingsRow>
          <SettingsRow
            label="Capture mouse cursor"
            hint={
              settings.screenshotCaptureCursor
                ? 'Cursor is visible in screenshot'
                : 'Cursor is excluded from screenshot'
            }
          >
            <Toggle
              checked={settings.screenshotCaptureCursor ?? false}
              onChange={(v) => set('screenshotCaptureCursor', v)}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="Data">
          <div className="flex flex-wrap gap-2 px-4 pt-1">
            <button onClick={clearCache} className="btn-secondary px-3 py-1.5 text-[11px] cursor-pointer">
              Clear cache
            </button>
            <button onClick={resetSettings} className="btn-secondary px-3 py-1.5 text-[11px] cursor-pointer">
              Reset settings
            </button>
            <button onClick={exportData} className="btn-secondary px-3 py-1.5 text-[11px] cursor-pointer">
              Export data
            </button>
            <button onClick={importData} className="btn-secondary px-3 py-1.5 text-[11px] cursor-pointer">
              Import data
            </button>
          </div>
        </SettingsSection>

        <SettingsDivider />

        <SettingsSection label="About">
          <div className="px-4 pt-1">
            <div className="flex items-start gap-3 rounded-lg border border-flow-border bg-flow-surface p-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-flow-bg-elevated border border-flow-border">
                <IconGlyph name="flow" size={18} className="text-flow-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-[13px] font-semibold text-flow-primary leading-none">Exist Flow</h4>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-flow-secondary leading-none">v0.1.0</span>
                </div>
                <p className="mt-1 text-[11px] text-flow-muted leading-relaxed">
                  Your desktop, one shortcut away. A keyboard-first command launcher and workspace manager for Windows.
                </p>
                <div className="mt-2.5 flex flex-col gap-1.5 text-[11px] text-flow-muted">
                  <div className="flex items-center gap-1.5">
                    <IconGlyph name="discord" size={13} className="text-flow-secondary flex-shrink-0" />
                    <span className="text-flow-secondary">Discord:</span>
                    <span className="font-mono text-flow-primary select-all">{ABOUT_DISCORD_HANDLE}</span>
                    <span className="text-white/15">·</span>
                    <span className="text-[10px] text-flow-muted">Created by Exist</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconGlyph name="github" size={13} className="text-flow-secondary flex-shrink-0" />
                    <span className="text-flow-secondary">GitHub:</span>
                    <button
                      type="button"
                      onClick={() => void window.electron?.app.open(ABOUT_GITHUB_URL)}
                      className="font-mono text-flow-primary hover:underline hover:text-white transition-colors cursor-pointer text-left"
                    >
                      {ABOUT_GITHUB_HANDLE}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
