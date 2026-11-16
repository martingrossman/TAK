const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOST_SCRIPT = 'S'.repeat(40), HOST_DEP = 'D'.repeat(30) + 'abc123', HEAD_DEP = 'H'.repeat(40);
const deploymentsText = `Found 2 deployments.\n- ${HEAD_DEP} @HEAD \n- ${HOST_DEP} @7 - v0.9.0 - Earlier release\n`;

function repo(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tak-release-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  fs.writeFileSync(path.join(dir, 'Version.js'), "function takAppVersion_() { return '1.2.3'; }\n");
  fs.writeFileSync(path.join(dir, 'docs', 'RELEASE_NOTES.md'), overrides.notes || '| Version | Date | Summary |\n| --- | --- | --- |\n| 1.2.3 | 2026-11-16 | Faster saves & safer retries |\n\n## v1.2.3 — 2026-11-16\n\n- Notes.\n');
  return dir;
}
function harness(dir, options = {}) {
  const calls = [], staged = [], logs = [];
  const git = args => args[0] === 'status' ? (options.dirty ? ' M Code.js\n' : '') : (options.tags === undefined ? 'v1.2.3\n' : options.tags);
  const run = (args, cwd) => {
    calls.push({ args, cwd });
    if (args[0] === 'deployments') return { status: 0, stdout: options.deployments || deploymentsText, stderr: '' };
    if (args[0] === 'version') return { status: 0, stdout: 'Created version 8.\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const stage = async (mode, opts) => { staged.push({ mode, opts }); return { outDir: path.join(dir, '.release', mode) }; };
  const env = options.env || { TAK_HOST_SCRIPT_ID: HOST_SCRIPT, TAK_HOST_DEPLOYMENT_ID: HOST_DEP, TAK_DEPLOYMENT_ID: HOST_DEP };
  const base = { root: dir, env, isTTY: true, ci: false, git, run, stage, log: line => logs.push(line), ask: async () => options.answer ?? 'v1.2.3' };
  return { calls, staged, logs, base };
}

test('parseDeployments, safeDescription and the Windows quoting of clasp arguments', async () => {
  const { parseDeployments, safeDescription, runClasp } = await import('../scripts/clasp-tools.mjs');
  assert.deepEqual(parseDeployments(deploymentsText), [
    { id: HEAD_DEP, version: 'HEAD', description: '' },
    { id: HOST_DEP, version: '7', description: 'v0.9.0 - Earlier release' }
  ]);
  assert.equal(safeDescription('v1 - Faster saves & "safer" retries; ok'), 'v1 - Faster saves safer retries ok');
  let seen;
  runClasp(['version', 'v1.2.3 - a b'], '/x', (command, args, options) => { seen = { command, args, options }; return { status: 0, stdout: '' }; }, 'win32');
  assert.equal(seen.command, 'npx.cmd @google/clasp version "v1.2.3 - a b"');
  assert.equal(seen.args.shell, true, 'the options object is the second argument on Windows');
  runClasp(['deployments'], '/x', (command, args, options) => { seen = { command, args, options }; return { status: 0, stdout: '' }; }, 'linux');
  assert.deepEqual([seen.command, seen.options.shell], ['npx', false]);
});

test('clasp:info describes the draft and production deployments and never guesses between several', async () => {
  const { describeDeployments, claspInfo } = await import('../scripts/clasp-info.mjs');
  const { parseDeployments } = await import('../scripts/clasp-tools.mjs');
  const one = describeDeployments(HOST_SCRIPT, parseDeployments(deploymentsText));
  assert.equal(one.devUrl, `https://script.google.com/macros/s/${HEAD_DEP}/dev`);
  assert.equal(one.productionDeploymentId, HOST_DEP);
  assert.equal(one.deployments[0].execUrl, `https://script.google.com/macros/s/${HOST_DEP}/exec`);
  assert.match(describeDeployments(HOST_SCRIPT, parseDeployments(deploymentsText), 'example.org').devUrl, /\/a\/macros\/example\.org\/s\//);
  const many = describeDeployments(HOST_SCRIPT, parseDeployments(deploymentsText + `- ${'Z'.repeat(40)} @3 - old\n`));
  assert.equal(many.productionDeploymentId, '');
  assert.match(many.note, /choose the production deployment yourself/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tak-info-'));
  assert.throws(() => claspInfo(dir, { run: () => ({ status: 0, stdout: '' }) }), /No \.clasp\.json/);
  fs.writeFileSync(path.join(dir, '.clasp.json'), JSON.stringify({ scriptId: HOST_SCRIPT }));
  assert.equal(claspInfo(dir, { run: () => ({ status: 0, stdout: deploymentsText }) }).scriptId, HOST_SCRIPT);
  assert.throws(() => claspInfo(dir, { run: () => ({ status: 1, stdout: '', stderr: 'not logged in' }) }), /not logged in/);
});

test('release refuses anything that is not a person on a clean, tagged, documented commit', async () => {
  const { release } = await import('../scripts/release.mjs');
  const dir = repo();
  const refuse = async (options, pattern, changes = {}) => {
    const h = harness(dir, options);
    await assert.rejects(release({ target: 'host', ...h.base, ...changes }), pattern);
    assert.equal(h.calls.filter(call => ['push', 'version', 'deploy'].includes(call.args[0])).length, 0, 'nothing may be pushed or deployed');
  };
  await refuse({}, /interactive terminal/, { isTTY: false });
  await refuse({}, /interactive terminal/, { ci: true });
  await refuse({}, /host\|install/, { target: 'prod' });
  await refuse({ dirty: true }, /uncommitted changes/);
  await refuse({ tags: 'v1.2.2\n' }, /not tagged v1\.2\.3/);
  await refuse({ env: { TAK_HOST_DEPLOYMENT_ID: HOST_DEP } }, /TAK_HOST_SCRIPT_ID/);
  await refuse({ env: { TAK_HOST_SCRIPT_ID: HOST_SCRIPT } }, /TAK_HOST_DEPLOYMENT_ID/);
  await refuse({ deployments: `- ${HEAD_DEP} @HEAD\n` }, /not in this project/);
  await refuse({ env: { TAK_HOST_SCRIPT_ID: HOST_SCRIPT, TAK_HOST_DEPLOYMENT_ID: HEAD_DEP } }, /draft \(@HEAD\)/);
  await refuse({ answer: 'yes' }, /did not match/);
  await refuse({ answer: 'v1.2.2' }, /did not match/);
  fs.writeFileSync(path.join(dir, 'Version.js'), "function takAppVersion_() { return '1.0.0'; }\n");
  await refuse({}, /Version\.js does not match/);
  const noNotes = repo({ notes: '# notes\n' });
  const h = harness(noNotes);
  await assert.rejects(release({ target: 'host', ...h.base }), /no entry for v1\.2\.3/);
});

test('release moves the host deployment in order, with the typed confirmation, and reports the rollback target', async () => {
  const { release } = await import('../scripts/release.mjs');
  const dir = repo(), h = harness(dir);
  const result = await release({ target: 'host', ...h.base });
  assert.deepEqual(h.staged, [{ mode: 'host', opts: { scriptId: HOST_SCRIPT } }]);
  assert.deepEqual(h.calls.map(call => call.args), [
    ['deployments'],
    ['push', '-f'],
    ['version', 'v1.2.3 - Faster saves safer retries'],
    ['deploy', '-i', HOST_DEP, '-V', '8', '-d', 'v1.2.3 - Faster saves safer retries']
  ]);
  assert.ok(h.calls.every(call => call.cwd === path.join(dir, '.release', 'host')));
  assert.equal(result.appsScriptVersion, '8');
  assert.equal(result.previousVersion, '7');
  assert.match(h.logs.join('\n'), /\.\.\.abc123 is at version 7/);
  assert.doesNotMatch(h.logs.join('\n'), new RegExp(HOST_DEP), 'the full deployment ID is not printed');
  assert.match(h.logs.join('\n'), /-V 7/);
});

test('release for an independent install runs from the checkout and a dry run changes nothing', async () => {
  const { release } = await import('../scripts/release.mjs');
  const dir = repo(), h = harness(dir);
  await release({ target: 'install', ...h.base });
  assert.equal(h.staged.length, 0);
  assert.ok(h.calls.every(call => call.cwd === dir));
  assert.equal(h.calls.at(-1).args[0], 'deploy');
  const dry = harness(dir);
  const result = await release({ target: 'install', dryRun: true, ...dry.base, ask: async () => { throw new Error('a dry run must not ask'); } });
  assert.equal(result.dryRun, true);
  assert.deepEqual(dry.calls.map(call => call.args[0]), ['deployments']);
  assert.match(dry.logs.join('\n'), /\[dry run\] clasp push -f/);
});
