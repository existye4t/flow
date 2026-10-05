/**
 * scripts/verify_screenshot_display.js
 *
 * End-to-end verification of the Print Screen flow against the REAL app
 * (dist-electron/electron/main.js), on a real multi-monitor desktop.
 *
 * Per target display it checks:
 *   1. cursor -> display targeting (screen.getCursorScreenPoint / getDisplayNearestPoint)
 *   2. capture window bounds sit on the target display when it is shown
 *   3. the decoded overlay image has the target display's physical pixel size
 *   4. the image content belongs to the target display (distinct marker colour
 *      windows are placed on every display before each run)
 *   5. the image is not black / not empty
 *   6. the overlay veil really covers the target display and NOT the other one
 *      (brightness before vs after the overlay is shown)
 *   7. every performance.now() stage mark exists, with an ms table
 * Run: npm run verify:screenshot
 */

const path = require('path')
const fs = require('fs')

if (typeof process.versions.electron === 'undefined') {
  // Invoked directly via `node scripts/verify_screenshot_display.js` -> re-spawn under electron
  const { spawn } = require('child_process')
  const electronBinary = require('electron')
  const child = spawn(electronBinary, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  runVerify()
}

function runVerify() {

const { app, BrowserWindow, screen, desktopCapturer } = require('electron')
const { execSync } = require('child_process')

/* ---- capture every [Screenshot #n] mark printed by the main process ---- */
const logLines = []
function tee(original) {
  return function (...args) {
    try {
      logLines.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '))
    } catch {}
    original.apply(console, args)
  }
}
console.log = tee(console.log)
console.warn = tee(console.warn)
console.error = tee(console.error)

const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(__dirname, 'out')
const outFile = path.join(outDir, 'screenshot-verify.json')

delete process.env.EXIST_FLOW_MEASURE
delete process.env.EXIST_FLOW_MEASURE_OUT

require(path.join(rootDir, 'dist-electron/electron/main.js'))

/* ------------------------------- helpers -------------------------------- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const epochNow = () => performance.timeOrigin + performance.now()

const failures = []
const warnings = []
function check(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`)
  } else {
    console.error(`[FAIL] ${message}`)
    failures.push(message)
  }
  return condition
}

async function evalIn(wc, code) {
  try {
    const result = await wc.executeJavaScript(code, true)
    if (result && typeof result.then === 'function') return await result
    return result
  } catch (err) {
    return { __error: String(err && err.message ? err.message : err) }
  }
}

function setCursorTo(x, y) {
  const ps =
    `Add-Type -AssemblyName System.Windows.Forms; ` +
    `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)},${Math.round(y)})`
  execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { stdio: 'ignore' })
}

function avgOfBitmap(bitmap, step = 16) {
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let n = 0
  for (let i = 0; i + 3 < bitmap.length; i += 4 * step) {
    s0 += bitmap[i]
    s1 += bitmap[i + 1]
    s2 += bitmap[i + 2]
    n++
  }
  if (!n) return { r: 0, g: 0, b: 0, luma: 0 }
  // Skia N32 pixel buffer is BGRA on Windows
  const b = Math.round(s0 / n)
  const g = Math.round(s1 / n)
  const r = Math.round(s2 / n)
  return { r, g, b, luma: Math.round(0.299 * r + 0.587 * g + 0.114 * b) }
}

function matchSource(source, displays) {
  if (source.display_id) {
    const byId = displays.find((d) => String(d.id) === String(source.display_id))
    if (byId) return byId
  }
  const m = /^screen:(\d+):/.exec(source.id)
  if (m) return displays[Number(m[1])] || null
  return null
}

async function brightnessSnapshot() {
  const displays = screen.getAllDisplays()
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    fetchWindowIcons: false,
    thumbnailSize: { width: 480, height: 270 },
  })
  const out = {}
  for (const s of sources) {
    const d = matchSource(s, displays)
    const size = s.thumbnail.getSize()
    const key = d ? String(d.id) : s.id
    out[key] = {
      sourceId: s.id,
      thumb: `${size.width}x${size.height}`,
      empty: s.thumbnail.isEmpty() || !size.width || !size.height,
      ...(s.thumbnail.isEmpty() || !size.width || !size.height ? { r: 0, g: 0, b: 0, luma: 0 } : avgOfBitmap(s.thumbnail.toBitmap())),
    }
  }
  return out
}

function isCaptureWindow(w) {
  try {
    return w.webContents.getURL().includes('mode=capture')
  } catch {
    return false
  }
}

function isLauncherWindow(w) {
  try {
    if (!w || w.isDestroyed()) return false
    const url = w.webContents.getURL()
    return (
      (url.includes('dist-renderer') || url.includes('localhost') || url.includes('127.0.0.1')) &&
      !url.includes('mode=capture')
    )
  } catch {
    return false
  }
}

function launcherWindow() {
  return BrowserWindow.getAllWindows().find((w) => isLauncherWindow(w)) || null
}

function captureWindow() {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && isCaptureWindow(w)) || null
}

const OVERLAY_STATS_JS = `(() => {
  const overlay = document.querySelector('.screenshot-overlay');
  const img = overlay ? overlay.querySelector('img') : null;
  const text = overlay ? (overlay.innerText || '').trim() : '';
  if (!img) return { hasOverlay: !!overlay, hasImg: false, text: text.slice(0, 240) };
  if (!img.complete || !img.naturalWidth) return { hasOverlay: true, hasImg: true, pending: true };
  const c = document.createElement('canvas');
  c.width = 80; c.height = 45;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 80, 45);
  const d = ctx.getImageData(0, 0, 80, 45).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return { hasOverlay: true, hasImg: true, w: img.naturalWidth, h: img.naturalHeight,
           r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
})()`

async function waitForOverlayImage(wc, timeoutMs) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await evalIn(wc, OVERLAY_STATS_JS)
    if (last && last.__error) return { failed: last.__error }
    if (last && last.hasImg && last.w > 0) return last
    if (last && typeof last.text === 'string' && /(alınamadı|boş geldi|çözülemedi)/.test(last.text)) {
      return { failed: last.text }
    }
    await wait(50)
  }
  return { failed: 'timeout waiting for overlay image', last }
}

async function dismissOverlay() {
  const cw = captureWindow()
  if (cw && cw.isVisible()) {
    await evalIn(cw.webContents, 'window.electron && window.electron.screenshot && window.electron.screenshot.cancel()')
    await wait(500)
  }
}

function parseMarks(lines) {
  const byRun = new Map()
  for (const line of lines) {
    const m = /^\[Screenshot #(\d+)\] (\S+)\s+\+([\d.]+)ms(?:\s+(.*))?$/.exec(line)
    if (!m) continue
    const runId = Number(m[1])
    if (!byRun.has(runId)) byRun.set(runId, {})
    byRun.get(runId)[m[2]] = { ms: Number(m[3]), info: m[4] || '' }
  }
  return byRun
}

/* ------------------------------ marker windows --------------------------- */

const MARKER_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']
const MARKER_CHANNELS = ['r', 'g', 'b', 'r']

function createMarkers(displays) {
  return displays.map((d, i) => {
    const color = MARKER_COLORS[i % MARKER_COLORS.length]
    const w = Math.round(d.bounds.width * 0.6)
    const h = Math.round(d.bounds.height * 0.6)
    const win = new BrowserWindow({
      x: Math.round(d.bounds.x + (d.bounds.width - w) / 2),
      y: Math.round(d.bounds.y + (d.bounds.height - h) / 2),
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
        encodeURIComponent(`<body style="margin:0;background:${color};width:100vw;height:100vh"></body>`)
    )
    return win
  })
}

/* --------------------------------- main ---------------------------------- */

app.whenReady().then(async () => {
  console.log('=== EXIST FLOW — screenshot display verification ===')
  console.log(`appPath=${app.getAppPath()} userData=${app.getPath('userData')}`)
  console.log(`electron=${process.versions.electron} cwd=${process.cwd()}`)

  await wait(1800)

  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  console.log(`displays=${displays.length}`)
  displays.forEach((d, i) =>
    console.log(
      `  display[${i}] id=${d.id} bounds=${JSON.stringify(d.bounds)} size=${d.size.width}x${d.size.height} scale=${d.scaleFactor}`
    )
  )
  if (displays.length < 2) {
    console.warn('[WARN] Only one display detected — the second-monitor scenario cannot be exercised.')
    warnings.push('single display: multi-monitor path not exercised')
  }

  const markers = createMarkers(displays)
  await wait(900)

  const report = {
    at: new Date().toISOString(),
    electron: process.versions.electron,
    appPath: app.getAppPath(),
    displays: displays.map((d, i) => ({
      index: i,
      id: d.id,
      bounds: d.bounds,
      size: d.size,
      scaleFactor: d.scaleFactor,
    })),
    runs: [],
    failures,
    warnings,
  }

  const targets = displays.length > 1 ? [1, 0] : [0] // second monitor first: that is the reported bug

  for (const targetIndex of targets) {
    const target = displays[targetIndex]
    const label = `run#display${targetIndex}`
    console.log(`\n---------------- ${label}: display ${target.id} ----------------`)

    await dismissOverlay()
    await wait(250)

    // 1. cursor -> display
    const cx = target.bounds.x + target.bounds.width / 2
    const cy = target.bounds.y + target.bounds.height / 2
    let cursorMoved = false
    try {
      setCursorTo(cx, cy)
      cursorMoved = true
    } catch (err) {
      console.warn(`[WARN] could not move cursor: ${err}`)
      warnings.push(`${label}: cursor move failed`)
    }
    await wait(200)
    const cursor = screen.getCursorScreenPoint()
    const cursorValid = Number.isFinite(cursor.x) && cursor.x > -10000 && cursor.x < 100000
    const nearest = cursorValid ? screen.getDisplayNearestPoint(cursor) : target
    const cursorOnTarget = nearest.id === target.id
    if (cursorMoved && cursorValid) {
      check(cursorOnTarget, `${label}: cursor (${cursor.x},${cursor.y}) resolves to display ${target.id}`)
    } else {
      console.warn(`[WARN] ${label}: cursor (${cursor.x},${cursor.y}) uninitialized or couldn't be positioned by script in this environment`)
      warnings.push(`${label}: cursor (${cursor.x},${cursor.y}) could not be moved`)
    }

    // 2. baseline brightness of every display (overlay still hidden)
    const base = await brightnessSnapshot()

    // 3. trigger through the real IPC handler
    const launcher = launcherWindow()
    if (!launcher) {
      failures.push(`${label}: launcher window not found`)
      console.error(`[FAIL] ${label}: launcher window not found`)
      continue
    }
    const logStart = logLines.length
    const t0 = epochNow()
    const invokeResult = await evalIn(
      launcher.webContents,
      `window.electron && window.electron.screenshot ? window.electron.screenshot.start({ displayId: ${target.id}, point: { x: ${Math.round(cx)}, y: ${Math.round(cy)} } }) : null`
    )
    const tInvoke = epochNow()
    if (invokeResult && invokeResult.__error) {
      console.error(`[FAIL] ${label}: screenshot.start() threw: ${invokeResult.__error}`)
      failures.push(`${label}: screenshot.start() threw`)
      continue
    }

    // 4. wait for the image inside the overlay
    const cw = captureWindow()
    const stats = cw ? await waitForOverlayImage(cw.webContents, 8000) : { failed: 'capture window missing' }
    const tImage = epochNow()
    await wait(320) // let the 150ms image animation finish

    // 5. where is the overlay now?
    const bounds = cw && !cw.isDestroyed() ? cw.getBounds() : null
    const hostDisplay = bounds
      ? screen.getDisplayNearestPoint({ x: bounds.x + Math.round(bounds.width / 2), y: bounds.y + Math.round(bounds.height / 2) })
      : null

    // 6. brightness of every display while the overlay is up
    const post = await brightnessSnapshot()

    // 7. main-process marks
    const marksByRun = parseMarks(logLines.slice(logStart))
    const runIds = [...marksByRun.keys()]
    const runId = runIds.length ? runIds[runIds.length - 1] : null
    const marks = runId != null ? marksByRun.get(runId) : {}

    const expectedW = Math.round(target.size.width * target.scaleFactor)
    const expectedH = Math.round(target.size.height * target.scaleFactor)
    const markerChannel = MARKER_CHANNELS[targetIndex % MARKER_CHANNELS.length]

    const run = {
      label,
      targetDisplayId: target.id,
      cursor,
      nearestDisplayId: nearest.id,
      invokeMs: +(tInvoke - t0).toFixed(1),
      imageMs: +(tImage - t0).toFixed(1),
      captureWinBounds: bounds,
      hostDisplayId: hostDisplay ? hostDisplay.id : null,
      image: stats,
      expectedSize: `${expectedW}x${expectedH}`,
      markerChannel,
      brightness: {},
      marks: {},
      runId,
    }

    if (stats.failed) {
      console.error(`[FAIL] ${label}: overlay image unavailable -> ${stats.failed}`)
      failures.push(`${label}: overlay image unavailable (${stats.failed})`)
    }

    // image size
    if (!stats.failed) {
      check(
        stats.w === expectedW && stats.h === expectedH,
        `${label}: image is ${stats.w}x${stats.h}, expected ${expectedW}x${expectedH} (target display physical size)`
      )
      // not black
      const luma = 0.299 * stats.r + 0.587 * stats.g + 0.114 * stats.b
      check(luma > 12, `${label}: image is not black (luma=${luma.toFixed(1)}, rgb=${stats.r},${stats.g},${stats.b})`)
      // belongs to the target display
      const dominant = stats[markerChannel]
      const others = Object.keys(stats).filter((k) => ['r', 'g', 'b'].includes(k) && k !== markerChannel)
      const maxOther = Math.max(...others.map((k) => stats[k]))
      check(
        dominant > maxOther + 10,
        `${label}: captured content carries the display-${targetIndex} marker ` +
          `(${markerChannel}=${dominant} vs max other=${maxOther})`
      )
    }

    // overlay placement
    if (bounds) {
      check(hostDisplay && hostDisplay.id === target.id, `${label}: overlay bounds ${JSON.stringify(bounds)} sit on display ${target.id} (host=${hostDisplay && hostDisplay.id})`)
    } else {
      failures.push(`${label}: overlay window has no bounds`)
      console.error(`[FAIL] ${label}: overlay window has no bounds`)
    }

    // veil covers the target, leaves the others alone
    for (const d of displays) {
      const key = String(d.id)
      const b0 = base[key]
      const b1 = post[key]
      if (!b0 || !b1) continue
      const ratio = b0.luma > 0 ? +(b1.luma / b0.luma).toFixed(3) : null
      run.brightness[key] = { before: b0.luma, after: b1.luma, ratio }
      if (b0.empty || b1.empty) {
        console.warn(`[WARN] ${label}: display ${d.id} brightness snapshot returned empty thumbnail`)
        warnings.push(`${label}: display ${d.id} brightness snapshot returned empty thumbnail`)
      } else if (d.id === target.id) {
        check(ratio != null && ratio < 0.85, `${label}: target display ${d.id} dimmed by overlay veil (luma ${b0.luma} -> ${b1.luma}, ratio ${ratio})`)
      } else {
        check(ratio != null && ratio > 0.9, `${label}: display ${d.id} untouched by overlay (luma ${b0.luma} -> ${b1.luma}, ratio ${ratio})`)
      }
    }

    // stage marks
    for (const stage of [
      'trigger',
      'bounds-set',
      'begin-ipc',
      'capture-start',
      'sources-listed',
      'source-selected',
      'capture-end',
      'encode-end',
      'show-called',
      'ipc-sent',
      'first-frame',
      'img-load',
      'settled',
    ]) {
      const m = marks[stage]
      run.marks[stage] = m ? m.ms : null
      if (m) console.log(`[ms] ${stage.padEnd(16)} +${m.ms}ms ${m.info}`)
    }

    const expectedStages = stats.failed
      ? ['trigger', 'source-selected', 'capture-end']
      : ['trigger', 'source-selected', 'capture-end', 'show-called', 'img-load', 'settled']
    for (const stage of expectedStages) {
      check(marks[stage] != null, `${label}: stage "${stage}" was logged`)
    }

    // source selection reported by main
    const sel = marks['source-selected']
    if (sel) {
      const info = sel.info || ''
      console.log(`[source] ${info}`)
      const parsedInfo = (() => {
        try {
          return JSON.parse(info)
        } catch {
          return null
        }
      })()

      const matchesTarget =
        (parsedInfo && String(parsedInfo.targetDisplayId) === String(target.id)) ||
        info.includes(`targetDisplayId:${target.id}`) ||
        info.includes(`"targetDisplayId":${target.id}`) ||
        info.includes(`"targetDisplayId":"${target.id}"`)
      check(matchesTarget, `${label}: main process targeted display ${target.id}`)

      const method = parsedInfo ? parsedInfo.matchMethod : (info.match(/matchMethod["']?\s*:\s*["']?(\S+?)["']?[,}\s]/) || [])[1]
      check(Boolean(method), `${label}: match method logged (${method || 'none'})`)

      // source must be the one belonging to the target display
      const srcId = parsedInfo ? parsedInfo.sourceId : (info.match(/sourceId["']?\s*:\s*["']?([^"',}\s]+)/) || [])[1]
      if (srcId) {
        const expectedId = `screen:${targetIndex}:0`
        const matchesExpected = srcId === expectedId || (parsedInfo && String(parsedInfo.sourceDisplayId) === String(target.id))
        check(matchesExpected, `${label}: selected source "${srcId}" (expected "${expectedId}" or display ${target.id})`)
      }
    }

    // latency
    const settled = marks['settled'] ? marks['settled'].ms : null
    const imgLoad = marks['img-load'] ? marks['img-load'].ms : null
    const showCalled = marks['show-called'] ? marks['show-called'].ms : null
    const captureEnd = marks['capture-end'] ? marks['capture-end'].ms : null
    run.latency = { captureEnd, showCalled, imgLoad, settled, target: 250 }
    if (settled != null) {
      const total = Math.max(settled, +(tImage - t0).toFixed(1))
      console.log(
        `[latency] ${label}: captureEnd=${captureEnd}ms showCalled=${showCalled}ms imgLoad=${imgLoad}ms settled=${settled}ms (target <250ms)`
      )
      check(settled < 250, `${label}: trigger -> settled ${settled}ms is under 250ms`)
      run.latency.total = total
    }

    report.runs.push(run)
    await wait(300)
  }

  for (const m of markers) {
    try {
      if (!m.isDestroyed()) m.destroy()
    } catch {}
  }

  report.failures = failures
  report.warnings = warnings
  try {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
    console.log(`\nreport written: ${outFile}`)
  } catch (err) {
    console.error('failed to write report:', err)
  }

  console.log('\n=== SUMMARY ===')
  if (warnings.length) console.log(`warnings: ${JSON.stringify(warnings, null, 2)}`)
  if (failures.length === 0) {
    console.log('ALL SCREENSHOT DISPLAY CHECKS PASSED')
  } else {
    console.error(`${failures.length} CHECK(S) FAILED:`)
    failures.forEach((f) => console.error(`  - ${f}`))
  }

  setTimeout(() => app.exit(failures.length === 0 ? 0 : 1), 400)
})

process.on('uncaughtException', (err) => {
  console.error('[verify] uncaughtException:', err)
})
}
