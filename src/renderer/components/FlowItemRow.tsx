import { FlowItem } from '@shared/types'
import FlowItemMenu from '@renderer/components/FlowItemMenu'
import { useFlowStore } from '@renderer/store/flow-store'
import { IconRenderer } from '@renderer/utils/icons'
import { getItemActions, ActionContext, ItemAction } from '@renderer/actions/itemActions'
import { formatBadgeShortcut } from '@renderer/utils/platform'

interface FlowItemRowProps {
  item: FlowItem
  index: number
  isSelected: boolean
  onClick: () => void
  onDeleteRequest?: (item: FlowItem) => void
  onSetShortcut?: (item: FlowItem) => void
}

export function runItemAction(action: ItemAction, item: FlowItem, ctx: ActionContext): void {
  void Promise.resolve(action.run(item, ctx)).catch((err) => {
    console.error('[Flow] action failed:', action.id, err)
  })
}

export default function FlowItemRow({
  item,
  index,
  isSelected,
  onClick,
  onDeleteRequest,
  onSetShortcut,
}: FlowItemRowProps) {
  const toggleFavorite = useFlowStore((s) => s.toggleFavorite)
  const deleteItem = useFlowStore((s) => s.deleteItem)
  const updateItem = useFlowStore((s) => s.updateItem)
  const setEditingItem = useFlowStore((s) => s.setEditingItem)
  // Single source of truth: favorites[] in the store
  const isFavorite = useFlowStore((s) => s.favorites.includes(item.id))

  const ctx: ActionContext = {
    isFavorite,
    onOpen: onClick,
    onToggleFavorite: () => toggleFavorite(item.id),
    onEdit: () => setEditingItem(item),
    onDelete: () => {
      if (onDeleteRequest) {
        onDeleteRequest(item)
      } else {
        deleteItem(item.id)
      }
    },
    onSetShortcut: () => {
      onSetShortcut?.(item)
    },
    onClearShortcut: () => {
      updateItem(item.id, { shortcut: undefined })
      void window.electron?.shortcuts.sync()
    },
  }
  const actions = getItemActions(item, ctx)

  return (
    <FlowItemMenu
      actions={actions}
      onRun={(action) => runItemAction(action, item, ctx)}
    >
      <button
        data-index={index}
        data-selected={isSelected ? 'true' : undefined}
        onClick={onClick}
        className={[
          'flow-focus-ring group flow-row',
          'flex w-full items-center gap-3 rounded-lg px-3',
          'text-left relative h-11',
          isSelected
            ? 'bg-flow-hover flow-row-selected'
            : 'hover:bg-flow-hover/60',
        ].join(' ')}
      >
        {/* Selection accent bar */}
        <div
          className={[
            'absolute left-0 top-2 bottom-2 w-0.5 rounded-full',
            'transition-all duration-100',
            isSelected ? 'bg-flow-accent/70 opacity-100' : 'opacity-0',
          ].join(' ')}
        />

        {/* Icon slot — fixed box for optical alignment, no chip/border */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <IconRenderer icon={item.icon} item={item} size={17} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p
            className={[
              'truncate text-[13px] leading-[1.3] tracking-[-0.01em]',
              isSelected ? 'text-flow-primary font-medium' : 'text-flow-secondary font-regular',
            ].join(' ')}
          >
            {item.name}
          </p>
          {item.description && (
            <p className="mt-0.5 truncate text-[11px] leading-[1.3] tracking-[0.002em] text-flow-muted">
              {item.description}
            </p>
          )}
        </div>

        {/* Item-level global shortcut chip */}
        {item.shortcut && (
          <kbd className="flex-shrink-0 inline-flex items-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] font-medium leading-none text-flow-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            {formatBadgeShortcut(item.shortcut)}
          </kbd>
        )}

        {/* Favorite star — derived from favorites[] */}
        {isFavorite && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="flex-shrink-0 text-flow-muted/60 group-hover:text-flow-muted transition-colors duration-100"
          >
            <path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.5l-5.88 3.1 1.12-6.55-4.76-4.64 6.58-.96z" />
          </svg>
        )}

        {/* Selected: enter hint */}
        {isSelected && (
          <span className="flex-shrink-0 text-[10px] text-flow-muted opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            ↵
          </span>
        )}
      </button>
    </FlowItemMenu>
  )
}
