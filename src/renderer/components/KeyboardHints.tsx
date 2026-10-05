import { formatShortcut } from '@renderer/utils/platform'

export default function KeyboardHints() {
  return (
    <div className="flex-shrink-0 flex h-8 items-center justify-between px-4 border-t border-flow-border select-none">
      <div className="flex items-center gap-3.5">
        <Hint keys="↑↓" label="Navigate" />
        <Hint keys="↵" label="Open" />
        <Hint keys={formatShortcut('N')} label="Add" />
      </div>
      <div className="flex items-center gap-3.5">
        <Hint keys={formatShortcut('K')} label="Actions" />
        <Hint keys={formatShortcut(',')} label="Settings" />
        <Hint keys="Esc" label="Close" />
      </div>
    </div>
  )
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="flex items-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] font-medium leading-none text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {keys}
      </kbd>
      <span className="text-[10px] tracking-[-0.01em] text-flow-muted font-normal">{label}</span>
    </span>
  )
}
