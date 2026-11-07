const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Core = require('../Core.js');

function harness() {
  const properties = new Map([['SPREADSHEET_ID', 'book-v2'], ['SHEETFLOW_ACTIVE_SCHEMA', '2']]);
  const tabs = {};
  const notes = new Map(), reads = [], logs = [];
  let book;
  function makeSheet(name, headers) {
    const rows = [headers.slice()];
    const sheet = {
      getName: () => name,
      getLastRow: () => rows.length,
      getMaxRows: () => 1000,
      deleteRow: row => rows.splice(row - 1, 1),
      getParent: () => book,
      getRange(row, col, height = 1, width = 1) {
        return {
          getValues: () => { reads.push({ name, row, col, height, width }); return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => rows[row - 1 + r]?.[col - 1 + c] ?? '')); },
          setValues(values) { values.forEach((line, r) => { while (rows.length <= row - 1 + r) rows.push(Array(headers.length).fill('')); line.forEach((value, c) => { rows[row - 1 + r][col - 1 + c] = value; }); }); return this; },
          setValue(value) { this.setValues([[value]]); return this; },
          getRow: () => row, getLastRow: () => row + height - 1, getColumn: () => col, getLastColumn: () => col + width - 1,
          getNumRows: () => height, getNumColumns: () => width,
          getSheet: () => sheet,
          setNote(value) { notes.set(`${name}:${row}:${col}`, value); return this; }
        };
      },
      rows
    };
    return sheet;
  }
  const context = vm.createContext({
    Date, console: { log: (...args) => logs.push(args.join(' ')) }, TrackerCore: Core,
    SpreadsheetApp: { openById: () => book, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || '', getProperties: () => Object.fromEntries(properties), setProperty: (key, value) => properties.set(key, String(value)) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (date, zone, format) => format === 'yyyy-MM-dd' ? date.toLocaleDateString('en-CA', { timeZone: zone }) : date.toISOString(),
      parseDate: value => new Date(String(value).length === 10 ? value + 'T00:00:00.000Z' : value),
      DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => crypto.createHash('sha256').update(value).digest(),
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
    }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../Schema.js'), 'utf8'), context);
  Object.keys(context.SheetFlowSchema.tabs).forEach(key => {
    const def = context.SheetFlowSchema.tabs[key]; tabs[def.name] = makeSheet(def.name, def.headers);
  });
  tabs.Issues = makeSheet('Issues', Core.fields.map(field => field.label));
  const system = tabs._System; system.rows.push(['SCHEMA_VERSION', context.SheetFlowSchema.version, new Date()]);
  book = {
    getSheetByName: name => tabs[name] || null,
    getId: () => 'book-v2', getUrl: () => 'https://docs.google.com/spreadsheets/d/book-v2/edit', getName: () => 'Project',
    getSpreadsheetTimeZone: () => 'Europe/Prague'
  };
  vm.runInContext(fs.readFileSync(require.resolve('../Repository.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../Code.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../Ordering.js'), 'utf8'), context);
  return { api: context, tabs, book, properties, notes, reads, logs };
}

function addRecord(sheet, record) {
  const headers = sheet.rows[0];
  sheet.rows.push(headers.map(header => record[header] ?? ''));
}

function assertBrowserValue(value, path = 'response') {
  assert.ok(!(value instanceof Date), `${path} must not contain a Date`);
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  assert.equal(typeof value, 'object', `${path} must contain browser-safe values`);
  Object.entries(value).forEach(([key, child]) => assertBrowserValue(child, `${path}.${key}`));
}

function loadBrowserServices(h) {
  for (const name of ['Settings', 'Comments', 'History']) vm.runInContext(fs.readFileSync(require.resolve(`../${name}.js`), 'utf8'), h.api);
  h.api.SheetFlowSettings.ensure(h.book);
}
function setTime(h, value) {
  const timestamp = Date.parse(value);
  h.api.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
    static [Symbol.hasInstance](value) { return value instanceof Date; }
  };
}

for (const mode of ['versioned', 'personal']) test(`${mode} save, sidebar, and batch create preserve explicit starts and default missing work dates`, () => {
  const h = mode === 'personal' ? personalBatchHarness() : harness();
  if (mode === 'versioned') loadBrowserServices(h);
  else vm.runInContext(fs.readFileSync(require.resolve('../PersonalBatch.js'), 'utf8'), h.api);
  setTime(h, '2026-11-06T23:30:00.000Z');
  const items = Core.types.flatMap(type => [{}, { startDate: '' }, { startDate: '2026-10-20' }].map((dates, index) => ({
    operationId: `date-batch-${type}-${index}`, input: { summary: `${type} ${index}`, type, ...dates }
  })));
  for (const { input, operationId } of items) {
    const saved = h.api.saveIssue({ ...input, operationId: 'save-' + operationId });
    const expected = Object.hasOwn(input, 'startDate') ? input.startDate : input.type === 'Epic' ? '' : '2026-11-07';
    assert.equal(saved.startDate, expected); assert.equal(saved.dueDate, '');
    const edited = h.api.saveIssue({ id: saved.id, summary: 'Edited ' + input.summary, operationId: 'edit-' + operationId }, saved.version);
    assert.equal(edited.startDate, expected);
    const cleared = h.api.saveIssue({ id: saved.id, startDate: '', operationId: 'clear-' + operationId }, edited.version);
    assert.equal(cleared.startDate, '');
  }
  for (const type of Core.types) {
    const quick = h.api.quickCreateIssue('Sidebar ' + type, type, '', 'date-quick-' + type);
    assert.equal(quick.startDate, type === 'Epic' ? '' : '2026-11-07');
  }
  const batch = h.api.createIssuesBatch(items);
  assert.equal(batch.errors.length, 0); assert.equal(batch.items.length, items.length);
  batch.items.forEach(({ index, issue }) => {
    const input = items[index].input;
    assert.equal(issue.startDate, Object.hasOwn(input, 'startDate') ? input.startDate : input.type === 'Epic' ? '' : '2026-11-07');
    assert.equal(issue.dueDate, '');
  });
});

for (const mode of ['legacy', 'versioned', 'personal']) test(`${mode} preserves no activity type through save, reread and ordinary edits`, () => {
  const h = mode === 'personal' ? personalBatchHarness() : harness();
  if (mode !== 'personal') { h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', mode === 'legacy' ? '1' : '2'); loadBrowserServices(h); }
  const saved = h.api.saveIssue({ summary: 'Without activity', taskTypeId: 'none', operationId: 'no-activity-create' });
  assert.equal(saved.taskTypeId, 'none');
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === saved.id).taskTypeId, 'none');
  const edited = h.api.saveIssue({ id: saved.id, summary: 'Still without activity', operationId: 'no-activity-edit' }, saved.version);
  assert.equal(edited.taskTypeId, 'none');
  const restored = h.api.saveIssue({ id: saved.id, taskTypeId: 'data', operationId: 'restore-activity' }, edited.version);
  assert.equal(restored.taskTypeId, 'data');
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === saved.id).taskTypeId, 'data');
});


test('save journal resolves both destinations before writing and preserves existing receipt timestamps', () => {
  const h = harness(); loadBrowserServices(h);
  const calls = [];
  for (const name of ['Change History', '_System']) {
    const sheet = h.tabs[name], getLastRow = sheet.getLastRow, getRange = sheet.getRange;
    sheet.getLastRow = () => { calls.push('read:' + name); return getLastRow(); };
    sheet.getRange = (...args) => {
      const range = getRange(...args), setValues = range.setValues;
      range.setValues = values => { calls.push('write:' + name); return setValues.call(range, values); };
      return range;
    };
  }
  const event = { operationId: 'journal-1', entityId: 'PRJ-1', eventKind: 'created', afterRevision: 'v1' };
  const result = { id: 'PRJ-1', version: 'v1' };
  const systemRows = h.api.readSystemRows_(h.book);
  h.api.SheetFlowHistory.recordAndReceipt(h.book, event, 'journal-1', result, systemRows);
  const firstWrite = calls.findIndex(call => call.startsWith('write:'));
  assert.deepEqual(calls.slice(firstWrite), ['write:Change History', 'write:_System']);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'journal-1').result.version, 'v1');
  assert.equal(h.tabs['Change History'].rows.at(-1)[1], 'journal-1');
  const receiptRow = h.tabs._System.rows.find(row => row[0] === 'IDEMPOTENCY:journal-1');
  const timestamp = receiptRow[2], count = h.tabs._System.rows.length;
  h.api.SheetFlowHistory.receipt(h.book, 'journal-1', { ...result, version: 'v2' });
  assert.equal(h.tabs._System.rows.length, count);
  assert.equal(receiptRow[2], timestamp);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'journal-1').result.version, 'v2');
});

