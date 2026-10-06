/**
 * scripts/test_screenshot_toggle.js
 *
 * Automated verification for Tour 16 requirements:
 * 1. AppSettings & DEFAULT_SETTINGS contain screenshotEnabled: boolean (default true).
 * 2. SettingsPanel.tsx includes "Enable screenshot" Toggle row above "Capture mouse cursor".
 * 3. SettingsPanel.tsx displays "Disabled" hint for shortcut when screenshotEnabled is false.
 * 4. electron/main.ts registers PrintScreen only when screenshotEnabled is true.
 * 5. Dynamic unregister when toggled to false, dynamic register when toggled to true.
 * 6. startScreenshot returns early if screenshotEnabled is false (no overlay, no capture).
 * 7. Persistence verified through electron-store.
 *
 * Run: npm run test:screenshot-toggle
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
  const { app, BrowserWindow, globalShortcut } = require('electron')
  const Store = require('electron-store')
  const store = new Store({ name: 'exist-flow' })

  // Suppress measurement auto-run in main.js
  delete process.env.EXIST_FLOW_MEASURE
  delete process.env.EXIST_FLOW_MEASURE_OUT

  const rootDir = path.resolve(__dirname, '..')
  require(path.join(rootDir, 'dist-electron/electron/main.js'))

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const results = []

  function report(scenario, expected, actual, pass) {
    results.push({ scenario, expected, actual, pass })
    const status = pass ? '[PASS]' : '[FAIL]'
    console.log(`${status} ${scenario}: expected "${expected}", got "${actual}"`)
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

  app.whenReady().then(async () => {
    console.log('=== EXIST FLOW - TOUR 16 SCREENSHOT TOGGLE VERIFICATION ===\n')
    await wait(2000)

    const launcher = launcherWindow()
    if (!launcher) {
      console.error('[FATAL] Launcher window not ready')
      process.exit(1)
    }

    // 1. Static Contract Checks
    console.log('\n--- 1. Static Contracts & Source Inspection ---')
    const typesPath = path.join(rootDir, 'src/shared/types.ts')
    const typesContent = fs.readFileSync(typesPath, 'utf8')
    const hasType = typesContent.includes('screenshotEnabled: boolean')
    const hasDefault = typesContent.includes('screenshotEnabled: true')
    report('Types - screenshotEnabled in AppSettings', 'true', String(hasType), hasType)
    report('Types - screenshotEnabled: true in DEFAULT_SETTINGS', 'true', String(hasDefault), hasDefault)

    const settingsPanelPath = path.join(rootDir, 'src/renderer/components/SettingsPanel.tsx')
    const panelContent = fs.readFileSync(settingsPanelPath, 'utf8')
    const hasToggle = panelContent.includes('label="Enable screenshot"')
    const hasDisabledHint = panelContent.includes("!settings.screenshotEnabled\n                ? 'Disabled'") ||
                            panelContent.includes("!settings.screenshotEnabled ? 'Disabled'")
    const toggleIndex = panelContent.indexOf('label="Enable screenshot"')
    const cursorIndex = panelContent.indexOf('label="Capture mouse cursor"')
    const isAboveCursor = toggleIndex > 0 && cursorIndex > 0 && toggleIndex < cursorIndex
    report('UI - "Enable screenshot" Toggle present', 'true', String(hasToggle), hasToggle)
    report('UI - Toggle positioned above "Capture mouse cursor"', 'true', String(isAboveCursor), isAboveCursor)
    report('UI - Print Screen shortcut hint shows "Disabled" when off', 'true', String(hasDisabledHint), hasDisabledHint)

    // 2. Preload API Check
    const preloadPath = path.join(rootDir, 'dist-electron/electron/preload.js')
    const preloadContent = fs.readFileSync(preloadPath, 'utf8')
    const hasPreloadMethod = preloadContent.includes('setScreenshotEnabled')
    report('Preload - setScreenshotEnabled exposed via contextBridge', 'true', String(hasPreloadMethod), hasPreloadMethod)

    // 3. Runtime Toggle Behavior
    console.log('\n--- 2. Runtime Dynamic Toggle & GlobalShortcut Verification ---')

    // Ensure starting state is enabled
    await launcher.webContents.executeJavaScript('window.electron.settings.setScreenshotEnabled(true)')
    await wait(200)

    const isRegInitial = globalShortcut.isRegistered('PrintScreen')
    const storeValInitial = store.get('settings.screenshotEnabled')
    report('Runtime - Initial state registered', 'true', String(isRegInitial), isRegInitial === true)
    report('Store - Initial state in electron-store', 'true', String(storeValInitial), storeValInitial === true)

    // Toggle OFF
    console.log('\n--- Toggling Screenshot OFF ---')
    await launcher.webContents.executeJavaScript('window.electron.settings.setScreenshotEnabled(false)')
    await wait(300)

    const isRegDisabled = globalShortcut.isRegistered('PrintScreen')
    const storeValDisabled = store.get('settings.screenshotEnabled')
    const statusDisabled = await launcher.webContents.executeJavaScript(
      'window.electron.settings.getScreenshotShortcutStatus()'
    )
    report('Runtime - PrintScreen unregister when disabled', 'false', String(isRegDisabled), isRegDisabled === false)
    report('Store - Persistence false in electron-store', 'false', String(storeValDisabled), storeValDisabled === false)
    report('IPC - getScreenshotShortcutStatus().registered when disabled', 'false', String(statusDisabled.registered), statusDisabled.registered === false)
    report('IPC - getScreenshotShortcutStatus().enabled when disabled', 'false', String(statusDisabled.enabled), statusDisabled.enabled === false)

    // Verify startScreenshot early returns when disabled
    const captureResultDisabled = await launcher.webContents.executeJavaScript(
      'window.electron.screenshot.start()'
    )
    const visibleCaptureWindows = BrowserWindow.getAllWindows().filter((w) => {
      try {
        return w.webContents.getURL().includes('mode=capture') && w.isVisible()
      } catch {
        return false
      }
    })
    report(
      'Runtime - startScreenshot blocked when disabled',
      'false',
      String(captureResultDisabled?.success),
      captureResultDisabled?.success === false
    )
    report(
      'Runtime - Overlay not shown when disabled (isVisible: false)',
      '0',
      String(visibleCaptureWindows.length),
      visibleCaptureWindows.length === 0
    )

    // Toggle ON
    console.log('\n--- Toggling Screenshot back ON ---')
    await launcher.webContents.executeJavaScript('window.electron.settings.setScreenshotEnabled(true)')
    await wait(300)

    const isRegEnabled = globalShortcut.isRegistered('PrintScreen')
    const storeValEnabled = store.get('settings.screenshotEnabled')
    const statusEnabled = await launcher.webContents.executeJavaScript(
      'window.electron.settings.getScreenshotShortcutStatus()'
    )
    report('Runtime - PrintScreen re-registered when enabled', 'true', String(isRegEnabled), isRegEnabled === true)
    report('Store - Persistence true in electron-store', 'true', String(storeValEnabled), storeValEnabled === true)
    report('IPC - getScreenshotShortcutStatus().registered when enabled', 'true', String(statusEnabled.registered), statusEnabled.registered === true)
    report('IPC - getScreenshotShortcutStatus().enabled when enabled', 'true', String(statusEnabled.enabled), statusEnabled.enabled === true)

    // Final Summary
    console.log('\n========================================')
    console.log('           VERIFICATION SUMMARY         ')
    console.log('========================================')
    const allPassed = results.every((r) => r.pass)
    console.table(results)

    if (allPassed) {
      console.log('\n>>> ALL 14 ASSERTIONS PASSED! <<<')
      setTimeout(() => process.exit(0), 400)
    } else {
      console.error('\n>>> SOME ASSERTIONS FAILED! <<<')
      setTimeout(() => process.exit(1), 400)
    }
  })
}
