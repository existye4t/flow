import { useFlowStore } from '@renderer/store/flow-store'
import { IconGlyph } from '@renderer/utils/icons'

interface WindowHeaderProps {
  onSettings?: () => void
  onAddFlow?: () => void
}

export default function WindowHeader({ onSettings, onAddFlow }: WindowHeaderProps) {
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as any
  const activeTab = useFlowStore((s) => s.activeTab)
  const setActiveTab = useFlowStore((s) => s.setActiveTab)
  const projects = useFlowStore((s) => s.projects)

  return (
    <div className="flex h-9 items-center justify-between px-3 select-none">
      {/* Left: App Title & Tab Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity">
          <IconGlyph name="flow" size={13} className="text-flow-primary" />
          <span className="text-[11.5px] font-medium tracking-tight text-flow-primary">Flow</span>
        </div>

        <div className="flex items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5 border border-white/[0.04]" style={noDragStyle}>
          <button
            type="button"
            onClick={() => setActiveTab('flows')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'flows'
                ? 'bg-white/10 text-flow-primary shadow-xs'
                : 'text-flow-muted hover:text-flow-secondary'
            }`}
          >
            All Flows
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'projects'
                ? 'bg-white/10 text-flow-primary shadow-xs'
                : 'text-flow-muted hover:text-flow-secondary'
            }`}
          >
            <span>Projects</span>
            {projects.length > 0 && (
              <span className="text-[9px] px-1 py-0.2 rounded-full bg-white/10 text-flow-muted font-mono">
                {projects.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Right: Actions (Add Flow, Settings, Close) */}
      <div className="flex items-center gap-1" style={noDragStyle}>
        {onAddFlow && (
          <button
            id="header-add-flow-button"
            type="button"
            onClick={onAddFlow}
            title="Add Flow (Ctrl+N)"
            className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] font-medium text-flow-secondary hover:text-flow-primary bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.04] hover:border-white/[0.08] cursor-pointer mr-0.5"
          >
            <span className="text-[12px] leading-none text-flow-muted">+</span>
            <span>Add Flow</span>
          </button>
        )}

        {onSettings && (
          <button
            onClick={onSettings}
            className="flex h-6 w-6 items-center justify-center rounded-md text-flow-muted hover:text-flow-primary hover:bg-white/[0.04] transition-colors"
            title="Settings (Ctrl+,)"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => window.electron?.closeWindow()}
          className="flex h-6 w-6 items-center justify-center rounded-md text-flow-muted hover:text-flow-primary hover:bg-white/[0.04] transition-colors"
          title="Close"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

