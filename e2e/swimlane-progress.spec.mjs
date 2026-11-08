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
  await expect(toggle).toBeChecked();
  await expect(page.locator('.swimlane')).not.toHaveCount(0);
  const epic = page.locator('.swimlane[data-epic-lane="PRJ-1"]');
  await expect(epic.locator('.swimlane-progress')).toHaveText('4 visible items · 2/3 leaf work done · 67% complete');
  await expect(page.locator('.swimlane[data-epic-lane="PRJ-2"] .swimlane-progress')).toHaveText('0 visible items · 0/0 leaf work done · 0% complete');
  await expect(page.locator('.swimlane[data-epic-lane=""] .swimlane-progress')).toHaveText('1 visible item · 1/1 leaf work done · 100% complete');

  await page.locator('#workspace-filters > summary').click();
  await page.locator('#status-filter').selectOption('Done');
  await page.locator('#workspace-filters > summary').click();
  await expect(epic.locator('.swimlane-progress')).toHaveText('3 visible items · 2/3 leaf work done · 67% complete');
  await epic.locator('[data-toggle-lane="PRJ-1"]').click();
  await expect(epic).toHaveClass(/collapsed/);
  await expect(epic.locator('.swimlane-progress')).toContainText('2/3 leaf work done');
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(epic.locator('.swimlane-progress')).toContainText('2/3 leaf work done');
});

test('grouped Kanban keeps visible bulk controls and folds each displayed Epic', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ project }) => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify(project));
    localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ swimlanes: true, collapsedEpics: { 'PRJ-1': true } }));
  }, { project: { issues, comments: [], sequence: 7 } });
  await page.goto('/#kanban');
  const group = page.getByRole('group', { name: 'Kanban Epic display' });
  const expand = page.locator('#kanban-expand-all');
  const collapse = page.locator('#kanban-collapse-all');
  await expect(group).toBeVisible();
  await expect(group).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-toggle-lane="PRJ-1"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-toggle-lane="PRJ-2"]')).toHaveAttribute('aria-expanded', 'true');

  await expand.press('Enter');
  await expect(expand).toBeDisabled();
  await expect(collapse).toBeFocused();
  await expect(page.locator('[data-toggle-lane="PRJ-1"]')).toHaveAttribute('aria-expanded', 'true');
  await collapse.click();
  await expect(collapse).toBeDisabled();
  await expect(expand).toBeFocused();
  await expect(page.locator('[data-toggle-lane="PRJ-1"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-toggle-lane="PRJ-2"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-toggle-lane="__no_epic__"]')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('#search').fill('Outside epic');
  await expect(group).toBeVisible();
  await expect(expand).toBeDisabled();
  await expect(collapse).toBeDisabled();
});
