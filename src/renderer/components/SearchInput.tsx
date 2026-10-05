import React, { forwardRef } from 'react'
import { formatShortcut } from '@renderer/utils/platform'
import { useSettings } from '@renderer/store/settings-store'

interface SearchInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  resultCount?: number
  onClear?: () => void
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, resultCount, onClear }, ref) => {
    const isFocused = React.useRef(false)
    const [focused, setFocused] = React.useState(false)
    const showShortcutHints = useSettings((s) => s.showShortcutHints)

    return (
      <div
        className={[
          'group relative flex h-[46px] items-center gap-3 rounded-[10px] px-3.5',
          'border bg-[#0e0f12] transition-all duration-150',
          focused
            ? 'border-white/[0.16] shadow-[0_2px_16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.08)]'
            : 'border-white/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/[0.10]',
        ].join(' ')}
      >
        {/* Optically tuned search lens icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            'flex-shrink-0 transition-colors duration-150',
            focused ? 'text-white/85' : 'text-white/40 group-hover:text-white/55',
          ].join(' ')}
        >
          <circle cx="10.5" cy="10.5" r="7.25" />
          <path d="m20.5 20.5-4.6-4.6" />
        </svg>

        {/* Search input field */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          onFocus={() => {
            isFocused.current = true
            setFocused(true)
          }}
          onBlur={() => {
            isFocused.current = false
            setFocused(false)
          }}
          placeholder="Search flows..."
          className={[
            'h-full min-w-0 flex-1 bg-transparent text-[14.5px] font-[450] tracking-[-0.018em] leading-normal text-[#FAFAFA]',
            'placeholder:font-[400] placeholder:tracking-[-0.014em] placeholder:text-white/30',
            'border-none outline-none selection:bg-white/15',
          ].join(' ')}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {/* Right cluster: result counter, clear button, shortcut hint */}
        <div className="flex flex-shrink-0 items-center gap-2 select-none">
          {resultCount !== undefined && resultCount > 0 && (
            <span
              className="flex items-center rounded-[4px] border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-white/45 tabular-nums"
              title={`${resultCount} results`}
            >
              {resultCount}
            </span>
          )}

          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="flow-focus-ring flex h-5 w-5 items-center justify-center rounded-[4px] text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/85"
              aria-label="Clear search"
            >
              <svg
                width="11"
                height="11"
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
          )}

          {!value && showShortcutHints && (
            <kbd
              title="Actions for selected item"
              className="flex items-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              {formatShortcut('K')}
            </kbd>
          )}
        </div>
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'

export default SearchInput
