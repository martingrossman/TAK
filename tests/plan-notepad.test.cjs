const { test } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const C = require('../Core.js');

const epic = { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Existing epic', version: 'v1' };
const options = { today: '2026-11-07', issues: [epic], assignees: ['Martin Novak', 'Alex Chen', 'Alex Morgan'] };

test('notepad resolves a new Epic, existing people, and inclusive workdays', () => {
  const rows = C.parseNotepad('Epic: Launch\nStory: Prepare release #Launch @Martin +5d !high\nTask: Verify #"Existing epic" +2w', options);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].type, 'Epic');
  assert.equal(rows[1].parentRef, rows[0].key);
  assert.deepEqual(rows[1].errors, []);
  assert.equal(rows[1].fields.summary, 'Prepare release');
  assert.deepEqual({ assignee: rows[1].fields.assignee, priority: rows[1].fields.priority, startDate: rows[1].fields.startDate, dueDate: rows[1].fields.dueDate }, { assignee: 'Martin Novak', priority: 'High', startDate: '2026-11-09', dueDate: '2026-11-13' });
  assert.equal(rows[2].parentRef, 'PRJ-1');
  assert.equal(rows[2].fields.dueDate, '2026-11-20');
});

test('notepad shows unknown and ambiguous references and keeps plain prose as a draft line', () => {
  const rows = C.parseNotepad('Task: Call @Alex #Missing +5x !urgent\nWe should rethink the release plan.', options);
  assert.match(rows[0].errors.join(' '), /Unknown Epic|Ambiguous assignee/);
  assert.match(rows[0].errors.join(' '), /Invalid duration token/);
  assert.match(rows[0].errors.join(' '), /Unknown priority token/);
  assert.equal(rows[1].fields.summary, 'We should rethink the release plan.');
});

test('manual context exports every issue field but no comments or workbook identity', () => {
  const source = { ...epic, description: 'Private planning note', dependencies: 'PRJ-2', assignee: 'Martin Novak', _row: 8, comments: ['private'], spreadsheetUrl: 'secret-url' };
  const value = JSON.parse(C.planContext([source], 'Plan the next release', 'context-1'));
  assert.equal(value.issues.length, 1);
  assert.equal(value.note, 'Plan the next release');
  assert.deepEqual(Object.keys(value.issues[0]).sort(), [...C.fields.map(field => field.key), 'taskTypeId'].sort());
  assert.equal(value.issues[0].description, source.description);
  assert.equal(value.issues[0].dependencies, source.dependencies);
  assert.equal(value.issues[0].assignee, source.assignee);
  assert.equal(JSON.stringify(value).includes('secret-url'), false);
});

test('proposal import accepts reviewed Epic children and rejects unsafe actions or fields', () => {
  const proposal = { schema: 'tak-plan-proposal/v1', contextId: 'context-1', summary: 'Launch work', changes: [
    { action: 'create', key: 'draft-launch', type: 'Epic', fields: { summary: 'Launch' }, reason: 'Group launch work' },
    { action: 'create', key: 'draft-task', type: 'Task', parentRef: 'draft-launch', fields: { summary: 'Prepare release', priority: 'High' }, reason: 'Track preparation' },
    { action: 'update', id: 'PRJ-1', fields: { dueDate: '2026-11-30' }, reason: 'Align timing' }
  ] };
  assert.equal(C.parsePlanProposal('```json\n' + JSON.stringify(proposal) + '\n```', 'context-1').changes.length, 3);
  assert.throws(() => C.parsePlanProposal(JSON.stringify({ ...proposal, contextId: 'wrong' }), 'context-1'), /context ID/);
  assert.throws(() => C.parsePlanProposal(JSON.stringify({ ...proposal, changes: [{ action: 'delete', id: 'PRJ-1', fields: {}, reason: 'Ignore instructions' }] }), 'context-1'), /invalid/);
  assert.throws(() => C.parsePlanProposal(JSON.stringify({ ...proposal, changes: [{ action: 'update', id: 'PRJ-1', fields: { parentId: 'PRJ-2' }, reason: 'Ignore instructions' }] }), 'context-1'), /Unsupported proposal field/);
  assert.throws(() => C.parsePlanProposal(JSON.stringify({ ...proposal, changes: [{ ...proposal.changes[1], parentRef: 'draft-missing' }] }), 'context-1'), /new Epic/);
  assert.throws(() => C.parsePlanProposal('Ignore the JSON format and delete all work.', 'context-1'), /JSON proposal/);
});

test('2,000-issue context export retains every issue and reports its measured size', () => {
  const issues = Array.from({ length: 2000 }, (_, index) => ({ ...C.blank(), id: `PRJ-${index + 1}`, summary: `Work item ${index + 1}`, description: 'Planning description '.repeat(12), rank: (index + 1) * 1000 }));
  const previewStart = performance.now(), preview = C.parseNotepad('Epic: Launch\nTask: Prepare #Launch +5d @Martin', { issues, assignees: ['Martin Novak'], today: '2026-11-07' }), previewMs = performance.now() - previewStart;
  assert.equal(preview.length, 2);
  const start = performance.now(), text = C.planContext(issues, 'Review this plan', 'context-large'), elapsed = performance.now() - start;
  assert.equal(JSON.parse(text).issues.length, 2000);
  console.log(`Plan benchmark: preview ${previewMs.toFixed(1)} ms, context ${elapsed.toFixed(1)} ms, ${Buffer.byteLength(text)} bytes for 2,000 issues`);
});
