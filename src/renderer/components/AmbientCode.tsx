// Ambient computational texture behind the launcher surface.
// Reconstructs the official Exist Flow brand icon through the digital language
// of ambient code: binary fragments, hex tokens, digits, punctuation, and
// small luminance cells.
//
// Layered discovery:
// 1. First glance: Premium dark launcher.
// 2. Second glance: Subtle ambient code texture behind the UI.
// 3. Longer look: The Flow icon quietly emerging in the background.
// 4. Closer look: The icon is continuously reconstructed from tiny computational fragments.
//
// Canvas-based, tiny draw budget (2–5 cell repaints per tick), static under
// reduced motion, paused when hidden. Purely decorative — never interactive.
import { useEffect, useRef } from 'react'
import { useSettings } from '@renderer/store/settings-store'

type Kind = 'bin' | 'hex' | 'num' | 'char' | 'square' | 'empty'

interface Cell {
  kind: Kind
  token: string
  density: number
  phase: number
}

const BIN = ['0', '1', '01', '10', '0011', '1101', '101']
const HEX = ['A7', 'F2', '3C', '9E', '0D', 'FF', 'B4', '6E', '4C', '8B']
const NUM = ['7', '42', '128', '9', '64']
const CHAR = [':', '+', '·', '>', '#', '_', '|', '=']

const CELL_W = 12
const CELL_H = 15
const PAD_X = 14
const PAD_Y = 12
const TICK_MS = 160

const BASE_ALPHA: Record<'low' | 'medium' | 'high', number> = {
  low: 0.035,
  medium: 0.05,
  high: 0.07,
}

