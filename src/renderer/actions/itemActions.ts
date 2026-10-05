import { FlowItem } from '@shared/types'

export interface ActionContext {
  isFavorite: boolean
  onOpen: () => void
  onToggleFavorite: () => void
  onEdit: () => void
  onDelete: () => void
  onSetShortcut?: () => void
  onClearShortcut?: () => void
}

export interface ItemAction {
  id: string
  label: string
  glyph: string
  danger?: boolean
  separatorBefore?: boolean
  /** Keyboard hint shown in the action panel (e.g. "↵"). */
  hint?: string
  run: (item: FlowItem, ctx: ActionContext) => void | Promise<void>
}

function isUrl(target: string): boolean {
  return /^https?:\/\//.test(target)
}

function isPathTarget(target: string): boolean {
  return /^([A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(target)
}

function copyTarget(item: FlowItem): void {
  void window.electron?.clipboard.writeText(item.target)
}

/**
 * The single action model for a flow item. The context menu renders all
 * of these; the action panel renders the same list (searchable).
 */
export function getItemActions(item: FlowItem, ctx: ActionContext): ItemAction[] {
  const openLabel =
    item.type === 'command' || item.type === 'action' ? 'Run' : 'Open'

  const actions: ItemAction[] = [
    {
      id: 'open',
      label: openLabel,
      glyph: item.type === 'website' ? 'external' : 'bolt',
      hint: '↵',
      run: (_item, c) => c.onOpen(),
    },
    {
      id: 'favorite',
      label: ctx.isFavorite ? 'Unfavorite' : 'Favorite',
      glyph: 'star',
      run: (_item, c) => c.onToggleFavorite(),
    },
    {
      id: 'shortcut',
      label: item.shortcut ? `Change Shortcut (${item.shortcut})` : 'Set Shortcut',
      glyph: 'keyboard',
      hint: item.shortcut,
      run: (_item, c) => c.onSetShortcut?.(),
    },
    {
      id: 'edit',
      label: 'Edit',
      glyph: 'pencil',
      run: (_item, c) => c.onEdit(),
    },
  ]

  if (item.shortcut) {
    actions.push({
      id: 'clear-shortcut',
      label: 'Clear Shortcut',
      glyph: 'trash',
      run: (_item, c) => c.onClearShortcut?.(),
    })
  }

  if (item.type === 'application') {
    actions.push({
      id: 'elevated',
      label: 'Run as Administrator',
      glyph: 'shield',
      run: (i) => {
        void window.electron?.app.openElevated(i.target, i.arguments, i.workingDirectory)
      },
    })
    if (isPathTarget(item.target)) {
      actions.push({
        id: 'reveal',
        label: 'Open Location',
        glyph: 'folderOpen',
        run: (i) => {
          void window.electron?.app.revealPath(i.target.replace('file://', ''))
        },
      })
    }
  }

  if (item.type === 'file') {
    actions.push({
      id: 'reveal',
      label: 'Open Containing Folder',
      glyph: 'folderOpen',
      run: (i) => {
        void window.electron?.app.revealPath(i.target.replace('file://', ''))
      },
    })
  }

  const copyLabel = isUrl(item.target)
    ? 'Copy URL'
    : item.type === 'file' || item.type === 'folder' || (item.type === 'application' && isPathTarget(item.target))
      ? 'Copy Path'
      : 'Copy Command'

  actions.push({
    id: 'copy',
    label: copyLabel,
    glyph: 'copy',
    run: copyTarget,
  })

  actions.push({
    id: 'delete',
    label: 'Delete',
    glyph: 'trash',
    danger: true,
    separatorBefore: true,
    run: (_item, c) => c.onDelete(),
  })

  return actions
}
