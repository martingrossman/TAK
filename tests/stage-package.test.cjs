const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('staging writes a clasp-ready host folder, a template folder, and keeps IDs out of the repo', async () => {
  const { stagePackage } = await import('../scripts/stage-package.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tak-stage-'));
  try {
    const hostDir = path.join(dir, 'host');
    const host = await stagePackage('host', { outDir: hostDir, scriptId: 'A'.repeat(40) });
    assert.equal(host.clasp, true);
    assert.equal(fs.readFileSync(path.join(hostDir, 'SharedConfig.js'), 'utf8'), 'var TAK_SHARED_HOST_ = true;\n');
    assert.equal(JSON.parse(fs.readFileSync(path.join(hostDir, 'appsscript.json'), 'utf8')).webapp.executeAs, 'USER_ACCESSING');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(hostDir, '.clasp.json'), 'utf8')), { scriptId: 'A'.repeat(40), rootDir: '' });
    for (const name of ['Code.js', 'SharedHost.js', 'Index.html', 'CoreScript.html']) assert.ok(fs.existsSync(path.join(hostDir, name)), name);
    fs.writeFileSync(path.join(hostDir, 'stale.js'), 'old');
    await stagePackage('host', { outDir: hostDir });
    assert.equal(fs.existsSync(path.join(hostDir, 'stale.js')), false);
    assert.equal(fs.existsSync(path.join(hostDir, '.clasp.json')), false);

    const url = 'https://script.google.com/macros/s/' + 'B'.repeat(30) + '/exec';
    const template = await stagePackage('template', { outDir: path.join(dir, 'template'), launchUrl: url });
    assert.match(fs.readFileSync(path.join(template.outDir, 'SharedConfig.js'), 'utf8'), /TAK_SHARED_LAUNCH_URL_ = "https:\/\/script\.google\.com\/macros\/s\/B+\/exec"/);
    await assert.rejects(stagePackage('template', { outDir: path.join(dir, 'bad'), launchUrl: 'http://example.com' }), /verified shared deployment URL/);
    await assert.rejects(stagePackage('host', { outDir: path.join(dir, 'bad2'), scriptId: 'short' }), /script ID/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
