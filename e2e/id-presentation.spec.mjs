import { test, expect } from '@playwright/test';
import C from '../Core.js';

const project = {
  issues: [
    { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Website launch', rank: 1000, version: 'v1' },
    { ...C.blank(), id: 'PRJ-2', type: 'Story', summary: 'Sign-in experience', parentId: 'PRJ-1', rank: 2000, version: 'v2' },
    { ...C.blank(), id: 'PRJ-3', type: 'Task', summary: 'Password reset', parentId: 'PRJ-2', rank: 3000, version: 'v3' }
  ],
  comments: [],
  sequence: 3
};

const visibleText = page => page.locator('#view-content').innerText();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(project => localStorage.setItem('sheetflow.project.v1', JSON.stringify(project)), project);
});

test('routine Kanban, Gantt and Sheet surfaces hide issue IDs while ID search still works', async ({ page }) => {
  await page.goto('/#kanban');
  await expect(page.locator('[data-issue="PRJ-3"]')).toContainText('Password reset');
  expect(await visibleText(page)).not.toMatch(/PRJ-\d+/);

  await page.locator('#swimlanes-toggle').check();
  expect(await visibleText(page)).not.toMatch(/PRJ-\d+/);
  await page.locator('#search').fill('PRJ-3');
  await expect(page.locator('[data-issue="PRJ-3"]')).toBeVisible();
  expect(await visibleText(page)).not.toMatch(/PRJ-\d+/);

  await page.locator('[data-view="gantt"]').click();
  await expect(page.locator('[data-gantt-row-id="PRJ-3"]')).toContainText('Password reset');
  expect(await visibleText(page)).not.toMatch(/PRJ-\d+/);

  await page.locator('[data-view="sheet"]').click();
  await expect(page.locator('td[data-column-key="id"]')).toHaveCount(0);
  await expect(page.locator('[data-sheet-row-id="PRJ-3"] [data-field="summary"]')).toHaveValue('Password reset');
  expect(await visibleText(page)).not.toMatch(/PRJ-\d+/);
});

test('Sheet exposes optional IDs and details retains the stable reference', async ({ page }) => {
  await page.goto('/#sheet');
  await page.locator('.sheet-columns-menu > summary').click();
  const idToggle = page.locator('[data-sheet-column-toggle="id"]');
  await expect(idToggle).not.toBeChecked();
  await idToggle.check();
  const idCell = page.locator('[data-sheet-row-id="PRJ-3"] td[data-column-key="id"]');
  await expect(idCell).toContainText('PRJ-3');
  await idCell.locator('[data-open="PRJ-3"]').click();
  await expect(page.locator('#dialog-id')).toHaveText('PRJ-3');
});
