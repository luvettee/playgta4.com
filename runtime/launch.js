"use strict";
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const file of ['app/index.html', 'app/liberty.js', 'app/liberty.wasm', 'game/default.xex']) {
 if (!fs.existsSync(path.join(root, file))) {
  console.error('Missing required file: ' + file);
  process.exit(1);
 }
}
// Start only the HTTP host; all game adapters execute in the user's browser.
const args = process.argv.slice(2);
for (const [flag, value] of [['--dist', path.join(root,'app')], ['--game', path.join(root,'game')], ['--port', process.env.PORT || '3001']]) {
 if (!args.includes(flag)) args.push(flag, value);
}
process.argv = [process.execPath, path.join(__dirname,'server.js'), ...args];
require('./server.js');
