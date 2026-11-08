import { test, expect } from '@playwright/test';
import C from '../Core.js';

const initial = [
  { id: 'PRJ-1', type: 'Epic', summary: 'First epic' },
  { id: 'PRJ-2', type: 'Epic', summary: 'Second epic' },
  { id: 'PRJ-3', type: 'Story', summary: 'Story', parentId: 'PRJ-1' },
  { id: 'PRJ-4', summary: 'Nested task', parentId: 'PRJ-3' },
  { id: 'PRJ-5', summary: 'Direct task', parentId: 'PRJ-1' },
  { id: 'PRJ-6', summary: 'Hidden sibling', parentId: 'PRJ-2', status: 'Review' }
].map((issue, index) => ({ ...C.blank(), rank: (index + 1) * 1000, version: `v${index}`, ...issue }));
async function setup(page, cloud = false, seed = initial) {
  await page.addInitScript(({ initial, cloud }) => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: initial, comments: [], sequence: 6 }));
    if (!cloud) return;
    const h = window.moveHarness = { issues: initial, requests: [], receipts: {} };
    h.finish = (outcome = 'ok') => {
      const r = h.requests.at(-1), current = h.issues.find(i => i.id === r.id);
      if (outcome === 'fail') return r.failure({ message: 'Temporary failure' });
      if (outcome === 'conflict') { current.version = 'remote'; current.summary = 'Remote title'; }
      if (current.version !== r.version) return r.failure({ message: 'This issue changed elsewhere.' });
      Object.assign(current, r.updates, { version: 'saved' }); r.success({ ...current });
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; }, withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: structuredClone(h.issues), settings: [], comments: {}, mode: 'personal', spreadsheetUrl: '' })); },
      moveIssue(id, updates, version, operationId) { h.requests.push({ id, updates, version, operationId, success: this.success, failure: this.failure }); }
    }; } });
  }, { initial: seed, cloud });
  await page.goto('/#kanban');
  await page.locator('#swimlanes-toggle').check();
  await expect(page.locator('.card[data-issue="PRJ-4"]')).toBeVisible();
}
const issues = page => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues);
const rankedTasks = ranks => ranks.map((rank, index) => ({ ...C.blank(), id: `PRJ-${index + 1}`, summary: `Task ${index + 1}`, rank, version: `v${index + 1}` }));
async function drop(page, id, epic, status) {
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(`.card[data-issue="${id}"]`).dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.locator(`.swimlane[data-epic-lane="${epic}"] .column[data-status="${status}"]`).dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}
async function move(page, id, epic, status) {
  const card = page.locator(`.card[data-issue="${id}"]`);
  await card.focus();
  await page.keyboard.press('Shift+M');
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  await page.locator('#board-move-status').selectOption(status);
  if (epic !== null) await page.locator('#board-move-epic').selectOption(epic);
  await page.locator('#board-move-form').getByRole('button', { name: 'Move', exact: true }).click();
}
test('dragging within an Epic changes status without detaching a Story child', async ({ page }) => {
  await setup(page); await drop(page, 'PRJ-4', 'PRJ-1', 'Review');
  await expect.poll(async () => (await issues(page)).find(i => i.id === 'PRJ-4').status).toBe('Review');
  await page.reload(); expect((await issues(page)).find(i => i.id === 'PRJ-4').parentId).toBe('PRJ-3');
});
test('keyboard reorder crosses an equal-rank card when a safe gap exists', async ({ page }) => {
  await setup(page, false, rankedTasks([1000, 2000, 2000, 3000]));
  const card = page.locator('.card[data-issue="PRJ-3"]');
  await card.focus(); await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(async () => (await issues(page)).find(item => item.id === 'PRJ-3').rank).toBe(1500);
  await expect(card).toBeFocused();
  const order = await page.locator('.column[data-status="Backlog"] .card[data-issue]').evaluateAll(cards => cards.map(card => card.dataset.issue));
  expect(order).toEqual(['PRJ-1', 'PRJ-3', 'PRJ-2', 'PRJ-4']);
});
test('keyboard reorder reports a rank collision without writing an unsafe value', async ({ page }) => {
  await setup(page, false, rankedTasks([1000, 2000, 2000, 2000, 3000]));
  const before = await issues(page), card = page.locator('.card[data-issue="PRJ-4"]');
  await card.focus(); await page.keyboard.press('Alt+ArrowUp');
  await expect(page.locator('#toast')).toContainText('No safe order position');
  expect(await issues(page)).toEqual(before);
});
test('cross-Epic drag rejects nested children without modifying their data', async ({ page }) => {
  await setup(page); await drop(page, 'PRJ-4', 'PRJ-2', 'Review');
  await expect(page.locator('#toast')).toContainText('Its parent has been preserved');
  expect((await issues(page)).find(i => i.id === 'PRJ-4')).toEqual(initial[3]);
});
test('Move dialog preserves nested parent and supports keyboard cancel and status changes', async ({ page }) => {
  await setup(page); const card = page.locator('.card[data-issue="PRJ-4"]');
  await card.focus(); await page.keyboard.press('Shift+M');
  await expect(page.locator('#board-move-epic')).toBeDisabled();
  await expect(page.locator('#board-move-note')).toContainText('preserve');
  await page.keyboard.press('Escape'); await expect(card).toBeFocused();
  await move(page, 'PRJ-4', null, 'Review');
  await expect.poll(async () => (await issues(page)).find(i => i.id === 'PRJ-4').status).toBe('Review');
  expect((await issues(page)).find(i => i.id === 'PRJ-4').parentId).toBe('PRJ-3');
});
test('direct children move to another Epic and No Epic without changing hidden sibling order', async ({ page }) => {
  await setup(page); await page.locator('#search').fill('Direct task');
  await move(page, 'PRJ-5', 'PRJ-2', 'Review');
  await expect.poll(async () => (await issues(page)).find(i => i.id === 'PRJ-5').parentId).toBe('PRJ-2');
  const saved = await issues(page);
  expect(saved.find(i => i.id === 'PRJ-5').rank).toBeGreaterThan(initial[5].rank);
  expect(saved.find(i => i.id === 'PRJ-6')).toEqual(initial[5]);
  await page.reload(); await move(page, 'PRJ-5', '', 'To Do');
  await expect.poll(async () => (await issues(page)).find(i => i.id === 'PRJ-5').parentId).toBe('');
});
test('moving a Story carries its descendants without rewriting their records', async ({ page }) => {
  await setup(page); await move(page, 'PRJ-3', 'PRJ-2', 'Review');
  await expect.poll(async () => (await issues(page)).find(i => i.id === 'PRJ-3').parentId).toBe('PRJ-2');
  await page.reload(); await expect(page.locator('.swimlane[data-epic-lane="PRJ-2"] [data-issue="PRJ-4"]')).toBeVisible();
  expect((await issues(page)).find(i => i.id === 'PRJ-4')).toEqual(initial[3]);
});
for (const outcome of ['ok', 'fail', 'conflict']) test(`cloud move handles delayed ${outcome} response`, async ({ page }) => {
  await setup(page, true); await move(page, 'PRJ-5', 'PRJ-2', 'Review');
  await expect.poll(() => page.evaluate(() => moveHarness.requests.length)).toBe(1);
  await expect(page.locator('#sync-status')).toContainText('Saving');
  expect(await page.evaluate(() => moveHarness.issues.find(i => i.id === 'PRJ-5').parentId)).toBe('PRJ-1');
  await page.evaluate(outcome => moveHarness.finish(outcome), outcome);
  if (outcome === 'ok') await expect(page.locator('#sync-status')).toHaveText('Synced with Sheets');
  else {
    await expect(page.locator('#draft-recovery')).toContainText(outcome === 'fail' ? 'Failed' : 'Conflict');
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.pending-drafts.v1'))['PRJ-5']);
    expect(draft.input.parentId).toBe('PRJ-2'); expect(draft.input.status).toBe('Review'); expect(draft.mutation).toBe('moveIssue');
    expect(await page.evaluate(() => moveHarness.issues.find(i => i.id === 'PRJ-5').parentId)).toBe('PRJ-1');
  }
});
