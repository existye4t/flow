const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.TEST_FLOW_RUNTIME = '1';

// Load full electron main application with all IPC handlers and store
require(path.join(__dirname, '../dist-electron/electron/main.js'));

app.whenReady().then(async () => {
  console.log('[Capture] Waiting for main window and app data...');
  // Wait for the window to be created and items to load
  await new Promise((r) => setTimeout(r, 2500));

  const windows = BrowserWindow.getAllWindows();
  const win = windows.find((w) => !w.isDestroyed() && w.isVisible()) || windows[0];

  if (!win) {
    console.error('[Capture] No window found!');
    app.quit();
    return;
  }

  // Ensure window is focused and painted
  win.focus();
  await new Promise((r) => setTimeout(r, 1000));

  console.log('[Capture] Capturing page...');
  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();

  const assetsDir = path.join(__dirname, '../assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const previewPath = path.join(assetsDir, 'preview.png');
  fs.writeFileSync(previewPath, pngBuffer);
  console.log(`[Capture] Saved full UI preview to ${previewPath} (${pngBuffer.length} bytes)`);

  setTimeout(() => {
    process.exit(0);
  }, 500);
});
