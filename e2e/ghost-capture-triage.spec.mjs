import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'Triage me', status: 'Backlog', priority: 'Medium', rank: 1000, version: 'v1' };

async function seed(page) {
  await page.addInitScript(item => localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 })), issue);
}

const target = (page, view) => page.locator(view === 'sheet' ? '[data-sheet-drag-id="PRJ-1"]' : view === 'kanban' ? '[data-issue="PRJ-1"]' : '[data-open="PRJ-1"].gantt-label-hit');
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0]);

for (const view of ['sheet', 'kanban', 'gantt']) test(`${view}: P/A/M/D micro-triage uses the focused issue and restores focus`, async ({ page }) => {
  await seed(page); await page.goto('/#' + view);
  await target(page, view).focus(); await page.keyboard.press('p');
  await expect(page.locator('#triage-popover')).toBeVisible();
  await page.locator('#triage-form select').selectOption('High'); await page.locator('#triage-form').getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await stored(page)).priority).toBe('High'); await expect(target(page, view)).toBeFocused();

  await page.keyboard.press('a'); await page.locator('#triage-form input').fill('Ada'); await page.locator('#triage-form').getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await stored(page)).assignee).toBe('Ada'); await expect(target(page, view)).toBeFocused();

  await page.keyboard.press('m'); await page.locator('#triage-form select').selectOption('Review'); await page.locator('#triage-form').getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await stored(page)).status).toBe('Review'); await expect(target(page, view)).toBeFocused();

  await page.keyboard.press('d'); await page.locator('#triage-form input').fill('2027-01-15'); await page.locator('#triage-form').getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await stored(page)).dueDate).toBe('2027-01-15'); await expect(target(page, view)).toBeFocused();
});

test('E opens the focused issue and X toggles its Sheet selection', async ({ page }) => {
  await seed(page); await page.goto('/#sheet'); const row = target(page, 'sheet');
  await row.focus(); await page.keyboard.press('x');
  await expect(page.locator('[data-sheet-select="PRJ-1"]')).toBeChecked(); await expect(row).toBeFocused();
  await page.keyboard.press('x'); await expect(page.locator('[data-sheet-select="PRJ-1"]')).not.toBeChecked();
  await page.keyboard.press('e'); await expect(page.locator('#issue-dialog')).toBeVisible(); await expect(page.locator('[name="summary"]')).toHaveValue('Triage me');
});

test('Commands expose the same focused triage action', async ({ page }) => {
  await seed(page); await page.goto('/#kanban'); const card = target(page, 'kanban');
  await card.focus(); await page.keyboard.press('Control+k');
  await page.locator('#command-query').fill('focused priority');
  await page.locator('#command-query').press('Enter');
  await expect(page.locator('#triage-popover')).toBeVisible();
  await expect(page.locator('#triage-title')).toContainText('Priority · PRJ-1');
  await page.keyboard.press('Escape'); await expect(card).toBeFocused();
});

test('micro-triage shortcuts do not fire while typing or when disabled', async ({ page }) => {
  await seed(page); await page.goto('/#kanban');
  await page.locator('#search').fill('p a m d e x');
  await expect(page.locator('#triage-popover')).toBeHidden(); await expect(page.locator('#issue-dialog')).toBeHidden();
  await page.locator('#search').fill('');
  await page.locator('#help-button').click();
  await page.locator('#help-dialog details').filter({ has: page.locator('#single-key-shortcuts') }).locator('summary').click();
  await page.locator('#single-key-shortcuts').uncheck(); await page.keyboard.press('Escape');
  await target(page, 'kanban').focus(); await page.keyboard.press('p');
  await expect(page.locator('#triage-popover')).toBeHidden();
});
