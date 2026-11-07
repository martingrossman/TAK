import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'Palette task', rank: 1000, version: 'v1' };

test('commands open issues, switch views, and restore focus on Escape', async ({ page }) => {
  await page.addInitScript(item => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#kanban');
  await expect(page.locator('#command-open')).toBeEnabled();
  await page.locator('#command-open').focus();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-dialog')).toBeVisible();
  const query = page.locator('#command-query');
  await expect(query).toBeFocused();
  await query.fill('PRJ-1');
  await query.press('Enter');
  await expect(page.locator('#issue-dialog')).toBeVisible();
  await expect(page.locator('#issue-form [name="summary"]')).toHaveValue('Palette task');
  await page.keyboard.press('Escape');
  await page.locator('#command-open').click();
  await expect(query).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#command-open')).toBeFocused();
  await page.locator('#command-open').click();
  await page.locator('#command-results').getByRole('button', { name: 'Switch to Sheet' }).click();
  await expect(page.locator('#view-title')).toHaveText('Sheet');
  await expect(page).toHaveURL(/#sheet$/);
});
