/**
 * scripts/probe_capture_sources.js
 *
 * Empirically maps desktopCapturer screen sources to Electron displays.
 *
 * A distinctly coloured window is opened on every display, one getSources call
 * is made, and each source thumbnail is classified by its dominant channel.
 * That gives the real (display id -> source id) mapping on this machine, plus
 * whether `display_id` is populated, whether thumbnails come back empty/black,
 * and how long the call takes.
 *
 * Run: npm run probe:capture
 */

const { app, BrowserWindow, screen, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

const RUNS = Number(process.env.EXIST_FLOW_PROBE_RUNS || 3)
const outDir = path.join(__dirname, 'out')
const outFile = path.join(outDir, 'capture-sources.json')

const COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF']

const report = {
  startedAt: new Date().toISOString(),
  electron: process.versions.electron,
  platform: process.platform,
  runs: [],
  displays: [],
  conclusion: null,
}

function avgRgb(bitmap, sampleStep = 16) {
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let n = 0
  for (let i = 0; i + 3 < bitmap.length; i += 4 * sampleStep) {
    s0 += bitmap[i]
    s1 += bitmap[i + 1]
    s2 += bitmap[i + 2]
    n++
  }
  return n ? [Math.round(s0 / n), Math.round(s1 / n), Math.round(s2 / n)] : [0, 0, 0]
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function classify(triple, expected) {
  // expected: [{displayId, color}] with hex colours
  let best = null
  for (const [order, mode] of [['rgba', 'rgba'], ['bgra', 'bgra']]) {
    for (const e of expected) {
      const c = e.rgb
      const ref = mode === 'rgba' ? c : [c[2], c[1], c[0]]
      const d = dist(triple, ref)
      if (!best || d < best.d) best = { d, displayId: e.displayId, mode, order, color: e.hex }
    }
  }
  return best
}

function hexToRgb(hex) {
  const v = hex.slice(1)
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

app.whenReady().then(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const displays = screen.getAllDisplays()
  const cursor = screen.getCursorScreenPoint()
  const nearest = screen.getDisplayNearestPoint(cursor)

  console.log('=== EXIST FLOW — desktopCapturer source probe ===')
  console.log(`electron=${process.versions.electron} runs=${RUNS}`)
  console.log(`cursor=(${cursor.x}, ${cursor.y}) nearestDisplay=${nearest.id} bounds=${JSON.stringify(nearest.bounds)}`)

  displays.forEach((d, i) => {
    console.log(
      `display[${i}] id=${d.id} bounds=${JSON.stringify(d.bounds)} size=${d.size.width}x${d.size.height} ` +
        `scale=${d.scaleFactor} rotation=${d.rotation} internal=${d.internal} label="${d.label || ''}"`
    )
    report.displays.push({
      index: i,
      id: d.id,
      bounds: d.bounds,
      size: d.size,
      scaleFactor: d.scaleFactor,
      rotation: d.rotation,
      internal: d.internal,
      label: d.label || '',
      isPrimary: d.id === screen.getPrimaryDisplay().id,
      isCursorNearest: d.id === nearest.id,
    })
  })

  // Distinct colour per display so each thumbnail can be identified.
  const wins = displays.map((d, i) => {
    const color = COLORS[i % COLORS.length]
    const w = Math.min(400, Math.max(200, Math.round(d.size.width / 4)))
    const h = Math.min(300, Math.max(150, Math.round(d.size.height / 4)))
    const win = new BrowserWindow({
      x: Math.round(d.bounds.x + d.bounds.width / 2 - w / 2),
      y: Math.round(d.bounds.y + d.bounds.height / 2 - h / 2),
      width: w,
      height: h,
      frame: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: true,
      backgroundColor: color,
      webPreferences: { sandbox: true },
    })
    win.loadURL(
      `data:text/html;charset=utf-8,` +
        encodeURIComponent(
          `<body style="margin:0;background:${color};width:100vw;height:100vh"></body>`
        )
    )
    return { win, color, displayId: d.id, rgb: hexToRgb(color) }
  })

  await wait(900)

  const expected = wins.map((w) => ({ displayId: w.displayId, rgb: w.rgb, hex: w.color }))

  for (let run = 1; run <= RUNS; run++) {
    const rec = { run, sources: [], errors: [] }
    console.log(`\n--- run ${run} ---`)
    for (const size of [{ w: 320, h: 180 }, { w: 0, h: 0 }]) {
      const t0 = performance.now()
      let sources
      try {
        sources = await desktopCapturer.getSources({
          types: ['screen'],
          fetchWindowIcons: false,
          thumbnailSize: { width: size.w, height: size.h },
        })
      } catch (err) {
        rec.errors.push(String(err && err.stack ? err.stack : err))
        console.log(`getSources(${size.w}x${size.h}) THREW: ${err}`)
        continue
      }
      const ms = +(performance.now() - t0).toFixed(1)
      console.log(`getSources(thumbnailSize=${size.w}x${size.h}) -> ${sources.length} sources in ${ms}ms`)
      for (const s of sources) {
        const sz = s.thumbnail.getSize()
        const empty = s.thumbnail.isEmpty()
        const rgba = empty || !sz.width || !sz.height ? null : avgRgb(s.thumbnail.toBitmap())
        const hit = rgba ? classify(rgba, expected) : null
        const entry = {
          thumbnailRequested: `${size.w}x${size.h}`,
          id: s.id,
          name: s.name,
          display_id: s.display_id,
          thumbSize: `${sz.width}x${sz.height}`,
          empty,
          avgTriple: rgba,
          matchedDisplayId: hit ? hit.displayId : null,
          matchDistance: hit ? +hit.d.toFixed(1) : null,
          matchMode: hit ? hit.mode : null,
          elapsedMs: ms,
        }
        rec.sources.push(entry)
        console.log(
          `  id="${s.id}" name="${s.name}" display_id="${s.display_id}" thumb=${entry.thumbSize}` +
            ` empty=${empty} avg=${rgba ? rgba.join(',') : '-'} -> display ${entry.matchedDisplayId}` +
            ` (d=${entry.matchDistance}, ${entry.matchMode})`
        )
      }
    }
    report.runs.push(rec)
    await wait(250)
  }

  // Verdict
  const full = report.runs.flatMap((r) => r.sources).filter((s) => s.thumbnailRequested !== '0x0')
  const withDisplayId = full.filter((s) => s.display_id && String(s.display_id).length)
  const emptyOnes = full.filter((s) => s.empty || s.thumbSize === '0x0')
  const correct = full.filter((s) => s.matchedDisplayId != null)
  const sameOrder = full.every((s, i) => {
    const dIdx = report.displays.findIndex((d) => d.id === s.matchedDisplayId)
    return dIdx === -1 || String(s.id) === `screen:${dIdx}:0`
  })

  report.conclusion = {
    sourceCount: full.length / Math.max(1, RUNS),
    displayCount: displays.length,
    displayIdPopulated: withDisplayId.length > 0,
    displayIdSample: withDisplayId.slice(0, 3).map((s) => s.display_id),
    emptyThumbnails: emptyOnes.map((s) => ({ id: s.id, thumbSize: s.thumbSize })),
    allMatched: correct.length === full.length,
    sourceIdMatchesDisplayIndex: sameOrder,
    maxElapsedMs: Math.max(...full.map((s) => s.elapsedMs), 0),
  }

  console.log('\n=== CONCLUSION ===')
  console.log(JSON.stringify(report.conclusion, null, 2))

  for (const w of wins) {
    try {
      w.win.destroy()
    } catch {}
  }

  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
    console.log(`report written: ${outFile}`)
  } catch (err) {
    console.error('failed to write report:', err)
  }

  setTimeout(() => app.exit(0), 300)
})

process.on('uncaughtException', (err) => {
  console.error('[probe] uncaughtException:', err)
})
