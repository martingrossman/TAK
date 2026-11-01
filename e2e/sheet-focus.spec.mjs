import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'First title', rank: 1000, version: 'v1' };

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