test('journal destination lookup failure writes neither history nor receipt', () => {
  const h = harness(); loadBrowserServices(h);
  const historyCount = h.tabs['Change History'].rows.length, systemCount = h.tabs._System.rows.length;
  h.tabs._System.getLastRow = () => { throw new Error('Destination unavailable'); };
  assert.throws(() => h.api.SheetFlowHistory.recordAndReceipt(h.book, { entityId: 'PRJ-1' }, 'failed-journal', { id: 'PRJ-1' }, []), /Destination unavailable/);
  assert.equal(h.tabs['Change History'].rows.length, historyCount);
  assert.equal(h.tabs._System.rows.length, systemCount);
});

for (const schema of ['1', '2']) test(`schema ${schema} create retry reuses a committed row and start date across midnight after receipt failure`, () => {
  const h = harness(); h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema); loadBrowserServices(h);
  setTime(h, '2026-11-06T23:30:00.000Z');
  const system = h.tabs._System, getRange = system.getRange;
  let failReceipt = true;
  system.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (failReceipt && values.some(row => String(row[0]).startsWith('IDEMPOTENCY:'))) {
        failReceipt = false;
        throw new Error('Receipt write failed');
      }
      return setValues.call(range, values);
    };
    return range;
  };
  const input = { summary: 'One reserved task', operationId: 'reserved-create-' + schema };
  assert.throws(() => h.api.saveIssue(input), /Receipt write failed/);
  const first = h.api.readIssues_(h.book).filter(issue => issue.summary === input.summary);
  assert.equal(first.length, 1, 'the first data write committed');
  assert.equal(first[0].startDate, '2026-11-07');
  setTime(h, '2026-11-07T23:30:00.000Z');
  assert.throws(() => h.api.saveIssue({ ...input, summary: 'Different content' }), /belongs to different create content/);
  const saved = h.api.saveIssue(input);
  assert.equal(saved.id, first[0].id);
  assert.equal(saved.startDate, '2026-11-07');
  assert.equal(h.api.readIssues_(h.book).filter(issue => issue.summary === input.summary).length, 1);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, input.operationId).result.id, saved.id);
  assert.equal(h.tabs['Change History'].rows.filter(row => row[1] === input.operationId).length, 1);
  assert.equal(h.api.saveIssue({ ...input, summary: 'Different content' }).id, saved.id, 'a completed receipt replays the first result');
});

for (const schema of ['1', '2']) test(`schema ${schema} update retry recovers a committed row after receipt failure`, () => {
  const h = harness(); h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema); loadBrowserServices(h);
  const original = h.api.saveIssue({ summary: 'Original title', operationId: 'original-' + schema });
  const system = h.tabs._System, getRange = system.getRange;
  let failReceipt = true;
  system.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (failReceipt && values.some(row => String(row[0]).startsWith('IDEMPOTENCY:'))) {
        failReceipt = false;
        throw new Error('Receipt write failed');
      }
      return setValues.call(range, values);
    };
    return range;
  };
  const input = { id: original.id, summary: 'Edited title', operationId: 'edit-retry-' + schema };
  assert.throws(() => h.api.saveIssue(input, original.version), /Receipt write failed/);
  const committed = h.api.readIssues_(h.book).find(issue => issue.id === original.id);
  assert.equal(committed.summary, 'Edited title');
  assert.notEqual(committed.version, original.version);
  assert.throws(() => h.api.saveIssue({ ...input, summary: 'Different title' }, original.version), /different update content/);
  const recovered = h.api.saveIssue(input, original.version);
  assert.equal(recovered.version, committed.version);
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === original.id).version, committed.version);
  assert.equal(h.tabs['Change History'].rows.filter(row => row[1] === input.operationId).length, 1);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, input.operationId).result.version, committed.version);
});

test('an unconfirmed update never replays over a later saved revision', () => {
  const h = harness(); loadBrowserServices(h);
  const original = h.api.saveIssue({ summary: 'Original', operationId: 'first-create' });
  const system = h.tabs._System, getRange = system.getRange;
  let failReceipt = true;
  system.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (failReceipt && values.some(row => String(row[0]).startsWith('IDEMPOTENCY:'))) {
        failReceipt = false;
        throw new Error('Receipt write failed');
      }
      return setValues.call(range, values);
    };
    return range;
  };
  const first = { id: original.id, summary: 'First update', operationId: 'first-update' };
  assert.throws(() => h.api.saveIssue(first, original.version), /Receipt write failed/);
  const committed = h.api.readIssues_(h.book).find(issue => issue.id === original.id);
  const later = h.api.saveIssue({ id: original.id, summary: 'Later update', operationId: 'later-update' }, committed.version);
  assert.throws(() => h.api.saveIssue(first, original.version), /changed elsewhere/);
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === original.id).version, later.version);
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === original.id).summary, 'Later update');
});

test('move retry recovers a committed status after receipt failure', () => {
  const h = harness(); loadBrowserServices(h);
  const original = h.api.saveIssue({ summary: 'Move target', operationId: 'move-create' });
  const system = h.tabs._System, getRange = system.getRange;
  let failReceipt = true;
  system.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (failReceipt && values.some(row => String(row[0]).startsWith('IDEMPOTENCY:'))) {
        failReceipt = false;
        throw new Error('Receipt write failed');
      }
      return setValues.call(range, values);
    };
    return range;
  };
  const move = { status: 'In Progress', rank: 2000 };
  assert.throws(() => h.api.moveIssue(original.id, move, original.version, 'move-retry'), /Receipt write failed/);
  const committed = h.api.readIssues_(h.book).find(issue => issue.id === original.id);
  assert.equal(committed.status, 'In Progress');
  assert.throws(() => h.api.moveIssue(original.id, { status: 'Done' }, original.version, 'move-retry'), /different update content/);
  const recovered = h.api.moveIssue(original.id, move, original.version, 'move-retry');
  assert.equal(recovered.version, committed.version);
  assert.equal(h.api.readIssues_(h.book).find(issue => issue.id === original.id).version, committed.version);
  assert.equal(h.tabs['Change History'].rows.filter(row => row[1] === 'move-retry').length, 1);
});

test('create reservation failure prevents data writes, and a retry can create once', () => {
  const h = harness(); loadBrowserServices(h);
  const system = h.tabs._System, getRange = system.getRange;
  let rejectReservation = true;
  system.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (rejectReservation && values.some(row => String(row[0]).startsWith('IDEMPOTENCY_PENDING:'))) {
        rejectReservation = false;
        throw new Error('Reservation unavailable');
      }
      return setValues.call(range, values);
    };
    return range;
  };
  const input = { summary: 'Safe retry after reservation failure', operationId: 'reservation-failed' };
  assert.throws(() => h.api.saveIssue(input), /Reservation unavailable/);
  assert.equal(h.api.readIssues_(h.book).length, 0);
  const saved = h.api.saveIssue(input);
  assert.equal(h.api.readIssues_(h.book).filter(issue => issue.id === saved.id).length, 1);
});

for (const schema of ['1', '2']) test(`schema ${schema} reserved create freezes missing starts in book time across midnight and preserves explicit dates`, () => {
  const h = harness(); h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema); loadBrowserServices(h);
  const write = h.api.writeIssue_;
  let failWrite = false, count = 0;
  h.api.writeIssue_ = (...args) => {
    if (failWrite) { failWrite = false; throw new Error('Data write failed'); }
    return write(...args);
  };
  for (const type of Core.types) for (const dates of [{}, { startDate: '' }, { startDate: '2026-10-20' }]) {
    setTime(h, '2026-11-06T23:30:00.000Z'); failWrite = true;
    const input = { summary: 'Reserved ' + type, type, ...dates, operationId: 'write-after-reserve-' + count };
    assert.throws(() => h.api.saveIssue(input), /Data write failed/);
    assert.equal(h.api.readIssues_(h.book).length, count);
    const reservation = h.api.SheetFlowHistory.findCreateReservation(h.book, input.operationId);
    assert.equal(reservation.createdAt, '2026-11-06T23:30:00.000Z');
    setTime(h, '2026-11-07T23:30:00.000Z');
    const saved = h.api.saveIssue(input);
    assert.equal(saved.id, reservation.id); assert.equal(saved.createdAt, reservation.createdAt);
    assert.equal(saved.startDate, Object.hasOwn(dates, 'startDate') ? dates.startDate : type === 'Epic' ? '' : '2026-11-07');
    assert.equal(saved.startDate, reservation.startDate);
    assert.equal(saved.dueDate, '');
    assert.equal(h.api.readIssues_(h.book).length, ++count);
    assert.equal(h.api.saveIssue(input).startDate, saved.startDate);
  }
});

