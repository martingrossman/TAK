import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import C from '../Core.js';

test('quick entry uses selected Epic only when the input has no explicit parent context', async () => {
  const client = await readFile(new URL('../Client.html', import.meta.url), 'utf8');
  const source = client.slice(client.indexOf('  async function createQuickTask('), client.indexOf('  async function undoLastCommand('));
  assert.ok(source.startsWith('  async function createQuickTask('), 'quick entry function must exist');
  const calls = [];
  const defaults = { type: 'Task', parentId: 'E1', status: 'Backlog', priority: 'Medium', startDate: '2026-11-07' };
  const globalInput = { value: 'Global task', dataset: {} };
  const context = {
    state: { epic: 'E1', ready: true, busy: false, drafts: {}, quickQueue: [], issues: [{ ...C.blank(), id: 'E1', type: 'Epic' }, { ...C.blank(), id: 'E2', type: 'Epic' }] },
    C, entrySession: defaults, creationDefaults: type => ({ ...defaults, type }), applyQuickParent: () => true,
    today: () => '2026-11-07', render: () => {}, syncText: () => {}, queueMicrotask: () => {},
    localStorage: { setItem: (key, value) => { calls.splice(0, calls.length, ...JSON.parse(value).map(entry => entry.input)); } },
    quickQueueStorageKey: 'queue', showError: error => { throw error; },
    issueById: id => id === 'E1' ? { id, type: 'Epic' } : null,
    $: () => globalInput,
    newOperationId: () => `intent-${calls.length + 1}`,
    hasPendingSaves: () => false,
    defaultTaskTypeId: () => 'algo',
    persist: async input => { calls.push(input); },
    drainQuickQueue: () => {}
  };
  const createQuickTask = vm.runInNewContext(`${source}\ncreateQuickTask`, context);

  await createQuickTask();
  await createQuickTask('To Do', { value: 'No Epic lane', dataset: { quickKind: 'Task', quickParentId: '' } });
  await createQuickTask('Review', { value: 'Another lane', dataset: { quickKind: 'Story', quickParentId: 'E2' } });
  await createQuickTask('Backlog', { value: 'New Epic', dataset: { quickKind: 'Epic', quickParentId: 'E1' } });

  assert.deepEqual(calls.map(({ summary, type, status, parentId }) => ({ summary, type, status, parentId })), [
    { summary: 'Global task', type: 'Task', status: 'Backlog', parentId: 'E1' },
    { summary: 'No Epic lane', type: 'Task', status: 'To Do', parentId: '' },
    { summary: 'Another lane', type: 'Story', status: 'Review', parentId: 'E2' },
    { summary: 'New Epic', type: 'Epic', status: 'Backlog', parentId: '' }
  ]);
});

test('Sheet quick entry shows saving and failed drafts with an actionable retry', async () => {
  const client = await readFile(new URL('../Client.html', import.meta.url), 'utf8');
  const source = client.slice(client.indexOf('  function renderQuickEntryPending('), client.indexOf('  function retryQuickDraft('));
  assert.ok(source.startsWith('  function renderQuickEntryPending('));
  const panel = { innerHTML: '', hidden: true };
  const context = {
    state: { view: 'sheet' },
    $: () => panel,
    pendingQuickTasks: () => [
      { draftKey: 'one', summary: 'First task', status: 'Backlog', pendingState: 'saving', error: '' },
      { draftKey: 'two', summary: 'Second task', status: 'To Do', pendingState: 'failed', error: 'Connection lost' }
    ],
    escape: value => String(value)
  };
  const renderQuickEntryPending = vm.runInNewContext(`${source}\nrenderQuickEntryPending`, context);
  renderQuickEntryPending();
  assert.equal(panel.hidden, false);
  assert.match(panel.innerHTML, /First task.*Saving/s);
  assert.match(panel.innerHTML, /Second task.*Save unconfirmed.*Retry save/s);
  assert.match(panel.innerHTML, /data-retry-quick="two"/);

  context.state.view = 'kanban';
  renderQuickEntryPending();
  assert.equal(panel.hidden, true);
});
