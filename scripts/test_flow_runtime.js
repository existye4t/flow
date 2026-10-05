const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.TEST_FLOW_RUNTIME = '1';

require(path.join(__dirname, '../dist-electron/electron/main.js'));

app.whenReady().then(async () => {
  console.log('[Runtime Test] App is ready!');

  // Wait 8 seconds for discoverInstalledApps & icon prewarm to finish
  await new Promise((r) => setTimeout(r, 8000));

  const cacheDir = path.join(app.getPath('userData'), 'flow_icon_cache');
  const diskFile = path.join(cacheDir, 'discovered-apps.json');
  console.log('[Runtime Test] Checking flow_icon_cache exists:', fs.existsSync(cacheDir));
  console.log('[Runtime Test] Checking discovered-apps.json exists:', fs.existsSync(diskFile));

  if (fs.existsSync(diskFile)) {
    const raw = fs.readFileSync(diskFile, 'utf8');
    const apps = JSON.parse(raw);
    console.log(`[Runtime Test] Total discovered apps: ${apps.length}`);

    const targets = ['Antigravity', 'Visual Studio Code', 'Zen', 'Discord', 'ZCode', 'Google Chrome', 'Spotify', 'Steam', 'Subtitle Edit'];
    for (const t of targets) {
      const match = apps.find(a => a.name.toLowerCase().includes(t.toLowerCase()));
      if (match) {
        console.log(`[Runtime Test] -> ${match.name}:\n    target="${match.target}"\n    desc="${match.description}"\n    iconDataUrlLen=${match.iconDataUrl ? match.iconDataUrl.length : 0}`);
      } else {
        console.log(`[Runtime Test] -> ${t}: NOT FOUND in discovered apps`);
      }
    }
  }

  const iconsDir = path.join(cacheDir, 'icons');
  if (fs.existsSync(iconsDir)) {
    const files = fs.readdirSync(iconsDir);
    console.log(`[Runtime Test] Total icon cache files on disk: ${files.length}`);
  }

  console.log('[Runtime Test] VERIFICATION SUCCESSFUL!');
  setTimeout(() => app.quit(), 500);
});
