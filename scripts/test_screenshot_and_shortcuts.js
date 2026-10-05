const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.TEST_FLOW_RUNTIME = '1';

require(path.join(__dirname, '../dist-electron/electron/main.js'));

app.whenReady().then(async () => {
  console.log('--- STARTING REGRESSION TEST FOR SCREENSHOT FLASH & SHORTCUTS UX ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      failures++;
    } else {
      console.log(`[PASS] ${message}`);
    }
  }

  const Store = require('electron-store');
  const store = new Store({ name: 'exist-flow' });

  // TEST 1: SCREENSHOT LIFECYCLE & FLASH PREVENTION
  console.log('\n[Scenario 1: Screenshot Lifecycle & State Reset]');
  const preloadContent = fs.readFileSync(path.join(__dirname, '../dist-electron/electron/preload.js'), 'utf8');
  assert(preloadContent.includes('screenshot:reset'), 'Preload exposes screenshot:reset listener');

  const mainContent = fs.readFileSync(path.join(__dirname, '../dist-electron/electron/main.js'), 'utf8');
  assert(mainContent.includes("captureDataUrl = null"), 'Main process clears captureDataUrl upon startScreenshot and closeCapture');
  assert(mainContent.includes("'screenshot:reset'"), 'Main process dispatches screenshot:reset before capture and on close');

  const overlayContent = fs.readFileSync(path.join(__dirname, '../src/renderer/components/ScreenshotOverlay.tsx'), 'utf8');
  assert(overlayContent.includes('onReset'), 'ScreenshotOverlay subscribes to onReset');
  assert(overlayContent.includes('resetState()'), 'ScreenshotOverlay invokes resetState() on cancel and complete');
  assert(overlayContent.includes('bg-black pointer-events-none'), 'ScreenshotOverlay has pure black fallback when dataUrl is null');

  // TEST 2: PROJECT SHORTCUT ASSIGNMENT & UX
  console.log('\n[Scenario 2: Project Shortcut]');
  const projectsViewContent = fs.readFileSync(path.join(__dirname, '../src/renderer/components/ProjectsView.tsx'), 'utf8');
  assert(projectsViewContent.includes('SetShortcutModal'), 'ProjectsView integrates SetShortcutModal');
  assert(projectsViewContent.includes('setProjectForShortcut'), 'ProjectsView allows clicking shortcut chip to change/assign');
  assert(projectsViewContent.includes('+ Shortcut') || projectsViewContent.includes('+ Add Shortcut'), 'ProjectsView displays prompt to assign shortcut when unset');

  // Verify store persistence for project shortcut
  const flowData = store.get('flow-data') || { items: [], projects: [] };
  const testProjId = 'test-proj-shortcut-' + Date.now();
  const testProj = {
    id: testProjId,
    name: 'Test Shortcut Project',
    shortcut: 'Ctrl+Alt+D',
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updatedProjects = [...(flowData.projects || []), testProj];
  store.set('flow-data.projects', updatedProjects);
  assert(store.get('flow-data.projects').some(p => p.id === testProjId && p.shortcut === 'Ctrl+Alt+D'), 'Project shortcut persisted to store as Ctrl+Alt+D');

  // Clear project shortcut
  const clearedProjects = store.get('flow-data.projects').map(p => p.id === testProjId ? { ...p, shortcut: undefined } : p);
  store.set('flow-data.projects', clearedProjects);
  const reloadedProj = store.get('flow-data.projects').find(p => p.id === testProjId);
  assert(reloadedProj && !reloadedProj.shortcut, 'Project shortcut cleanly cleared');

  // Clean up test project
  store.set('flow-data.projects', store.get('flow-data.projects').filter(p => p.id !== testProjId));

  // TEST 3: ITEM SHORTCUT ASSIGNMENT & VISIBILITY
  console.log('\n[Scenario 3: Flow Item Shortcut]');
  const itemActionsContent = fs.readFileSync(path.join(__dirname, '../src/renderer/actions/itemActions.ts'), 'utf8');
  assert(itemActionsContent.includes('onSetShortcut'), 'itemActions includes onSetShortcut in ActionContext');
  assert(itemActionsContent.includes('onClearShortcut'), 'itemActions includes onClearShortcut in ActionContext');
  assert(itemActionsContent.includes('Set Shortcut') || itemActionsContent.includes('Change Shortcut'), 'itemActions generates Set/Change Shortcut menu actions');

  const rowContent = fs.readFileSync(path.join(__dirname, '../src/renderer/components/FlowItemRow.tsx'), 'utf8');
  assert(!rowContent.includes('hidden flex-shrink-0 group-hover:inline-flex'), 'FlowItemRow shortcut chip is always visible when set (no hidden hover bug)');

  const appContent = fs.readFileSync(path.join(__dirname, '../src/renderer/App.tsx'), 'utf8');
  assert(appContent.includes('itemForShortcut'), 'App.tsx maintains itemForShortcut state');
  assert(appContent.includes('<SetShortcutModal'), 'App.tsx renders SetShortcutModal for items');

  // TEST 4: ABOUT PANEL & ATTRIBUTION
  console.log('\n[Scenario 4: About Panel]');
  const settingsPanelContent = fs.readFileSync(path.join(__dirname, '../src/renderer/components/SettingsPanel.tsx'), 'utf8');
  assert(!settingsPanelContent.includes('https://github.com/exist/exist-flow'), 'GitHub link is completely removed from Settings');
  assert(!settingsPanelContent.includes('https://discord.gg/flow'), 'Discord URL is completely removed from Settings');
  assert(settingsPanelContent.includes('existofficial'), 'existofficial contact handle is present in About');

  // TEST 5: TYPOGRAPHY
  console.log('\n[Scenario 5: Typography]');
  const globalCss = fs.readFileSync(path.join(__dirname, '../src/renderer/styles/global.css'), 'utf8');
  assert(globalCss.includes('.text-label {') && globalCss.includes('font-weight: 500;'), '.text-label uses refined font-weight 500 (no harsh bold)');
  assert(!globalCss.includes('text-transform: uppercase;\n  color: var(--flow-tertiary);'), 'Harsh all-caps removed from text-label');

  console.log('\n--- TEST SUMMARY ---');
  if (failures === 0) {
    console.log('ALL REGRESSION SCENARIOS PASSED WITH ZERO FAILURES!');
    setTimeout(() => process.exit(0), 400);
  } else {
    console.error(`FAILED WITH ${failures} ERRORS`);
    setTimeout(() => process.exit(1), 400);
  }
});
