// Screenshot capture overlay (renderer side of `?mode=capture`).
// Full-screen screenshot image → drag to select a region → toolbar
// (Copy / Save / Cancel). Selection area stays bright, everything else
// is dimmed. Esc always cancels and returns to the launcher.
// With "Automatically save screenshots" ON the capture saves silently
// the moment the drag completes (Lightshot-style) — the toolbar only
// stays when "Open editor after capture" is also enabled.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '@renderer/store/settings-store'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface ToolbarPos {
  left: number
  top: number
}

const MIN_SIZE = 4

function normalize(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  }
}

function cropSelection(dataUrl: string, rect: Rect): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const scaleX = img.naturalWidth / window.innerWidth
        const scaleY = img.naturalHeight / window.innerHeight
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(rect.w * scaleX))
        canvas.height = Math.max(1, Math.round(rect.h * scaleY))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(
          img,
          Math.round(rect.x * scaleX),
          Math.round(rect.y * scaleY),
          canvas.width,
          canvas.height,
          0,
          0,
          canvas.width,
          canvas.height
        )
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('failed to load screenshot'))
    img.src = dataUrl
  })
}

function removeCursorFromCanvas(
  ctx: CanvasRenderingContext2D,
  cursorX: number,
  cursorY: number,
  canvasWidth: number,
  canvasHeight: number
) {
  // Typical Windows cursor bounding box in native screen pixels
  const boxW = Math.max(24, Math.round(28 * (canvasWidth / window.innerWidth)))
  const boxH = Math.max(28, Math.round(32 * (canvasHeight / window.innerHeight)))
  const margin = 3

  const x0 = Math.max(margin, Math.min(canvasWidth - boxW - margin, Math.round(cursorX)))
  const y0 = Math.max(margin, Math.min(canvasHeight - boxH - margin, Math.round(cursorY)))
  const w = boxW
  const h = boxH

  const fullW = w + margin * 2
  const fullH = h + margin * 2
  const imgData = ctx.getImageData(x0 - margin, y0 - margin, fullW, fullH)
  const data = imgData.data

  const getPixel = (px: number, py: number) => {
    const idx = (py * fullW + px) * 4
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]
  }

  // Dirichlet harmonic interpolation: inpaint and replace cursor pixels using clean boundary pixels
  for (let dy = margin; dy < margin + h; dy++) {
    for (let dx = margin; dx < margin + w; dx++) {
      const topP = getPixel(dx, 0)
      const btmP = getPixel(dx, fullH - 1)
      const leftP = getPixel(0, dy)
      const rgtP = getPixel(fullW - 1, dy)

      const dL = Math.max(0.01, dx - margin)
      const dR = Math.max(0.01, margin + w - dx)
      const dT = Math.max(0.01, dy - margin)
      const dB = Math.max(0.01, margin + h - dy)

      const invL = 1 / dL
      const invR = 1 / dR
      const invT = 1 / dT
      const invB = 1 / dB
      const sumInv = invL + invR + invT + invB

      const idx = (dy * fullW + dx) * 4
      for (let c = 0; c < 3; c++) {
        data[idx + c] = Math.round(
          (leftP[c] * invL + rgtP[c] * invR + topP[c] * invT + btmP[c] * invB) / sumInv
        )
      }
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imgData, x0 - margin, y0 - margin)
}