for (const schema of ['1', '2']) test(`schema ${schema} pre-default reservations keep omitted dates blank and respect explicit input`, () => {
  const h = harness(); h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema); loadBrowserServices(h);
  setTime(h, '2026-11-07T23:30:00.000Z');
  let count = 0;
  for (const dates of [{}, { startDate: '' }, { startDate: '2026-10-20' }]) {
    const input = { summary: 'Legacy reserved create', ...dates, operationId: 'legacy-reserve-' + ++count };
    const reservation = { id: 'PRJ-' + count, createdAt: '2026-11-06T23:30:00.000Z', updatedAt: '2026-11-06T23:30:00.000Z', fingerprint: h.api.createIntentFingerprint_(input) };
    h.api.SheetFlowHistory.reserveCreate(h.book, input.operationId, reservation);
    const saved = h.api.saveIssue(input);
    assert.equal(saved.id, reservation.id); assert.equal(saved.createdAt, reservation.createdAt);
    assert.equal(saved.startDate, dates.startDate || '');
    assert.equal(h.api.readIssues_(h.book).length, count);
  }
});

test('a failed history write is recovered once with the create receipt', () => {
  const h = harness(); loadBrowserServices(h);
  const history = h.tabs['Change History'], getRange = history.getRange;
  let failHistory = true;
  history.getRange = (...args) => {
    const range = getRange(...args), setValues = range.setValues;
    range.setValues = values => {
      if (failHistory) { failHistory = false; throw new Error('History write failed'); }
      return setValues.call(range, values);
    };
    return range;
  };
  const input = { summary: 'Recover missing history', operationId: 'history-failed' };
  assert.throws(() => h.api.saveIssue(input), /History write failed/);
  assert.equal(h.api.readIssues_(h.book).length, 1);
  const saved = h.api.saveIssue(input);
  assert.equal(h.api.readIssues_(h.book).length, 1);
  assert.equal(h.tabs['Change History'].rows.filter(row => row[1] === input.operationId).length, 1);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, input.operationId).result.id, saved.id);
});

for (const schema of ['1', '2']) test(`schema ${schema} project payload converts Sheet timestamps and omits internal records`, () => {
  const h = harness(); h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema); loadBrowserServices(h);
  if (schema === '2') addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Active: true, Revision: 1 });
  const task = h.api.saveIssue({ summary: 'Browser transport', startDate: '2026-10-28', dueDate: '2026-10-29' });
  h.api.addTaskComment(task.id, 'A stored comment');
  const project = h.api.getProject();
  assertBrowserValue(project);
  assert.equal(project.issues[0].startDate, '2026-10-28');
  assert.ok(project.issues[0].version);
  assert.equal(Object.keys(project.issues[0]).some(key => key.startsWith('_')), false);
  assert.match(project.settings[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(project.commentsLazy, true);
  assert.deepEqual(Object.keys(project.comments), []);
  assert.match(h.api.getTaskComments(task.id)[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(h.tabs.Settings.rows[1][7] instanceof Date, 'stored timestamps remain native Sheet dates');
  assert.ok(h.tabs.Comments.rows[1][4] instanceof Date);
  if (schema === '2') assert.ok(h.api.readVersionedIssues_(h.book, false)[0]._record['Created At'] instanceof Date);
});

test('v2 mutation, comment, history, and replay results are safe for google.script.run', () => {
  const h = harness(); loadBrowserServices(h);
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Active: true, Revision: 1 });
  let task = h.api.saveIssue({ summary: 'RPC task', operationId: 'rpc-create' });
  assertBrowserValue(task); assert.equal(task._record, undefined);
  assertBrowserValue(h.api.saveIssue({ summary: 'Ignored retry', operationId: 'rpc-create' }));
  task = h.api.moveIssue(task.id, { rank: 2000 }, task.version, 'rpc-move'); assertBrowserValue(task);
  const batch = h.api.updateIssuesBatch([{ id: task.id, expectedVersion: task.version, operationId: 'rpc-bulk', updates: { priority: 'High' } }]);
  assertBrowserValue(batch); task = batch.items[0].issue;
  const duplicate = h.api.duplicateIssue(task.id, task.version, false, 'rpc-copy'); assertBrowserValue(duplicate);
  const copied = duplicate.items[0].issue;
  assert.equal(copied._record, undefined);
  assertBrowserValue(h.api.duplicateIssue(task.id, task.version, false, 'rpc-copy'));
  task = h.api.reorderIssue(task.id, copied.id, task.version); assertBrowserValue(task);
  const comment = h.api.addTaskComment(task.id, 'Initial comment'); assertBrowserValue(comment);
  assertBrowserValue(h.api.updateTaskComment(comment.id, 'Edited comment'));
  assertBrowserValue(h.api.getTaskComments(task.id));
  const archived = h.api.deleteIssue(task.id, task.version); assertBrowserValue(archived);
  assertBrowserValue(h.api.restoreIssue(task.id, archived.version));
  const history = h.api.getTaskHistory(task.id, 50, 0); assertBrowserValue(history);
  assert.match(history.items[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test('v2 repository reads hierarchical issues, writes edits, and supports archive restore', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PRJ-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  addRecord(h.tabs['Projects and Epics'], { ID: 'PRJ-2', 'Entity Kind': 'Epic', 'Project ID': 'PRJ-1', Title: 'Epic', Order: 100, Active: true, Revision: 1, 'Legacy JSON': JSON.stringify({ type: 'Epic', status: 'In Progress', priority: 'High', rank: 100 }) });
  addRecord(h.tabs.Tasks, { ID: 'PRJ-3', Kind: 'Story', 'Task Type ID': 'requirements', 'Project ID': 'PRJ-1', 'Epic ID': 'PRJ-2', Title: 'Story', Status: 'Ready', Priority: 'High', Order: 200, Revision: 1, 'Legacy JSON': JSON.stringify({ type: 'Story', createdAt: '2026-10-01T00:00:00.000Z', rank: 200 }) });
  const initial = h.api.getProject().issues;
  assert.deepEqual(Array.from(initial, issue => issue.type), ['Epic', 'Story']);
  assert.equal(initial[1].parentId, 'PRJ-2');
  assert.equal(initial[1].status, 'To Do');

  const task = h.api.saveIssue({ summary: 'Implementation', type: 'Task', parentId: 'PRJ-3', taskTypeId: 'algo' });
  assert.equal(task.parentId, 'PRJ-3');
  const taskRow = h.tabs.Tasks.rows.find(row => row[0] === task.id);
  const taskHeaders = h.tabs.Tasks.rows[0];
  assert.equal(taskRow[taskHeaders.indexOf('Parent Task ID')], 'PRJ-3');
  assert.equal(taskRow[taskHeaders.indexOf('Epic ID')], 'PRJ-2');
  const updated = h.api.saveIssue({ id: task.id, summary: 'Implementation updated' }, task.version);
  assert.equal(updated.summary, 'Implementation updated');

  const deleted = h.api.deleteIssue(task.id, updated.version);
  assert.equal(deleted.archived, true);
  assert.equal(h.api.getProject().issues.some(issue => issue.id === task.id), false);
  const restored = h.api.restoreIssue(task.id, deleted.version);
  assert.equal(restored.summary, 'Implementation updated');
  assert.equal(h.api.getProject().issues.some(issue => issue.id === task.id), true);
});

test('v2 rollback copies active repository edits back into Issues', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PRJ-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  const task = h.api.saveIssue({ summary: 'Versioned task' });
  assert.equal(h.tabs.Issues.rows.length, 1);
  const result = h.api.deactivateVersionedRepository();
  assert.equal(result.activeRepository, 'legacy');
  assert.equal(h.api.getProject().issues[0].summary, 'Versioned task');
  assert.equal(h.tabs.Issues.rows[1][3], 'Versioned task');
  assert.ok(task.id);
});

test('native edits on the active Tasks tab receive defaults and validation notes', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  const headers = h.tabs.Tasks.rows[0], row = Array(headers.length).fill('');
  row[headers.indexOf('Title')] = 'Direct task';
  h.tabs.Tasks.rows.push(row);
  const titleColumn = headers.indexOf('Title') + 1;
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(2, titleColumn) });
  assert.equal(h.tabs.Tasks.rows[1][headers.indexOf('Kind')], 'Task');
  assert.equal(h.tabs.Tasks.rows[1][headers.indexOf('Status')], 'Backlog');
  assert.equal(h.tabs.Tasks.rows[1][headers.indexOf('Task Type ID')], 'algo');
  assert.match(h.tabs.Tasks.rows[1][headers.indexOf('ID')], /^PRJ-\d+$/);
  const assignedId = h.tabs.Tasks.rows[1][headers.indexOf('ID')];
  h.tabs.Tasks.rows[1][headers.indexOf('ID')] = 'CHANGED-ID';
  const idColumn = headers.indexOf('ID') + 1;
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(2, idColumn) });
  assert.equal(h.tabs.Tasks.rows[1][idColumn - 1], assignedId);
  assert.match(h.notes.get(`Tasks:2:${titleColumn}`), /ID is managed/);
  const statusColumn = headers.indexOf('Status') + 1;
  h.tabs.Tasks.rows[1][statusColumn - 1] = 'Invalid status';
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(2, statusColumn) });
  assert.match(h.notes.get(`Tasks:2:${titleColumn}`), /valid status/);
  assert.equal(h.tabs.Tasks.rows[1][statusColumn - 1], 'Invalid status');
});
test('versioned native creation defaults new work only and leaves existing blanks and Epic dates unchanged', () => {
  const h = harness(); setTime(h, '2026-11-06T23:30:00.000Z');
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Active: true, Revision: 1 });
  const existing = h.api.saveIssue({ summary: 'Existing unscheduled', startDate: '' });
  const existingEpic = h.api.saveIssue({ summary: 'Existing Epic', type: 'Epic' });
  const taskHeaders = h.tabs.Tasks.rows[0], titleColumn = taskHeaders.indexOf('Title') + 1;
  for (const type of ['Task', 'Story', 'Bug']) {
    addRecord(h.tabs.Tasks, { Kind: type === 'Story' ? 'Story' : 'Task', Title: 'Native ' + type, 'Legacy JSON': JSON.stringify({ type }) });
    h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(h.tabs.Tasks.rows.length, titleColumn) });
  }
  addRecord(h.tabs.Tasks, { Kind: 'Task', Title: 'Native scheduled', 'Start Date': '2026-10-20' });
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(2, 1, h.tabs.Tasks.rows.length - 1, taskHeaders.length) });
  const projects = h.tabs['Projects and Epics'], projectHeaders = projects.rows[0];
  addRecord(projects, { 'Entity Kind': 'Epic', Title: 'Native Epic' });
  h.api.handleSheetEdit({ range: projects.getRange(projects.rows.length, projectHeaders.indexOf('Title') + 1) });
  addRecord(projects, { 'Entity Kind': 'Epic', Title: 'Native dated Epic', 'Start Date': '2026-10-20' });
  h.api.handleSheetEdit({ range: projects.getRange(3, 1, projects.rows.length - 2, projectHeaders.length) });
  const issues = h.api.getProject().issues;
  assert.equal(issues.find(issue => issue.id === existing.id).startDate, '');
  assert.equal(issues.find(issue => issue.id === existingEpic.id).startDate, '');
  assert.equal(issues.find(issue => issue.summary === 'Native Epic').startDate, '');
  assert.equal(issues.find(issue => issue.summary === 'Native dated Epic').startDate, '2026-10-20');
  assert.equal(issues.find(issue => issue.summary === 'Native scheduled').startDate, '2026-10-20');
  for (const type of ['Task', 'Story', 'Bug']) {
    const issue = issues.find(issue => issue.summary === 'Native ' + type);
    assert.equal(issue.type, type); assert.equal(issue.startDate, '2026-11-07'); assert.equal(issue.dueDate, '');
  }
  for (let row = 2; row <= h.tabs.Tasks.rows.length; row++) assert.equal(h.notes.get(`Tasks:${row}:${titleColumn}`), '');
  const taskIndex = h.tabs.Tasks.rows.findIndex(row => row[titleColumn - 1] === 'Native Task');
  const dateColumn = taskHeaders.indexOf('Start Date') + 1;
  assert.ok(h.tabs.Tasks.rows[taskIndex][dateColumn - 1] instanceof Date);
  h.tabs.Tasks.rows[taskIndex][dateColumn - 1] = '';
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(taskIndex + 1, dateColumn), oldValue: '2026-11-07' });
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(taskIndex + 1, titleColumn) });
  assert.equal(h.tabs.Tasks.rows[taskIndex][dateColumn - 1], '');
  h.tabs.Tasks.rows[taskIndex][taskHeaders.indexOf('ID')] = '';
  h.api.handleSheetEdit({ range: h.tabs.Tasks.getRange(taskIndex + 1, 1, 1, taskHeaders.length) });
  assert.equal(h.tabs.Tasks.rows[taskIndex][dateColumn - 1], '', 'restoring a managed ID must not turn an old blank into a new default');
});

