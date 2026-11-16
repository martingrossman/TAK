/** Stage a clasp-ready host or template folder under .release/. Never touches the repo's .clasp.json. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { googlePackage } from './google-package.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensions = { SERVER_JS: '.js', HTML: '.html', JSON: '.json' };
/** scriptId comes from the caller (an environment variable), so no Apps Script ID is ever committed. */
export async function stagePackage(mode, { launchUrl = '', scriptId = '', outDir = path.join(root, '.release', mode) } = {}) {
  const { files } = await googlePackage(mode, launchUrl);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  for (const file of files) await fs.writeFile(path.join(outDir, file.name + extensions[file.type]), file.source);
  if (scriptId) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(scriptId)) throw new Error('The script ID does not look like an Apps Script project ID.');
    await fs.writeFile(path.join(outDir, '.clasp.json'), JSON.stringify({ scriptId, rootDir: '' }, null, 2) + '\n');
  }
  return { outDir, files: files.length, clasp: Boolean(scriptId) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, launchUrl] = process.argv.slice(2);
  if (!['host', 'template'].includes(mode)) throw new Error('Usage: node scripts/stage-package.mjs host|template [shared-/exec-url]\nSet TAK_SCRIPT_ID to also write .clasp.json for the target Apps Script project.');
  const result = await stagePackage(mode, { launchUrl, scriptId: process.env.TAK_SCRIPT_ID || '' });
  console.log(`Staged ${result.files} files in ${path.relative(root, result.outDir)}${result.clasp ? ' with .clasp.json' : ' (no .clasp.json: set TAK_SCRIPT_ID)'}.`);
}
