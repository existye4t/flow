// Shared action model — one definition consumed by both the right-click
// context menu and the Ctrl+K action panel. Future built-in utilities
// (clipboard history, calculator, window management, snippets, …) can
// register themselves here without touching the item action code.

export interface UtilityAction {
  id: string
  title: string
  subtitle?: string
  glyph: string
  keywords?: string[]
  run: () => void | Promise<void>
}

const utilities: UtilityAction[] = []

/** Register a built-in utility action (idempotent). */
export function registerUtilityAction(action: UtilityAction): void {
  if (!utilities.some((u) => u.id === action.id)) {
    utilities.push(action)
  }
}

/** Query registered utilities — empty query returns all. */
export function getUtilityActions(query = ''): UtilityAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...utilities]
  return utilities.filter((u) => {
    const haystack = [u.title, u.subtitle || '', ...(u.keywords || [])].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

// Built-in utility: screenshot capture
registerUtilityAction({
  id: 'screenshot',
  title: 'Take Screenshot',
  subtitle: 'Capture a region of the screen',
  glyph: 'camera',
  keywords: ['screenshot', 'capture', 'snip', 'screen', 'print'],
  run: () => {
    void window.electron?.screenshot.start()
  },
})
