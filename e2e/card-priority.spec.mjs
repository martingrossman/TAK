import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'Priority task', rank: 1000, version: 'v1' };

test('card priority edits locally without opening or dragging the card', async ({ page }) => {
  await page.addInitScript(item => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#kanban');
  const priority = page.locator('[data-card-priority="PRJ-1"]');
  await priority.selectOption('High');
  await expect(priority).toBeFocused();
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].priority)).toBe('High');
  await page.reload();
  await expect(priority).toHaveValue('High');
});

test('card priority uses the recoverable save path in Apps Script mode', async ({ page }) => {
  await page.addInitScript(item => {
    const h = window.priorityHarness = { issue: JSON.parse(sessionStorage.getItem('priorityHarnessIssue') || 'null') || item, requests: [] };
    h.finish = outcome => {
      const request = h.requests.at(-1);
      if (outcome === 'fail') return request.failure({ message: 'Temporary failure' });
      h.issue = { ...h.issue, ...request.input, version: 'v2' };
      delete h.issue.operationId;
      sessionStorage.setItem('priorityHarnessIssue', JSON.stringify(h.issue));
      request.success(structuredClone(h.issue));
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: [structuredClone(h.issue)], comments: {}, settings: [], mode: 'team', spreadsheetUrl: '' })); },
      saveIssue(input, version) { h.requests.push({ input: structuredClone(input), version, success: this.success, failure: this.failure }); }
    }; } });
  }, issue);
  await page.goto('/#kanban');
  const priority = page.locator('[data-card-priority="PRJ-1"]');
  await priority.selectOption('Highest');
  await expect.poll(() => page.evaluate(() => priorityHarness.requests.length)).toBe(1);
  expect(await page.evaluate(() => priorityHarness.requests[0].input.priority)).toBe('Highest');
  await page.evaluate(() => priorityHarness.finish('fail'));
  await expect(page.locator('#draft-recovery')).toContainText('Failed');
  await expect(priority).toHaveValue('Highest');
  await page.locator('#retry-save').click();
  await expect.poll(() => page.evaluate(() => priorityHarness.requests.length)).toBe(2);
  expect(await page.evaluate(() => priorityHarness.requests[1].input.operationId)).toBe(await page.evaluate(() => priorityHarness.requests[0].input.operationId));
  await page.evaluate(() => priorityHarness.finish('ok'));
  await expect(page.locator('#sync-status')).toHaveText('Synced with Sheets');
  await page.reload();
  await expect(priority).toHaveValue('Highest');
});
