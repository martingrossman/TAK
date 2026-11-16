const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const C = require('../Core.js');

function fakeSheet(name, rows) {
  const formats = [];
  const sheet = {
    rows, formats, frozen: 0,
    getName: () => name,
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    setFrozenRows: count => { sheet.frozen = count; },
    deleteRow: row => { rows.splice(row - 1, 1); },
    getRange: (row, column, height = 1, width = 1) => {
      const range = {
        getValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => rows[row - 1 + r]?.[column - 1 + c] ?? '')),
        setValues: values => { values.forEach((line, r) => line.forEach((value, c) => { rows[row - 1 + r] ||= []; rows[row - 1 + r][column - 1 + c] = value; })); return range; },
        setNumberFormat: format => { formats.push({ row, height, format }); return range; },
        setFontWeight: () => range
      };
      return range;
    }
  };
  return sheet;
}

function harness() {
  const issues = fakeSheet('Issues', [C.fields.map(field => field.label)]);
  const sheets = new Map([['Issues', issues]]);
  const book = {
    getSheetByName: name => sheets.get(name) || null,
    insertSheet: name => { const sheet = fakeSheet(name, []); sheets.set(name, sheet); return sheet; },
    getId: () => 'book-1', getUrl: () => 'https://example.invalid/book-1', getSpreadsheetTimeZone: () => 'Europe/Prague'
  };
  const props = new Map([['SPREADSHEET_ID', 'book-1']]);
  let locks = 0, releases = 0;
  const context = vm.createContext({
    Date, console, TrackerCore: C,
    SpreadsheetApp: { openById: () => book, flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), getProperties: () => Object.fromEntries(props), setProperty: (key, value) => props.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => locks++, releaseLock: () => releases++ }) },
    Utilities: {
      formatDate: (date, zone) => date.toLocaleDateString('en-CA', { timeZone: zone }),
      DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => crypto.createHash('sha256').update(value).digest(), base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
    }
  });
  for (const file of ['Code.js', 'Roadmap.js']) vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), context);
  return { api: context, book, sheets, issues, balanced: () => locks === releases };
}

test('an empty tracker reads an empty roadmap without creating a tab', () => {
  const h = harness();
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.getRoadmap())), { items: [] });
  assert.equal(h.sheets.has('Roadmap'), false);
  assert.ok(h.balanced());
});

test('the first save creates the Roadmap tab with text-formatted columns and leaves task rows untouched', () => {
  const h = harness(), before = JSON.stringify(h.issues.rows);
  const stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'rose' }, '');
  assert.equal(stream.id, 'RM-1');
  assert.equal(stream.order, 1);
  assert.equal(stream.version, '1');
  const tab = h.sheets.get('Roadmap');
  assert.deepEqual(tab.rows[0], ['ID', 'Type', 'Stream ID', 'Title', 'Start Date', 'End Date', 'Color', 'Notes', 'Order', 'Revision', 'Updated At', 'Icon', 'Line']);
  assert.equal(tab.frozen, 1);
  assert.ok(tab.formats.some(entry => entry.format === '@'));
  assert.equal(JSON.stringify(h.issues.rows), before);
  const second = h.api.saveRoadmapItem({ type: 'Stream', title: 'Web', color: 'teal' }, '');
  assert.equal(second.order, 2);
  assert.ok(h.balanced());
});

test('increments and milestones are validated against existing streams and dates', () => {
  const h = harness(), stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'indigo' }, '');
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Increment', title: 'App', streamId: 'RM-99', startDate: '2026-01-05', endDate: '2026-02-01' }, ''), /Choose the stream/);
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Increment', title: 'App', streamId: stream.id, startDate: '2026-03-05', endDate: '2026-02-01' }, ''), /end date must be on or after/);
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Increment', title: '', streamId: stream.id, startDate: '2026-01-05', endDate: '2026-02-01' }, ''), /title/);
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Stream', title: 'Bad', color: '#ff0000' }, ''), /stream colours/);
  const increment = h.api.saveRoadmapItem({ type: 'Increment', title: 'iOS app', streamId: stream.id, startDate: '2026-01-05', endDate: '2026-02-28', color: 'ignored' }, '');
  assert.equal(increment.color, '');
  const milestone = h.api.saveRoadmapItem({ type: 'Milestone', title: 'Launch', startDate: '2026-05-02', endDate: '2026-06-01' }, '');
  assert.equal(milestone.endDate, '2026-05-02');
  assert.equal(milestone.streamId, '');
  assert.equal(h.api.getRoadmap().items.length, 3);
  assert.ok(h.balanced());
});

test('stale versions are rejected and accepted edits increase the revision', () => {
  const h = harness(), stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'indigo' }, '');
  const renamed = h.api.saveRoadmapItem({ id: stream.id, title: 'Mobile apps' }, stream.version);
  assert.equal(renamed.version, '2');
  assert.equal(renamed.title, 'Mobile apps');
  assert.throws(() => h.api.saveRoadmapItem({ id: stream.id, title: 'Old tab edit' }, stream.version), /changed elsewhere/);
  assert.throws(() => h.api.saveRoadmapItem({ id: stream.id, type: 'Increment' }, renamed.version), /cannot change its type/);
  assert.throws(() => h.api.saveRoadmapItem({ id: 'RM-404', title: 'Gone' }, '1'), /no longer exists/);
  assert.equal(h.api.getRoadmap().items[0].title, 'Mobile apps');
  assert.ok(h.balanced());
});

