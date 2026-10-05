/**
 * scripts/probe_capture_timing.js
 *
 * Measures how long desktopCapturer.getSources actually costs on this machine,
 * isolated from any window logic: warm-up vs steady state, and across
 * thumbnail sizes. Used to decide whether the <250ms trigger->image budget is
 * reachable with a capture-first overlay.
 *
 * Run: npm run probe:timing
 */

const { app, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

const RUNS = Number(process.env.EXIST_FLOW_PROBE_RUNS || 5)
const outDir = path.join(__dirname, 'out')
const outFile = path.join(outDir, 'capture-timing.json')

const SIZES = [
  { label: '0x0', width: 0, height: 0 },
  { label: '1x1', width: 1, height: 1 },
  { label: '320x180', width: 320, height: 180 },
  { label: '640x360', width: 640, height: 360 },
  { label: 'full', width: 1920, height: 1080 },
]

function stats(values) {
  const v = [...values].sort((a, b) => a - b)
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return {
    n: v.length,
    min: +v[0].toFixed(1),
    p50: +q(0.5).toFixed(1),
    max: +v[v.length - 1].toFixed(1),
    avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1),
  }
}

app.whenReady().then(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  console.log('=== EXIST FLOW — getSources timing probe ===')
  console.log(`electron=${process.versions.electron} runs=${RUNS} per size`)

  const results = {}
  for (const size of SIZES) {
    const times = []
    const thumbSizes = []
    let emptyCount = 0
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now()
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false,
        thumbnailSize: { width: size.width, height: size.height },
      })
      const ms = performance.now() - t0
      times.push(ms)
      for (const s of sources) {
        const ts = s.thumbnail.getSize()
        thumbSizes.push(`${ts.width}x${ts.height}`)
        if (s.thumbnail.isEmpty() || !ts.width || !ts.height) emptyCount++
      }
      await wait(120)
    }
    results[size.label] = { ...stats(times), thumbSizes: [...new Set(thumbSizes)], emptyCount }
    console.log(
      `${size.label.padEnd(9)} min=${results[size.label].min}ms p50=${results[size.label].p50}ms ` +
        `max=${results[size.label].max}ms thumb=[${results[size.label].thumbSizes.join('|')}] empty=${emptyCount}`
    )
    await wait(200)
  }

  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), runs: RUNS, results }, null, 2))
    console.log(`report written: ${outFile}`)
  } catch (err) {
    console.error('failed to write report:', err)
  }

  setTimeout(() => app.exit(0), 200)
})

process.on('uncaughtException', (err) => {
  console.error('[timing] uncaughtException:', err)
})
