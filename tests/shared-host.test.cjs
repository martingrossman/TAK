const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Core = require('../Core.js');

function harness() {
  const books = {}, writes = [], denied = new Set();
  let email = 'tester@example.invalid', effective = email, locked = false;
  const api = vm.createContext({ Date, TrackerCore: Core, TAK_SHARED_HOST_: true,
    console: { log() {} },
    PropertiesService: { getScriptProperties() { throw new Error('Shared Script Properties must not be used.'); } },
    Session: { getActiveUser: () => ({ getEmail: () => email }), getEffectiveUser: () => ({ getEmail: () => effective }) },
    SpreadsheetApp: { openById(id) { if (denied.has(id) || !books[id]) throw new Error('Access denied'); return books[id]; }, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false); locked = true; }, releaseLock() { locked = false; } }) },
    Utilities: { getUuid: () => crypto.randomUUID(), formatDate: (date, zone, format) => format === 'yyyy-MM-dd' ? date.toLocaleDateString('en-CA', { timeZone: zone }) : date.toISOString(), parseDate: value => new Date(value+'T00:00:00Z'), DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => crypto.createHash('sha256').update(value).digest(), base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url') }
  });
  for (const name of ['Schema','Code','SharedHost','Authorization','Environment','Repository','History','Settings','Comments']) vm.runInContext(fs.readFileSync(require.resolve('../'+name+'.js'),'utf8'),api);
  function makeBook(id) {
    const tabs = {}, book = { id, tabs, writable: true, getId: () => id, getName: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/'+id+'/edit', getSpreadsheetTimeZone: () => 'Europe/Prague', getSheetByName: name => tabs[name] || null };
    function sheet(name, headers) {
      const rows = [Array.from(headers)];
      const result = { rows, getName: () => name, getParent: () => book, getLastRow: () => rows.length, getMaxRows: () => 1000, deleteRow(row) { check(); rows.splice(row-1,1); }, getRange(row,col,height=1,width=1) {
        return { getValues: () => Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>rows[row-1+r]?.[col-1+c]??'')), setValues(values) { check(); values.forEach((line,r)=>{ rows[row-1+r] ||= []; line.forEach((value,c)=>{ rows[row-1+r][col-1+c]=value; }); }); return this; }, setValue(value) { return this.setValues([[value]]); } };
      } };
      function check() { assert.equal(locked,true,'writes hold the mutation lock'); if (!book.writable) throw new Error('Google denied this write'); writes.push([id,name]); }
      tabs[name] = result;
    }
    for(const def of Object.values(api.SheetFlowSchema.tabs)) sheet(def.name,def.headers);
    sheet('Issues',Core.fields.map(f=>f.label));
    tabs._System.rows.push(['SCHEMA_VERSION',api.SheetFlowSchema.version],['TAK_SHARED_STORAGE_V1','legacy']);
    books[id]=book;
    return book;
  }
  const a = makeBook('test_book_A_123456789012345'), b = makeBook('test_book_B_123456789012345');
  return {api,a,b,writes,denied,call:(book,method,...args)=>api.sharedTrackerRpc(book.id,method,args),identity:(active,runAs=active)=>{email=active;effective=runAs;},balanced:()=>!locked};
}

