// Accelerator parsing shared by main-process shortcut registration.

const NAMED_KEYS: Record<string, string> = {
  space: 'Space',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  enter: 'Enter',
  return: 'Return',
  backspace: 'Backspace',
  delete: 'Delete',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  comma: ',',
  ',': ',',
  plus: 'Plus',
  printscreen: 'PrintScreen',
  prtscn: 'PrintScreen',
  prtsc: 'PrintScreen',
}

/**
 * Normalize a user-entered shortcut ("ctrl+space", "ctrl+shift+k", "Print Screen")
 * into an Electron accelerator ("Control+Space", "PrintScreen"). Returns null when
 * the input cannot be parsed.
 */
export function toAccelerator(input: string): string | null {
  const normalized = String(input)
    .toLowerCase()
    .trim()
    .replace(/\bprint\s+screen\b/g, 'printscreen')
    .replace(/\bprt\s*sc(n)?\b/g, 'printscreen')

  const parts = normalized
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  const mods: string[] = []
  let key = ''
  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        mods.push('Control')
        break
      case 'cmd':
      case 'command':
      case 'meta':
        mods.push('Command')
        break
      case 'cmdorctrl':
        mods.push('CmdOrCtrl')
        break
      case 'alt':
      case 'option':
        mods.push('Alt')
        break
      case 'shift':
        mods.push('Shift')
        break
      case 'super':
      case 'win':
        mods.push('Super')
        break
      default:
        if (key) return null
        key = part
    }
  }
  if (!key) return null

  // Bare (modifier-less) shortcuts are only accepted for function keys and PrintScreen —
  // a bare letter or ordinary named key would swallow that input system-wide.
  const isBareAllowed =
    /^f\d{1,2}$/.test(key) || key === 'printscreen' || key === 'prtscn' || key === 'prtsc'
  if (mods.length === 0 && !isBareAllowed) return null

  if (NAMED_KEYS[key]) {
    key = NAMED_KEYS[key]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  } else if (/^f\d{1,2}$/.test(key)) {
    key = key.toUpperCase()
  } else {
    return null
  }

  return [...mods, key].join('+')
}
