import { test, expect } from '@playwright/test';

const year = new Date().getFullYear();

test('roadmap opens with shortcut 4, edits an increment and keeps it after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#kanban');
  await expect(page.locator('#sync-status')).toHaveText('Saved in this browser');
  await page.keyboard.press('4');
  await expect(page).toHaveURL(/#roadmap$/);
  await expect(page.getByRole('button', { name: 'Roadmap', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.workspace-bar')).toBeHidden();
  await expect(page.locator('.roadmap-year')).toHaveText(String(year));
  await expect(page.locator('.roadmap-stream:not(.roadmap-milestones)')).toHaveCount(5);

  await page.getByRole('button', { name: 'Help bot', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit increment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Title')).toBeFocused();
  await dialog.getByLabel('Title').fill('Help bot v2');
  await dialog.getByLabel('End').fill(`${year}-03-31`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Help bot v2', exact: true })).toBeFocused();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Help bot v2', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('roadmap validates input, keeps the draft, and protects streams that still have items', async ({ page }) => {
  await page.goto('/#roadmap');
  await page.getByRole('button', { name: 'Add stream', exact: true }).first().click();
  const stream = page.getByRole('dialog', { name: 'New stream' });
  await stream.getByRole('button', { name: 'Save' }).click();
  await expect(stream.locator('#roadmap-status')).toHaveText(/title/);
  await stream.getByLabel('Title').fill('Analytics');
  await stream.getByText('Violet', { exact: true }).locator('..').click();
  await stream.getByRole('button', { name: 'Save' }).click();
  await expect(stream).toBeHidden();
  const added = page.locator('.roadmap-stream[aria-label="Analytics"]');
  await expect(added).toHaveAttribute('data-roadmap-color', 'violet');

  await added.getByRole('button', { name: '+ Add increment' }).click();
  const increment = page.getByRole('dialog', { name: 'New increment' });
  await expect(increment.getByLabel('Stream')).toHaveValue(/RM-\d+/);
  await increment.getByLabel('Title').fill('Usage dashboard');
  await increment.getByLabel('Start').fill(`${year}-06-01`);
  await increment.getByLabel('End').fill(`${year}-05-01`);
  await increment.getByRole('button', { name: 'Save' }).click();
  await expect(increment.locator('#roadmap-status')).toHaveText(/end date must be on or after/);
  await expect(increment.getByLabel('Title')).toHaveValue('Usage dashboard');
  await increment.getByLabel('End').fill(`${year}-07-15`);
  await increment.getByRole('button', { name: 'Save' }).click();
  await expect(added.getByRole('button', { name: 'Usage dashboard' })).toBeVisible();

  await added.getByRole('button', { name: 'Analytics', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit stream' });
  await edit.getByRole('button', { name: 'Delete' }).click();
  await expect(edit.locator('#roadmap-status')).toHaveText(/Delete again/);
  await edit.getByRole('button', { name: 'Delete' }).click();
  await expect(edit.locator('#roadmap-status')).toHaveText(/before deleting the stream/);
  await edit.getByRole('button', { name: 'Cancel' }).click();
  await expect(added).toBeVisible();
});

test('stream order moves with the keyboard buttons and year navigation hides other years', async ({ page }) => {
  await page.goto('/#roadmap');
  const titles = page.locator('.roadmap-stream:not(.roadmap-milestones) .roadmap-stream-title');
  await expect(titles.first()).toHaveText('Self serve');
  await page.getByRole('button', { name: 'Move Self serve down' }).click();
  await expect(titles.nth(0)).toHaveText('Mobile');
  await expect(titles.nth(1)).toHaveText('Self serve');
  await expect(page.getByRole('button', { name: 'Move Self serve down' })).toBeFocused();
  await page.reload();
  await expect(titles.nth(0)).toHaveText('Mobile');

  await page.getByRole('button', { name: 'Next year' }).click();
  await expect(page.locator('.roadmap-year')).toHaveText(String(year + 1));
  await expect(page.locator('.roadmap-bar')).toHaveCount(0);
  await expect(page.locator('.roadmap-hidden').first()).toContainText(`outside ${year + 1}`);
  await page.getByRole('button', { name: 'This year' }).click();
  await expect(page.locator('.roadmap-year')).toHaveText(String(year));
});

test('the theme toggle switches and remembers dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#roadmap');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute('aria-pressed', 'true');
});
