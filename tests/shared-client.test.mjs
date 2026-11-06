import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { googlePackage } from '../scripts/google-package.mjs';
const client=await readFile(new URL('../Client.html',import.meta.url),'utf8');

test('shared browser preferences and recovery state are separate for each workbook',()=>{
  const source=client.slice(client.indexOf('  const isCloud ='),client.indexOf('  const noEpicLaneKey'));
  function keys(id,cloud=true){return vm.runInNewContext(source+'\n[uiStorageKey,savedViewsStorageKey,draftStorageKey,quickQueueStorageKey,bulkDraftStorageKey,duplicateDraftStorageKey,undoStorageKey]',{window:{google:cloud?{}:undefined},google:{script:{run:{}}},document:{body:{dataset:{sharedSheet:id}}}});}
  const a=keys('book-a'),b=keys('book-b'),legacy=keys('');
  for(let i=0;i<a.length;i++){assert.notEqual(a[i],b[i]);assert.equal(a[i],legacy[i]+'.sheet.book-a');}
  assert.deepEqual(Array.from(keys('book-a',false)),Array.from(legacy));
});
test('shared browser RPC always carries the selected workbook and server failures remain errors',async()=>{
  const source=client.slice(client.indexOf('  async function rpc('),client.indexOf("    if (method === 'createIssuesBatch')"))+'\n}';
  const calls=[];let success,failure;
  const runner={withSuccessHandler(fn){success=fn;return this;},withFailureHandler(fn){failure=fn;return this;},sharedTrackerRpc(...args){calls.push(args);success({ok:true});}};
  const context={isCloud:true,sharedSheetId:'selected-copy',google:{script:{run:runner}},setTimeout,clearTimeout};
  const rpc=vm.runInNewContext(source+'\nrpc',context);
  assert.equal((await rpc('saveIssue',{summary:'Test'},'revision')).ok,true);
  assert.equal(calls[0][0],'selected-copy');assert.equal(calls[0][1],'saveIssue');assert.equal(calls[0][2][1],'revision');
  runner.sharedTrackerRpc=()=>failure({message:'Permission denied'});
  await assert.rejects(rpc('getProject'),/Permission denied/);
});
test('shared Google packages explicitly separate host identity from the copied launcher',async()=>{
  const host=await googlePackage('host'),template=await googlePackage('template','https://script.google.com/macros/s/shared-test/exec');
  const manifest=p=>JSON.parse(p.files.find(f=>f.name==='appsscript').source);
  assert.deepEqual(manifest(host).webapp,{executeAs:'USER_ACCESSING',access:'ANYONE'});
  assert.deepEqual(manifest(host).oauthScopes,['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/userinfo.email']);
  assert.equal(manifest(template).webapp,undefined);
  assert.deepEqual(manifest(template).oauthScopes,['https://www.googleapis.com/auth/spreadsheets.currentonly','https://www.googleapis.com/auth/script.container.ui']);
  assert.match(template.files.find(f=>f.name==='SharedConfig').source,/TAK_SHARED_HOST_ = false/);
  assert.match(host.files.find(f=>f.name==='SharedConfig').source,/TAK_SHARED_HOST_ = true/);
  await assert.rejects(googlePackage('template','https://example.invalid/untrusted'),/verified shared deployment/);
});
