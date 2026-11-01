import { test, expect } from '@playwright/test';

test('each view keeps its own horizontal scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#kanban');
  const board = page.locator('.board').first();
  await board.evaluate(element => { element.scrollLeft = 300; });
  const boardLeft = await board.evaluate(element => element.scrollLeft);
  expect(boardLeft).toBeGreaterThan(100);
  await page.locator('[data-view="sheet"]').click();
  const sheet = page.locator('.table-wrap');
  await sheet.evaluate(element => { element.scrollLeft = 500; });
  const sheetLeft = await sheet.evaluate(element => element.scrollLeft);
  expect(sheetLeft).toBeGreaterThan(100);
  await page.locator('[data-view="kanban"]').click();
  await expect.poll(() => board.evaluate(element => element.scrollLeft)).toBe(boardLeft);
  await page.locator('[data-view="sheet"]').click();
  await expect.poll(() => sheet.evaluate(element => element.scrollLeft)).toBe(sheetLeft);
});
