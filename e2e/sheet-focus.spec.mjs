import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'First title', rank: 1000, version: 'v1' };

async function expectCellExposed(cell) {
  await expect(cell).toBeFocused();
  await expect.poll(() => cell.evaluate(element => {
    const viewport = element.closest('.table-wrap'), bounds = viewport.getBoundingClientRect();
    const pinned = element.closest('tr').cells[0].getBoundingClientRect();
    const header = viewport.querySelector('thead th').getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const left = Math.max(bounds.left + viewport.clientLeft, pinned.right);
    const right = bounds.left + viewport.clientLeft + viewport.clientWidth;
    const top = Math.max(bounds.top + viewport.clientTop, header.bottom);
    const bottom = bounds.top + viewport.clientTop + viewport.clientHeight;
    return rect.left >= left - 1 && Math.min(rect.right, right) - rect.left >= Math.min(rect.width, right - left) - 1
      && rect.top >= top - 1 && rect.bottom <= bottom + 1;
  })).toBe(true);
}

for (const width of [1366, 390]) test(`Sheet Tab and Shift+Tab reveal cells past the pinned column at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(item => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#sheet');
  const cells = page.locator('.cell-input[data-id="PRJ-1"]');
  await expect(cells.first()).toBeVisible();
  const count = await cells.count(), viewport = page.locator('.table-wrap');
  await cells.first().focus();
  for (let index = 1; index < count; index++) {
    await cells.nth(index - 1).press('Tab');
    await expectCellExposed(cells.nth(index));
  }
  const farRight = await viewport.evaluate(element => element.scrollLeft);
  expect(farRight).toBeGreaterThan(100);
  for (let index = count - 2; index >= 0; index--) {
    await cells.nth(index + 1).press('Shift+Tab');
    await expectCellExposed(cells.nth(index));
  }
  expect(await viewport.evaluate(element => element.scrollLeft)).toBeLessThan(farRight);
});

test('Sheet Enter and Shift+Enter reveal rows below and above the sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(item => {
    const issues = Array.from({ length: 25 }, (_, index) => ({ ...item, id: `PRJ-${index + 1}`, summary: `Title ${index + 1}`, rank: (index + 1) * 1000 }));
    localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 25 }));
  }, issue);
  await page.goto('/#sheet');
  const cells = page.locator('.cell-input[data-field="summary"]'), viewport = page.locator('.table-wrap');
  await cells.first().focus();
  for (let index = 1; index < 25; index++) {
    await cells.nth(index - 1).press('Enter');
    await expectCellExposed(cells.nth(index));
  }
  const bottomScroll = await viewport.evaluate(element => element.scrollTop);
  expect(bottomScroll).toBeGreaterThan(100);
  for (let index = 23; index >= 0; index--) {
    await cells.nth(index + 1).press('Shift+Enter');
    await expectCellExposed(cells.nth(index));
  }
  expect(await viewport.evaluate(element => element.scrollTop)).toBeLessThan(bottomScroll);
});

for (const outcome of ['success', 'failure']) test(`Sheet keeps the revealed destination through a delayed cloud ${outcome}`, async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 844 });
  await page.addInitScript(item => {
    window.sheetFocusHarness = { issue: item, pending: null };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(callback) { this.success = callback; return this; },
      withFailureHandler(callback) { this.failure = callback; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: [sheetFocusHarness.issue], comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      saveIssue(input) { sheetFocusHarness.pending = { input, success: this.success, failure: this.failure }; }
    }; } });
  }, issue);
  await page.goto('/#sheet');
  const summary = page.locator('.cell-input[data-id="PRJ-1"][data-field="summary"]');
  const status = page.locator('.cell-input[data-id="PRJ-1"][data-field="status"]');
  await summary.fill('Changed while scrolling');
  await summary.press('Tab');
  await expectCellExposed(status);
  await expect.poll(() => page.evaluate(() => Boolean(sheetFocusHarness.pending))).toBe(true);
  const scrollLeft = await page.locator('.table-wrap').evaluate(element => element.scrollLeft);
  await page.evaluate(outcome => {
    const request = sheetFocusHarness.pending;
    if (outcome === 'failure') request.failure({ message: 'Temporary test failure' });
    else {
      sheetFocusHarness.issue = { ...sheetFocusHarness.issue, ...request.input, version: 'v2' };
      request.success(sheetFocusHarness.issue);
    }
  }, outcome);
  if (outcome === 'success') await expect(page.locator('#sync-status')).toHaveText('Synced with Sheets');
  else await expect(page.locator('#retry-save')).toBeVisible();
  await expectCellExposed(status);
  await expect(summary).toHaveValue('Changed while scrolling');
  expect(await page.locator('.table-wrap').evaluate(element => element.scrollLeft)).toBe(scrollLeft);
});

test('Sheet keeps the next cell focused after a changed value and save render', async ({ page }) => {
  await page.addInitScript(item => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#sheet');
  const summary = page.locator('.cell-input[data-id="PRJ-1"][data-field="summary"]');
  const status = page.locator('.cell-input[data-id="PRJ-1"][data-field="status"]');
  await summary.fill('Changed title');
  await summary.press('Tab');
  await expect(status).toBeFocused();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].summary)).toBe('Changed title');
  await expect(status).toBeFocused();
});

test('Sheet Escape cancels an unsent value and Enter saves then advances in the column', async ({ page }) => {
  const second = { ...issue, id: 'PRJ-2', summary: 'Second title', rank: 2000, version: 'v2' };
  await page.addInitScript(items => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: items, comments: [], sequence: 2 }));
  }, [issue, second]);
  await page.goto('/#sheet');
  const summary = page.locator('.cell-input[data-id="PRJ-1"][data-field="summary"]');
  const next = page.locator('.cell-input[data-id="PRJ-2"][data-field="summary"]');
  await summary.fill('Unsent title');
  await summary.press('Escape');
  await expect(summary).toHaveValue('First title');
  await expect(summary).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].summary)).toBe('First title');
  await summary.fill('Committed title');
  await summary.press('Enter');
  await expect(next).toBeFocused();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].summary)).toBe('Committed title');
  await expect(next).toBeFocused();
});

test('Sheet keeps ID and title visible in its pinned column while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(item => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#sheet');
  const pinned = page.locator('[data-sheet-row-id="PRJ-1"] td:first-child');
  await expect(pinned.locator('.sheet-id-summary')).toHaveText('First title');
  const before = await pinned.boundingBox();
  await page.locator('.table-wrap').evaluate(element => { element.scrollLeft = 700; });
  const after = await pinned.boundingBox();
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
