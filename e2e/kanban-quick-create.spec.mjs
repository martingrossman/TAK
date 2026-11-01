import { test, expect } from '@playwright/test';
import C from '../Core.js';

test.use({ viewport: { width: 760, height: 900 } });

const initial = [
  { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'First epic', rank: 1000, version: 'v1' },
  { ...C.blank(), id: 'PRJ-2', type: 'Epic', summary: 'Second epic', rank: 2000, version: 'v2' },
  ...Array.from({ length: 4 }, (_, index) => ({ ...C.blank(), id: `PRJ-${index + 3}`, summary: `Existing task ${index}`, parentId: 'PRJ-2', status: 'In Progress', rank: 3000 + index * 1000, version: `v${index + 3}` }))
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ initial, blank }) => {
    const harness = window.cloudHarness = { requests: [], issues: initial, receipts: {}, sequence: 6 };
    window.finishSave = (index, outcome = 'success') => {
      const request = harness.requests[index];
      if (outcome === 'fail') { request.failure({ message: 'Temporary connection failure' }); return; }
      let saved = harness.receipts[request.input.operationId];
      if (!saved) {
        saved = { ...blank, ...request.input, id: `PRJ-${++harness.sequence}`, version: `saved-${harness.sequence}`, rank: harness.sequence * 1000 };
        delete saved._draftKey; delete saved.operationId;
        harness.receipts[request.input.operationId] = saved; harness.issues.push(saved);
      }
      if (outcome === 'lost') request.failure({ message: 'Save acknowledgement lost' }); else request.success(saved);
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() {
      return {
        withSuccessHandler(handler) { this.success = handler; return this; },
        withFailureHandler(handler) { this.failure = handler; return this; },
        getProject() { queueMicrotask(() => this.success({ issues: harness.issues, comments: {}, settings: [], spreadsheetUrl: '', name: 'Cloud fixture' })); },
        saveIssue(input, version) { harness.requests.push({ input, version, success: this.success, failure: this.failure }); }
      };
    } });
  }, { initial, blank: C.blank() });
  await page.goto('/');
  await page.locator('#swimlanes-toggle').check();
  await expect(page.locator('[data-epic-lane="PRJ-2"]')).toBeVisible();
});

const inputFor = page => page.locator('[data-epic-lane="PRJ-2"] [data-quick-title="In Progress"]');
const requestCount = page => page.evaluate(() => window.cloudHarness.requests.length);

test('global quick add inherits a selected Epic while an explicit No Epic lane stays independent', async ({ page }) => {
  await page.locator('.workspace-options > summary').click();
  await page.locator('#epic-nav [data-epic="PRJ-1"]').click();
  const globalInput = page.locator('#quick-title');
  await globalInput.fill('Selected Epic task');
  await globalInput.press('Enter');
  await expect.poll(() => requestCount(page)).toBe(1);
  expect(await page.evaluate(() => window.cloudHarness.requests[0].input.parentId)).toBe('PRJ-1');
  await page.evaluate(() => window.finishSave(0));

  const noEpicInput = page.locator('.swimlane[data-epic-lane=""] [data-quick-title="Backlog"]');
  await noEpicInput.fill('Independent task');
  await noEpicInput.press('Enter');
  await expect.poll(() => requestCount(page)).toBe(2);
  expect(await page.evaluate(() => window.cloudHarness.requests[1].input.parentId)).toBe('');
  await page.evaluate(() => window.finishSave(1));
  expect(await page.evaluate(() => window.cloudHarness.issues.filter(issue => ['Selected Epic task', 'Independent task'].includes(issue.summary)).map(issue => [issue.summary, issue.parentId]))).toEqual([
    ['Selected Epic task', 'PRJ-1'], ['Independent task', '']
  ]);
});

test('inline Enter ignores IME composition and Escape cancels only the unsent title', async ({ page }) => {
  for (const input of [page.locator('#quick-title'), inputFor(page)]) {
    await input.fill('Composing title');
    await input.evaluate(element => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
      const legacyComposition = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      Object.defineProperty(legacyComposition, 'keyCode', { value: 229 });
      element.dispatchEvent(legacyComposition);
    });
    expect(await requestCount(page)).toBe(0);
    await expect(input).toHaveValue('Composing title');
    await input.press('Escape');
    await expect(input).toHaveValue('');
    await expect(input).not.toBeFocused();
  }
  await inputFor(page).fill('Submitted title');
  await inputFor(page).press('Enter');
  await expect.poll(() => requestCount(page)).toBe(1);
  await page.evaluate(() => window.finishSave(0));
  await expect(page.locator('[data-issue="PRJ-7"]')).toContainText('Submitted title');
});

