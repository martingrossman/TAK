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

test('clasp uses src as its content root and every allowed Apps Script file exists there', () => {
  const config = JSON.parse(read('.clasp.json'));
  assert.equal(config.rootDir, 'src');
  const allowed = read('.claspignore').split(/\r?\n/).filter(line => line.startsWith('!')).map(line => line.slice(1));
  assert.ok(allowed.includes('appsscript.json'));
  for (const name of allowed) assert.ok(fs.statSync(path.join(root, 'src', name)).isFile(), name);
});

test('generated Version.js agrees with package.json (run npm run build if this fails)', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(read('src/Version.js'), context);
  assert.equal(context.takAppVersion_(), version);
});

test('the header badge and Apps Script allowlists carry the version', () => {
  assert.match(read('src/Index.html'), /<span class="brand-version" title="TAK version <\?= takAppVersion_\(\) \?>">v<\?= takAppVersion_\(\) \?><\/span>/);
  assert.ok(read('.claspignore').split(/\r?\n/).includes('!Version.js'));
  assert.match(read('scripts/google-package.mjs'), /'Roadmap','Version'/);
  assert.match(read('docs/INSTALL_FROM_SOURCE.md'), /SharedHost\.js · Roadmap\.js · Version\.js/);
});

test('AGENTS.md carries the release gate and names the generated files', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /## Release and deployment gate/);
  assert.match(agents, /docs\/RELEASE\.md/);
  assert.match(agents, /`src\/CoreScript\.html`, `src\/Version\.js` and `dist\/index\.html` are generated/);
  assert.match(agents, /explicit written approval/);
});

test('every web app release also updates the starter template to the same version', () => {
  assert.match(read('AGENTS.md'), /starter template\*\* is updated in \*\*every\*\* Option 2 release/);
  assert.match(read('AGENTS.md'), /Then update the starter template under the same approval/);
  assert.match(read('docs/RELEASE.md'), /The starter template ships with every Option 2 release/);
  assert.match(read('docs/RELEASE.md'), /TAK_TEMPLATE_SCRIPT_ID/);
  assert.match(read('readme.md'), /Every web app release also updates the starter template/);
  assert.match(read('scripts/release.mjs'), /TAK_TEMPLATE_SCRIPT_ID/);
});

test('the changelog lists this version in the table and as the newest entry', () => {
  const notes = read('CHANGELOG.md');
  assert.match(notes, new RegExp('^\\| ' + version.replace(/\./g, '\\.') + ' \\| \\d{4}-\\d{2}-\\d{2} \\|', 'm'));
  const headings = [...notes.matchAll(/^## v(\d+\.\d+\.\d+) — /gm)].map(match => match[1]);
  assert.equal(headings[0], version);
});

test('Version.js shows the version and its changelog summary where the Apps Script editor displays it', () => {
  const source = read('src/Version.js');
  assert.match(source, new RegExp('^/\\*\\*\\n \\* TAK v' + version.replace(/\./g, '\\.') + ' \\(\\d{4}-\\d{2}-\\d{2} - .+\\)\\n'));
  const context = {}; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(context.TAK_APP_VERSION, version);
});
