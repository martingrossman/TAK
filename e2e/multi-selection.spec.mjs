import { test, expect } from '@playwright/test';
import C from '../Core.js';

const projectKey = 'sheetflow.project.v1';
const deleteKey = 'sheetflow.pending-delete.v1';
const items = Array.from({ length: 6 }, (_, index) => ({ ...C.blank(), id: `PRJ-${index + 1}`, summary: `Selection task ${index + 1}`, status: 'Backlog', priority: 'Medium', rank: (index + 1) * 1000, version: `v${index + 1}`, startDate: '2026-11-01', dueDate: '2026-11-10' }));
const readProject = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), projectKey);
const readDelete = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), deleteKey);
const checkbox = (page, id) => page.locator(`[data-issue-select="${id}"]`);
const checkedIds = page => page.locator('[data-issue-select]:checked').evaluateAll(nodes => nodes.map(node => node.dataset.issueSelect));
const rowTarget = (page, view, id) => page.locator(view === 'sheet' ? `[data-sheet-drag-id="${id}"]` : view === 'kanban' ? `[data-issue="${id}"] .card-title` : `[data-gantt-drag-id="${id}"]`);

async function seed(page, view = 'sheet', issues = items, ui = {}) {
  await page.addInitScript(({ issues, projectKey, ui }) => {
    if (!localStorage.getItem(projectKey)) {
      localStorage.setItem(projectKey, JSON.stringify({ issues, comments: [], sequence: issues.length }));
      localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ swimlanes: false, collapsedEpics: {}, collapsedSheetParents: {}, collapsedGanttStories: {}, timelineStart: '2026-10-25', ...ui }));
    }
  }, { issues, projectKey, ui });
  await page.goto(`/#${view}`);
  await expect(page.locator('[data-issue-select]').first()).toBeEnabled();
}

test('Shift click inside a Sheet text field selects text, not work items', async ({ page }) => {
  await seed(page);
  const title = page.getByRole('textbox', { name: 'PRJ-1 Title', exact: true });
  await title.focus();
  await title.press('End');
  await title.click({ modifiers: ['Shift'], position: { x: 8, y: 12 } });
  await expect(title).toBeFocused();
  expect(await title.evaluate(input => input.selectionEnd - input.selectionStart)).toBeGreaterThan(0);
  expect(await checkedIds(page)).toEqual([]);
  expect((await readProject(page)).issues).toEqual(items);
});