test('server ordering writes ranks through the active versioned repository', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  const first = h.api.saveIssue({ summary: 'First' });
  const second = h.api.saveIssue({ summary: 'Second' });
  const moved = h.api.reorderIssue(second.id, first.id, second.version);
  assert.equal(moved.id, second.id);
  assert.equal(moved.rank, 1000);
  assert.deepEqual(Array.from(h.api.getProject().issues, issue => issue.summary), ['Second', 'First']);
});

test('bounded bulk updates write every selected record through the active versioned repository', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  const epic = h.api.saveIssue({ summary: 'Epic', type: 'Epic' });
  const task = h.api.saveIssue({ summary: 'Task', parentId: epic.id });
  const result = h.api.updateIssuesBatch([
    { id: epic.id, expectedVersion: epic.version, operationId: 'v2-bulk-1', updates: { status: 'In Progress' } },
    { id: task.id, expectedVersion: task.version, operationId: 'v2-bulk-2', updates: { priority: 'Highest' } }
  ]);
  assert.equal(result.errors.length, 0);
  const issues = h.api.getProject().issues;
  assert.equal(issues.find(issue => issue.id === epic.id).status, 'In Progress');
  assert.equal(issues.find(issue => issue.id === task.id).priority, 'Highest');
  assert.equal(issues.find(issue => issue.id === task.id).parentId, epic.id);
});

test('issue duplication preserves hierarchy through the active versioned repository', () => {
  const h = harness();
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Order: 1, Active: true, Revision: 1 });
  const epic = h.api.saveIssue({ summary: 'Epic', type: 'Epic' });
  const story = h.api.saveIssue({ summary: 'Story', type: 'Story', parentId: epic.id });
  h.api.saveIssue({ summary: 'Task', parentId: story.id });
  const result = h.api.duplicateIssue(epic.id, epic.version, true, 'v2-duplicate-1');
  const issues = h.api.getProject().issues;
  assert.equal(result.items.length, 3);
  assert.equal(issues.find(issue => issue.id === result.items[1].issue.id).parentId, result.rootId);
  assert.equal(issues.find(issue => issue.id === result.items[2].issue.id).parentId, result.items[1].issue.id);
  assert.equal(issues.filter(issue => issue.type === 'Epic').length, 2);
});

function versionedDuplicateUndoFixture() {
  const h = harness(), receipts = new Map(), events = [];
  h.api.SheetFlowHistory = {
    findReceipt: (_, id) => id && receipts.has(id) ? {result:receipts.get(id)} : null,
    receipt: (_, id, result) => { if (id) receipts.set(id,result); }, record: (_, event) => events.push(event)
  };
  addRecord(h.tabs['Projects and Epics'], {ID:'PROJECT-1','Entity Kind':'Project',Title:'Project',Active:true,Revision:1});
  const epic = h.api.saveIssue({summary:'Original epic',type:'Epic'});
  const story = h.api.saveIssue({summary:'Original story',type:'Story',parentId:epic.id});
  h.api.saveIssue({summary:'Original task',parentId:story.id});
  const duplicate = h.api.duplicateIssue(epic.id,epic.version,true,'v2-tree');
  const expected = duplicate.items.map(({issue})=>({id:issue.id,expectedVersion:issue.version}));
  return {...h,duplicate,expected,receipts,events};
}

test('v2 duplicate undo archives the complete copied hierarchy and safely replays', () => {
  const h = versionedDuplicateUndoFixture();
  const result = h.api.undoDuplicateIssues('v2-tree',h.expected,'v2-undo');
  assert.equal(result.archived,true); assert.equal(result.ids.length,3);
  assert.equal(h.api.getProject().issues.length,3);
  const archived = h.api.readVersionedIssues_(h.book,true).filter(issue=>result.ids.includes(issue.id));
  assert.equal(archived.length,3); assert.ok(archived.every(issue=>issue._archivedAt));
  assert.equal(h.events.filter(event=>event.details?.undoDuplicate==='v2-tree' && event.eventKind==='archived').length,3);
  assert.equal(h.api.undoDuplicateIssues('v2-tree',h.expected,'v2-undo'),result);
});

test('failed v2 duplicate undo restores original revisions even after a partially applied write', () => {
  const h = versionedDuplicateUndoFixture(), upsert = h.api.SheetFlowRepository.upsert;
  let calls=0;
  h.api.SheetFlowRepository.upsert = (...args) => { const result=upsert(...args); if (++calls===2) throw new Error('Injected partial write'); return result; };
  assert.throws(()=>h.api.undoDuplicateIssues('v2-tree',h.expected,'v2-retry'), /Written changes were rolled back/);
  assert.equal(h.api.getProject().issues.length,6);
  h.expected.forEach(item=>assert.equal(h.api.getProject().issues.find(issue=>issue.id===item.id).version,item.expectedVersion));
  assert.equal(h.receipts.has('v2-retry'),false);
  h.api.SheetFlowRepository.upsert=upsert;
  assert.equal(h.api.undoDuplicateIssues('v2-tree',h.expected,'v2-retry').ids.length,3);
});