test('deleting keeps streams with items and checks the version', () => {
  const h = harness(), stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'indigo' }, '');
  const increment = h.api.saveRoadmapItem({ type: 'Increment', title: 'App', streamId: stream.id, startDate: '2026-01-05', endDate: '2026-02-01' }, '');
  assert.throws(() => h.api.deleteRoadmapItem(stream.id, stream.version), /before deleting the stream/);
  assert.throws(() => h.api.deleteRoadmapItem(increment.id, '7'), /changed elsewhere/);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.deleteRoadmapItem(increment.id, increment.version))), { id: increment.id, deleted: true });
  h.api.deleteRoadmapItem(stream.id, stream.version);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.getRoadmap())), { items: [] });
  assert.throws(() => h.api.deleteRoadmapItem(stream.id, '1'), /no longer exists/);
  assert.ok(h.balanced());
});

test('a Roadmap tab with other headers is never overwritten', () => {
  const h = harness();
  h.sheets.set('Roadmap', fakeSheet('Roadmap', [['Something', 'Else']]));
  assert.throws(() => h.api.getRoadmap(), /different column headers/);
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'indigo' }, ''), /different column headers/);
  assert.deepEqual(h.sheets.get('Roadmap').rows, [['Something', 'Else']]);
  assert.ok(h.balanced());
});

test('dates typed into the sheet as real dates are read back as ISO days', () => {
  const h = harness(), stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'indigo' }, '');
  h.api.saveRoadmapItem({ type: 'Milestone', title: 'Launch', streamId: stream.id, startDate: '2026-05-02' }, '');
  h.sheets.get('Roadmap').rows[2][4] = new Date('2026-06-10T10:00:00Z');
  assert.equal(h.api.getRoadmap().items[1].startDate, '2026-06-10');
});

test('the browser sample roadmap is valid', () => {
  const items = C.roadmapSample(2026);
  for (const item of items) C.validateRoadmapItem(C.prepareRoadmapItem(item, null), items);
  assert.equal(items.filter(item => item.type === 'Stream').length, 5);
  assert.ok(items.every(item => item.type !== 'Increment' || item.startDate.startsWith('2026')));
});

test('milestones keep an icon, a colour and a line setting; other types cannot carry them', () => {
  const h = harness(), stream = h.api.saveRoadmapItem({ type: 'Stream', title: 'Mobile', color: 'rose' }, '');
  const launch = h.api.saveRoadmapItem({ type: 'Milestone', title: 'Launch', startDate: '2026-05-02', icon: 'star', color: 'amber', line: true }, '');
  assert.equal(launch.icon, 'star');
  assert.equal(launch.color, 'amber');
  assert.equal(launch.line, true);
  const row = h.sheets.get('Roadmap').rows[2];
  assert.equal(row[11], 'star');
  assert.equal(row[12], 'TRUE');
  const plain = h.api.saveRoadmapItem({ id: launch.id, icon: 'diamond', color: '', line: false }, launch.version);
  assert.deepEqual([plain.icon, plain.color, plain.line], ['', '', false]);
  assert.equal(h.sheets.get('Roadmap').rows[2][12], '');
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Milestone', title: 'Bad', startDate: '2026-05-02', icon: 'rocket' }, ''), /milestone icons/);
  assert.throws(() => h.api.saveRoadmapItem({ type: 'Milestone', title: 'Bad', startDate: '2026-05-02', color: '#00ff00' }, ''), /milestone colours/);
  const bar = h.api.saveRoadmapItem({ type: 'Increment', title: 'App', streamId: stream.id, startDate: '2026-01-05', endDate: '2026-02-01', icon: 'star', color: 'teal', line: true }, '');
  assert.deepEqual([bar.icon, bar.color, bar.line], ['', '', false]);
  const renamed = h.api.saveRoadmapItem({ id: stream.id, icon: 'star', line: true }, stream.version);
  assert.deepEqual([renamed.icon, renamed.line, renamed.color], ['', false, 'rose']);
  assert.ok(h.balanced());
});

test('a Roadmap tab from before milestone styling is read as is and gains the new columns on the next save', () => {
  const h = harness(), legacy = ['ID', 'Type', 'Stream ID', 'Title', 'Start Date', 'End Date', 'Color', 'Notes', 'Order', 'Revision', 'Updated At'];
  h.sheets.set('Roadmap', fakeSheet('Roadmap', [legacy.slice(), ['RM-1', 'Milestone', '', 'Beta', '2026-02-15', '2026-02-15', '', '', '0', '1', '2026-11-01T00:00:00Z']]));
  const read = h.api.getRoadmap().items;
  assert.equal(read.length, 1);
  assert.deepEqual([read[0].icon, read[0].line], ['', false]);
  assert.equal(h.sheets.get('Roadmap').rows[0].length, 11);
  h.api.saveRoadmapItem({ id: 'RM-1', icon: 'flag', line: true }, '1');
  const tab = h.sheets.get('Roadmap');
  assert.deepEqual(tab.rows[0], [...legacy, 'Icon', 'Line']);
  assert.deepEqual(tab.rows[1].slice(11), ['flag', 'TRUE']);
  assert.equal(h.api.getRoadmap().items[0].icon, 'flag');
  assert.ok(h.balanced());
});
