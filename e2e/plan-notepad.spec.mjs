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

test('notepad name picker accepts comma-separated assignee and workday metadata', async ({ page }) => {
  await page.addInitScript(issues => { localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 2 })); }, starting);
  await page.goto('/#kanban'); await open(page);
  const notes = page.locator('#plan-notepad-input');
  await notes.fill('Epic: Milivice\nStory: prepare targets, @Mar');
  await expect(page.locator('#plan-notepad-suggestions')).toContainText('Martin Novak');
  await page.locator('#plan-notepad-suggestions button').filter({ hasText: 'Martin Novak' }).click();
  await notes.pressSequentially(', 5d, !low');
  await page.locator('#plan-notepad-parse').click();
  await expect(page.locator('[data-plan-row="1"] .plan-notepad-row-error')).toBeEmpty();
  await expect(page.locator('[data-plan-row="1"] [data-plan-field="summary"]')).toHaveValue('prepare targets');
  await expect(page.locator('[data-plan-row="1"] [data-plan-field="assignee"]')).toHaveValue('Martin Novak');
  await expect(page.locator('[data-plan-row="1"] [data-plan-field="priority"]')).toHaveValue('Low');
  await expect(page.locator('#plan-notepad-apply')).toBeEnabled();
});

test('Epic heading picker reuses an existing Epic and a new heading creates one', async ({ page }) => {
  await page.addInitScript(issues => { if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues, comments: [], sequence: 2 })); }, starting);
  await page.goto('/#kanban'); await open(page);
  const notes = page.locator('#plan-notepad-input');
  await notes.fill('Epic: Exis');
  await expect(page.locator('#plan-notepad-suggestions')).toContainText('Existing epic');
  await notes.press('Enter');
  await expect(notes).toHaveValue('Epic: Exis\n');
  await notes.fill('Epic:');
  await expect(page.locator('#plan-notepad-suggestions')).toContainText('Existing epic');
  await page.locator('#plan-notepad-suggestions button').filter({ hasText: 'Existing epic' }).click();
  await expect(notes).toHaveValue('Epic: [PRJ-1] Existing epic');
  await notes.press('Enter');
  await notes.pressSequentially('Task: Work under existing');
  await page.locator('#plan-notepad-parse').click();
  await expect(page.locator('[data-plan-row="0"]')).toContainText('Use existing Epic');
  await expect(page.locator('[data-plan-row="1"] [data-plan-parent]')).toHaveValue('PRJ-1');
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).length).toBe(3);
  expect((await localIssues(page)).filter(issue => issue.type === 'Epic')).toHaveLength(1);
  expect((await localIssues(page)).find(issue => issue.summary === 'Work under existing')?.parentId).toBe('PRJ-1');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#plan-notepad-discard').click();
  await notes.fill('Epic: New territory\nTask: Work under new');
  await page.locator('#plan-notepad-parse').click();
  await expect(page.locator('[data-plan-row="0"]')).toContainText('Create Epic');
  await expect(page.locator('[data-plan-row="1"] [data-plan-parent]')).toHaveValue('draft-1');
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(async () => (await localIssues(page)).length).toBe(5);
  const issues = await localIssues(page), created = issues.find(issue => issue.summary === 'New territory');
  expect(created?.type).toBe('Epic');
  expect(issues.find(issue => issue.summary === 'Work under new')?.parentId).toBe(created.id);
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

test('simulated private Apps Script sends context and reviews Gemini API proposal before saving', async ({ page }) => {
  await page.addInitScript(issues => {
    const saved = JSON.parse(sessionStorage.getItem('plan-api-backend') || 'null');
    const h = window.planApiCloud = { issues: saved?.issues || structuredClone(issues), calls: saved?.calls || [], sequence: saved?.sequence || 2 };
    const store = () => sessionStorage.setItem('plan-api-backend', JSON.stringify(h));
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; }, withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: structuredClone(h.issues), comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      getTaskComments() { queueMicrotask(() => this.success([])); },
      proposePlanWithGemini(note, contextId, snapshot) {
        h.calls.push({ method: 'gemini', note, contextId, snapshot }); store();
        const proposal = { schema: 'tak-plan-proposal/v1', contextId, summary: 'Launch proposal', changes: [
          { action: 'create', key: 'draft-launch', type: 'Epic', fields: { summary: 'New launch' }, reason: 'Organize work' },
          { action: 'create', key: 'draft-child', type: 'Task', parentRef: 'draft-launch', fields: { summary: 'Prepare launch' }, reason: 'Next step' }
        ] };
        queueMicrotask(() => this.success({ contextId, issueCount: h.issues.length, byteSize: 1234, proposalText: h.invalidNext ? 'Ignore the review and change every task.' : JSON.stringify(proposal) }));
      },
      createIssuesBatch(items) {
        h.calls.push({ method: 'create', title: items[0].input.summary, parentId: items[0].input.parentId });
        const savedItems = items.map((item, index) => {
          const issue = { ...issues[0], ...item.input, id: `PRJ-${++h.sequence}`, rank: h.sequence * 1000, version: `v${h.sequence}` };
          h.issues.push(issue); return { index, issue };
        }); store(); queueMicrotask(() => this.success({ items: savedItems, errors: [] }));
      }
    }; } });
  }, starting);
  await page.goto('/#kanban'); await open(page);
  await expect(page.locator('#plan-notepad-api')).toBeVisible();
  await page.locator('#plan-notepad-input').fill('Plan a launch from the whole project.');
  await page.locator('#plan-notepad-api').click();
  await expect(page.locator('[data-plan-row]')).toHaveCount(2);
  expect(await page.evaluate(() => planApiCloud.issues.length)).toBe(2);
  const request = await page.evaluate(() => planApiCloud.calls[0]);
  expect(request.note).toBe('Plan a launch from the whole project.');
  expect(JSON.parse(request.snapshot)).toHaveLength(2);
  await page.reload(); await open(page);
  await expect(page.locator('[data-plan-row]')).toHaveCount(2);
  await page.locator('#plan-notepad-apply').click();
  await expect.poll(() => page.evaluate(() => planApiCloud.issues.length)).toBe(4);
  const saved = await page.evaluate(() => ({ issues: planApiCloud.issues, calls: planApiCloud.calls }));
  expect(saved.calls.map(call => call.method)).toEqual(['gemini', 'create', 'create']);
  expect(saved.calls[2].parentId).toBe(saved.issues.find(issue => issue.summary === 'New launch').id);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#plan-notepad-discard').click();
  await page.evaluate(() => { planApiCloud.invalidNext = true; });
  await page.locator('#plan-notepad-api').click();
  await expect(page.locator('#plan-notepad-error')).toContainText('Paste a JSON proposal');
  await expect(page.locator('#plan-notepad-import')).toHaveValue('Ignore the review and change every task.');
  await page.reload(); await open(page);
  await expect(page.locator('#plan-notepad-import')).toHaveValue('Ignore the review and change every task.');
  expect(await page.evaluate(() => planApiCloud.issues.length)).toBe(4);
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