test('duplicate undo uses persisted history receipts after the history service reloads', () => {
  const h = harness(), historySource = fs.readFileSync(require.resolve('../History.js'), 'utf8');
  vm.runInContext(historySource, h.api);
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Active: true, Revision: 1 });
  const source = h.api.saveIssue({ summary: 'Persistent receipt source' });
  const duplicate = h.api.duplicateIssue(source.id, source.version, false, 'persistent-copy');
  const expected = duplicate.items.map(({ issue }) => ({ id: issue.id, expectedVersion: issue.version }));
  const undone = h.api.undoDuplicateIssues('persistent-copy', expected, 'persistent-undo');
  const rows = h.tabs['Change History'].rows.length;
  vm.runInContext(historySource, h.api);
  const replayed = h.api.undoDuplicateIssues('persistent-copy', expected, 'persistent-undo');
  assert.equal(JSON.stringify(replayed), JSON.stringify(undone));
  assert.equal(h.tabs['Change History'].rows.length, rows);
  assert.equal(h.api.getProject().issues.length, 1);
});

function persistedBulkDeleteFixture(schema) {
  const h = harness();
  h.properties.set('SHEETFLOW_ACTIVE_SCHEMA', schema);
  loadBrowserServices(h);
  addRecord(h.tabs['Projects and Epics'], { ID: 'PROJECT-1', 'Entity Kind': 'Project', Title: 'Project', Active: true, Revision: 1 });
  const epic = h.api.saveIssue({ summary: 'Delete epic', type: 'Epic' });
  const story = h.api.saveIssue({ summary: 'Delete story', type: 'Story', parentId: epic.id, taskTypeId: 'data' });
  const task = h.api.saveIssue({ summary: 'Delete task', parentId: story.id, dependencies: epic.id });
  const outside = h.api.saveIssue({ summary: 'Keep task' });
  const items = [epic, story, task].map(issue => ({ id: issue.id, expectedVersion: issue.version }));
  return { ...h, epic, story, task, outside, items };
}

for (const schema of ['legacy', '2']) test(`bulk delete persists schema ${schema} receipts and replays after service reload`, () => {
  const h = persistedBulkDeleteFixture(schema), before = h.tabs['Change History'].rows.length;
  const deleted = h.api.deleteIssuesBatch(h.items, 'persisted-delete');
  assertBrowserValue(deleted);
  assert.deepEqual(Array.from(deleted.deletedIds), h.items.map(item => item.id));
  assert.deepEqual(Array.from(h.api.getProject().issues, issue => issue.id), [h.outside.id]);
  const events = h.tabs['Change History'].rows.slice(before);
  assert.equal(events.length, 3);
  assert.ok(events.every(row => row[4] === (schema === '2' ? 'archived' : 'deleted')));
  if (schema === '2') {
    const archived = h.api.readVersionedIssues_(h.book, true).filter(issue => deleted.deletedIds.includes(issue.id));
    assert.equal(archived.length, 3); assert.ok(archived.every(issue => issue._archivedAt && issue._storageRevision === 2));
    assert.equal(h.tabs.Issues.rows.length, 1, 'legacy storage is untouched');
    assert.equal(h.tabs['Projects and Epics'].rows.find(row => row[0] === 'PROJECT-1')[h.tabs['Projects and Epics'].rows[0].indexOf('Active')], true);
  }
  vm.runInContext(fs.readFileSync(require.resolve('../History.js'), 'utf8'), h.api);
  const replayed = h.api.deleteIssuesBatch(h.items, 'persisted-delete');
  assert.equal(replayed.replayed, true); assertBrowserValue(replayed);
  assert.deepEqual(Array.from(replayed.deletedIds), Array.from(deleted.deletedIds));
  assert.equal(h.tabs['Change History'].rows.length, before + 3);
});

for (const schema of ['legacy', '2']) {
  for (const afterWrite of [false, true]) test(`schema ${schema} bulk delete recovers a ${afterWrite ? 'lost' : 'failed'} completion receipt`, () => {
    const h = persistedBulkDeleteFixture(schema), history = h.api.SheetFlowHistory, receipt = history.receipt;
    const before = h.tabs['Change History'].rows.length;
    let fail = true;
    history.receipt = (...args) => {
      if (args[2].phase === 'complete' && fail) {
        fail = false;
        if (afterWrite) receipt(...args);
        throw new Error('Injected completion receipt failure');
      }
      return receipt(...args);
    };
    assert.throws(() => h.api.deleteIssuesBatch(h.items, 'receipt-delete'), /completion receipt failure/);
    assert.deepEqual(Array.from(h.api.getProject().issues, issue => issue.id), [h.outside.id]);
    vm.runInContext(fs.readFileSync(require.resolve('../History.js'), 'utf8'), h.api);
    const replayed = h.api.deleteIssuesBatch(h.items, 'receipt-delete');
    assert.equal(replayed.replayed, true); assert.equal(replayed.deletedIds.length, 3);
    assert.equal(h.tabs['Change History'].rows.length, before + 3, 'history is not duplicated during journal recovery');
    assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'receipt-delete').result.phase, 'complete');
    assert.equal(h.api.getProject().issues.length, 1);
  });

  test(`schema ${schema} bulk delete recovers a partial journal without duplicate events`, () => {
    const h = persistedBulkDeleteFixture(schema), history = h.api.SheetFlowHistory, record = history.record;
    const before = h.tabs['Change History'].rows.length;
    let calls = 0;
    history.record = (...args) => {
      const result = record(...args);
      if (++calls === 2) throw new Error('Injected journal acknowledgement failure');
      return result;
    };
    assert.throws(() => h.api.deleteIssuesBatch(h.items, 'journal-delete'), /journal acknowledgement failure/);
    assert.equal(h.api.getProject().issues.length, 1);
    assert.equal(h.tabs['Change History'].rows.length, before + 2);
    vm.runInContext(fs.readFileSync(require.resolve('../History.js'), 'utf8'), h.api);
    const replayed = h.api.deleteIssuesBatch(h.items, 'journal-delete');
    assert.equal(replayed.replayed, true);
    const events = h.tabs['Change History'].rows.slice(before);
    assert.equal(events.length, 3);
    assert.equal(new Set(events.map(row => row[3])).size, 3);
  });

  test(`schema ${schema} bulk delete retries a lost intent receipt without touching unrelated work`, () => {
    const h = persistedBulkDeleteFixture(schema), history = h.api.SheetFlowHistory, receipt = history.receipt;
    let fail = true;
    history.receipt = (...args) => {
      const result = receipt(...args);
      if (fail) { fail = false; throw new Error('Intent acknowledgement lost'); }
      return result;
    };
    assert.throws(() => h.api.deleteIssuesBatch(h.items, 'intent-delete'), /Intent acknowledgement lost/);
    assert.equal(h.api.getProject().issues.length, 4);
    assert.throws(() => h.api.deleteIssuesBatch([{ id: h.outside.id, expectedVersion: h.outside.version }], 'intent-delete'), /different operation or delete selection/);
    assert.equal(h.api.deleteIssuesBatch(h.items, 'intent-delete').deletedIds.length, 3);
    assert.equal(h.api.getProject().issues[0].id, h.outside.id);
  });
}

test('v2 bulk delete validates native revisions and external references before archiving', () => {
  const h = persistedBulkDeleteFixture('2');
  h.api.saveIssue({ id: h.outside.id, dependencies: h.task.id }, h.outside.version);
  assert.throws(() => h.api.deleteIssuesBatch(h.items, 'external-v2-delete'), /parent\/dependency/);
  assert.equal(h.api.getProject().issues.length, 4);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'external-v2-delete'), null);
  const taskRow = h.tabs.Tasks.rows.find(row => row[0] === h.task.id);
  taskRow[h.tabs.Tasks.rows[0].indexOf('Title')] = 'Native edit without revision bump';
  assert.throws(() => h.api.deleteIssuesBatch(h.items, 'stale-v2-delete'), /changed elsewhere/);
  assert.equal(h.api.getProject().issues.length, 4);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'stale-v2-delete'), null);
});

