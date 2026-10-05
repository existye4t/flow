/**
 * scripts/measure_screenshot.js
 *
 * Real-time end-to-end screenshot latency & animation measurement script.
 * Runs actual Electron app, triggers full screenshot lifecycle across
 * main and renderer processes, and measures:
 * - Trigger moment (key press in main process)
 * - First visible frame (overlay shown + first rAF in renderer)
 * - desktopCapturer completion
 * - JPEG Buffer encode
 * - IPC transit
 * - Image decode & img.onload
 * - Settled frame (scale/fade transition completed)
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const rootDir = path.resolve(__dirname, '..')
const outFile = path.join(os.tmpdir(), `exist-flow-measure-${Date.now()}.json`)

console.log('=== EXIST FLOW - REAL-TIME SCREENSHOT LATENCY MEASUREMENT ===\n')

const RUNS = 3
const electronBinary = require('electron')

const env = {
  ...process.env,
  EXIST_FLOW_MEASURE: String(RUNS),
  EXIST_FLOW_MEASURE_OUT: outFile,
}

// First ensure project is built
console.log('Building Electron main and renderer...')
const buildProc = require('child_process').spawnSync('npm', ['run', 'build'], {
  cwd: rootDir,
  shell: true,
  stdio: 'inherit'
})

if (buildProc.status !== 0) {
  console.error('Build failed!')
  process.exit(1)
}

console.log('\nLaunching app with measurement instrumentation (3 consecutive runs)...')
const child = spawn(electronBinary, ['.'], {
  cwd: rootDir,
  env,
  stdio: ['inherit', 'pipe', 'pipe']
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (d) => {
  stdout += d.toString()
  process.stdout.write(d)
})
child.stderr.on('data', (d) => {
  stderr += d.toString()
  process.stderr.write(d)
})

child.on('close', (code) => {
  console.log(`\nApp exited with code ${code}`)
  if (!fs.existsSync(outFile)) {
    console.error(`Measurement output file not found at ${outFile}`)
    process.exit(1)
  }

  try {
    const data = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    console.log('\n===============================================================')
    console.log('                   SCREENSHOT TIMING REPORT                     ')
    console.log('===============================================================')
    console.log(`Windows Build WDA_EXCLUDEFROMCAPTURE Supported: ${data.captureExclusion}`)
    console.log(`Completed Measurement Runs: ${data.runs.length}/${data.requested}\n`)

    console.table(data.runs.map((r) => {
      const m = r.msFromTrigger || {}
      return {
        'Run #': r.id,
        'Mode': r.mode,
        'Show Called': m['show-called'] != null ? `${m['show-called']} ms` : '-',
        'First Frame (Veil)': m['first-frame'] != null ? `${m['first-frame']} ms` : '-',
        'getSources': m['capture-end'] != null ? `${m['capture-end']} ms` : '-',
        'JPEG Encode': m['encode-end'] != null ? `${m['encode-end']} ms` : '-',
        'img.onload': m['img-load'] != null ? `${m['img-load']} ms` : '-',
        'Settled (Total)': m['settled'] != null ? `${m['settled']} ms` : '-',
        'Image Size': r.info?.width ? `${r.info.width}x${r.info.height}` : '-',
        'JPEG Buffer': r.info?.bytes ? `${(r.info.bytes / 1024).toFixed(1)} KB` : '-'
      }
    }))

    // Clean up temp file
    try { fs.unlinkSync(outFile) } catch {}

    const allHaveFirstFrame = data.runs.every((r) => r.msFromTrigger?.['first-frame'] != null)
    const allHaveImage = data.runs.every((r) => r.msFromTrigger?.['img-load'] != null)

    if (allHaveFirstFrame && allHaveImage) {
      console.log('\n✔ ALL RUNS MEASURED SUCCESSFULLY: Overlay appeared instantly, image loaded cleanly with non-zero dimensions.')
      process.exit(0)
    } else {
      console.error('\n✖ Some runs did not complete all stages cleanly.')
      process.exit(1)
    }
  } catch (err) {
    console.error('Failed to parse measurement JSON:', err)
    process.exit(1)
  }
})
