import { test, expect } from '@playwright/test';
import C from '../Core.js';

const starting = [
  { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Existing epic', status: 'Backlog', rank: 1000, version: 'v1', description: 'Context description' },
  { ...C.blank(), id: 'PRJ-2', type: 'Task', parentId: 'PRJ-1', summary: 'Existing task', status: 'Backlog', rank: 2000, version: 'v2', assignee: 'Martin Novak' }
];
async function open(page) {
  await page.locator('#workspace-more summary').click();
  await page.locator('#plan-notepad-open').click();
  await expect(page.locator('#plan-notepad-dialog')).toBeVisible();
}
const localIssues = page => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues);

test('local notepad creates a reviewed Epic and child exactly once across reload', async ({ page }) => {
  await page.addInitScript(issues => { if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 2 })); }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Epic: Launch\nTask: Prepare release #Launch @Martin +5d !high');
  await page.locator('#plan-notepad-parse').click();
  await expect(page.locator('[data-plan-row]')).toHaveCount(2);
  await expect(page.locator('#plan-notepad-apply')).toBeEnabled();
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).length).toBe(4);
  const issues = await localIssues(page), epic = issues.find(issue => issue.summary === 'Launch'), child = issues.find(issue => issue.summary === 'Prepare release');
  expect(epic?.type).toBe('Epic'); expect(child?.parentId).toBe(epic.id);
  expect(child?.assignee).toBe('Martin Novak'); expect(child?.priority).toBe('High');
  await page.reload(); await open(page);
  await expect(page.locator('#plan-notepad-status')).toContainText('0 selected · 2 applied');
  expect((await localIssues(page)).filter(issue => issue.summary === 'Launch')).toHaveLength(1);
});

test('manual Gemini proposal downloads context and requires selected, reviewed changes', async ({ page }) => {
  await page.addInitScript(issues => { if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [{ body: 'Never export this comment', taskId: 'PRJ-2' }], sequence: 2 })); }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Please plan a small launch.');
  const download = page.waitForEvent('download');
  await page.locator('#plan-notepad-prepare').click();
  expect((await download).suggestedFilename()).toBe('tak-plan-context.txt');
  await expect(page.locator('#plan-notepad-context')).toContainText('2 issues');
  const contextId = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.plan-notepad.v1')).contextId);
  const proposal = { schema: 'tak-plan-proposal/v1', contextId, summary: 'Small launch', changes: [
    { action: 'create', key: 'draft-launch', type: 'Epic', fields: { summary: 'Launch' }, reason: 'Group launch work' },
    { action: 'create', key: 'draft-child', type: 'Task', parentRef: 'draft-launch', fields: { summary: 'Prepare notes' }, reason: 'Plan next action' },
    { action: 'update', id: 'PRJ-2', fields: { priority: 'High' }, reason: 'Raise priority' }
  ] };
  await page.locator('#plan-notepad-import').fill(JSON.stringify(proposal));
  await page.locator('#plan-notepad-import-button').click();
  await expect(page.locator('[data-plan-row]')).toHaveCount(3);
  await page.locator('[data-plan-row="2"] [data-plan-selected]').uncheck();
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).length).toBe(4);
  const issues = await localIssues(page), epic = issues.find(issue => issue.summary === 'Launch');
  expect(issues.find(issue => issue.summary === 'Prepare notes')?.parentId).toBe(epic.id);
  expect(issues.find(issue => issue.id === 'PRJ-2')?.priority).toBe('Medium');
});

test('local proposal updates an existing field and blocks a stale revision', async ({ page }) => {
  await page.addInitScript(issues => { if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 2 })); }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Raise the priority of the existing task.');
  const download = page.waitForEvent('download'); await page.locator('#plan-notepad-prepare').click(); await download;
  const contextId = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.plan-notepad.v1')).contextId);
  const proposal = { schema: 'tak-plan-proposal/v1', contextId, summary: 'Priority update', changes: [{ action: 'update', id: 'PRJ-2', fields: { priority: 'High' }, reason: 'Important next step' }] };
  await page.locator('#plan-notepad-import').fill(JSON.stringify(proposal)); await page.locator('#plan-notepad-import-button').click();
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).find(issue => issue.id === 'PRJ-2').priority).toBe('High');
  await page.locator('#plan-notepad-prepare').click();
  const nextContext = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.plan-notepad.v1')).contextId);
  await page.locator('#plan-notepad-import').fill(JSON.stringify({ ...proposal, contextId: nextContext, changes: [{ ...proposal.changes[0], fields: { priority: 'Highest' } }] }));
  await page.locator('#plan-notepad-import-button').click();
  await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('sheetflow.project.v1')); db.issues.find(issue => issue.id === 'PRJ-2').version = 'remote-change'; localStorage.setItem('sheetflow.project.v1', JSON.stringify(db)); });
  await page.reload(); await open(page);
  await expect(page.locator('[data-plan-row="0"] .plan-notepad-row-error')).toContainText('Conflict');
  await expect(page.locator('#plan-notepad-apply')).toBeDisabled();
});

test('local batch creation does not need the separate receipt storage write', async ({ page }) => {
  await page.addInitScript(issues => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 2 }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'sheetflow.local-receipts.v1') throw Error('Injected receipt write failure'); return original.call(this, key, value); };
  }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Task: Safe batch item'); await page.locator('#plan-notepad-parse').click();
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).filter(issue => issue.summary === 'Safe batch item').length).toBe(1);
  await page.reload();
  expect((await localIssues(page)).filter(issue => issue.summary === 'Safe batch item')).toHaveLength(1);
});