for (const view of ['sheet', 'kanban', 'gantt']) {
  test(`${view}: inclusive forward/reverse range, modifier toggle and keyboard selection`, async ({ page }) => {
    await seed(page, view);
    await expect(page.locator('#selection-actions')).toBeHidden();
    await checkbox(page, 'PRJ-2').check();
    await rowTarget(page, view, 'PRJ-5').click({ modifiers: ['Shift'] });
    expect(await checkedIds(page)).toEqual(['PRJ-2', 'PRJ-3', 'PRJ-4', 'PRJ-5']);
    await expect(page.locator('#selection-count')).toHaveText('4 selected');
    await rowTarget(page, view, 'PRJ-1').click({ modifiers: ['Shift'] });
    expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2']);
    await rowTarget(page, view, 'PRJ-6').click({ modifiers: ['Control'] });
    expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2', 'PRJ-6']);
    await rowTarget(page, view, 'PRJ-6').click({ modifiers: ['Meta'] });
    expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2']);
    await checkbox(page, 'PRJ-1').focus();
    await page.keyboard.press('Space');
    await expect(checkbox(page, 'PRJ-1')).toBeFocused();
    expect(await checkedIds(page)).toEqual(['PRJ-2']);
    await expect(page.locator('#issue-dialog')).not.toBeVisible();
    await page.locator('#selection-clear').click();
    await expect(page.locator('#selection-actions')).toBeHidden();
    expect((await readProject(page)).issues).toEqual(items);
  });

  test(`${view}: Shift checkbox ranges exclude filtered rows and reset hidden anchors`, async ({ page }) => {
    await seed(page, view);
    await checkbox(page, 'PRJ-1').check();
    await checkbox(page, 'PRJ-4').click({ modifiers: ['Shift'] });
    await expect(page.locator('#selection-count')).toHaveText('4 selected');
    await page.locator('#search').fill('Selection task 6');
    await expect(page.locator('[data-issue-select]')).toHaveCount(1);
    await expect(page.locator('#selection-actions')).toBeHidden();
    await checkbox(page, 'PRJ-6').click({ modifiers: ['Shift'] });
    expect(await checkedIds(page)).toEqual(['PRJ-6']);
    await page.locator('#search').fill('');
    expect(await checkedIds(page)).toEqual(['PRJ-6']);
  });

  test(`${view}: bulk edit updates only selected issues and survives reload`, async ({ page }) => {
    await seed(page, view);
    await checkbox(page, 'PRJ-1').check();
    await checkbox(page, 'PRJ-3').check();
    await page.locator('#selection-edit').click();
    await expect(page.locator('#bulk-edit-selection-count')).toContainText('2 visible');
    await page.locator('#bulk-edit-field').selectOption('priority');
    await page.locator('[data-bulk-edit-value]').selectOption('High');
    await page.locator('#bulk-edit-submit').click();
    await expect(page.locator('#bulk-edit-dialog')).not.toBeVisible();
    expect((await readProject(page)).issues.map(issue => issue.priority)).toEqual(['High', 'Medium', 'High', 'Medium', 'Medium', 'Medium']);
    await page.reload();
    await expect(page.locator('[data-issue-select]').first()).toBeEnabled();
    expect((await readProject(page)).issues.filter(issue => issue.priority === 'High').map(issue => issue.id)).toEqual(['PRJ-1', 'PRJ-3']);
  });

  test(`${view}: deletion cancel is inert; confirmed deletion persists and clears selection`, async ({ page }) => {
    await seed(page, view);
    await checkbox(page, 'PRJ-2').check();
    await checkbox(page, 'PRJ-3').check();
    await page.locator('#selection-delete').click();
    await expect(page.locator('#bulk-delete-description')).toContainText('2 selected issues');
    await expect(page.locator('#bulk-delete-description')).toContainText('There is no undo');
    await expect(page.locator('#bulk-delete-cancel')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
    await expect(page.locator('#selection-delete')).toBeFocused();
    expect((await readProject(page)).issues).toEqual(items);
    expect(await readDelete(page)).toBeNull();
    expect(await checkedIds(page)).toEqual(['PRJ-2', 'PRJ-3']);
    await page.locator('#selection-delete').click();
    await page.locator('#bulk-delete-submit').click();
    await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
    await expect(page.locator('#selection-actions')).toBeHidden();
    expect((await readProject(page)).issues.map(issue => issue.id)).toEqual(['PRJ-1', 'PRJ-4', 'PRJ-5', 'PRJ-6']);
    expect(await readDelete(page)).toBeNull();
    await page.reload();
    await expect(page.locator('[data-issue-select]')).toHaveCount(4);
  });
}

test('selection is shared across all views, not duplicated per view', async ({ page }) => {
  await seed(page);
  await checkbox(page, 'PRJ-2').check();
  await checkbox(page, 'PRJ-4').check();
  for (const view of ['kanban', 'gantt', 'sheet']) {
    await page.locator(`[data-view="${view}"]`).first().click();
    expect(await checkedIds(page)).toEqual(['PRJ-2', 'PRJ-4']);
    await expect(page.locator('#selection-count')).toHaveText('2 selected');
  }
});

test('Kanban ranges follow displayed status-column order, not project array order', async ({ page }) => {
  const issues = items.map((issue, index) => ({ ...issue, status: index % 2 ? 'To Do' : 'Backlog' }));
  await seed(page, 'kanban', issues);
  await checkbox(page, 'PRJ-3').check();
  await rowTarget(page, 'kanban', 'PRJ-4').click({ modifiers: ['Shift'] });
  expect(await checkedIds(page)).toEqual(['PRJ-3', 'PRJ-5', 'PRJ-2', 'PRJ-4']);
});

for (const view of ['sheet', 'kanban', 'gantt']) test(`${view}: collapsed lanes exclude children and selection gestures do not toggle collapse`, async ({ page }) => {
  const issues = [{ ...items[0], type: 'Epic' }, { ...items[1], parentId: 'PRJ-1' }, { ...items[2], parentId: 'PRJ-1' }, items[3]];
  await seed(page, view, issues, { swimlanes: true });
  await checkbox(page, 'PRJ-2').check();
  await page.locator('[data-toggle-lane="PRJ-1"]').click();
  await expect(checkbox(page, 'PRJ-2')).toHaveCount(0);
  await expect(page.locator('#selection-actions')).toBeHidden();
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-4').click({ modifiers: ['Shift'] });
  expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-4']);
  await expect(page.locator('[data-toggle-lane="PRJ-1"]')).toHaveAttribute('aria-expanded', 'false');
});

for (const view of ['sheet', 'gantt']) test(`${view}: collapsed Story descendants cannot enter a range`, async ({ page }) => {
  await seed(page, view, [{ ...items[0], type: 'Story' }, { ...items[1], parentId: 'PRJ-1' }, items[2]]);
  const toggle = view === 'sheet' ? '[data-toggle-sheet-parent="PRJ-1"]' : '[data-toggle-gantt-story="PRJ-1"]';
  await checkbox(page, 'PRJ-2').check();
  await page.locator(toggle).click();
  await expect(page.locator('#selection-actions')).toBeHidden();
  await checkbox(page, 'PRJ-1').check();
  await rowTarget(page, view, 'PRJ-3').click({ modifiers: ['Shift'] });
  expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-3']);
});

test('range selection refuses more than 100 without altering the existing selection', async ({ page }) => {
  const issues = Array.from({ length: 101 }, (_, index) => ({ ...items[0], id: `PRJ-${index + 1}`, rank: index * 1000, summary: `Limit task ${index + 1}` }));
  await seed(page, 'sheet', issues);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-101').click({ modifiers: ['Shift'] });
  expect(await checkedIds(page)).toEqual(['PRJ-1']);
  await expect(page.locator('#toast')).toContainText('up to 100');
  await expect(page.locator('[data-sheet-select-visible]')).toBeDisabled();
});

for (const protection of ['parentId', 'dependencies', 'version']) test(`delete protects unselected ${protection} references or stale versions atomically`, async ({ page }) => {
  const issues = items.slice(0, 3).map(issue => ({ ...issue }));
  if (protection !== 'version') issues[2][protection] = 'PRJ-1';
  await seed(page, 'sheet', issues);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-2').check();
  if (protection === 'version') await page.evaluate(key => {
    const db = JSON.parse(localStorage.getItem(key)); db.issues[0].version = 'newer'; localStorage.setItem(key, JSON.stringify(db));
  }, projectKey);
  const before = await readProject(page);
  await page.locator('#selection-delete').click();
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-error')).toContainText(protection === 'version' ? 'changed elsewhere' : 'unselected issue');
  expect(await readProject(page)).toEqual(before);
  expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2']);
  await expect(page.locator('#bulk-delete-submit')).toBeEnabled();
});

test('an explicitly selected linked tree and internal dependency can be deleted together', async ({ page }) => {
  const issues = [{ ...items[0], type: 'Story' }, { ...items[1], parentId: 'PRJ-1' }, { ...items[2], parentId: 'PRJ-1', dependencies: 'PRJ-2' }, items[3]];
  await seed(page, 'sheet', issues);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-3').click({ modifiers: ['Shift'] });
  await page.locator('#selection-delete').click();
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
  expect((await readProject(page)).issues.map(issue => issue.id)).toEqual(['PRJ-4']);
});

for (const failure of ['before write', 'lost acknowledgement']) test(`delete retains stable durable identity after ${failure} and reload`, async ({ page }) => {
  await seed(page);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-2').check();
  await page.evaluate(({ projectKey, failure }) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === projectKey && Object.keys(JSON.parse(value).deleteReceipts || {}).length) {
        Storage.prototype.setItem = original;
        if (failure === 'lost acknowledgement') original.call(this, key, value);
        throw new Error('Simulated deletion transport failure');
      }
      return original.call(this, key, value);
    };
  }, { projectKey, failure });
  await page.locator('#selection-delete').click();
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-error')).toContainText('Simulated deletion transport failure');
  expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2']);
  await expect(checkbox(page, 'PRJ-1')).toHaveCount(1);
  const pending = await readDelete(page);
  expect(pending.items).toEqual([{ id: 'PRJ-1', expectedVersion: 'v1' }, { id: 'PRJ-2', expectedVersion: 'v2' }]);
  expect((await readProject(page)).issues).toHaveLength(failure === 'before write' ? 6 : 4);
  await page.reload();
  await expect(page.locator('#delete-recovery-open')).toBeVisible();
  await page.locator('#delete-recovery-open').click();
  await expect(page.locator('#bulk-delete-error')).toContainText('Simulated deletion transport failure');
  expect((await readDelete(page)).operationId).toBe(pending.operationId);
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
  const saved = await readProject(page);
  expect(saved.issues.map(issue => issue.id)).toEqual(['PRJ-3', 'PRJ-4', 'PRJ-5', 'PRJ-6']);
  expect(Object.keys(saved.deleteReceipts)).toEqual([pending.operationId]);
  expect(await readDelete(page)).toBeNull();
});