test('shared requests isolate data, counters, receipts and identity between workbooks',()=>{
  const h=harness();
  assert.equal(h.call(h.a,'getProject').issues.length,0); assert.equal(h.writes.length,0);
  const a=h.call(h.a,'saveIssue',{summary:'A only',operationId:'same-op'});
  const b=h.call(h.b,'saveIssue',{summary:'B only',operationId:'same-op'});
  assert.equal(a.id,'PRJ-1'); assert.equal(b.id,'PRJ-1');
  assert.equal(h.call(h.a,'saveIssue',{summary:'retry',operationId:'same-op'}).summary,'A only');
  assert.equal(h.call(h.b,'getProject').issues[0].summary,'B only');
  h.call(h.a,'deleteIssue',a.id,a.version);
  assert.equal(h.call(h.a,'saveIssue',{summary:'After deletion'}).id,'PRJ-2');
  assert.equal(h.api.takSharedRequest_,null); assert.ok(h.balanced());
});
test('native sheet entry and the shared app use the same workbook ID high-water mark',()=>{
  const h=harness();
  const first=h.call(h.a,'saveIssue',{summary:'App task'});
  h.call(h.a,'deleteIssue',first.id,first.version);
  h.api.TAK_SHARED_HOST_=false;
  h.api.TAK_SHARED_LAUNCH_URL_='https://script.google.com/macros/s/shared-test/exec';
  h.api.SpreadsheetApp.getActiveSpreadsheet=()=>h.a;
  assert.equal(h.api.withLock_(()=>h.api.nextId_([])),'PRJ-2');
  h.api.TAK_SHARED_HOST_=true;
  assert.equal(h.call(h.a,'saveIssue',{summary:'Next app task'}).id,'PRJ-3');
});
test('shared edit, move, bulk, duplicate/undo and comments preserve normal protections',()=>{
  const h=harness();
  const epic=h.call(h.a,'saveIssue',{summary:'Epic',type:'Epic'});
  let task=h.call(h.a,'saveIssue',{summary:'Task',parentId:epic.id});
  const original=task;
  task=h.call(h.a,'saveIssue',{id:task.id,summary:'Edited'},task.version);
  assert.throws(()=>h.call(h.a,'saveIssue',{id:task.id,summary:'Stale'},original.version),/changed elsewhere/);
  task=h.call(h.a,'moveIssue',task.id,{status:'In Progress',rank:2000},task.version,'move-1');
  const bulk=h.call(h.a,'updateIssuesBatch',[{id:task.id,updates:{priority:'High'},expectedVersion:task.version,operationId:'bulk-1'}]);
  assert.equal(bulk.errors.length,0); task=bulk.items[0].issue;
  const copy=h.call(h.a,'duplicateIssue',task.id,task.version,false,'duplicate-1');
  h.call(h.a,'undoDuplicateIssues','duplicate-1',copy.items.map(i=>({id:i.issue.id,expectedVersion:i.issue.version})),'undo-1');
  const comment=h.call(h.a,'addTaskComment',task.id,'A comment');
  h.call(h.a,'updateTaskComment',comment.id,'Edited comment');
  assert.equal(h.call(h.a,'getTaskComments',task.id)[0].body,'Edited comment');
  assert.equal(h.call(h.b,'getTaskComments',task.id).length,0); assert.ok(h.balanced());
});
test('shared bulk delete dispatches bounded versioned selections and isolates replay by workbook',()=>{
  const h=harness();
  const aParent=h.call(h.a,'saveIssue',{summary:'A parent',type:'Epic'});
  const aChild=h.call(h.a,'saveIssue',{summary:'A child',parentId:aParent.id,dependencies:aParent.id});
  const bTask=h.call(h.b,'saveIssue',{summary:'B task'});
  const items=[aParent,aChild].map(issue=>({id:issue.id,expectedVersion:issue.version}));
  assert.throws(()=>h.call(h.a,'deleteIssuesBatch',items.slice(0,1),'parent-only'),/parent\/dependency/);
  const before=h.writes.length;
  assert.throws(()=>h.call(h.a,'deleteIssuesBatch',[items[0],{...items[1],expectedVersion:'stale'}],'stale-delete'),/changed elsewhere/);
  assert.equal(h.writes.length,before);
  const deleted=h.call(h.a,'deleteIssuesBatch',items,'same-delete-operation');
  assert.deepEqual(Array.from(deleted.deletedIds),items.map(item=>item.id));
  assert.equal(h.call(h.a,'getProject').issues.length,0);
  assert.equal(h.call(h.b,'getProject').issues[0].id,bTask.id);
  const after=h.writes.length;
  const replayed=h.call(h.a,'deleteIssuesBatch',items,'same-delete-operation');
  assert.equal(replayed.replayed,true); assert.equal(h.writes.length,after);
  const bDeleted=h.call(h.b,'deleteIssuesBatch',[{id:bTask.id,expectedVersion:bTask.version}],'same-delete-operation');
  assert.deepEqual(Array.from(bDeleted.deletedIds),[bTask.id]);
  assert.equal(h.call(h.b,'getProject').issues.length,0);
  assert.equal(h.call(h.a,'saveIssue',{summary:'After batch deletion'}).id,'PRJ-3');
  assert.equal(h.api.takSharedRequest_,null); assert.ok(h.balanced());
});
test('shared bulk delete cannot bypass authorization or leave request context after rejection',()=>{
  const h=harness(),task=h.call(h.a,'saveIssue',{summary:'Protected task'});
  const items=[{id:task.id,expectedVersion:task.version}];
  assert.throws(()=>h.api.deleteIssuesBatch(items,'direct-delete'),/No tracker was selected/);
  assert.throws(()=>h.call(h.a,'deleteIssuesBatch',[],'empty-delete'),/1 and 100/);
  h.a.writable=false;
  assert.throws(()=>h.call(h.a,'deleteIssuesBatch',items,'denied-delete'),/Google denied/);
  assert.equal(h.call(h.a,'getProject').issues.length,1);
  assert.equal(h.api.takSharedRequest_,null); assert.ok(h.balanced());
  h.a.writable=true;
  h.call(h.a,'deleteIssuesBatch',items,'denied-delete');
  h.identity('');
  assert.throws(()=>h.call(h.a,'deleteIssuesBatch',items,'denied-delete'),/Sign in/);
  assert.equal(h.api.takSharedRequest_,null); assert.ok(h.balanced());
});
test('shared dispatcher rejects missing access, identity, malformed input and admin methods',()=>{
  const h=harness();
  h.denied.add(h.b.id); assert.throws(()=>h.call(h.b,'getProject'),/cannot access/);
  for(const method of ['setupTracker','configureTrackerEnvironment','configureTrackerRole','loadSampleData','activateVersionedRepository','constructor','__proto__']) assert.throws(()=>h.call(h.a,method),/Unsupported/);
  assert.throws(()=>h.api.sharedTrackerRpc('bad','getProject',[]),/select a tracker/);
  assert.throws(()=>h.api.sharedTrackerRpc(h.a.id,'getProject',{}),/Unsupported/);
  h.identity(''); assert.throws(()=>h.call(h.a,'getProject'),/Sign in/);
  h.identity('someone@example.invalid','owner@example.invalid'); assert.throws(()=>h.call(h.a,'getProject'),/Sign in/);
  assert.equal(h.writes.length,0); assert.equal(h.api.takSharedRequest_,null);
});
test('direct legacy calls cannot bypass the dispatcher, and failed writes clear context',()=>{
  const h=harness();
  for(const call of [()=>h.api.getProject(),()=>h.api.saveIssue({summary:'Bypass'}),()=>h.api.setupTracker(),()=>h.api.configureTrackerEnvironment('production',h.b.id),()=>h.api.configureTrackerRole('x','administrator')]) assert.throws(call,/No tracker was selected/);
  h.a.writable=false; assert.throws(()=>h.call(h.a,'saveIssue',{summary:'Read only'}),/Google denied/);
  assert.equal(h.api.takSharedRequest_,null); assert.ok(h.balanced());
  assert.equal(h.call(h.b,'getProject').issues.length,0);
});
test('shared app rejects changed headers, unprepared sheets and versioned repositories without writes',()=>{
  const h=harness();
  h.a.tabs.Issues.rows[0][0]='Wrong'; assert.throws(()=>h.call(h.a,'getProject'),/different column/);
  h.a.tabs.Issues.rows[0][0]=Core.fields[0].label;
  h.a.tabs._System.rows[2][1]='2'; assert.throws(()=>h.call(h.a,'getProject'),/not been prepared/);
  h.a.tabs._System.rows[2][1]='legacy'; h.a.tabs.Tasks.rows.push(['migrated']); assert.throws(()=>h.call(h.a,'getProject'),/versioned records/);
  assert.equal(h.writes.length,0);
});

test('launcher has an accessible fallback when popups are blocked and never navigates to a copied deployment',()=>{
  const script=fs.readFileSync(require.resolve('../FullScreen.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const status={},link={href:'https://example.invalid/shared?sheet=copy'}; let closed=0,openedUrl='';
  const run=opened=>vm.runInNewContext(script,{document:{getElementById:id=>id==='launch-tracker'?link:status},window:{open(url){openedUrl=url;return opened;}},google:{script:{host:{close(){closed++;}}}}});
  run(null); assert.match(status.textContent,/needs a click/); assert.equal(closed,0); assert.equal(openedUrl,link.href);
  const popup={opener:{}}; run(popup); assert.equal(popup.opener,null); assert.equal(closed,1);
});
