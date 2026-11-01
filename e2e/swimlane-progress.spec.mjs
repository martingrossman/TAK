import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issues = [
  { id: 'PRJ-1', type: 'Epic', summary: 'Delivery epic' },
  { id: 'PRJ-2', type: 'Epic', summary: 'Empty epic' },
  { id: 'PRJ-3', type: 'Story', parentId: 'PRJ-1', summary: 'Parent story', status: 'Done' },
  { id: 'PRJ-4', parentId: 'PRJ-3', summary: 'Leaf A', status: 'Done' },
  { id: 'PRJ-5', parentId: 'PRJ-3', summary: 'Leaf B', status: 'Done' },
  { id: 'PRJ-6', parentId: 'PRJ-3', summary: 'Leaf C', status: 'Backlog' },
  { id: 'PRJ-7', summary: 'Outside epic', status: 'Done' }
].map((issue, index) => ({ ...C.blank(), rank: (index + 1) * 1000, version: 'v' + index, ...issue }));

test('first-use flat board and filtered Epic progress count overall leaf work', async ({ page }) => {
  await page.addInitScript(project => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify(project));
  }, { issues, comments: [], sequence: 7 });
  await page.goto('/#kanban');
  const toggle = page.locator('#swimlanes-toggle');
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.swimlane')).toHaveCount(0);

  await toggle.check();
  const epic = page.locator('.swimlane[data-epic-lane="PRJ-1"]');
  await expect(epic.locator('.swimlane-progress')).toHaveText('4 visible items · 2/3 leaf work done · 67% complete');
  await expect(page.locator('.swimlane[data-epic-lane="PRJ-2"] .swimlane-progress')).toHaveText('0 visible items · 0/0 leaf work done · 0% complete');
  await expect(page.locator('.swimlane[data-epic-lane=""] .swimlane-progress')).toHaveText('1 visible item · 1/1 leaf work done · 100% complete');

  await page.locator('#workspace-filters > summary').click();
  await page.locator('#status-filter').selectOption('Done');
  await expect(epic.locator('.swimlane-progress')).toHaveText('3 visible items · 2/3 leaf work done · 67% complete');
  await epic.locator('[data-toggle-lane="PRJ-1"]').click();
  await expect(epic).toHaveClass(/collapsed/);
  await expect(epic.locator('.swimlane-progress')).toContainText('2/3 leaf work done');
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(epic.locator('.swimlane-progress')).toContainText('2/3 leaf work done');
});