test('a pending cloud deletion cannot be cancelled or submitted twice and never removes rows before acknowledgement', async ({ page }) => {
  await page.addInitScript(({ issues }) => {
    window.deleteHarness = { issues, requests: [] };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: structuredClone(deleteHarness.issues), comments: {}, settings: [], mode: 'personal' })); },
      deleteIssuesBatch(items, operationId) { deleteHarness.requests.push({ items: structuredClone(items), operationId, success: this.success, failure: this.failure }); }
    }; } });
  }, { issues: items });
  await page.goto('/#kanban');
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-2').check();
  await page.locator('#selection-delete').click();
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-submit')).toBeDisabled();
  await expect(page.locator('#bulk-delete-cancel')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#bulk-delete-dialog')).toBeVisible();
  await expect(checkbox(page, 'PRJ-3')).toBeDisabled();
  expect(await page.evaluate(() => deleteHarness.requests.length)).toBe(1);
  await expect(page.locator('[data-issue="PRJ-1"]')).toHaveCount(1);
  await page.evaluate(() => deleteHarness.requests[0].failure({ message: 'Temporary transport failure' }));
  await expect(page.locator('#bulk-delete-error')).toContainText('Temporary transport failure');
  const pending = await readDelete(page);
  await page.locator('#bulk-delete-submit').click();
  expect(await page.evaluate(() => deleteHarness.requests.map(request => request.operationId))).toEqual([pending.operationId, pending.operationId]);
  await page.evaluate(() => deleteHarness.requests[1].success({ deletedIds: ['PRJ-1', 'PRJ-2'] }));
  await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
  await expect(page.locator('[data-issue="PRJ-1"]')).toHaveCount(0);
  expect(await readDelete(page)).toBeNull();
});