test('v2 bulk delete rollback restores full records and revisions after a partially applied archive', () => {
  const h = persistedBulkDeleteFixture('2'), upsert = h.api.SheetFlowRepository.upsert;
  const original = JSON.stringify([h.tabs.Tasks.rows, h.tabs['Projects and Epics'].rows]);
  let calls = 0;
  h.api.SheetFlowRepository.upsert = (...args) => {
    const result = upsert(...args);
    if (++calls === 2) throw new Error('Injected partially applied archive');
    return result;
  };
  assert.throws(() => h.api.deleteIssuesBatch(h.items, 'rollback-v2-delete'), /Written changes were rolled back/);
  assert.equal(JSON.stringify([h.tabs.Tasks.rows, h.tabs['Projects and Epics'].rows]), original);
  assert.equal(h.api.getProject().issues.length, 4);
  h.items.forEach(item => assert.equal(h.api.getProject().issues.find(issue => issue.id === item.id).version, item.expectedVersion));
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book, 'rollback-v2-delete').result.phase, 'pending');
  h.api.SheetFlowRepository.upsert = upsert;
  assert.equal(h.api.deleteIssuesBatch(h.items, 'rollback-v2-delete').deletedIds.length, 3);
});

test('v2 bulk delete recovery does not archive a restored issue with a newer revision', () => {
  const h = persistedBulkDeleteFixture('2'), history = h.api.SheetFlowHistory, receipt = history.receipt;
  history.receipt = (...args) => { if (args[2].phase === 'complete') throw new Error('Completion receipt unavailable'); return receipt(...args); };
  assert.throws(() => h.api.deleteIssuesBatch(h.items, 'restored-v2-delete'), /Completion receipt unavailable/);
  const archived = h.api.readVersionedIssues_(h.book, true).find(issue => issue.id === h.epic.id);
  const restored = h.api.restoreIssue(archived.id, archived.version);
  history.receipt = receipt;
  assert.throws(() => h.api.deleteIssuesBatch(h.items, 'restored-v2-delete'), /changed elsewhere/);
  assert.equal(h.api.getProject().issues.find(issue => issue.id === restored.id).version, restored.version);
});

test('ordinary v2 saves reuse one locked snapshot and verify only the saved row', () => {
  const h = harness(); loadBrowserServices(h);
  addRecord(h.tabs['Projects and Epics'], {ID:'PROJECT-1','Entity Kind':'Project',Title:'Project',Active:true,Revision:1});
  const epic = h.api.saveIssue({summary:'Parent epic',type:'Epic'});
  for (let index = 0; index < 12; index++) h.api.saveIssue({summary:'Existing ' + index,parentId:epic.id});
  h.reads.length = 0;
  const saved = h.api.saveIssue({summary:'Measured save',parentId:epic.id,operationId:'measured-save'});
  const fullTasks = h.reads.filter(read => read.name==='Tasks' && read.row===2 && read.height>1);
  const projectReads = h.reads.filter(read => read.name==='Projects and Epics' && read.row===2);
  const systemReads = h.reads.filter(read => read.name==='_System' && read.row===2);
  const schemaHeaders = h.reads.filter(read => read.row===1 && read.name!=='Issues');
  console.log('V2 save read counts:',JSON.stringify({rangeReads:h.reads.length,taskRegisters:fullTasks.length,projectRegisters:projectReads.length,systemReads:systemReads.length,schemaHeaders:schemaHeaders.length}));
  assert.equal(fullTasks.length,1); assert.equal(projectReads.length,1); assert.equal(systemReads.length,1);
  assert.equal(schemaHeaders.length,Object.keys(h.api.SheetFlowSchema.tabs).length);
  const fresh = h.api.getProject().issues.find(issue=>issue.id===saved.id);
  assert.equal(saved.version,fresh.version);
  h.reads.length=0;
  assert.equal(h.api.saveIssue({summary:'Ignored retry',operationId:'measured-save'}).id,saved.id);
  assert.equal(h.reads.filter(read=>read.name==='Tasks').length,0);
});

test('legacy saves share operational reads and return the persisted task-type revision', () => {
  const h=harness();h.properties.set('SHEETFLOW_ACTIVE_SCHEMA','1');loadBrowserServices(h);
  for(let index=0;index<12;index++)h.api.saveIssue({summary:'Existing '+index});
  h.reads.length=0;
  const saved=h.api.saveIssue({summary:'Mapped category',taskTypeId:'data',operationId:'typed-create'});
  assert.equal(h.reads.filter(read=>read.name==='_System' && read.row===2).length,1);
  assert.equal(h.reads.filter(read=>read.name==='Issues' && read.row===2 && read.height>1).length,1);
  const fresh=h.api.getProject().issues.find(issue=>issue.id===saved.id);
  assert.equal(saved.taskTypeId,'data');assert.equal(saved.version,fresh.version);
  const updated=h.api.saveIssue({id:saved.id,summary:'Still editable',taskTypeId:'algo',operationId:'typed-update'},saved.version);
  assert.equal(updated.taskTypeId,'algo');assert.equal(updated.version,h.api.getProject().issues.find(issue=>issue.id===saved.id).version);
  assert.equal(h.api.saveIssue({summary:'Ignored',operationId:'typed-create'}).id,saved.id);
  assert.equal(h.api.getProject().issues.length,13);
});

test('optimized saves use fresh data on every request and retain v2 workflow metadata', () => {
  const h=harness();
  addRecord(h.tabs['Projects and Epics'],{ID:'PROJECT-1','Entity Kind':'Project',Title:'Project',Active:true,Revision:1});
  let task=h.api.saveIssue({summary:'Initial task',startDate:'2026-10-28',dueDate:'2026-10-29'});
  const headers=h.tabs.Tasks.rows[0],row=h.tabs.Tasks.rows.find(row=>row[0]===task.id);
  row[headers.indexOf('Acceptance Criteria')]='Keep acceptance criteria';row[headers.indexOf('Created By')]='original-creator';row[headers.indexOf('Claimed By')]='existing-claim';
  task=h.api.getProject().issues.find(issue=>issue.id===task.id);
  const updated=h.api.saveIssue({id:task.id,summary:'Updated task'},task.version);
  assert.equal(updated.version,h.api.getProject().issues.find(issue=>issue.id===task.id).version);
  assert.equal(row[headers.indexOf('Acceptance Criteria')],'Keep acceptance criteria');
  assert.equal(row[headers.indexOf('Created By')],'original-creator');assert.equal(row[headers.indexOf('Claimed By')],'existing-claim');
  assert.equal(updated.startDate,'2026-10-28');assert.equal(updated.dueDate,'2026-10-29');
  row[headers.indexOf('Title')]='Changed directly in Sheets';
  assert.throws(()=>h.api.saveIssue({id:task.id,summary:'Stale edit'},updated.version),/changed elsewhere/);
  assert.equal(row[headers.indexOf('Title')],'Changed directly in Sheets');
  const current=h.api.getProject().issues.find(issue=>issue.id===task.id);
  headers[headers.indexOf('Title')]='Broken header';
  assert.throws(()=>h.api.saveIssue({id:task.id,summary:'Unsafe edit'},current.version),/schema is incomplete/);
});

test('project refresh defers comments and an issue fetch returns only its own comments', () => {
  const h=harness();loadBrowserServices(h);
  addRecord(h.tabs['Projects and Epics'],{ID:'PROJECT-1','Entity Kind':'Project',Title:'Project',Active:true,Revision:1});
  const first=h.api.saveIssue({summary:'First task'}),second=h.api.saveIssue({summary:'Second task'});
  h.api.addTaskComment(first.id,'First comment');h.api.addTaskComment(second.id,'Second comment');h.api.addTaskComment('missing-id','Orphan comment');
  h.reads.length=0;
  const project=h.api.getProject();
  assert.equal(h.reads.filter(read=>read.name==='Comments' && read.row===2).length,0);
  assert.equal(project.commentsLazy,true);
  assert.equal(h.api.getTaskComments(first.id)[0].body,'First comment');
  assert.equal(h.api.getTaskComments(second.id)[0].body,'Second comment');
  assert.equal(project.comments['missing-id'],undefined);assertBrowserValue(project);
});

