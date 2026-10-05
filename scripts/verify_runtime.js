const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Diagnostic runner to test main.ts functions in production build
require(path.join(__dirname, '../dist-electron/main.js'));