for (const view of ['sheet', 'kanban', 'gantt']) test(`${view}: unsaved capture rows have no selection control and cannot enter ranges`, async ({ page }) => {
  await page.addInitScript(({ blank }) => {
    localStorage.setItem('sheetflow.pending-drafts.v1', JSON.stringify({
      'quick-unconfirmed': { input: { ...blank, _draftKey: 'quick-unconfirmed', summary: 'Unconfirmed capture', rank: 1500 }, operationId: 'quick-unconfirmed', error: 'Save unconfirmed' }
    }));
  }, { blank: C.blank() });
  await seed(page, view);
  await expect(page.locator('[data-pending-quick="quick-unconfirmed"]')).toBeVisible();
  await expect(page.locator('[data-pending-quick] [data-issue-select]')).toHaveCount(0);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-3').click({ modifiers: ['Shift'] });
  expect(await checkedIds(page)).toEqual(['PRJ-1', 'PRJ-2', 'PRJ-3']);
});

test('pending inline edits and unsaved child captures block deletion before a request is stored', async ({ page }) => {
  await page.addInitScript(({ blank }) => {
    localStorage.setItem('sheetflow.pending-drafts.v1', JSON.stringify({
      'PRJ-1': { input: { id: 'PRJ-1', priority: 'High' }, version: 'v1', operationId: 'inline-pending', error: 'Temporary failure' },
      'quick-child': { input: { ...blank, _draftKey: 'quick-child', summary: 'Pending child', parentId: 'PRJ-2' }, operationId: 'quick-child', error: 'Save unconfirmed' }
    }));
  }, { blank: C.blank() });
  await seed(page);
  for (const id of ['PRJ-1', 'PRJ-2']) {
    await checkbox(page, id).check();
    await page.locator('#selection-delete').click();
    await expect(page.locator('#toast')).toContainText('Finish or discard pending edits and queued work');
    await expect(page.locator('#bulk-delete-dialog')).not.toBeVisible();
    expect(await readDelete(page)).toBeNull();
    await page.locator('#selection-clear').click();
  }
  expect((await readProject(page)).issues).toEqual(items);
});

