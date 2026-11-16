import { test, expect } from '@playwright/test';

test('a starter copy without access yet asks the user to pick that spreadsheet', async ({ page }) => {
  await page.addInitScript(() => {
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ needsPicker: true, requestedSheetId: 'starter-copy-id-0123456789', issues: [], comments: {}, settings: [] })); }
    }; } });
  });
  await page.goto('/#kanban');
  await expect(page.getByRole('heading', { name: 'Allow TAK to open your spreadsheet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select your spreadsheet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create blank TAK Sheet' })).toBeVisible();
});
