import { test, expect } from '@playwright/test';
import C from '../Core.js';

const initial = [
  { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'First epic', rank: 1000, version: 'v1' },
  { ...C.blank(), id: 'PRJ-2', type: 'Epic', summary: 'Second epic', rank: 2000, version: 'v2' },
  { ...C.blank(), id: 'PRJ-3', summary: 'Focused task', parentId: 'PRJ-2', status: 'In Progress', rank: 3000, version: 'v3' }
];

async function seedLocal(page) {
  await page.addInitScript(items => localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: items, comments: [], sequence: 3 })), initial);
}

async function seedCloud(page) {
  await page.addInitScript(({ items, blank }) => {
    const harness = window.captureHarness = { requests: [], issues: structuredClone(items), receipts: {}, sequence: 3 };
    window.finishCapture = (index, outcome = 'success') => {
      const request = harness.requests[index];
      if (outcome === 'fail') { request.failure({ message: 'Temporary connection failure' }); return; }
      let saved = harness.receipts[request.input.operationId];
      if (!saved) {
        saved = { ...blank, ...request.input, id: `PRJ-${++harness.sequence}`, version: `saved-${harness.sequence}` };
        harness.receipts[request.input.operationId] = saved; harness.issues.push(saved);
      }
      request.success(structuredClone(saved));
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(handler) { this.success = handler; return this; },
      withFailureHandler(handler) { this.failure = handler; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: harness.issues, comments: {}, settings: [], spreadsheetUrl: '', name: 'Cloud fixture' })); },
      saveIssue(input, version) { harness.requests.push({ input: structuredClone(input), version, success: this.success, failure: this.failure }); }
    }; } });
  }, { items: initial, blank: C.blank() });
}

test('visible Kanban Add opens Ghost Capture in the exact lane without a permanent input', async ({ page }) => {
  await seedCloud(page); await page.goto('/#kanban'); await page.locator('#swimlanes-toggle').check();
  await expect(page.locator('#quick-title')).toBeHidden();
  const add = page.locator('.swimlane[data-epic-lane="PRJ-2"] .column[data-status="In Progress"] .ghost-add');
  await add.click();
  await expect(page.locator('#quick-title')).toBeFocused();
  await expect(page.locator('#quick-status')).toHaveValue('In Progress');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Second epic');
  await page.locator('#quick-title').fill('Created in lane'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => captureHarness.requests.length)).toBe(1);
  expect(await page.evaluate(() => captureHarness.requests[0].input)).toMatchObject({ summary: 'Created in lane', parentId: 'PRJ-2', status: 'In Progress', type: 'Task' });
  await page.evaluate(() => finishCapture(0));
  await expect(page.locator('[data-issue="PRJ-4"]')).toContainText('Created in lane');
  await expect(page.locator('#quick-title')).toBeFocused();
});

test('failed Ghost Capture stays recoverable and retries with the same operation identity', async ({ page }) => {
  await seedCloud(page); await page.goto('/#kanban');
  await page.locator('[data-issue="PRJ-3"]').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Retry safely'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => captureHarness.requests.length)).toBe(1);
  await page.evaluate(() => finishCapture(0, 'fail'));
  await expect(page.locator('.pending-card.failed')).toContainText('Retry safely');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => captureHarness.requests.length)).toBe(2);
  expect(await page.evaluate(() => captureHarness.requests[0].input.operationId === captureHarness.requests[1].input.operationId)).toBe(true);
  await page.evaluate(() => finishCapture(1));
  await expect(page.locator('.pending-card')).toHaveCount(0);
  expect(await page.evaluate(() => captureHarness.issues.filter(issue => issue.summary === 'Retry safely').length)).toBe(1);
});

test('multiline paste previews editable titles and creates them in order and context', async ({ page }) => {
  await seedLocal(page); await page.goto('/#kanban');
  await page.locator('[data-issue="PRJ-3"]').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').evaluate((input, text) => {
    const data = new DataTransfer(); data.setData('text', text);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, 'First pasted\nSecond pasted\nRemove me');
  await expect(page.locator('#quick-batch')).toBeVisible();
  await expect(page.locator('#quick-batch-status')).toContainText('3 tasks');
  await page.locator('#quick-batch-input').fill('First pasted\nSecond pasted');
  await page.locator('#quick-batch-submit').click();
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues.filter(issue => issue.summary.includes('pasted')).map(issue => issue.summary)))).toEqual(['First pasted', 'Second pasted']);
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues.filter(issue => issue.summary.includes('pasted')));
  expect(created.map(issue => issue.parentId)).toEqual(['PRJ-2', 'PRJ-2']);
  expect(created.map(issue => issue.status)).toEqual(['In Progress', 'In Progress']);
  expect(created[0].rank).toBeLessThan(created[1].rank);
});

test('Escape hides Ghost Capture but preserves and resumes the exact draft', async ({ page }) => {
  await seedLocal(page); await page.goto('/#sheet');
  await page.locator('[data-sheet-drag-id="PRJ-3"]').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Unfinished draft'); await page.keyboard.press('Escape');
  await expect(page.locator('#quick-title')).toBeHidden();
  await page.locator('[data-sheet-drag-id="PRJ-1"]').focus(); await page.keyboard.press('s');
  await expect(page.locator('#quick-title')).toHaveValue('Unfinished draft');
  await expect(page.locator('#quick-kind')).toHaveValue('Task');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Second epic');
});

test('Ghost Capture docks inside the viewport when its anchor scrolls above or below', async ({ page }) => {
  const items = structuredClone(initial), template = items.find(issue => issue.id === 'PRJ-3');
  for (let number = 4; number <= 43; number++) items.push({ ...template, id: `PRJ-${number}`, summary: `Scrollable task ${number}`, rank: number * 1000, version: `v${number}` });
  await page.addInitScript(projectIssues => localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: projectIssues, comments: [], sequence: 43 })), items);
  await page.setViewportSize({ width: 900, height: 480 }); await page.goto('/#sheet');
  const captureFits = () => page.locator('.quick-entry').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 7 && rect.bottom <= innerHeight - 7;
  });
  const viewport = page.locator('.table-wrap');

  await page.locator('[data-sheet-drag-id="PRJ-43"]').scrollIntoViewIfNeeded();
  await page.locator('[data-sheet-drag-id="PRJ-43"]').focus(); await page.keyboard.press('t');
  await viewport.evaluate(element => { element.scrollTop = 0; });
  await expect(page.locator('#quick-title')).toBeVisible();
  await expect.poll(captureFits).toBe(true);

  await page.locator('#quick-clear').click(); await page.keyboard.press('Escape');
  await page.locator('[data-sheet-drag-id="PRJ-1"]').scrollIntoViewIfNeeded();
  await page.locator('[data-sheet-drag-id="PRJ-1"]').focus(); await page.keyboard.press('t');
  await viewport.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator('#quick-title')).toBeVisible();
  await expect.poll(captureFits).toBe(true);
});
