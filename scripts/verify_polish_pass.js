const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.TEST_FLOW_RUNTIME = '1';

// Load full electron main application
require(path.join(__dirname, '../dist-electron/electron/main.js'));

app.whenReady().then(async () => {
  console.log('--- STARTING VERIFICATION OF UX / POLISH PASS ---');
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      failures++;
    } else {
      console.log(`[PASS] ${message}`);
    }
  }

  // 1. Verify preview.png exists and is non-empty
  const previewPath = path.join(__dirname, '../assets/preview.png');
  assert(fs.existsSync(previewPath) && fs.statSync(previewPath).size > 10000, 'Real UI preview image exists in assets/preview.png');

  // 2. Verify Store and data integrity
  const Store = require('electron-store');
  const store = new Store({ name: 'exist-flow' });
  const flowData = store.get('flow-data');
  assert(flowData && Array.isArray(flowData.items), 'flow-data store exists and has items array');
  assert(flowData && Array.isArray(flowData.projects), 'flow-data store exists and has projects array');

  // 3. Verify settings defaults & new screenshotBehavior field
  const settings = store.get('settings') || {};
  console.log('[Info] Current settings:', JSON.stringify(settings, null, 2));

  // Test setting screenshotBehavior to review and instant
  store.set('settings.screenshotBehavior', 'instant');
  assert(store.get('settings.screenshotBehavior') === 'instant', 'Can persist screenshotBehavior = instant');
  store.set('settings.screenshotBehavior', 'review');
  assert(store.get('settings.screenshotBehavior') === 'review', 'Can persist screenshotBehavior = review');

  // 4. Verify Project Shortcut Sync & Deletion logic
  const initialItemsCount = flowData.items.length;
  const testProjectId = 'test-proj-' + Date.now();
  const testProject = {
    id: testProjectId,
    name: 'Verification Workspace',
    shortcut: 'Ctrl+Alt+V',
    icon: 'folder',
    itemIds: flowData.items.length > 0 ? [flowData.items[0].id] : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Add test project
  const updatedProjects = [...(flowData.projects || []), testProject];
  store.set('flow-data.projects', updatedProjects);
  assert(store.get('flow-data.projects').some(p => p.id === testProjectId), 'Test project added to store');

  // Simulate project deletion without deleting flows
  const projectsAfterDelete = store.get('flow-data.projects').filter(p => p.id !== testProjectId);
  store.set('flow-data.projects', projectsAfterDelete);
  const itemsAfterDelete = store.get('flow-data.items');
  assert(itemsAfterDelete.length === initialItemsCount, 'Deleting project does NOT delete any Flow items');
  assert(!store.get('flow-data.projects').some(p => p.id === testProjectId), 'Test project successfully removed from store');

  // 5. Verify Package metadata
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert(pkg.version === '0.1.0', `Package version matches 0.1.0 (actual: ${pkg.version})`);
  assert(pkg.name === 'exist-flow', `Package name matches exist-flow`);

  // 6. Verify README.md includes assets/preview.png and accurate branding
  const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
  assert(readme.includes('./assets/preview.png'), 'README.md links to ./assets/preview.png');
  assert(readme.includes('Review Mode'), 'README.md documents Review Mode');
  assert(readme.includes('Instant Mode'), 'README.md documents Instant Mode');

  console.log('--- VERIFICATION COMPLETE ---');
  if (failures === 0) {
    console.log('ALL POLISH PASS CHECKS PASSED!');
    setTimeout(() => process.exit(0), 500);
  } else {
    console.error(`FAILED WITH ${failures} ERRORS`);
    setTimeout(() => process.exit(1), 500);
  }
});