test('Sheet keeps a quick addition visible and retries a failed save with the same identity', async ({ page }) => {
  await page.locator('[data-view="sheet"]').click();
  await page.locator('#quick-title').fill('Sheet quick draft');
  await page.locator('#quick-title').press('Enter');
  const pending = page.locator('#quick-entry-pending');
  await expect(pending).toContainText('Sheet quick draft');
  await expect(pending).toContainText('Saving');
  await page.evaluate(() => window.finishSave(0, 'fail'));
  await expect(pending).toContainText('Save unconfirmed');
  await pending.getByRole('button', { name: 'Retry save' }).click();
  await expect.poll(() => requestCount(page)).toBe(2);
  expect(await page.evaluate(() => window.cloudHarness.requests[0].input.operationId === window.cloudHarness.requests[1].input.operationId)).toBe(true);
  await page.evaluate(() => window.finishSave(1));
  await expect(pending).toBeHidden();
  expect(await page.evaluate(() => window.cloudHarness.issues.filter(issue => issue.summary === 'Sheet quick draft').length)).toBe(1);
});

test('Epic quick-add appears before the server responds and preserves focus, text, and scroll', async ({ page }) => {
  const input = inputFor(page);
  await input.fill('Fast feedback');
  await input.scrollIntoViewIfNeeded();
  const top = (await input.boundingBox()).y;
  await input.press('Enter');
  await expect(page.locator('.pending-card')).toContainText('Fast feedback');
  await expect(page.locator('.pending-card')).toContainText('Saving');
  await expect(input).toBeFocused();
  expect(Math.abs((await input.boundingBox()).y - top)).toBeLessThan(4);
  await input.fill('Next unfinished title');
  const otherKind = page.locator('[data-epic-lane="PRJ-1"] [data-quick-kind="Backlog"]');
  await otherKind.selectOption('Story');
  await input.focus();
  const beforeAck = (await input.boundingBox()).y;
  const horizontalPositions = await page.locator('.board').evaluateAll(boards => boards.map(board => board.scrollLeft));
  await page.evaluate(() => window.finishSave(0));
  await expect(page.locator('.pending-card')).toHaveCount(0);
  await expect(page.locator('[data-issue="PRJ-7"]')).toContainText('Fast feedback');
  await expect(input).toHaveValue('Next unfinished title');
  await expect(input).toBeFocused();
  await expect(otherKind).toHaveValue('Story');
  expect(Math.abs((await input.boundingBox()).y - beforeAck)).toBeLessThan(4);
  expect(await page.locator('.board').evaluateAll(boards => boards.map(board => board.scrollLeft))).toEqual(horizontalPositions);
  const saved = await page.evaluate(() => window.cloudHarness.issues.at(-1));
  expect(saved.parentId).toBe('PRJ-2'); expect(saved.status).toBe('In Progress');
});

test('consecutive entries are immediately visible while queued and leave global drafts intact', async ({ page }) => {
  const input = inputFor(page);
  await input.fill('First submission'); await input.press('Enter');
  await input.fill('Second submission'); await input.press('Enter');
  await expect(page.locator('.pending-card')).toHaveCount(2);
  await expect(page.locator('.pending-card.queued')).toContainText('Second submission');
  await page.getByRole('textbox', { name: 'New task title', exact: true }).fill('Do not overwrite this');
  expect(await requestCount(page)).toBe(1);
  await page.evaluate(() => window.finishSave(0));
  await expect.poll(() => requestCount(page)).toBe(2);
  await expect(page.getByRole('textbox', { name: 'New task title', exact: true })).toHaveValue('Do not overwrite this');
  await page.evaluate(() => window.finishSave(1));
  await expect(page.locator('.pending-card')).toHaveCount(0);
  expect(await page.evaluate(() => window.cloudHarness.issues.filter(issue => issue.id === 'PRJ-7' || issue.id === 'PRJ-8').map(issue => issue.parentId))).toEqual(['PRJ-2', 'PRJ-2']);
});

test('a lost acknowledgement retains the card and retries with the same operation ID', async ({ page }) => {
  const input = inputFor(page);
  await input.fill('Retry safely'); await input.press('Enter');
  await page.evaluate(() => window.finishSave(0, 'lost'));
  await expect(page.locator('.pending-card.failed')).toContainText('Save unconfirmed');
  await expect(page.locator('.pending-card.failed')).toContainText('Save acknowledgement lost');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect.poll(() => requestCount(page)).toBe(2);
  expect(await page.evaluate(() => window.cloudHarness.requests[0].input.operationId === window.cloudHarness.requests[1].input.operationId)).toBe(true);
  await page.evaluate(() => window.finishSave(1));
  await expect(page.locator('.pending-card')).toHaveCount(0);
  await expect(page.locator('[data-issue="PRJ-7"]')).toContainText('Retry safely');
  expect(await page.evaluate(() => window.cloudHarness.issues.filter(issue => issue.summary === 'Retry safely').length)).toBe(1);
});

test('an unfinished quick-create draft remains retryable after a reload', async ({ page }) => {
  const input = inputFor(page);
  await input.fill('Recover after reload'); await input.press('Enter');
  await page.reload();
  await expect(page.locator('.pending-card.failed')).toContainText('Recover after reload');
  await expect(page.locator('.pending-card.failed')).toContainText('Save is unconfirmed');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect.poll(() => requestCount(page)).toBe(1);
  await page.evaluate(() => window.finishSave(0));
  await expect(page.locator('.pending-card')).toHaveCount(0);
  await expect(page.locator('[data-issue="PRJ-7"]')).toContainText('Recover after reload');
});
