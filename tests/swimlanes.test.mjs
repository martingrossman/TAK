import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');


test('Kanban has a flat rendering path and preserves epic relationships', async () => {
  const client = await read('Client.html');

  const helpers = ['inEpicWithin', 'boardEpicId', 'boardMoveParent'].map(name => client.match(new RegExp(`  function ${name}\\([^]*?\\n  }`))?.[0]).join('\n');
  const records = [
    { id: 'e1', type: 'Epic' }, { id: 'e2', type: 'Epic' },
    { id: 's1', type: 'Story', parentId: 'e1' },
    { id: 't1', type: 'Task', parentId: 's1' },
    { id: 't2', type: 'Task', parentId: 'e1' },
    { id: 't3', type: 'Task', parentId: 't1' },
    { id: 't4', type: 'Task', parentId: '' }
  ];
  const moveParent = new Function('state', 'issueById', `${helpers}; return boardMoveParent;`)({ issues: records }, id => records.find(issue => issue.id === id));
  assert.equal(moveParent(records[3], 'e1'), 's1');
  assert.equal(moveParent(records[5], 'e1'), 't1');
  assert.throws(() => moveParent(records[3], 'e2'), /parent has been preserved/);
  assert.throws(() => moveParent(records[5], ''), /parent has been preserved/);
  assert.equal(moveParent(records[2], 'e2'), 'e2');
  assert.equal(moveParent(records[4], ''), '');
  assert.equal(moveParent(records[6], 'e2'), 'e2');
  assert.throws(() => moveParent(records[4], 'missing'), /existing Epic/);
});

test('grouped lanes represent epics once and keep epic details and schedule accessible', async () => {
  const client = await read('Client.html');

  const epics = [{ id: 'E', type: 'Epic', summary: 'One' }, { id: 'F', type: 'Epic', summary: 'Two' }];
  const story = { id: 'S', type: 'Story', parentId: 'E' }, task = { id: 'T', parentId: 'S' }, orphan = { id: 'O', parentId: 'missing' };
  const records = [...epics, story, task, orphan], byId = new Map(records.map(issue => [issue.id, issue]));
  const source = client.slice(client.indexOf('  function epicLanes('), client.indexOf('  function laneCollapsedKey('));
  const lanes = new Function('C', 'indexedIssues', 'issueById', source + 'return epicLanes;')({ sorted: items => items.slice() }, () => ({ epics }), id => byId.get(id));
  assert.deepEqual(lanes([task, epics[1], orphan]), [
    { id: 'E', label: 'One', items: [task] }, { id: 'F', label: 'Two', items: [] }, { id: '', label: 'No epic', items: [orphan] }
  ]);
});

