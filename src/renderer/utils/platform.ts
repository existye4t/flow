// Platform abstraction for keyboard shortcuts.
// Visual presentation uses the clean, modern Command symbol (⌘K, ⌘,, ⌘N),
// while underlying behavior stays fully functional on Windows (Ctrl) and macOS (Cmd).

export const isMac =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

export const modLabel = '⌘'

/** Display string for a modifier+key combo, e.g. formatShortcut('K') → "⌘K", formatShortcut(',') → "⌘,". */
export function formatShortcut(key: string): string {
  const cleanKey = key === 'comma' ? ',' : key
  return `${modLabel}${cleanKey}`
}

/** True when the platform's primary modifier is held on this event. */
export function isModKey(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMac ? e.metaKey : e.ctrlKey || e.metaKey
}

const MODIFIERS = new Set([
  'ctrl',
  'control',
  'cmd',
  'command',
  'alt',
  'shift',
  'super',
  'meta',
  'commandorcontrol',
])

const KEY_PATTERN =
  /^([a-z0-9]|f[0-9]{1,2}|space|enter|return|tab|esc|escape|up|down|left|right|home|end|pageup|pagedown|insert|delete|backspace|[+\-/*,])$/

/**
 * Light client-side validation for shortcut input fields — mirrors the
 * main-process accelerator parser closely enough for good UX; the main
 * process remains the source of truth (invalid values are skipped there).
 */
export function isValidShortcutInput(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/\bprint\s+screen\b/g, 'printscreen')
    .replace(/\bprt\s*sc(n)?\b/g, 'printscreen')
  const parts = normalized
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return false
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)
  const isPrintScreen = key === 'printscreen' || key === 'prtscn' || key === 'prtsc'
  // Bare function keys (F9, F12…) and PrintScreen are valid shortcuts.
  if (modifiers.length === 0) return /^f[0-9]{1,2}$/.test(key) || isPrintScreen
  if (!modifiers.every((modifier) => MODIFIERS.has(modifier))) return false
  return KEY_PATTERN.test(key) || isPrintScreen
}

/** Display string for a raw accelerator, e.g. "ctrl+," → "⌘,", "ctrl+k" → "⌘K", "Print Screen" → "Print Screen". */
export function formatRawShortcut(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/\bprint\s+screen\b/g, 'printscreen')
    .replace(/\bprt\s*sc(n)?\b/g, 'printscreen')
  const parts = normalized
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)
  const displayMods = mods.map((mod) => {
    if (mod === 'ctrl' || mod === 'control' || mod === 'cmdorctrl' || mod === 'commandorcontrol') return '⌘'
    if (mod === 'cmd' || mod === 'command' || mod === 'super' || mod === 'meta') return '⌘'
    if (mod === 'alt' || mod === 'option') return '⌥'
    if (mod === 'shift') return '⇧'
    return mod.charAt(0).toUpperCase() + mod.slice(1)
  })

  let keyDisplay = ''
  if (key === 'printscreen' || key === 'prtscn' || key === 'prtsc') {
    keyDisplay = 'Print Screen'
  } else if (key === ',' || key === 'comma') {
    keyDisplay = ','
  } else if (key.length === 1) {
    keyDisplay = key.toUpperCase()
  } else {
    keyDisplay = key.charAt(0).toUpperCase() + key.slice(1)
  }

  if (displayMods.length === 0) {
    return keyDisplay
  }

  const allSymbols = displayMods.every((m) => ['⌘', '⌥', '⇧'].includes(m))
  if (allSymbols && keyDisplay.length === 1) {
    return `${displayMods.join('')}${keyDisplay}`
  }
  return [...displayMods, keyDisplay].join(' ')
}

/**
 * Format a shortcut specifically for application, project, and flow item badges on Windows/desktop.
 * Always renders clean text like "Ctrl+Alt+Shift+R", "Ctrl+Space", "Ctrl+Alt+D" rather than macOS symbols.
 */
export function formatBadgeShortcut(value: string): string {
  if (!value) return ''
  const normalized = value
    .toLowerCase()
    .replace(/\bprint\s+screen\b/g, 'printscreen')
    .replace(/\bprt\s*sc(n)?\b/g, 'printscreen')
  const parts = normalized
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)

  const modOrder: string[] = []
  for (const mod of mods) {
    if (mod === 'ctrl' || mod === 'control' || mod === 'cmdorctrl' || mod === 'commandorcontrol') {
      modOrder.push('Ctrl')
    } else if (mod === 'alt' || mod === 'option') {
      modOrder.push('Alt')
    } else if (mod === 'shift') {
      modOrder.push('Shift')
    } else if (mod === 'cmd' || mod === 'command' || mod === 'super' || mod === 'meta') {
      modOrder.push('Win')
    }
  }

  let keyDisplay = ''
  if (key === 'printscreen' || key === 'prtscn' || key === 'prtsc') {
    keyDisplay = 'Print Screen'
  } else if (key === 'space') {
    keyDisplay = 'Space'
  } else if (key === ',' || key === 'comma') {
    keyDisplay = ','
  } else if (key.length === 1) {
    keyDisplay = key.toUpperCase()
  } else {
    keyDisplay = key.charAt(0).toUpperCase() + key.slice(1)
  }

  return [...modOrder, keyDisplay].join('+')
}

/**
 * Captures a key combo from a keyboard event in an input field.
 * Returns the normalized shortcut string (e.g. "Print Screen", "Ctrl+Shift+S", "Ctrl+Space"),
 * or null if the event is a bare modifier or incomplete combo.
 */
export function recordShortcutFromEvent(e: React.KeyboardEvent): string | null {
  const key = e.key
  // Ignore bare modifier presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return null
  }

  // Handle PrintScreen bare or with modifiers
  if (key === 'PrintScreen' || e.code === 'PrintScreen') {
    const mods: string[] = []
    if (e.ctrlKey) mods.push('Ctrl')
    if (e.altKey) mods.push('Alt')
    if (e.shiftKey) mods.push('Shift')
    if (mods.length === 0) return 'Print Screen'
    return [...mods, 'Print Screen'].join('+')
  }

  // Handle function keys bare or with modifiers
  if (/^F\d{1,2}$/i.test(key)) {
    const mods: string[] = []
    if (e.ctrlKey) mods.push('Ctrl')
    if (e.altKey) mods.push('Alt')
    if (e.shiftKey) mods.push('Shift')
    return [...mods, key.toUpperCase()].join('+')
  }

  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')

  // Require at least one modifier for standard keys
  if (mods.length === 0) return null

  let cleanKey = key
  if (key === ' ' || e.code === 'Space') cleanKey = 'Space'
  else if (key === ',') cleanKey = ','
  else if (key.length === 1) cleanKey = key.toUpperCase()
  else cleanKey = key.charAt(0).toUpperCase() + key.slice(1)

  return [...mods, cleanKey].join('+')
}
