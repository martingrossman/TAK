const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../Core.js');
const day = '2026-10-27', now = day + 'T10:00:00.000Z';
const make = (values = {}) => ({ ...C.blank(), id: 'PRJ-1', summary: 'Example issue', createdAt: now, updatedAt: now, ...values });

test('task type presentation supports legacy names, JSON configuration, and safe fallbacks', () => {
  const settings = [
    { category: 'taskType', key: 'algo', value: 'Algorithm', valueType: 'json', active: true },
    { category: 'taskType', key: 'Legacy Name', value: 'legacy', valueType: 'text', active: true },
    { category: 'taskType', key: 'custom', value: '{"name":"Analytics","color":"#123ABC","badge":"x"}', valueType: 'json', active: true },
    { category: 'taskType', key: 'broken', value: '{"name":"Broken","color":"red","badge":"!!"}', valueType: 'json', active: true }
  ];
  assert.deepEqual(C.taskTypePresentation('algo', settings), { id: 'algo', name: 'Algorithm', color: '#2563EB', badge: 'A' });
  assert.deepEqual(C.taskTypePresentation('legacy', settings), { id: 'legacy', name: 'Legacy Name', color: C.taskTypePresentation('legacy', []).color, badge: 'L' });
  assert.deepEqual(C.taskTypePresentation('custom', settings), { id: 'custom', name: 'Analytics', color: '#123ABC', badge: 'X' });
  const fallback = C.taskTypePresentation('broken', settings);
  assert.equal(fallback.name, 'Broken'); assert.match(fallback.color, /^#[0-9A-F]{6}$/i); assert.equal(fallback.badge, 'B');
  assert.equal(C.taskTypePresentation('data', []).color, '#0F766E');
  assert.deepEqual(C.taskTypeDefinitions([]).map(type => type.id), ['algo', 'data', 'requirements', 'bug']);
});

test('sample project has unique IDs and valid hierarchy, dates, and dependencies', () => {
  const issues = C.sample(day); assert.equal(new Set(issues.map(i => i.id)).size, issues.length);
  issues.forEach(i => C.validate(i, issues));
  const epics = issues.filter(issue => issue.type === 'Epic');
  assert.equal(epics.length, 3);
  for (const epic of epics) {
    const stories = issues.filter(issue => issue.type === 'Story' && issue.parentId === epic.id);
    assert.ok(stories.length >= 1 && stories.length <= 2);
    for (const story of stories) assert.ok(issues.some(issue => ['Task', 'Bug'].includes(issue.type) && issue.parentId === story.id));
  }
  assert.ok(issues.every(issue => issue.description.length > 50 && !issue.description.startsWith('Sample issue')));
});
test('whole-project validation keeps hierarchy and dependency safety at large local sizes', () => {
  const sample = C.sample(day);
  assert.equal(C.validateProject(sample), sample);
  const many = Array.from({ length: 2000 }, (_, index) => make({ id: `PRJ-${index + 1}`, summary: `Task ${index + 1}` }));
  assert.equal(C.validateProject(many), many);
  assert.throws(() => C.validateProject([make(), make()]), /missing or duplicate IDs/);
  assert.throws(() => C.validateProject([make({ parentId: 'PRJ-404' })]), /existing parent/);
  assert.throws(() => C.validateProject([make({ dependencies: 'PRJ-2' }), make({ id: 'PRJ-2', dependencies: 'PRJ-1' })]), /Dependencies cannot form a cycle/);
});

test('blank projects allow unassigned, unscheduled work', () => assert.doesNotThrow(() => C.validate(make(), [])));
test('new Task, Story, and Bug start today while Epics and explicit start values stay unchanged', () => {
  const today = '2026-11-07';
  assert.equal(C.prepare({ summary: 'Default task' }, null, today, now).startDate, today);
  for (const type of C.types) {
    const input = { summary: type, type };
    assert.equal(C.prepare(input, null, today, now).startDate, type === 'Epic' ? '' : today);
    assert.equal(C.prepare({ ...input, startDate: '' }, null, today, now).startDate, '');
    assert.equal(C.prepare({ ...input, startDate: '2026-10-20' }, null, today, now).startDate, '2026-10-20');
    for (const startDate of [null, undefined]) assert.equal(C.prepare({ ...input, startDate }, null, today, now).startDate, '');
    assert.equal(Object.hasOwn(input, 'startDate'), false, 'preparation does not mutate the submitted intent');
  }
});
test('editing existing work preserves blank or scheduled starts and allows explicit clearing', () => {
  for (const type of C.types) {
    const unscheduled = make({ type, startDate: '' }), scheduled = make({ type, startDate: '2026-10-20' });
    assert.equal(C.prepare({ summary: 'Edited' }, unscheduled, day, now).startDate, '');
    assert.equal(C.prepare({ summary: 'Edited' }, scheduled, day, now).startDate, '2026-10-20');
    assert.equal(C.prepare({ startDate: '' }, scheduled, day, now).startDate, '');
  }
  assert.equal(C.prepare({ type: 'Task' }, make({ type: 'Epic', startDate: '' }), day, now).startDate, '');
});
test('calendar arithmetic works across leap days and daylight saving boundaries', () => {
  assert.equal(C.addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(C.addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.validDate('2026-02-29'), false); assert.equal(C.validDate('2026-04-31'), false);
});
test('invalid dates, date ranges, enums, and numeric values are rejected', () => {
  for (const values of [{ summary: '' }, { summary: 'x'.repeat(251) }, { type: 'Other' }, { status: 'Started' }, { priority: 'Urgent' }, { startDate: '2026-02-31' }, { startDate: '2026-10-29', dueDate: day }, { estimate: -1 }, { timeSpent: NaN }, { rank: Infinity }, { progress: 101 }]) assert.throws(() => C.validate(make(values), []));
});
test('Done stamps completion and 100%; reopening clears completion and progress', () => {
  const done = C.prepare({ status: 'Done', progress: 20 }, make(), day, now);
  assert.equal(done.progress, 100); assert.equal(done.completedDate, day);
  const reopened = C.prepare({ status: 'In Progress' }, done, '2026-10-28', now);
  assert.equal(reopened.completedDate, ''); assert.equal(reopened.progress, 0);
});
test('editing completed work preserves its original completion date', () => {
  const result = C.prepare({ summary: 'Changed' }, make({ status: 'Done', completedDate: '2026-10-20' }), day, now);
  assert.equal(result.completedDate, '2026-10-20');
});
test('clients cannot forge IDs or generated timestamps through update payloads', () => {
  const result = C.prepare({ id: 'EVIL-1', createdAt: 'no', updatedAt: 'no', completedDate: '1900-01-01' }, make(), day, now);
  assert.equal(result.id, 'PRJ-1'); assert.equal(result.createdAt, now); assert.equal(result.updatedAt, now); assert.equal(result.completedDate, '');
});
test('only known fields survive preparation from new input', () => {
  const result = C.prepare({ summary: 'New', estimate: '2.5', dependencies: ' PRJ-1,PRJ-1, PRJ-2 ', evil: true }, null, day, now);
  assert.equal(result.estimate, 2.5); assert.equal(result.dependencies, 'PRJ-1, PRJ-2'); assert.equal(result.evil, undefined);
});
test('parent types and existence are enforced', () => {
  const epic = make({ type: 'Epic' }), story = make({ id: 'PRJ-2', type: 'Story', parentId: epic.id });
  assert.doesNotThrow(() => C.validate(story, [epic]));
  assert.throws(() => C.validate(make({ type: 'Epic', parentId: 'PRJ-2' }), [story]));
  assert.throws(() => C.validate(make({ type: 'Story', parentId: 'PRJ-2' }), [story]));
  assert.throws(() => C.validate(make({ parentId: 'PRJ-404' }), []));
  assert.throws(() => C.validate(make({ parentId: 'PRJ-1' }), []));
});
test('tasks can be nested below tasks but parent relationships cannot cycle', () => {
  const epic = make({ id: 'PRJ-1', type: 'Epic', summary: 'Epic' });
  const parent = make({ id: 'PRJ-2', type: 'Task', parentId: epic.id, summary: 'Parent task' });
  const child = make({ id: 'PRJ-3', type: 'Task', parentId: parent.id, summary: 'Child task' });
  assert.doesNotThrow(() => C.validate(child, [epic, parent]));
  assert.throws(() => C.validate(Object.assign({}, parent, { parentId: child.id }), [epic, child]), /Parent hierarchy cannot form a cycle/);
});
test('changing parent type cannot orphan its children', () => {
  const epic = make({ type: 'Epic' }), story = make({ id: 'PRJ-2', type: 'Story', parentId: epic.id });
  assert.throws(() => C.validate({ ...epic, type: 'Task' }, [epic, story]));
});
test('epic schedule range follows the earliest start and latest due date of scheduled descendants', () => {
  const epic = make({ type: 'Epic', startDate: '2027-01-01', dueDate: '2027-12-31' });
  const story = make({ id: 'PRJ-2', type: 'Story', parentId: epic.id, startDate: '2026-04-01', dueDate: '2026-04-30' });
  const nestedTask = make({ id: 'PRJ-3', type: 'Task', parentId: story.id, startDate: '2026-03-25', dueDate: '2026-05-02' });
  const directTask = make({ id: 'PRJ-4', type: 'Task', parentId: epic.id, startDate: '2026-05-01', dueDate: '2026-05-11' });
  const unscheduledTask = make({ id: 'PRJ-5', type: 'Task', parentId: epic.id, startDate: '', dueDate: '2026-08-01' });
  const unrelatedTask = make({ id: 'PRJ-6', type: 'Task', startDate: '2026-01-01', dueDate: '2026-01-02' });

  assert.deepEqual(C.epicScheduleRange(epic.id, [epic, story, nestedTask, directTask, unscheduledTask, unrelatedTask]), { startDate: '2026-03-25', dueDate: '2026-05-11' });
  assert.equal(C.epicScheduleRange(epic.id, [epic, unscheduledTask]), null);
});
test('Epic progress counts overall leaf work once, including hidden descendants', () => {
  const issues = [
    make({ id: 'E1', type: 'Epic' }),
    make({ id: 'E2', type: 'Epic' }),
    make({ id: 'E3', type: 'Epic' }),
    make({ id: 'S1', type: 'Story', parentId: 'E1', status: 'Done' }),
    make({ id: 'T1', parentId: 'S1', status: 'Done' }),
    make({ id: 'T2', parentId: 'S1', status: 'Done' }),
    make({ id: 'T3', parentId: 'S1', status: 'Backlog' }),
    make({ id: 'S2', type: 'Story', parentId: 'E2', status: 'Review' }),
    make({ id: 'U1', status: 'Done' })
  ];
  const progress = C.leafWorkProgress(issues);
  assert.deepEqual(progress.get('E1'), { done: 2, total: 3 });
  assert.deepEqual(progress.get('E2'), { done: 0, total: 1 });
  assert.equal(progress.has('E3'), false);
  assert.deepEqual(progress.get(''), { done: 1, total: 1 });
});
test('missing, self-referential and cyclic dependencies are rejected', () => {
  const a = make(), b = make({ id: 'PRJ-2', dependencies: a.id });
  assert.throws(() => C.validate({ ...a, dependencies: a.id }, [a]));
  assert.throws(() => C.validate({ ...a, dependencies: 'PRJ-404' }, [a]));
  assert.throws(() => C.validate({ ...a, dependencies: b.id }, [a, b]));
  const c = make({ id: 'PRJ-3', dependencies: b.id });
  assert.throws(() => C.validate({ ...a, dependencies: c.id }, [a, b, c]));
});
test('linked issues cannot be deleted until their references are removed', () => {
  assert.throws(() => C.canDelete('PRJ-1', [make({ id: 'PRJ-2', parentId: 'PRJ-1' })]));
  assert.throws(() => C.canDelete('PRJ-1', [make({ id: 'PRJ-2', dependencies: 'PRJ-1' })]));
  assert.doesNotThrow(() => C.canDelete('PRJ-1', []));
});
test('CSV escapes multiline quotes and neutralizes spreadsheet formulas', () => {
  const csv = C.csv([make({ summary: '=HYPERLINK("https://example.com")', description: 'one, two\n"three"', assignee: ' +SUM(1,2)' })]);
  assert.ok(csv.startsWith('\uFEFF"ID"')); assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes('"one, two\n""three"""')); assert.ok(csv.includes('"\' +SUM(1,2)"'));
});