test('unavailable durable request storage never starts deletion', async ({ page }) => {
  await seed(page);
  await checkbox(page, 'PRJ-1').check();
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new Error('Storage quota reached');
      return original.call(this, name, value);
    };
  }, deleteKey);
  await page.locator('#selection-delete').click();
  await page.locator('#bulk-delete-submit').click();
  await expect(page.locator('#bulk-delete-error')).toContainText('Nothing was sent');
  expect((await readProject(page)).issues).toEqual(items);
  expect(await checkedIds(page)).toEqual(['PRJ-1']);
  expect(await readDelete(page)).toBeNull();
});

test('bulk removal of activity type survives reload and undo restores each original type', async ({ page }) => {
  const source = items.map((issue, index) => ({ ...issue, taskTypeId: index === 2 ? 'data' : 'algo' }));
  await seed(page, 'kanban', source);
  await checkbox(page, 'PRJ-1').check();
  await checkbox(page, 'PRJ-3').check();
  await page.locator('#selection-edit').click();
  await page.locator('#bulk-edit-field').selectOption('taskTypeId');
  await page.locator('[data-bulk-edit-value]').selectOption({ label: 'No activity type' });
  await page.locator('#bulk-edit-submit').click();
  await expect(page.locator('#bulk-edit-dialog')).toBeHidden();
  await page.reload();
  await expect(page.locator('.card[data-issue="PRJ-1"]')).toBeVisible();
  expect((await readProject(page)).issues.map(issue => issue.taskTypeId)).toEqual(['none', 'algo', 'none', 'algo', 'algo', 'algo']);
  await expect(page.locator('.card[data-issue="PRJ-1"] .task-type-badge')).toHaveCount(0);
  await expect(page.locator('.card[data-issue="PRJ-3"] .task-type-badge')).toHaveCount(0);
  await page.locator('#undo-last-action').click();
  await expect.poll(async () => (await readProject(page)).issues.map(issue => issue.taskTypeId)).toEqual(source.map(issue => issue.taskTypeId));
  await expect(page.locator('.card[data-issue="PRJ-3"] .task-type-badge')).toHaveAttribute('aria-label', 'Data');
});