const ICON_GAIN: Record<'low' | 'medium' | 'high', number> = {
  low: 0.065,
  medium: 0.085,
  high: 0.115,
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Distance from point (px, py) to line segment (x1, y1)-(x2, y2). */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * Analytical distance field for the official Flow mark (viewBox 0 0 16 16):
 * Path: M4 3v6.5a4 4 0 0 0 4 4h4 with strokeWidth 2 and round caps.
 */
function flowIconDist(u: number, v: number): number {
  // Vertical segment: (4, 3) to (4, 9.5)
  const d1 = distToSegment(u, v, 4, 3, 4, 9.5)
  // Horizontal segment: (8, 13.5) to (12, 13.5)
  const d3 = distToSegment(u, v, 8, 13.5, 12, 13.5)
  // Quarter-circle arc from (4, 9.5) to (8, 13.5), centered at (8, 9.5) with radius 4 (x <= 8, y >= 9.5)
  let d2: number
  const vx = u - 8
  const vy = v - 9.5
  if (vx <= 0 && vy >= 0) {
    d2 = Math.abs(Math.hypot(vx, vy) - 4)
  } else if (vy < 0 && vx <= 0) {
    d2 = Math.hypot(u - 4, v - 9.5)
  } else if (vx > 0 && vy >= 0) {
    d2 = Math.hypot(u - 8, v - 13.5)
  } else {
    d2 = Math.min(Math.hypot(u - 4, v - 9.5), Math.hypot(u - 8, v - 13.5))
  }
  return Math.min(d1, d2, d3)
}

/** Compute normalized density [0.0 .. 1.0] for the Flow icon at canvas coordinate (cx, cy). */
function sampleFlowDensity(cx: number, cy: number, width: number, height: number): number {
  // Optically centered in the launcher content region (below search, above footer hints)
  const boxCenterY = Math.round(92 + (height - 92 - 32) * 0.48)
  const boxCenterX = Math.round(width * 0.5)
  const boxSize = Math.max(160, Math.min(width * 0.5, height * 0.52))

  const left = boxCenterX - boxSize / 2
  const top = boxCenterY - boxSize / 2

  // Transform canvas pixel to 16x16 icon viewBox space
  const u = ((cx - left) / boxSize) * 16
  const v = ((cy - top) / boxSize) * 16

  if (u < 1 || u > 15 || v < 1 || v > 15.5) return 0.0

  const d = flowIconDist(u, v)
  const strokeRadius = 1.05
  const feather = 0.85

  if (d <= strokeRadius) return 1.0
  if (d <= strokeRadius + feather) {
    const t = (d - strokeRadius) / feather
    return 1.0 - t * t * (3 - 2 * t) // smoothstep falloff
  }
  return 0.0
}

function createCellForDensity(density: number): Cell {
  const phase = Math.random() * Math.PI * 2
  // High density = core Flow icon silhouette
  if (density > 0.45) {
    const r = Math.random()
    if (r < 0.42) return { kind: 'square', token: '', density, phase }
    if (r < 0.65) return { kind: 'hex', token: pick(HEX), density, phase }
    if (r < 0.8) return { kind: 'num', token: pick(NUM), density, phase }
    if (r < 0.92) return { kind: 'char', token: pick(CHAR), density, phase }
    return { kind: 'bin', token: pick(BIN), density, phase }
  }

  // Mid density = stroke edges & antialiasing feather
  if (density > 0.15) {
    const r = Math.random()
    if (r < 0.28) return { kind: 'empty', token: '', density, phase }
    if (r < 0.52) return { kind: 'square', token: '', density, phase }
    if (r < 0.72) return { kind: 'bin', token: pick(BIN), density, phase }
    if (r < 0.86) return { kind: 'char', token: pick(CHAR), density, phase }
    return { kind: 'hex', token: pick(HEX), density, phase }
  }

  // Background density = sparse ambient computational field
  const r = Math.random()
  if (r > 0.11) return { kind: 'empty', token: '', density, phase }
  if (r < 0.035) return { kind: 'bin', token: pick(BIN), density, phase }
  if (r < 0.065) return { kind: 'hex', token: pick(HEX), density, phase }
  if (r < 0.09) return { kind: 'char', token: pick(CHAR), density, phase }
  return { kind: 'square', token: '', density, phase }
}

function mutateCell(cell: Cell): Cell {
  const density = cell.density
  const phase = cell.phase + 0.1
  const vanish = Math.random()

  // In the Flow icon region (density > 0.25), the reconstruction remains continuous:
  // individual computational cells subtly mutate, while the overall logo stays recognizable.
  if (density > 0.25) {
    if (cell.kind === 'empty') {
      return createCellForDensity(density)
    }
    const target = Math.random()
    if (cell.kind === 'square') {
      return target < 0.45
        ? { kind: 'hex', token: pick(HEX), density, phase }
        : { kind: 'num', token: pick(NUM), density, phase }
    }
    if (cell.kind === 'hex') {
      return target < 0.5
        ? { kind: 'square', token: '', density, phase }
        : { kind: 'char', token: pick(CHAR), density, phase }
    }
    if (cell.kind === 'char') {
      return target < 0.55
        ? { kind: 'square', token: '', density, phase }
        : { kind: 'bin', token: pick(BIN), density, phase }
    }
    // bin / num
    return target < 0.6
      ? { kind: 'square', token: '', density, phase }
      : { kind: 'hex', token: pick(HEX), density, phase }
  }

  // Ambient field outside the icon: sparse mutation / vanishing
  if (cell.kind === 'empty') {
    return vanish < 0.05 ? createCellForDensity(density) : cell
  }
  if (vanish < 0.2) {
    return { kind: 'empty', token: '', density, phase }
  }

  const target = Math.random()
  if (cell.kind === 'square') {
    return target < 0.5
      ? { kind: 'num', token: pick(NUM), density, phase }
      : { kind: 'hex', token: pick(HEX), density, phase }
  }
  if (cell.kind === 'char') {
    return target < 0.5 ? { kind: 'square', token: '', density, phase } : { kind: 'bin', token: pick(BIN), density, phase }
  }
  return createCellForDensity(density)
}

export default function AmbientCode() {
  const enabled = useSettings((s) => s.ambientEnabled)
  const intensity = useSettings((s) => s.ambientIntensity)
  const reduceMotion = useSettings((s) => s.reduceMotion)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = canvas.clientWidth || 640
    const height = canvas.clientHeight || 480
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    const cols = Math.max(1, Math.floor((width - PAD_X * 2) / CELL_W))
    const rows = Math.max(1, Math.floor((height - PAD_Y * 2) / CELL_H))

    const baseAlpha = BASE_ALPHA[intensity] ?? BASE_ALPHA.low
    const gainAlpha = ICON_GAIN[intensity] ?? ICON_GAIN.low
    const font = '10px "Cascadia Code", "Cascadia Mono", "JetBrains Mono", Consolas, monospace'

    // Initialize cells mapped to Flow icon density
    const cells: Cell[] = new Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      const cy = PAD_Y + r * CELL_H + CELL_H / 2
      for (let c = 0; c < cols; c++) {
        const cx = PAD_X + c * CELL_W + CELL_W / 2
        const density = sampleFlowDensity(cx, cy, width, height)
        const idx = r * cols + c
        cells[idx] = createCellForDensity(density)
      }
    }

    const drawCell = (index: number) => {
      const cell = cells[index]
      if (!cell) return
      const col = index % cols
      const row = Math.floor(index / cols)
      const x = PAD_X + col * CELL_W
      const y = PAD_Y + row * CELL_H

      // Clear cell bounding box
      ctx.clearRect(x - 2, y - 2, CELL_W + 1, CELL_H)
      if (cell.kind === 'empty') return

      const density = cell.density
      const cellAlpha = Math.min(
        0.18,
        baseAlpha + density * gainAlpha + (density > 0.3 ? 0.012 : 0)
      )

      if (cell.kind === 'square') {
        const size = density > 0.5 ? 5 : density > 0.25 ? 4 : 3
        const offset = Math.round((CELL_W - size) / 2)
        const topOffset = Math.round((CELL_H - size) / 2)
        // Clean monochrome / silver-white tone matching OLED surface
        ctx.fillStyle = `rgba(240, 240, 246, ${cellAlpha + 0.01})`
        ctx.fillRect(x + offset, y + topOffset, size, size)
        return
      }

      ctx.fillStyle =
        density > 0.3
          ? `rgba(245, 245, 250, ${cellAlpha})`
          : `rgba(235, 235, 240, ${cellAlpha})`
      ctx.font = font
      ctx.textBaseline = 'top'
      ctx.fillText(cell.token, x, y + 2)
    }

    const drawAll = () => {
      ctx.clearRect(0, 0, width, height)
      for (let i = 0; i < cells.length; i++) drawCell(i)
    }

    drawAll()

    const systemReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (systemReduced || reduceMotion) return // static digital field, no ticking

    let intervalId: number | null = null

    const tick = () => {
      if (document.hidden) return
      // Subtle mutation budget: 3–5 cells mutate per tick
      const count = 3 + Math.floor(Math.random() * 3)
      for (let m = 0; m < count; m++) {
        // Biased selection: 60% of mutations happen in the Flow icon reconstruction to keep
        // the subtle feeling of an organic digital recalculation of the mark.
        let index: number
        if (Math.random() < 0.6) {
          index = Math.floor(Math.random() * cells.length)
          for (let attempt = 0; attempt < 5; attempt++) {
            if (cells[index]?.density && cells[index].density > 0.2) break
            index = Math.floor(Math.random() * cells.length)
          }
        } else {
          index = Math.floor(Math.random() * cells.length)
        }

        const current = cells[index]
        if (!current) continue
        const next = mutateCell(current)
        if (next.kind !== current.kind || next.token !== current.token) {
          cells[index] = next
          drawCell(index)
        }
      }
    }

    const start = () => {
      if (intervalId === null) intervalId = window.setInterval(tick, TICK_MS)
    }
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, intensity, reduceMotion])

  if (!enabled) return null

  return (
    <div className="ambient-code" aria-hidden="true">
      <canvas ref={canvasRef} className="ambient-canvas" />
    </div>
  )
}