export default function ScreenshotOverlay() {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [isAnimated, setIsAnimated] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null)
  const [toolbar, setToolbar] = useState<ToolbarPos | null>(null)
  const [toolbarDrag, setToolbarDrag] = useState<{ dx: number; dy: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<Rect | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const currentRunIdRef = useRef<number>(0)
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null)
  const captureCursorRef = useRef<boolean>(false)
  selRef.current = sel

  const epochNow = () => performance.timeOrigin + performance.now()

  const resetState = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    cursorPositionRef.current = null
    captureCursorRef.current = false
    setDataUrl(null)
    setIsAnimated(false)
    setIsClosing(false)
    setErrorMessage(null)
    setSel(null)
    setDragOrigin(null)
    setToolbar(null)
    setToolbarDrag(null)
    setBusy(false)
    setAutoSaving(false)
  }, [])

  const handleIncomingPayload = useCallback((payload: Uint8Array | Buffer | string) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setDataUrl(null)
    setIsAnimated(false)
    setErrorMessage(null)

    if (!payload) {
      console.warn('[ScreenshotOverlay] empty payload received')
      return
    }

    let src = ''
    if (typeof payload === 'string') {
      src = payload
    } else {
      const blob = new Blob([payload as any], { type: 'image/jpeg' })
      src = URL.createObjectURL(blob)
      blobUrlRef.current = src
    }

    const runId = currentRunIdRef.current
    const img = new Image()
    img.onload = () => {
      console.log(`[ScreenshotOverlay] img.onload: ${img.naturalWidth}x${img.naturalHeight}`)
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        setErrorMessage('Ekran görüntüsü boş geldi.')
        window.electron?.screenshot.metric?.(runId, 'img-error', epochNow(), { reason: 'zero-dimension' })
        return
      }

      let finalSrc = src
      const cursor = cursorPositionRef.current
      const shouldCaptureCursor = captureCursorRef.current

      // When cursor capture is DISABLED (!shouldCaptureCursor), desktopCapturer on Windows
      // automatically embeds the OS cursor in the screen buffer. We cleanly remove/inpaint
      // that small bounding box using Dirichlet boundary interpolation.
      if (!shouldCaptureCursor && cursor) {
        try {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          const ctx = c.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            const scaleX = img.naturalWidth / window.innerWidth
            const scaleY = img.naturalHeight / window.innerHeight
            removeCursorFromCanvas(ctx, cursor.x * scaleX, cursor.y * scaleY, img.naturalWidth, img.naturalHeight)
            finalSrc = c.toDataURL('image/png')
          }
        } catch (e) {
          console.warn('[ScreenshotOverlay] failed to remove cursor:', e)
        }
      }

      setDataUrl(finalSrc)
      window.electron?.screenshot.metric?.(runId, 'img-load', epochNow(), { width: img.naturalWidth, height: img.naturalHeight })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimated(true)
          window.electron?.screenshot.metric?.(runId, 'settled', epochNow())
        })
      })
    }
    img.onerror = (err) => {
      console.error('[ScreenshotOverlay] img.onerror failed to load:', err)
      setErrorMessage('Görüntü çözülemedi.')
      window.electron?.screenshot.metric?.(runId, 'img-error', epochNow(), { error: String(err) })
    }
    img.src = src
  }, [])

  useEffect(() => {
    void useSettings.getState().load()
    let cancelled = false
    void window.electron?.screenshot.getData().then((res) => {
      if (cancelled) return
      if (res?.cursor) {
        cursorPositionRef.current = res.cursor
      }
      if (res?.captureCursor !== undefined) {
        captureCursorRef.current = res.captureCursor
      } else {
        captureCursorRef.current = useSettings.getState().screenshotCaptureCursor ?? false
      }
      if (res?.buffer) {
        handleIncomingPayload(res.buffer)
      } else if (res?.dataUrl) {
        handleIncomingPayload(res.dataUrl)
      }
    })

    const unsubscribeBegin = window.electron?.screenshot.onBegin?.(({ runId, cursor, captureCursor }) => {
      currentRunIdRef.current = runId
      resetState()
      cursorPositionRef.current = cursor || null
      captureCursorRef.current = captureCursor ?? useSettings.getState().screenshotCaptureCursor ?? false
      requestAnimationFrame(() => {
        window.electron?.screenshot.metric?.(runId, 'first-frame', epochNow())
      })
    })

    const unsubscribeFailed = window.electron?.screenshot.onCaptureFailed?.(({ runId, reason }) => {
      currentRunIdRef.current = runId
      console.error(`[ScreenshotOverlay] capture failed for run #${runId}: ${reason}`)
      const text =
        reason === 'empty-thumbnail'
          ? 'Ekran görüntüsü boş geldi (0x0). Ekran kilitli veya masaüstü kaynağı yanıt vermedi.'
          : reason === 'no-screen-source'
          ? 'Hedef ekran için uygun ekran kaynağı bulunamadı.'
          : `Ekran görüntüsü alınamadı (${reason}).`
      setErrorMessage(text)
      window.electron?.screenshot.metric?.(runId, 'error-shown', epochNow(), { reason })
    })

    const unsubscribeReset = window.electron?.screenshot.onReset?.(() => {
      resetState()
    })

    const unsubscribeReady = window.electron?.screenshot.onCaptureReady?.((payload) => {
      handleIncomingPayload(payload)
      void useSettings.getState().load()
    })

    return () => {
      cancelled = true
      unsubscribeBegin?.()
      unsubscribeFailed?.()
      unsubscribeReset?.()
      unsubscribeReady?.()
    }
  }, [handleIncomingPayload, resetState])

  // Position the toolbar whenever the selection changes
  useEffect(() => {
    if (!sel) {
      setToolbar(null)
      return
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tw = 224
    const th = 34
    let left = sel.x + sel.w / 2 - tw / 2
    let top = sel.y + sel.h + 8
    if (top + th > vh - 8) top = sel.y - th - 8
    left = Math.max(8, Math.min(left, vw - tw - 8))
    top = Math.max(8, Math.min(top, vh - th - 8))
    setToolbar({ left, top })
  }, [sel])

  const cancel = useCallback(() => {
    if (busy || isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      resetState()
      void window.electron?.screenshot.cancel()
    }, 90)
  }, [busy, isClosing, resetState])

  const copy = useCallback(async () => {
    const rect = selRef.current
    if (!dataUrl || !rect || busy || isClosing) return
    setBusy(true)
    try {
      const cropped = await cropSelection(dataUrl, rect)
      await window.electron?.screenshot.copy(cropped)
      setIsClosing(true)
      setTimeout(async () => {
        resetState()
        await window.electron?.screenshot.complete()
      }, 90)
    } catch (err) {
      console.error('[Screenshot] copy failed:', err)
      setBusy(false)
    }
  }, [dataUrl, busy, isClosing, resetState])

  const save = useCallback(async () => {
    const rect = selRef.current
    if (!dataUrl || !rect || busy || isClosing) return
    setBusy(true)
    try {
      const cropped = await cropSelection(dataUrl, rect)
      const result = await window.electron?.screenshot.save(cropped)
      if (result?.success) {
        setIsClosing(true)
        setTimeout(async () => {
          resetState()
          await window.electron?.screenshot.complete()
        }, 90)
      } else {
        setBusy(false) // dialog canceled — keep selection
      }
    } catch (err) {
      console.error('[Screenshot] save failed:', err)
      setBusy(false)
    }
  }, [dataUrl, busy, isClosing, resetState])

  const runAutoSave = useCallback(
    async (rect: Rect, close: boolean) => {
      if (!dataUrl || isClosing) return
      setBusy(true)
      try {
        const cropped = await cropSelection(dataUrl, rect)
        const result = await window.electron?.screenshot.saveAuto(cropped)
        if (!result?.success) throw new Error(result?.error || 'auto-save failed')
        if (useSettings.getState().screenshotCopy) {
          await window.electron?.screenshot.copy(cropped)
        }
        if (close) {
          setIsClosing(true)
          setTimeout(async () => {
            resetState()
            await window.electron?.screenshot.complete()
          }, 90)
          return
        }
        // Editor mode: keep the selection + toolbar usable
        setBusy(false)
      } catch (err) {
        console.error('[Screenshot] auto-save failed:', err)
        // Recover: show the manual toolbar for this selection
        setAutoSaving(false)
        setBusy(false)
      }
    },
    [dataUrl, isClosing, resetState]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancel()
        return
      }
      if (e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c')) {
        if (selRef.current) {
          e.preventDefault()
          void copy()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cancel, copy])

  const onMouseDown = (e: React.MouseEvent) => {
    if (busy || toolbarDrag) return
    const target = e.target as HTMLElement
    if (target.closest('[data-toolbar]')) return
    setDragOrigin({ x: e.clientX, y: e.clientY })
    setSel(null)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragOrigin) return
    setSel(normalize(dragOrigin.x, dragOrigin.y, e.clientX, e.clientY))
  }

  const onMouseUp = (e: React.MouseEvent) => {
    if (!dragOrigin) return
    const rect = normalize(dragOrigin.x, dragOrigin.y, e.clientX, e.clientY)
    setDragOrigin(null)
    if (rect.w < MIN_SIZE || rect.h < MIN_SIZE) {
      setSel(null)
      return
    }
    const st = useSettings.getState()
    const isInstant = st.screenshotBehavior === 'instant'

    if (isInstant) {
      setSel(rect)
      setAutoSaving(true)
      const shouldSave = st.screenshotAutoSave
      const shouldCopy = st.screenshotCopy

      // If user has auto-save enabled in instant mode, run auto-save (which also copies if copy is on)
      if (shouldSave) {
        void runAutoSave(rect, true)
        return
      }

      // If auto-save is off but copy is on, crop and copy, then close
      if (shouldCopy) {
        setBusy(true)
        void (async () => {
          try {
            if (!dataUrl) return
            const cropped = await cropSelection(dataUrl, rect)
            await window.electron?.screenshot.copy(cropped)
            resetState()
            await window.electron?.screenshot.complete()
          } catch (err) {
            console.error('[Screenshot] instant copy failed:', err)
            setBusy(false)
            setAutoSaving(false)
          }
        })()
        return
      }

      // Edge case: Both Auto-save and Copy are off in Instant mode -> fallback to review toolbar
      setSel(rect)
      setAutoSaving(false)
      return
    }

    // Review Mode (Lightshot style)
    if (st.screenshotAutoSave) {
      // If AutoSave is on in Review mode, save in background but keep toolbar for review/copy
      setSel(rect)
      void runAutoSave(rect, false)
      return
    }

    // Standard Review Mode: Select region → Show floating toolbar (Copy / Save / Cancel)
    setSel(rect)
  }

  const onToolbarMouseDown = (e: React.MouseEvent) => {
    if (busy || !toolbar) return
    e.stopPropagation()
    setToolbarDrag({ dx: e.clientX - toolbar.left, dy: e.clientY - toolbar.top })
  }

  const onGlobalMouseMove = (e: React.MouseEvent) => {
    if (!toolbarDrag || !toolbar) return
    const left = Math.max(8, Math.min(e.clientX - toolbarDrag.dx, window.innerWidth - 232))
    const top = Math.max(8, Math.min(e.clientY - toolbarDrag.dy, window.innerHeight - 42))
    setToolbar({ left, top })
  }

  const onGlobalMouseUp = () => {
    if (toolbarDrag) setToolbarDrag(null)
  }

  return (
    <div
      ref={rootRef}
      className={`screenshot-overlay fixed inset-0 select-none ${isClosing ? 'capture-fade-out' : ''}`}
      style={{ cursor: 'crosshair' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseMoveCapture={onGlobalMouseMove}
      onMouseUpCapture={onGlobalMouseUp}
    >
      {/* 1. Arka plan katmanı: 0 → %40 koyuluk, 120ms ease-out fade-in */}
      <div className="pointer-events-none absolute inset-0 capture-veil-in" />

      {/* 2. Full screenshot with 0.985 -> 1 scale in 150ms */}
      {dataUrl ? (
        <div
          className={[
            'pointer-events-none absolute inset-0 h-full w-full',
            isAnimated ? 'capture-image-in' : 'opacity-0 scale-[0.985]',
          ].join(' ')}
        >
          <img
            src={dataUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />
        </div>
      ) : (
        <div className="bg-black pointer-events-none absolute inset-0" />
      )}

      {/* Error notification if capture or decoding failed */}
      {errorMessage && (
        <div
          className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={cancel}
        >
          <div
            className="flex flex-col items-center gap-2.5 rounded-xl border border-red-500/30 bg-[#16171a] px-6 py-4 font-medium text-red-300 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-red-200">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="7" />
                <line x1="8" y1="5" x2="8" y2="9" />
                <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <p className="text-[11px] text-white/50 text-center max-w-[340px]">
              Windows ekran yakalama servisi yanıt vermedi veya ekran kilitli olabilir.
            </p>
            <button
              onClick={cancel}
              className="mt-1 rounded-md border border-white/10 bg-white/10 px-3.5 py-1 text-[11px] text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
            >
              Kapat (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Dim outside selection */}
      {sel && (
        <div className="pointer-events-none absolute inset-0">
          {/* Top rect */}
          <div className="absolute left-0 right-0 top-0 bg-black/50" style={{ height: Math.max(0, sel.y) }} />
          {/* Bottom rect */}
          <div className="absolute left-0 right-0 bottom-0 bg-black/50" style={{ top: Math.max(0, sel.y + sel.h) }} />
          {/* Left rect */}
          <div className="absolute left-0 bg-black/50" style={{ top: Math.max(0, sel.y), width: Math.max(0, sel.x), height: Math.max(0, sel.h) }} />
          {/* Right rect */}
          <div className="absolute right-0 bg-black/50" style={{ top: Math.max(0, sel.y), left: Math.max(0, sel.x + sel.w), height: Math.max(0, sel.h) }} />

          {/* Border around selection */}
          <div
            className="absolute border border-white/80"
            style={{
              left: sel.x,
              top: sel.y,
              width: sel.w,
              height: sel.h,
            }}
          />
          {/* Size label */}
          <div
            className="absolute rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white/90"
            style={{
              left: Math.min(sel.x, window.innerWidth - 70),
              top: Math.max(sel.y - 20, 4),
            }}
          >
            {Math.round(sel.w)} × {Math.round(sel.h)}
          </div>
        </div>
      )}

      {/* Idle hint */}
      {!sel && !dragOrigin && (
        <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center">
          <div className="rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-[11.5px] text-white/70">
            Drag to select a region · <span className="font-mono text-[10px]">Esc</span> to cancel
          </div>
        </div>
      )}

      {/* Dim veil while dragging (before a selection exists) */}
      {!sel && dragOrigin && (
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
      )}

      {/* Toolbar */}
      {sel && toolbar && !autoSaving && (
        <div
          data-toolbar
          className="screenshot-toolbar absolute flex h-[34px] items-center gap-1 rounded-lg border border-white/12 bg-[#111214] px-1.5 shadow-lg"
          style={{ left: toolbar.left, top: toolbar.top }}
          onMouseDown={onToolbarMouseDown}
        >
          {/* Drag handle */}
          <div className="flex h-6 w-5 cursor-grab items-center justify-center text-white/40 active:cursor-grabbing">
            <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor">
              <circle cx="2" cy="2" r="1.2" />
              <circle cx="7" cy="2" r="1.2" />
              <circle cx="2" cy="6.5" r="1.2" />
              <circle cx="7" cy="6.5" r="1.2" />
              <circle cx="2" cy="11" r="1.2" />
              <circle cx="7" cy="11" r="1.2" />
            </svg>
          </div>

          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void copy()}
            disabled={busy}
            className="h-6 rounded-md px-2.5 text-[11.5px] text-white/85 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Copy
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void save()}
            disabled={busy}
            className="h-6 rounded-md px-2.5 text-[11.5px] text-white/85 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Save
          </button>
          <div className="mx-0.5 h-4 w-px bg-white/12" />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={cancel}
            disabled={busy}
            title="Cancel (Esc)"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white/90 disabled:opacity-50"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