test('simulated Sheets mode keeps an unconfirmed Epic and its child for safe retry', async ({ page }) => {
  await page.addInitScript(issues => {
    const saved = JSON.parse(sessionStorage.getItem('plan-cloud-backend') || 'null');
    const h = window.planCloud = { issues: saved?.issues || structuredClone(issues), receipts: saved?.receipts || {}, calls: saved?.calls || [], sequence: saved?.sequence || 2, loseFirst: saved?.loseFirst ?? true };
    const store = () => sessionStorage.setItem('plan-cloud-backend', JSON.stringify({ issues: h.issues, receipts: h.receipts, calls: h.calls, sequence: h.sequence, loseFirst: h.loseFirst }));
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; }, withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: structuredClone(h.issues), comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      getTaskComments() { queueMicrotask(() => this.success([])); },
      createIssuesBatch(items) {
        const request = { items, success: this.success, failure: this.failure }; h.calls.push(items[0].operationId);
        const results = items.map((item, index) => {
          let issue = h.receipts[item.operationId];
          if (!issue) { issue = { ...issues[0], ...item.input, status: item.input.status || 'Backlog', priority: item.input.priority || 'Medium', id: `PRJ-${++h.sequence}`, rank: h.sequence * 1000, version: `v${h.sequence}` }; h.receipts[item.operationId] = issue; h.issues.push(issue); }
          return { index, issue };
        });
        queueMicrotask(() => { if (h.loseFirst) { h.loseFirst = false; store(); request.failure({ message: 'Acknowledgement lost' }); } else { store(); request.success({ items: results, errors: [] }); } });
      }
    }; } });
  }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Epic: Launch\nTask: Child #Launch');
  await page.locator('#plan-notepad-parse').click();
  await page.locator('#plan-notepad-apply').click();
  await expect(page.locator('[data-plan-row="0"] .plan-notepad-row-error')).toContainText('Acknowledgement lost');
  expect(await page.evaluate(() => planCloud.issues.length)).toBe(3);
  await page.reload(); await open(page);
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(() => page.evaluate(() => planCloud.issues.length)).toBe(4);
  const saved = await page.evaluate(() => ({ issues: planCloud.issues, calls: planCloud.calls }));
  expect(saved.calls[0]).toBe(saved.calls[1]);
  expect(saved.issues.filter(issue => issue.summary === 'Launch')).toHaveLength(1);
  expect(saved.issues.find(issue => issue.summary === 'Child')?.parentId).toBe(saved.issues.find(issue => issue.summary === 'Launch').id);
});

test('simulated Sheets update retries the same operation after a lost acknowledgement', async ({ page }) => {
  await page.addInitScript(issues => {
    const saved = JSON.parse(sessionStorage.getItem('plan-update-backend') || 'null');
    const h = window.planUpdateCloud = { issues: saved?.issues || structuredClone(issues), receipts: saved?.receipts || {}, calls: saved?.calls || [], loseFirst: saved?.loseFirst ?? true };
    const store = () => sessionStorage.setItem('plan-update-backend', JSON.stringify(h));
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; }, withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: structuredClone(h.issues), comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      getTaskComments() { queueMicrotask(() => this.success([])); },
      saveIssue(input, expectedVersion) {
        h.calls.push(input.operationId);
        let issue = h.receipts[input.operationId];
        if (!issue) {
          const current = h.issues.find(item => item.id === input.id);
          if (!current || current.version !== expectedVersion) { queueMicrotask(() => this.failure({ message: 'Conflict' })); return; }
          issue = { ...current, ...input, version: 'v3' }; h.receipts[input.operationId] = issue;
          h.issues = h.issues.map(item => item.id === issue.id ? issue : item);
        }
        queueMicrotask(() => { if (h.loseFirst) { h.loseFirst = false; store(); this.failure({ message: 'Acknowledgement lost' }); } else { store(); this.success(issue); } });
      }
    }; } });
  }, starting);
  await page.goto('/#kanban'); await open(page);
  await page.locator('#plan-notepad-input').fill('Raise the priority of the existing task.');
  const download = page.waitForEvent('download'); await page.locator('#plan-notepad-prepare').click(); await download;
  const contextId = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.plan-notepad.v1')).contextId);
  const proposal = { schema: 'tak-plan-proposal/v1', contextId, summary: 'Priority update', changes: [{ action: 'update', id: 'PRJ-2', fields: { priority: 'High' }, reason: 'Important next step' }] };
  await page.locator('#plan-notepad-import').fill(JSON.stringify(proposal)); await page.locator('#plan-notepad-import-button').click();
  await page.locator('#plan-notepad-apply').click();
  await expect(page.locator('[data-plan-row="0"] .plan-notepad-row-error')).toContainText('Acknowledgement lost');
  await page.reload(); await open(page);
  await page.locator('#plan-notepad-apply').click();
  await expect(page.locator('#plan-notepad-status')).toContainText('1 applied');
  const saved = await page.evaluate(() => ({ issues: planUpdateCloud.issues, calls: planUpdateCloud.calls }));
  expect(saved.calls).toHaveLength(2); expect(saved.calls[0]).toBe(saved.calls[1]);
  expect(saved.issues.find(issue => issue.id === 'PRJ-2')?.priority).toBe('High');
});
