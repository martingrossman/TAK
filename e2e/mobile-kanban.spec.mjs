import { test, expect } from '@playwright/test';
import C from '../Core.js';

const initial = [
  { id: 'PRJ-1', type: 'Epic', summary: 'Mobile epic' },
  { id: 'PRJ-2', summary: 'Backlog task', parentId: 'PRJ-1', status: 'Backlog' },
  { id: 'PRJ-3', summary: 'Second backlog task', parentId: 'PRJ-1', status: 'Backlog' },
  { id: 'PRJ-4', summary: 'Work in progress', parentId: 'PRJ-1', status: 'In Progress' }
].map((issue, index) => ({ ...C.blank(), rank: (index + 1) * 1000, version: `v${index}`, ...issue }));

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function setup(page) {
  await page.addInitScript(seed => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: seed, comments: [], sequence: 4 }));
  }, initial);
  await page.goto('/#kanban');
  await expect(page.locator('.kanban-tabs [data-kanban-tab]')).toHaveCount(C.statuses.length);
}
const columnInView = page => page.evaluate(() => {
  const board = document.querySelector('.board'), left = board.getBoundingClientRect().left;
  return [...board.querySelectorAll(':scope > .column')].find(column => Math.abs(column.getBoundingClientRect().left - left) < 4)?.dataset.status;
});

test('phones start without swimlanes and show one snapped column with status tabs', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.swimlane')).toHaveCount(0);
  await expect(page.locator('.kanban-tabs .active')).toContainText('Backlog');
  const width = await page.evaluate(() => [document.querySelector('.board').clientWidth, document.querySelector('.board > .column').offsetWidth]);
  expect(width[1]).toBeGreaterThan(width[0] * 0.8);
  await page.locator('[data-kanban-tab="3"]').click();
  await expect.poll(() => columnInView(page)).toBe(C.statuses[3]);
  await expect(page.locator('.kanban-tabs .active')).toContainText(C.statuses[3]);
});

test('long-press drag moves a card to another column and a short swipe does not', async ({ page, context }) => {
  await setup(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const title = page.locator('.card[data-issue="PRJ-2"] .card-title');
  let box = await title.boundingBox();
  await touch('touchStart', box.x + 20, box.y + 8);
  await touch('touchMove', box.x + 60, box.y + 8);
  await touch('touchEnd');
  await expect(page.locator('body')).not.toHaveClass(/touch-dragging/);
  await expect(page.locator('.card[data-issue="PRJ-2"]')).toHaveAttribute('data-issue', 'PRJ-2');
  expect(await page.locator('.card[data-issue="PRJ-2"]').evaluate(card => card.closest('.column').dataset.status)).toBe('Backlog');

  await page.evaluate(() => document.querySelector('.board').scrollTo({ left: 0 }));
  box = await title.boundingBox();
  await touch('touchStart', box.x + 20, box.y + 8);
  await expect(page.locator('body')).toHaveClass(/touch-dragging/);
  for (let x = box.x + 20; x < 384; x += 24) await touch('touchMove', x, box.y + 8);
  await expect.poll(() => page.evaluate(() => document.querySelector('.board').scrollLeft)).toBeGreaterThan(150);
  await touch('touchMove', 200, box.y + 8);
  const target = await page.evaluate(y => document.elementFromPoint(200, y)?.closest('.column')?.dataset.status, box.y + 8);
  await touch('touchEnd');
  expect(target).not.toBe('Backlog');
  await expect.poll(() => page.locator('.card[data-issue="PRJ-2"]').evaluate(card => card.closest('.column').dataset.status)).toBe(target);
  await expect(page.locator('.touch-drag-ghost')).toHaveCount(0);
});
