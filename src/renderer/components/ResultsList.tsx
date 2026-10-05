import { FlowItem } from '@shared/types'
import FlowItemRow from '@renderer/components/FlowItemRow'
import { useEffect, useState } from 'react'

interface ResultsListProps {
  items: (FlowItem & { score?: number })[]
  selectedIndex: number
  onSelect: (item: FlowItem) => void
  emptyMessage?: string
  onDeleteRequest?: (item: FlowItem) => void
  onSetShortcut?: (item: FlowItem) => void
}

export default function ResultsList({
  items,
  selectedIndex,
  onSelect,
  emptyMessage = 'No results found',
  onDeleteRequest,
  onSetShortcut,
}: ResultsListProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    setIsUpdating(true)
    const timer = setTimeout(() => setIsUpdating(false), 75)
    return () => clearTimeout(timer)
  }, [items])

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-flow-border bg-flow-surface text-flow-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-caption text-flow-muted">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`results-list ${isUpdating ? 'updating' : ''}`}>
      {items.map((item, index) => (
        <FlowItemRow
          key={item.id}
          item={item}
          index={index}
          isSelected={index === selectedIndex}
          onClick={() => onSelect(item)}
          onDeleteRequest={onDeleteRequest}
          onSetShortcut={onSetShortcut}
        />
      ))}
    </div>
  )
}
