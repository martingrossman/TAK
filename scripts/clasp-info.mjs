/** Show where a clasp project's draft and production deployments are. Read-only. Usage: npm run clasp:info [-- <folder>] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeployments, runClasp } from './clasp-tools.mjs';

/** Pure: turn a script ID and parsed deployments into the facts a person needs before testing or releasing. */
export function describeDeployments(scriptId, deployments, domain = '') {
  const head = deployments.find(item => item.version === 'HEAD');
  const live = deployments.filter(item => item.version !== 'HEAD');
  const only = live.length === 1 ? live[0] : null; // several deployments: never guess which one is production
  const macros = domain ? `https://script.google.com/a/macros/${domain}/s/` : 'https://script.google.com/macros/s/';
  return {
    scriptId,
    headDeploymentId: head ? head.id : '',
    devUrl: head ? `${macros}${head.id}/dev` : '',
    deployments: live.map(item => ({ id: item.id, version: item.version, description: item.description, execUrl: `https://script.google.com/macros/s/${item.id}/exec` })),
    productionDeploymentId: only ? only.id : '',
    note: live.length > 1 ? 'More than one deployment exists; choose the production deployment yourself.' : live.length === 0 ? 'No versioned deployment exists yet.' : ''
  };
}

export function claspInfo(dir, { run = runClasp, domain = process.env.TAK_WORKSPACE_DOMAIN || '' } = {}) {
  const file = path.join(dir, '.clasp.json');
  if (!fs.existsSync(file)) throw new Error(`No .clasp.json in ${dir}. Run from a clasp project folder, or pass the staged folder, e.g. npm run clasp:info -- .release/host`);
  const scriptId = JSON.parse(fs.readFileSync(file, 'utf8')).scriptId || '';
  if (!scriptId) throw new Error('scriptId is missing in .clasp.json.');
  const result = run(['deployments'], dir);
  if (result.status !== 0) throw new Error('clasp deployments failed: ' + (result.stderr || result.stdout).trim());
  return describeDeployments(scriptId, parseDeployments(result.stdout), domain);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(claspInfo(path.resolve(process.argv[2] || process.cwd())), null, 2)); }
  catch (error) { console.error('Failure: ' + error.message); process.exitCode = 1; }
}
