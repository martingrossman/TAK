import { test, expect } from '@playwright/test';
import C from '../Core.js';

const issue = { ...C.blank(), id: 'PRJ-1', summary: 'Assignee task', assignee: 'Martin', rank: 1000, version: 'v1' };

test('card assignee edits locally and preserves keyboard focus', async ({ page }) => {
  await page.addInitScript(item => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: [item], comments: [], sequence: 1 }));
  }, issue);
  await page.goto('/#kanban');
  const assignee = page.locator('[data-card-assignee="PRJ-1"]');
  await assignee.fill('Alex');
  await assignee.press('Enter');
  await expect(assignee).toBeFocused();
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].assignee)).toBe('Alex');
  await assignee.fill('Unsent');
  await assignee.press('Escape');
  await expect(assignee).toHaveValue('Alex');
  await page.reload();
  await expect(assignee).toHaveValue('Alex');
});

test('card assignee retains a failed Apps Script edit for retry', async ({ page }) => {
  await page.addInitScript(item => {
    const h = window.assigneeHarness = { issue: JSON.parse(sessionStorage.getItem('assigneeHarnessIssue') || 'null') || item, requests: [] };
    h.finish = outcome => {
      const request = h.requests.at(-1);
      if (outcome === 'fail') return request.failure({ message: 'Temporary failure' });
      h.issue = { ...h.issue, ...request.input, version: 'v2' };
      delete h.issue.operationId;
      sessionStorage.setItem('assigneeHarnessIssue', JSON.stringify(h.issue));
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
  const assignee = page.locator('[data-card-assignee="PRJ-1"]');
  await assignee.fill('Alex');
  await assignee.press('Enter');
  await expect.poll(() => page.evaluate(() => assigneeHarness.requests.length)).toBe(1);
  expect(await page.evaluate(() => assigneeHarness.requests[0].input.assignee)).toBe('Alex');
  await page.evaluate(() => assigneeHarness.finish('fail'));
  await expect(page.locator('#draft-recovery')).toContainText('Failed');
  await expect(assignee).toHaveValue('Alex');
  const operationId = await page.evaluate(() => assigneeHarness.requests[0].input.operationId);
  await page.reload();
  await expect(assignee).toHaveValue('Alex');
  await page.locator('#retry-save').click();
  await expect.poll(() => page.evaluate(() => assigneeHarness.requests.length)).toBe(1);
  expect(await page.evaluate(() => assigneeHarness.requests[0].input.operationId)).toBe(operationId);
  await page.evaluate(() => assigneeHarness.finish('ok'));
  await expect(page.locator('#sync-status')).toHaveText('Synced with Sheets');
  await page.reload();
  await expect(assignee).toHaveValue('Alex');
});
