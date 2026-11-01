import { test, expect } from '@playwright/test';
import C from '../Core.js';

test('a missing Apps Script callback leaves an actionable unconfirmed draft', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(blank => {
    const h = window.timeoutHarness = {
      issue: { ...blank, id: 'PRJ-1', summary: 'Delayed task', rank: 1000, version: 'v1' },
      requests: []
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: [structuredClone(h.issue)], comments: {}, settings: [], mode: 'team', spreadsheetUrl: '' })); },
      saveIssue(input, version) { h.requests.push({ input: structuredClone(input), version, success: this.success, failure: this.failure }); }
    }; } });
  }, C.blank());
  await page.goto('/#sheet');
  await page.locator('[data-field="priority"][data-id="PRJ-1"]').selectOption('High');
  await expect.poll(() => page.evaluate(() => timeoutHarness.requests.length)).toBe(1);
  await page.clock.fastForward(30001);
  await expect(page.locator('#draft-recovery')).toContainText('Save unconfirmed · draft kept');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.pending-drafts.v1'))['PRJ-1']);
  expect(draft.status).toBe('unconfirmed');
  expect(draft.input.priority).toBe('High');
  await page.evaluate(() => timeoutHarness.requests[0].success({ ...timeoutHarness.issue, priority: 'High', version: 'v2' }));
  await expect(page.locator('#draft-recovery')).toContainText('Save unconfirmed · draft kept');
  await expect(page.locator('#retry-save')).toBeVisible();
});
