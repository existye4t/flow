import React, { useState, useEffect, useRef } from 'react'

export interface ShortcutRecorderProps {
  value: string
  onChange: (value: string) => void | Promise<void>
  hasError?: boolean
  disabled?: boolean
  widthClass?: string
  placeholder?: string
}

function isPrintScreenEvent(e: KeyboardEvent | React.KeyboardEvent): boolean {
  if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.key === 'Print') return true
  if ('keyCode' in e && (e.keyCode === 44 || e.which === 44)) return true
  const lowerKey = (e.key || '').toLowerCase().trim()
  if (lowerKey === 'printscreen' || lowerKey === 'print screen' || lowerKey === 'prtsc' || lowerKey === 'prtscn') {
    return true
  }
  return false
}

export default function ShortcutRecorder({
  value,
  onChange,
  hasError = false,
  disabled = false,
  widthClass = 'w-[155px]',
  placeholder = 'Click to record',
}: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [heldModifiers, setHeldModifiers] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isRecording) return

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      // Escape cancels recording
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsRecording(false)
        setHeldModifiers([])
        return
      }

      // Tab cancels recording
      if (e.key === 'Tab') {
        setIsRecording(false)
        setHeldModifiers([])
        return
      }

      if (isPrintScreenEvent(e)) {
        e.preventDefault()
        e.stopPropagation()
        const mods: string[] = []
        if (e.ctrlKey) mods.push('Ctrl')
        if (e.altKey) mods.push('Alt')
        if (e.shiftKey) mods.push('Shift')
        if (e.metaKey) mods.push('Cmd')
        const combo = mods.length > 0 ? `${mods.join(' + ')} + Print Screen` : 'Print Screen'
        setIsRecording(false)
        setHeldModifiers([])
        void onChange(combo)
        return
      }

      const mods: string[] = []
      if (e.ctrlKey) mods.push('Ctrl')
      if (e.altKey) mods.push('Alt')
      if (e.shiftKey) mods.push('Shift')
      if (e.metaKey) mods.push('Cmd')

      const isModifierKey = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)
      if (isModifierKey) {
        e.preventDefault()
        e.stopPropagation()
        setHeldModifiers(mods)
        return
      }

      e.preventDefault()
      e.stopPropagation()

      let cleanKey = ''
      if (/^F\d{1,2}$/i.test(e.key)) {
        cleanKey = e.key.toUpperCase()
      } else if (e.key === ' ' || e.code === 'Space') {
        cleanKey = 'Space'
      } else if (e.code.startsWith('Key')) {
        cleanKey = e.code.slice(3).toUpperCase()
      } else if (e.code.startsWith('Digit')) {
        cleanKey = e.code.slice(5)
      } else if (e.key.length === 1) {
        cleanKey = e.key.toUpperCase()
      } else {
        cleanKey = e.key.charAt(0).toUpperCase() + e.key.slice(1)
      }

      const combo = mods.length > 0 ? `${mods.join(' + ')} + ${cleanKey}` : cleanKey
      setIsRecording(false)
      setHeldModifiers([])
      void onChange(combo)
    }

    const handleWindowKeyUp = (e: KeyboardEvent) => {
      // In Chromium on Windows, physical PrintScreen often only fires keyup!
      if (isPrintScreenEvent(e)) {
        e.preventDefault()
        e.stopPropagation()
        const mods: string[] = []
        if (e.ctrlKey) mods.push('Ctrl')
        if (e.altKey) mods.push('Alt')
        if (e.shiftKey) mods.push('Shift')
        if (e.metaKey) mods.push('Cmd')
        const combo = mods.length > 0 ? `${mods.join(' + ')} + Print Screen` : 'Print Screen'
        setIsRecording(false)
        setHeldModifiers([])
        void onChange(combo)
        return
      }

      const mods: string[] = []
      if (e.ctrlKey) mods.push('Ctrl')
      if (e.altKey) mods.push('Alt')
      if (e.shiftKey) mods.push('Shift')
      if (e.metaKey) mods.push('Cmd')
      setHeldModifiers(mods)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsRecording(false)
        setHeldModifiers([])
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown, true)
    window.addEventListener('keyup', handleWindowKeyUp, true)
    document.addEventListener('mousedown', onMouseDown, true)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true)
      window.removeEventListener('keyup', handleWindowKeyUp, true)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [isRecording, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isRecording) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsRecording(true)
        setHeldModifiers([])
      }
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsRecording(false)
    setHeldModifiers([])
    void onChange('')
  }

  let displayText = value
  if (isRecording) {
    if (heldModifiers.length > 0) {
      displayText = `${heldModifiers.join(' + ')} + ...`
    } else {
      displayText = 'Press shortcut...'
    }
  } else if (!value) {
    displayText = placeholder
  }

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return
        setIsRecording(true)
        setHeldModifiers([])
      }}
      onKeyDown={handleKeyDown}
      className={[
        'flow-focus-ring relative flex h-7 items-center justify-between gap-1.5 rounded-md px-2.5 text-[11.5px] cursor-pointer select-none transition-all duration-100',
        widthClass,
        isRecording
          ? 'border border-flow-accent/60 bg-flow-hover ring-1 ring-flow-accent/40 text-flow-accent font-medium'
          : hasError
            ? 'border border-flow-danger/60 bg-flow-surface text-flow-danger'
            : value
              ? 'border border-flow-border bg-flow-surface hover:border-flow-border-strong hover:bg-flow-hover/50 text-flow-primary'
              : 'border border-dashed border-flow-border/80 bg-transparent text-flow-muted hover:border-flow-border hover:text-flow-secondary',
      ].join(' ')}
      title={isRecording ? 'Press any shortcut combination now' : 'Click to record shortcut'}
    >
      <span className="flex-1 truncate tracking-[-0.01em]">
        {isRecording && heldModifiers.length === 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-flow-accent animate-pulse" />
            <span>Press shortcut...</span>
          </span>
        ) : (
          displayText
        )}
      </span>

      {!isRecording && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="flex h-3.5 w-3.5 items-center justify-center rounded text-flow-muted hover:text-flow-primary hover:bg-white/10 transition-colors ml-1"
          title="Clear shortcut"
        >
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      )}
    </div>
  )
}
