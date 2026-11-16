const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const version = JSON.parse(read('package.json')).version;

test('package.json holds a plain semantic version', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('generated Version.js agrees with package.json (run npm run build if this fails)', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(read('Version.js'), context);
  assert.equal(context.takAppVersion_(), version);
});

test('the header badge and Apps Script allowlists carry the version', () => {
  assert.match(read('Index.html'), /<span class="brand-version" title="TAK version <\?= takAppVersion_\(\) \?>">v<\?= takAppVersion_\(\) \?><\/span>/);
  assert.ok(read('.claspignore').split(/\r?\n/).includes('!Version.js'));
  assert.match(read('scripts/google-package.mjs'), /'Roadmap','Version'/);
  assert.match(read('docs/INSTALL_FROM_SOURCE.md'), /SharedHost\.js · Version\.js/);
});

test('AGENTS.md carries the release gate and names the generated files', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /## Release and deployment gate/);
  assert.match(agents, /docs\/RELEASE\.md/);
  assert.match(agents, /`CoreScript\.html`, `Version\.js` and `dist\/index\.html` are generated/);
  assert.match(agents, /explicit written approval/);
});

test('the changelog lists this version in the table and as the newest entry', () => {
  const notes = read('CHANGELOG.md');
  assert.match(notes, new RegExp('^\\| ' + version.replace(/\./g, '\\.') + ' \\| \\d{4}-\\d{2}-\\d{2} \\|', 'm'));
  const headings = [...notes.matchAll(/^## v(\d+\.\d+\.\d+) — /gm)].map(match => match[1]);
  assert.equal(headings[0], version);
});

test('Version.js shows the version and its changelog summary where the Apps Script editor displays it', () => {
  const source = read('Version.js');
  assert.match(source, new RegExp('^/\\*\\*\\n \\* TAK v' + version.replace(/\./g, '\\.') + ' \\(\\d{4}-\\d{2}-\\d{2} - .+\\)\\n'));
  const context = {}; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(context.TAK_APP_VERSION, version);
});
