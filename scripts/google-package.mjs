/** Produce isolated shared-host/template packages; never changes .clasp.json. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function googlePackage(mode, launchUrl = '') {
  if (!['host', 'template'].includes(mode)) throw new Error('Choose host or template package.');
  if (mode === 'template' && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(launchUrl)) throw new Error('Provide the verified shared deployment URL.');
  const js = ['Code','PersonalBatch','Core','Schema','Migrations','Environment','Repository','History','Authorization','Settings','Ordering','Comments','SharedHost'];
  const html = ['Index','Styles','Client','QuickAdd','Help','FullScreen','Connection','CoreScript'];
  const files = [];
  for (const name of js) files.push({name,type:'SERVER_JS',source:await fs.readFile(path.join(root,name+'.js'),'utf8')});
  for (const name of html) files.push({name,type:'HTML',source:await fs.readFile(path.join(root,name+'.html'),'utf8')});
  files.push({name:'SharedConfig',type:'SERVER_JS',source:mode === 'host' ? 'var TAK_SHARED_HOST_ = true;\n' : 'var TAK_SHARED_HOST_ = false;\nvar TAK_SHARED_LAUNCH_URL_ = '+JSON.stringify(launchUrl)+';\n'});
  const manifest = {
    timeZone:'Europe/Prague',runtimeVersion:'V8',exceptionLogging:'STACKDRIVER',
    oauthScopes: mode === 'host' ? ['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/userinfo.email'] : ['https://www.googleapis.com/auth/spreadsheets.currentonly','https://www.googleapis.com/auth/script.container.ui']
  };
  if (mode === 'host') manifest.webapp = {executeAs:'USER_ACCESSING',access:'ANYONE'};
  files.push({name:'appsscript',type:'JSON',source:JSON.stringify(manifest,null,2)});
  return {files};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, output, launchUrl] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node scripts/google-package.mjs host|template output.json [shared-url]');
  await fs.writeFile(output,JSON.stringify(await googlePackage(mode,launchUrl),null,2),{flag:'wx'});
}