function personalBatchHarness() {
  const h=harness(); loadBrowserServices(h);
  vm.runInContext(fs.readFileSync(require.resolve('../Environment.js'),'utf8'),h.api);
  h.properties.set('SHEETFLOW_MODE','personal');
  const calls=[],batchReads=[]; let failBefore=false,lostAfter=false,splitResponse=false;
  const sheets=Object.values(h.tabs);
  sheets.forEach((sheet,index)=> { sheet.getSheetId=()=>index; });
  const originalFormat=h.api.Utilities.formatDate;
  h.api.Utilities.formatDate=(date,zone,format)=>format==="yyyy-MM-dd'T'HH:mm:ss.SSS" ? date.toISOString().slice(0,-1) : originalFormat(date,zone,format);
  h.api.Utilities.parseDate=value=>new Date(value.length===10 ? value+'T00:00:00Z' : value.endsWith('Z') ? value : value+'Z');
  h.api.Sheets={Spreadsheets:{Values:{batchGet(id,options) {
    batchReads.push(options);
    assert.equal(id,h.book.getId());assert.equal(options.ranges.length,2);
    return {valueRanges:['Issues','_System'].map(name=>{
      const sheet=h.tabs[name];
      return {values:sheet.rows.map(row=>row.map(value=>value instanceof Date ? value.getTime()/86400000+25569 : value))};
    })};
  }},batchUpdate(request,id) {
    calls.push(request); assert.equal(id,h.book.getId());
    if(failBefore) {failBefore=false;throw new Error('Batch rejected');}
    const taskRows=[];
    for(const entry of request.requests) {
      if(entry.appendDimension || entry.repeatCell) continue;
      const change=entry.updateCells, sheet=sheets[change.start.sheetId],rowIndex=change.start.rowIndex;
      while(sheet.rows.length<=rowIndex)sheet.rows.push([]);
      change.rows[0].values.forEach((cell,column)=> {
        const value=cell.userEnteredValue;
        let stored=value.stringValue ?? value.numberValue ?? '';
        const kind=sheet===h.tabs.Issues ? Core.fields[column]?.kind : column===2 ? 'timestamp' : '';
        if(typeof stored==='number' && ['date','timestamp'].includes(kind))stored=new Date(Math.round((stored-25569)*86400000));
        sheet.rows[rowIndex][column]=stored;
      });
      if(sheet===h.tabs.Issues) taskRows.push({startRow:rowIndex,rowData:[{values:change.rows[0].values.map(cell=>({effectiveValue:cell.userEnteredValue}))}]});
    }
    if(lostAfter){lostAfter=false;throw new Error('Acknowledgement lost');}
    const firstRow=Math.min(...taskRows.map(row=>row.startRow)),lastRow=Math.max(...taskRows.map(row=>row.startRow));
    const data=splitResponse ? taskRows : [{startRow:firstRow,rowData:Array.from({length:lastRow-firstRow+1},(_,offset)=>taskRows.find(row=>row.startRow===firstRow+offset)?.rowData[0]||{})}];
    return {updatedSpreadsheet:{sheets:[{properties:{sheetId:h.tabs.Issues.getSheetId()},data}]}};
  }}};
  h.api.SpreadsheetApp.flush=()=>{throw new Error('Batched personal save must not flush SpreadsheetApp');};
  return {...h,calls,batchReads,fail:()=>{failBefore=true;},loseAcknowledgement:()=>{lostAfter=true;},splitResponse:()=>{splitResponse=true;}};
}

test('personal batch saves native dates and literal text with category and receipt in one request', () => {
  const h=personalBatchHarness();
  const saved=h.api.saveIssue({summary:'=literal task',description:'+literal detail',taskTypeId:'data',startDate:'2026-10-28',dueDate:'2026-10-29',operationId:'personal-create'});
  assert.equal(h.calls.length,1);
  const stored=h.api.getProject().issues[0];
  assert.equal(stored.version,saved.version);
  assert.equal(stored.summary,'=literal task');assert.equal(stored.description,'+literal detail');
  assert.equal(stored.startDate,'2026-10-28');assert.equal(stored.taskTypeId,'data');
  assert.ok(h.tabs.Issues.rows[1][9] instanceof Date);assert.ok(h.tabs.Issues.rows[1][18] instanceof Date);
  assert.equal(h.tabs['Change History'].rows.length,1);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,'personal-create').result.version,saved.version);
  const updated=h.api.saveIssue({id:saved.id,summary:'Updated',dueDate:'',operationId:'personal-update'},saved.version);
  assert.equal(h.calls.length,2);assert.equal(h.api.getProject().issues[0].version,updated.version);
  assert.equal(h.api.getProject().issues[0].dueDate,'');
  assert.throws(()=>h.api.saveIssue({id:saved.id,summary:'Stale',operationId:'stale'},saved.version),/changed elsewhere/);
  assert.equal(h.calls.length,2);
});

test('a lost personal batch acknowledgement replays its original start date across midnight without another write', () => {
  const h=personalBatchHarness();setTime(h,'2026-11-06T23:30:00.000Z');h.loseAcknowledgement();
  const input={summary:'One task',operationId:'personal-lost'};
  assert.throws(()=>h.api.saveIssue(input),/Acknowledgement lost/);
  setTime(h,'2026-11-07T23:30:00.000Z');
  const saved=h.api.saveIssue(input);
  assert.equal(h.calls.length,1);assert.equal(h.api.getProject().issues.length,1);
  assert.equal(saved.id,h.tabs.Issues.rows[1][0]);
  assert.equal(saved.startDate,'2026-11-07');
});

test('a rejected personal batch leaves neither task nor receipt and a retry can create once', () => {
  const h=personalBatchHarness();h.fail();
  const input={summary:'Retry rejection',operationId:'personal-rejected'};
  assert.throws(()=>h.api.saveIssue(input),/Batch rejected/);
  assert.equal(h.tabs.Issues.rows.length,1);assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,input.operationId),null);
  const saved=h.api.saveIssue(input);
  assert.equal(h.api.getProject().issues.length,1);assert.equal(h.calls.length,2);
  assert.equal(h.api.saveIssue(input).id,saved.id);assert.equal(h.calls.length,2);
});

test('personal mode suppresses all detailed history and switching to team resumes it', () => {
  const h=personalBatchHarness();
  h.api.SheetFlowHistory.record(h.book,{entityId:'PRJ-1',eventKind:'direct_edit'});
  assert.equal(h.tabs['Change History'].rows.length,1);
  h.properties.set('SHEETFLOW_MODE','team');
  h.api.SheetFlowHistory.record(h.book,{entityId:'PRJ-1',eventKind:'direct_edit'});
  assert.equal(h.tabs['Change History'].rows.length,2);
});

test('personal batched reads detect native edits and header damage on the next save', () => {
  const h=personalBatchHarness();
  const saved=h.api.saveIssue({summary:'Original',operationId:'personal-native'});
  h.tabs.Issues.rows[1][3]='Edited in Sheets';
  assert.throws(()=>h.api.saveIssue({id:saved.id,summary:'Stale',operationId:'personal-stale'},saved.version),/changed elsewhere/);
  const latest=h.api.getProject().issues[0];
  h.tabs.Issues.rows[0][3]='Broken summary header';
  assert.throws(()=>h.api.saveIssue({id:saved.id,summary:'Unsafe',operationId:'personal-header'},latest.version),/different column headers/);
  assert.equal(h.calls.length,1);
});

test('personal legacy batch creation falls back to the standard writer when its batch module is unavailable', () => {
  const h=personalBatchHarness();h.api.SpreadsheetApp.flush=()=>{};
  const result=h.api.createIssuesBatch([
    {operationId:'personal-list-1',input:{summary:'List first'}},
    {operationId:'personal-list-2',input:{summary:'List second',taskTypeId:'data'}}
  ]);
  assert.equal(result.errors.length,0);assert.equal(result.items.length,2);
  assert.equal(h.calls.length,0);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,'personal-list-1').result.id,result.items[0].issue.id);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,'personal-list-2').result.id,result.items[1].issue.id);
  assert.equal(h.tabs['Change History'].rows.length,1);
  assert.equal(h.api.saveIssue({summary:'Editor call without operation ID'}).summary,'Editor call without operation ID');
});

test('warm personal metadata avoids workbook opening while native edits remain fresh', () => {
  const h=personalBatchHarness(), entries=new Map();
  h.api.CacheService={getScriptCache:()=>({get:key=>entries.get(key)||null,put:(key,value,ttl)=>{assert.equal(ttl,30);entries.set(key,value);},remove:key=>entries.delete(key)})};
  const saved=h.api.saveIssue({summary:'Cached metadata only',operationId:'cache-first'});
  assert.equal(entries.size,1);
  const open=h.api.SpreadsheetApp.openById;
  h.api.SpreadsheetApp.openById=()=>{throw new Error('Warm metadata must not reopen the workbook');};
  h.tabs.Issues.rows[1][3]='Native edit while metadata is warm';
  assert.throws(()=>h.api.saveIssue({id:saved.id,summary:'Stale',operationId:'cache-stale'},saved.version),/changed elsewhere/);
  const second=h.api.saveIssue({summary:'A new task sees fresh rows',operationId:'cache-second'});
  assert.notEqual(second.id,saved.id);assert.equal(h.tabs.Issues.rows.length,3);
  h.api.SpreadsheetApp.openById=open;
  assert.equal(h.api.getProject().issues[0].summary,'Native edit while metadata is warm');
});

test('personal metadata refresh follows geometry changes and write failures invalidate cached references', () => {
  const h=personalBatchHarness(),entries=new Map();
  h.api.CacheService={getScriptCache:()=>({get:key=>entries.get(key)||null,put:(key,value)=>entries.set(key,value),remove:key=>entries.delete(key)})};
  h.api.saveIssue({summary:'Prime metadata',operationId:'meta-prime'});
  h.tabs.Issues.getMaxRows=()=>1500;
  h.api.getProject();
  assert.equal(JSON.parse(entries.values().next().value).sheets.Issues.rowCount,1500);
  h.fail();
  assert.throws(()=>h.api.saveIssue({summary:'Rejected write',operationId:'meta-failed'}),/Batch rejected/);
  assert.equal(entries.size,0);
  const saved=h.api.saveIssue({summary:'Retry after invalidation',operationId:'meta-failed'});
  assert.ok(saved.id);assert.equal(entries.size,1);
});

