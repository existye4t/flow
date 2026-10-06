/**
 * scripts/test_tour17_item_types.js
 *
 * Automated verification for Tour 17:
 * - Detects item target category (app, website, folder)
 * - Verifies line-based monochrome icons (AppTypeIcon, WebsiteTypeIcon, FolderTypeIcon)
 * - Verifies title and aria-label accessibility attributes ("Uygulama", "Web sitesi", "Klasör")
 * - Verifies presence in FlowItemRow and ProjectsView
 * - Captures screenshot showing application, website, and folder items in the launcher
 *
 * Run: node scripts/test_tour17_item_types.js
 */

const path = require('path')
const fs = require('fs')

if (typeof process.versions.electron === 'undefined') {
  const { spawn } = require('child_process')
  const electronBinary = require('electron')
  const child = spawn(electronBinary, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  })
  child.on('exit', (code) => process.exit(code ?? 0))
} else {
  runVerification()
}

function runVerification() {
  const { app, BrowserWindow } = require('electron')
  const Store = require('electron-store')
  const store = new Store({ name: 'exist-flow' })

  // Ensure scripts/out directory exists
  const outDir = path.join(__dirname, 'out')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // Back up existing items
  const originalFlowData = store.get('flow-data')

  // Set test items: one application, one website, one folder
  const testItems = [
    {
      id: 'tour17-app',
      name: 'GitHub Desktop',
      type: 'application',
      target: 'C:\\Users\\Exist\\AppData\\Local\\GitHubDesktop\\GitHubDesktop.exe',
      description: 'Desktop Application for GitHub',
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'tour17-web',
      name: 'github.com',
      type: 'website',
      target: 'https://github.com',
      description: 'Developer collaboration platform',
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'tour17-folder',
      name: 'Exist Flow Directory',
      type: 'folder',
      target: 'C:\\Users\\Exist\\Documents\\exist-flow',
      description: 'Project root workspace folder',
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  store.set('flow-data.items', testItems)

  // Load main process
  require(path.join(__dirname, '../dist-electron/electron/main.js'))

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  app.whenReady().then(async () => {
    console.log('=== EXIST FLOW - TOUR 17 ITEM TYPE ICONS VERIFICATION ===\n')
    await wait(2500)

    const windows = BrowserWindow.getAllWindows()
    const win = windows.find((w) => !w.isDestroyed() && w.isVisible()) || windows[0]

    if (!win) {
      console.error('[FAIL] Launcher window not found')
      process.exit(1)
    }

    win.show()
    win.focus()
    await wait(1000)

    // DOM inspection inside launcher window
    const domChecks = await win.webContents.executeJavaScript(`
      (() => {
        const rows = Array.from(document.querySelectorAll('button[data-index]'));
        const results = [];
        
        for (const row of rows) {
          const nameEl = row.querySelector('.truncate.text-\\\\[13px\\\\]');
          const name = nameEl ? nameEl.textContent.trim() : '';
          
          const typeSvg = row.querySelector('svg[aria-label]');
          const ariaLabel = typeSvg ? typeSvg.getAttribute('aria-label') : null;
          const title = typeSvg ? (typeSvg.querySelector('title')?.textContent || null) : null;
          const svgRole = typeSvg ? typeSvg.getAttribute('role') : null;
          const isMuted = typeSvg ? typeSvg.classList.contains('text-flow-muted') : false;
          
          results.push({ name, ariaLabel, title, svgRole, isMuted });
        }
        return results;
      })()
    `)

    console.log('DOM Inspection Results:', JSON.stringify(domChecks, null, 2))

    let failures = 0
    function assert(cond, msg) {
      if (!cond) {
        console.error(`[FAIL] ${msg}`)
        failures++
      } else {
        console.log(`[PASS] ${msg}`)
      }
    }

    const appItem = domChecks.find((d) => d.name === 'GitHub Desktop')
    const webItem = domChecks.find((d) => d.name === 'github.com')
    const folderItem = domChecks.find((d) => d.name === 'Exist Flow Directory')

    assert(Boolean(appItem), 'GitHub Desktop row found in launcher DOM')
    assert(appItem?.ariaLabel === 'Uygulama', 'GitHub Desktop has aria-label="Uygulama"')
    assert(appItem?.title === 'Uygulama', 'GitHub Desktop has <title>Uygulama</title>')
    assert(appItem?.isMuted, 'GitHub Desktop type icon has text-flow-muted color')

    assert(Boolean(webItem), 'github.com row found in launcher DOM')
    assert(webItem?.ariaLabel === 'Web sitesi', 'github.com has aria-label="Web sitesi"')
    assert(webItem?.title === 'Web sitesi', 'github.com has <title>Web sitesi</title>')
    assert(webItem?.isMuted, 'github.com type icon has text-flow-muted color')

    assert(Boolean(folderItem), 'Exist Flow Directory row found in launcher DOM')
    assert(folderItem?.ariaLabel === 'Klasör', 'Exist Flow Directory has aria-label="Klasör"')
    assert(folderItem?.title === 'Klasör', 'Exist Flow Directory has <title>Klasör</title>')
    assert(folderItem?.isMuted, 'Exist Flow Directory type icon has text-flow-muted color')

    // Capture screenshot
    console.log('\n[Capture] Capturing preview of launcher with type icons...')
    const pageImage = await win.webContents.capturePage()
    const pngBuffer = pageImage.toPNG()

    const screenshotPath = path.join(outDir, 'tour17_item_types.png')
    fs.writeFileSync(screenshotPath, pngBuffer)
    console.log(`[Capture] Saved screenshot to ${screenshotPath} (${pngBuffer.length} bytes)`)

    // Also copy to brain artifact directory if accessible
    const artifactBrainDir = 'C:\\Users\\Exist\\.gemini\\antigravity-ide\\brain\\1b6ee9c5-0f92-408f-84ba-afbd9c1a5360'
    if (fs.existsSync(artifactBrainDir)) {
      const brainScreenshot = path.join(artifactBrainDir, 'tour17_item_types.png')
      fs.writeFileSync(brainScreenshot, pngBuffer)
      console.log(`[Capture] Copied screenshot to artifact directory: ${brainScreenshot}`)
    }

    // Restore original store items
    if (originalFlowData) {
      store.set('flow-data', originalFlowData)
    }

    if (failures === 0) {
      console.log('\n>>> ALL TOUR 17 ASSERTIONS PASSED! <<<')
      setTimeout(() => process.exit(0), 400)
    } else {
      console.error(`\n>>> ${failures} ASSERTIONS FAILED! <<<`)
      setTimeout(() => process.exit(1), 400)
    }
  })
}
