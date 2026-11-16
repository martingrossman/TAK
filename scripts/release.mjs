/**
 * Move a production deployment to the tagged version. A person runs this; it refuses otherwise.
 * Usage: npm run release -- host|install [--dry-run]
 * IDs come from the environment, never from the repository:
 *   host:    TAK_HOST_SCRIPT_ID, TAK_HOST_DEPLOYMENT_ID
 *   install: TAK_DEPLOYMENT_ID (script comes from this checkout's .clasp.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDeployments, runClasp, safeDescription } from './clasp-tools.mjs';
import { stagePackage } from './stage-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const idPattern = /^[A-Za-z0-9_-]{20,100}$/;

export async function release({ target, dryRun = false, root: base = root, env = process.env, isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY), ci = Boolean(process.env.CI),
  git = args => execFileSync('git', args, { cwd: base, encoding: 'utf8' }), run = runClasp, stage = stagePackage, ask, log = console.log } = {}) {
  if (!isTTY || ci) throw new Error('Releases run only from an interactive terminal, started by a person. Scripts, CI and agents must stop after the /dev push.');
  if (!['host', 'install'].includes(target)) throw new Error('Usage: npm run release -- host|install [--dry-run]');
  const read = name => fs.readFileSync(path.join(base, name), 'utf8');
  const version = JSON.parse(read('package.json')).version, tag = 'v' + version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('package.json version must be X.Y.Z.');

  if (git(['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('The working tree has uncommitted changes to tracked files. Commit or discard them, then tag the release commit.');
  if (!git(['tag', '--points-at', 'HEAD']).split(/\r?\n/).includes(tag)) throw new Error(`HEAD is not tagged ${tag}. Release only the tagged commit: git tag -a ${tag} -m "Release ${tag}"`);
  if (!new RegExp(`return '${version.replace(/\./g, '\\.')}'`).test(read('Version.js'))) throw new Error('Version.js does not match package.json. Run npm run build and commit the result.');
  const notes = read('CHANGELOG.md');
  const row = notes.match(new RegExp(`^\\| ${version.replace(/\./g, '\\.')} \\| [^|]+\\| ([^|]+) \\|`, 'm'));
  if (!row || !new RegExp(`^## ${tag} `, 'm').test(notes)) throw new Error(`CHANGELOG.md has no entry for ${tag}.`);
  const description = safeDescription(`${tag} - ${row[1]}`);

  const scriptId = target === 'host' ? env.TAK_HOST_SCRIPT_ID : '';
  const deploymentId = target === 'host' ? env.TAK_HOST_DEPLOYMENT_ID : env.TAK_DEPLOYMENT_ID;
  if (target === 'host' && !idPattern.test(scriptId || '')) throw new Error('Set TAK_HOST_SCRIPT_ID in your shell (not in the repository).');
  if (!idPattern.test(deploymentId || '')) throw new Error(`Set ${target === 'host' ? 'TAK_HOST_DEPLOYMENT_ID' : 'TAK_DEPLOYMENT_ID'} in your shell (not in the repository).`);

  const cwd = target === 'host' ? (await stage('host', { scriptId })).outDir : base;
  const call = (args, allowDry = false) => {
    if (dryRun && !allowDry) { log('[dry run] clasp ' + args.join(' ')); return { status: 0, stdout: '', stderr: '' }; }
    const result = run(args, cwd);
    if (result.status !== 0) throw new Error(`clasp ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
    return result;
  };
  const current = parseDeployments(call(['deployments'], true).stdout).find(item => item.id === deploymentId);
  if (!current) throw new Error('That deployment ID is not in this project. Check it with npm run clasp:info.');
  if (current.version === 'HEAD') throw new Error('That is the draft (@HEAD) deployment, not a production deployment.');

  log(`Release ${tag} to the ${target === 'host' ? 'shared host' : 'independent install'}.`);
  log(`Production deployment ...${deploymentId.slice(-6)} is at version ${current.version}${current.description ? ' (' + current.description + ')' : ''}; it will move to the new version.`);
  log(`Description: ${description}`);
  if (dryRun) { log('[dry run] no changes made; the push, version and deploy steps would run after you type the version to confirm.'); call(['push', '-f']); call(['version', description]); call(['deploy', '-i', deploymentId, '-V', '<new version>', '-d', description]); return { dryRun: true, version, target }; }
  const typed = (await ask(`Did you test this on /dev and approve it? Type ${tag} to deploy to production: `)).trim();
  if (typed !== tag) throw new Error('Confirmation did not match. Nothing was deployed.');

  call(['push', '-f']);
  const made = call(['version', description]);
  const number = (made.stdout + made.stderr).match(/version\s+(\d+)/i);
  if (!number) throw new Error('Could not read the new version number from clasp. Run clasp versions; nothing was deployed.');
  call(['deploy', '-i', deploymentId, '-V', number[1], '-d', description]);
  log(`Deployed ${tag} as Apps Script version ${number[1]}. Previous production version was ${current.version}; roll back with: clasp deploy -i <id> -V ${current.version}`);
  log('Next: verify the live /exec from a private test copy, then git push origin ' + tag + '.');
  return { version, target, appsScriptVersion: number[1], previousVersion: current.version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { await release({ target: args.find(arg => !arg.startsWith('--')), dryRun: args.includes('--dry-run'), ask: question => rl.question(question) }); }
  catch (error) { console.error('Refused: ' + error.message); process.exitCode = 1; }
  finally { rl.close(); }
}
