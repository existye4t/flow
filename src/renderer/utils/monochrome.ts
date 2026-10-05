export const MONO_VERSION = 2

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

export function getMonochromeCached(src: string): string | null {
  return cache.get(src) || null
}

export function clearMonochromeCache(): void {
  cache.clear()
}

// Theme-fitted monochrome band: deep gray (never pure black) .. soft white
// (never 255). Matches the OLED surface #08090A and primary #FAFAFA.
const BAND_DARK = 0.155 // ~40
const BAND_SOFT = 0.965 // ~246
const CHROMA_KEEP = 0.12 // subtle brand tint — keeps original logo identity
const MIN_ALPHA = 16

/**
 * Transforms a raster icon (colored logo, native app icon, favicon) into
 * Exist Flow's theme-fitted monochrome language while preserving its form:
 * - rec709 luminance with a mild S-curve, remapped into the deep-gray ..
 *   soft-white band so the icon reads as an original object on the dark
 *   surface (NOT flat pure white, NOT pure black).
 * - ~12% of the original per-channel chroma is re-injected so brand
 *   identity survives as a delicate tint (Chrome stays faintly warm,
 *   VS Code faintly blue), never as saturated color.
 * - alpha is preserved (transparent stays transparent).
 * Version: MONO_VERSION 2 — cached icons carry their version so legacy
 * (v1, washed-out) transforms are re-processed instead of reused.
 * Returns null when the image cannot be processed (broken/tainted),
 * in which case callers must fall back to a semantic glyph.
 */
export function toMonochrome(src: string): Promise<string | null> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)

  const inFlight = pending.get(src)
  if (inFlight) return inFlight

  const task = new Promise<string | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (!w || !h) {
          resolve(null)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, w, h)
        const px = imageData.data
        const span = BAND_SOFT - BAND_DARK
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3]
          if (a < MIN_ALPHA) {
            px[i + 3] = 0
            continue
          }
          const r = px[i]
          const g = px[i + 1]
          const b = px[i + 2]
          let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          // mild contrast so flat icons keep their internal structure
          lum = Math.min(1, Math.max(0, (lum - 0.5) * 1.14 + 0.5))
          const base = BAND_DARK + lum * span
          // keep a trace of the original chroma for logo identity
          const mean = (r + g + b) / 3 / 255
          let nr = base + CHROMA_KEEP * (r / 255 - mean)
          let ng = base + CHROMA_KEEP * (g / 255 - mean)
          let nb = base + CHROMA_KEEP * (b / 255 - mean)
          // never pure black / pure white
          nr = Math.min(0.98, Math.max(0.12, nr))
          ng = Math.min(0.98, Math.max(0.12, ng))
          nb = Math.min(0.98, Math.max(0.12, nb))
          px[i] = Math.round(nr * 255)
          px[i + 1] = Math.round(ng * 255)
          px[i + 2] = Math.round(nb * 255)
        }
        ctx.putImageData(imageData, 0, 0)
        const out = canvas.toDataURL('image/png')
        cache.set(src, out)
        resolve(out)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })

  pending.set(src, task)
  task.then(() => pending.delete(src))
  return task
}