function runPersonalCreateBatch(h,items) {
  vm.runInContext(fs.readFileSync(require.resolve('../PersonalBatch.js'),'utf8'),h.api);
  const request=h.api.saveRequestContext_(),book=h.api.readPersonalSaveBook_(request.config);
  return h.api.createPersonalIssuesBatch_(book,items,request);
}

test('personal create batch reads once and atomically writes accepted items with distinct rows and receipts', () => {
  const h=personalBatchHarness();
  const epic=h.api.saveIssue({summary:'Parent Epic',type:'Epic',operationId:'batch-epic'});
  h.calls.length=0;h.batchReads.length=0;
  const getProperties=h.api.PropertiesService.getScriptProperties;let reservations=0;
  h.api.PropertiesService.getScriptProperties=()=>{
    const props=getProperties();return {...props,setProperty(key,value){if(key==='LAST_ISSUE_NUMBER')reservations++;return props.setProperty(key,value);}};
  };
  const result=runPersonalCreateBatch(h,[
    {operationId:'batch-story',input:{summary:'New Story',type:'Story',parentId:epic.id,taskTypeId:'data'}},
    {operationId:'batch-invalid',input:{summary:'',parentId:epic.id}},
    {operationId:'batch-task',input:{summary:'New Task',parentId:epic.id,taskTypeId:'bug'}},
    {operationId:'batch-story',input:{summary:'Duplicate operation'}},
    {operationId:'batch-edit',input:{id:epic.id,summary:'Not a create'}}
  ]);
  assert.equal(h.batchReads.length,1);assert.equal(h.calls.length,1);assert.equal(reservations,1);
  assert.deepEqual(Array.from(result.items,item=>item.index),[0,2]);
  assert.deepEqual(Array.from(result.errors,error=>error.index),[1,3,4]);
  assert.deepEqual(Array.from(result.items,item=>item.issue.id),['PRJ-2','PRJ-4']);
  const project=h.api.getProject();assert.equal(project.issues.length,3);
  for(const item of result.items) {
    const stored=project.issues.find(issue=>issue.id===item.issue.id);
    assert.equal(stored.version,item.issue.version);assert.equal(stored.parentId,epic.id);
    assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,item.index===0?'batch-story':'batch-task').result.id,item.issue.id);
  }
  assert.equal(project.issues.find(issue=>issue.id==='PRJ-2').taskTypeId,'data');
  assert.equal(project.issues.find(issue=>issue.id==='PRJ-4').taskTypeId,'bug');
  assert.equal(h.properties.get('LAST_ISSUE_NUMBER'),'4');
  assert.equal(h.tabs['Change History'].rows.length,1);
});

test('personal create batch replays original starts across midnight after a lost acknowledgement without rewriting', () => {
  const h=personalBatchHarness(),items=[1,2].map(n=>({operationId:`lost-batch-${n}`,input:{summary:`Task ${n}`}}));
  setTime(h,'2026-11-06T23:30:00.000Z');
  h.loseAcknowledgement();
  assert.throws(()=>runPersonalCreateBatch(h,items),/Acknowledgement lost/);
  assert.equal(h.calls.length,1);assert.equal(h.tabs.Issues.rows.length,3);
  setTime(h,'2026-11-07T23:30:00.000Z');
  const replay=runPersonalCreateBatch(h,items);
  assert.equal(replay.errors.length,0);assert.equal(replay.items.length,2);assert.equal(h.calls.length,1);
  assert.deepEqual(Array.from(replay.items,item=>item.issue.id),['PRJ-1','PRJ-2']);
  assert.deepEqual(Array.from(replay.items,item=>item.issue.startDate),['2026-11-07','2026-11-07']);
  const mixed=runPersonalCreateBatch(h,[items[0],{operationId:'mixed-new',input:{summary:'Third task'}}]);
  assert.deepEqual(Array.from(mixed.items,item=>item.issue.id),['PRJ-1','PRJ-3']);
  assert.deepEqual(Array.from(mixed.items,item=>item.issue.startDate),['2026-11-07','2026-11-08']);
  assert.equal(h.calls.length,2);assert.equal(h.api.getProject().issues.length,3);
});

test('a rejected personal create batch leaves all task and receipt rows unwritten and never reuses reserved IDs', () => {
  const h=personalBatchHarness(),items=[1,2].map(n=>({operationId:`rejected-batch-${n}`,input:{summary:`Task ${n}`}}));
  h.fail();assert.throws(()=>runPersonalCreateBatch(h,items),/Batch rejected/);
  assert.equal(h.tabs.Issues.rows.length,1);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,items[0].operationId),null);
  assert.equal(h.api.SheetFlowHistory.findReceipt(h.book,items[1].operationId),null);
  const retry=runPersonalCreateBatch(h,items);
  assert.deepEqual(Array.from(retry.items,item=>item.issue.id),['PRJ-3','PRJ-4']);
  assert.equal(h.calls.length,2);assert.equal(h.api.getProject().issues.length,2);
});

test('personal batch verifies written rows across separate GridData segments and expands each grid only once', () => {
  const h=personalBatchHarness();h.splitResponse();
  const entries=new Map();
  h.api.CacheService={getScriptCache:()=>({get:key=>entries.get(key)||null,put:(key,value)=>entries.set(key,value),remove:key=>entries.delete(key)})};
  h.tabs.Issues.getMaxRows=()=>1;h.tabs._System.getMaxRows=()=>2;
  const result=runPersonalCreateBatch(h,[1,2,3].map(n=>({operationId:`segmented-${n}`,input:{summary:`Task ${n}`,taskTypeId:'data'}})));
  assert.equal(result.items.length,3);assert.equal(h.calls.length,1);
  const growth=h.calls[0].requests.filter(request=>request.appendDimension);
  assert.equal(growth.filter(request=>request.appendDimension.sheetId===h.tabs.Issues.getSheetId()).length,1);
  assert.equal(growth.filter(request=>request.appendDimension.sheetId===h.tabs._System.getSheetId()).length,1);
  assert.equal(entries.size,0,'grid growth invalidates cached capacities before the next request');
  assert.equal(new Set(h.tabs._System.rows.filter(row=>String(row[0]).startsWith('IDEMPOTENCY:')).map(row=>row[0])).size,3);
});

test('public personal batch dispatch uses one API write and advertises support only for the personal legacy path', () => {
  const h=personalBatchHarness();
  vm.runInContext(fs.readFileSync(require.resolve('../PersonalBatch.js'),'utf8'),h.api);
  const result=h.api.createIssuesBatch([1,2].map(n=>({operationId:`public-personal-${n}`,input:{summary:`Public task ${n}`}})));
  assert.equal(result.items.length,2);assert.equal(result.errors.length,0);
  assert.equal(h.batchReads.length,1);assert.equal(h.calls.length,1);
  assert.equal(h.api.getProject().quickBatchCreate,true);
  h.properties.set('SHEETFLOW_MODE','team');h.api.SpreadsheetApp.flush=()=>{};
  const team=h.api.createIssuesBatch([{operationId:'team-fallback',input:{summary:'Team task'}}]);
  assert.equal(team.items.length,1);assert.equal(h.calls.length,1);
  assert.equal(h.api.getProject().quickBatchCreate,false);
});

test('personal save uses one fresh property snapshot including authorization and observes enforcement changes', () => {
  const h=personalBatchHarness();
  vm.runInContext(fs.readFileSync(require.resolve('../Authorization.js'),'utf8'),h.api);
  h.api.Session={getActiveUser:()=>({getEmail:()=> 'viewer@example.com'})};
  let snapshots=0,propertyReads=0;
  const getProperties=h.api.PropertiesService.getScriptProperties;
  h.api.PropertiesService.getScriptProperties=()=>{
    const props=getProperties();return {...props,getProperties(){snapshots++;return props.getProperties();},getProperty(key){propertyReads++;return props.getProperty(key);}};
  };
  h.api.saveIssue({summary:'One property snapshot',operationId:'single-snapshot'});
  assert.equal(snapshots,1);assert.equal(propertyReads,0);
  h.properties.set('SHEETFLOW_AUTH_ENFORCED','true');h.properties.set('SHEETFLOW_ROLE_viewer@example.com','viewer');
  assert.throws(()=>h.api.saveIssue({summary:'Forbidden next request',operationId:'enforced-next'}),/AUTH_FORBIDDEN/);
  assert.equal(snapshots,2);assert.equal(propertyReads,0);
});
