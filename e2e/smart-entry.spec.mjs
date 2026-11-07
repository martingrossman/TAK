import { test, expect } from '@playwright/test';
import C from '../Core.js';

const initial = [
  { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Smart capture project', rank: 1000, version: 'v1' },
  { ...C.blank(), id: 'PRJ-2', summary: 'Known owner', assignee: 'Martin Novak', parentId: 'PRJ-1', rank: 2000, version: 'v2' },
  { ...C.blank(), id: 'PRJ-3', summary: 'Another owner', assignee: 'Martin Smith', parentId: 'PRJ-1', rank: 3000, version: 'v3' },
  { ...C.blank(), id: 'PRJ-4', summary: 'Third owner', assignee: 'Marta Green', parentId: 'PRJ-1', rank: 4000, version: 'v4' }
];

let pageErrors;
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function seed(page, cloud = false) {
  await page.addInitScript(({ initial, cloud, blank }) => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: initial, comments: [], sequence: 4 }));
    if (!cloud) return;
    const harness = window.smartHarness = { issues: initial, requests: [], receipts: {}, sequence: 4 };
    window.finishSmart = (index, lost = false) => {
      const request = harness.requests[index], input = request.input;
      let issue = harness.receipts[input.operationId];
      if (!issue) {
        issue = { ...blank, ...input, id: `PRJ-${++harness.sequence}`, version: `saved-${harness.sequence}` };
        harness.receipts[input.operationId] = issue; harness.issues.push(issue);
      }
      if (lost) request.failure({ message: 'Save acknowledgement lost' });
      else request.success(issue);
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(callback) { this.success = callback; return this; },
      withFailureHandler(callback) { this.failure = callback; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: harness.issues, comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      saveIssue(input) { harness.requests.push({ input, success: this.success, failure: this.failure }); }
    }; } });
  }, { initial, cloud, blank: C.blank() });
}

function item(page, view) {
  return page.locator(view === 'sheet' ? '.sheet-row-grip[data-sheet-drag-id="PRJ-2"]' : view === 'kanban' ? '.card[data-issue="PRJ-2"]' : '.gantt-label-hit[data-open="PRJ-2"]');
}
async function open(page, view = 'sheet') {
  await page.goto('/#' + view); await item(page, view).focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-title')).toBeFocused();
}
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues); }
async function requestCount(page) { return page.evaluate(() => window.smartHarness.requests.length); }

for (const view of ['sheet', 'kanban', 'gantt']) {
  test(`${view}: preview leaves raw text editable, creates workdays and repeats without metadata leakage`, async ({ page }) => {
    await seed(page); await open(page, view);
    const title = page.locator('#quick-title'), raw = 'Ship release @"Martin Novak" 5d !high';
    await title.fill(raw);
    await expect(title).toHaveValue(raw);
    await expect(page.locator('#quick-smart-preview [data-smart-kind]')).toHaveCount(3);
    await expect(page.locator('[data-smart-kind="assignee"]')).toContainText('Martin Novak');
    await expect(page.locator('[data-smart-kind="duration"]')).toContainText('2026-11-13');
    await title.press('Enter');
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Ship release')).toMatchObject({ assignee: 'Martin Novak', priority: 'High', startDate: '2026-11-09', dueDate: '2026-11-13', parentId: 'PRJ-1' });
    await expect(title).toBeFocused(); await expect(title).toHaveValue('');
    await expect(page.locator('#quick-smart-preview')).toBeHidden();
    await title.fill('Plain next task'); await page.locator('#quick-add').click();
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Plain next task')).toMatchObject({ assignee: '', priority: 'Medium', dueDate: '', startDate: '2026-11-07' });
    await expect(title).toBeFocused(); await title.press('Escape'); await expect(title).toBeHidden();
  });

  test(`${view}: assignee arrows and Enter accept once; next Enter creates`, async ({ page }) => {
    await seed(page); await open(page, view);
    const title = page.locator('#quick-title'), list = page.locator('#quick-assignee-options');
    await title.fill('Assign @Mar'); await expect(list).toBeVisible();
    await title.press('ArrowDown'); await title.press('ArrowUp');
    const selected = await list.locator('[aria-selected="true"]').innerText();
    await title.press('Enter');
    await expect(title).toHaveValue(`Assign @"${selected}" `); await expect(list).toBeHidden();
    expect(await stored(page)).toHaveLength(initial.length);
    await title.press('Enter');
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Assign')?.assignee).toBe(selected);
    await expect(title).toBeFocused();
    await title.fill('Quoted @“Martin N'); await expect(list).toContainText('Martin Novak');
    await title.press('Tab'); await expect(title).toHaveValue('Quoted @"Martin Novak" '); await expect(title).toBeFocused();
    await title.press('Enter');
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Quoted')?.assignee).toBe('Martin Novak');
  });

  test(`${view}: Escape dismisses suggestions before capture and preserves literal draft on resume`, async ({ page }) => {
    await seed(page); await open(page, view);
    const title = page.locator('#quick-title');
    await title.fill('Research 5d @Mar');
    await title.press('Escape'); await expect(page.locator('#quick-assignee-options')).toBeHidden(); await expect(title).toBeVisible();
    await page.getByRole('button', { name: 'Keep 5d as title text', exact: true }).click();
    await expect(title).toHaveValue('Research \\5d @Mar');
    await expect(page.locator('#quick-smart-preview')).toBeHidden();
    await title.press('Escape'); await expect(title).toBeHidden();
    await page.keyboard.press('t'); await expect(title).toHaveValue('Research \\5d @Mar');
    await title.press('Enter');
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Research 5d @Mar')).toMatchObject({ assignee: '', dueDate: '', priority: 'Medium' });
  });

  test(`${view}: conflicting and invalid syntax writes nothing; Details transfers resolved values`, async ({ page }) => {
    await seed(page, true); await open(page, view);
    const title = page.locator('#quick-title');
    for (const raw of ['Blocked 5d due:2026-11-12', 'Blocked due:2026-02-30', 'Blocked 0d', 'Blocked !high !low', 'Blocked @Martin', 'Blocked 1.5d', 'Blocked due:1899-12-31']) {
      await title.fill(raw);
      // Deliberately leave the ambiguous name unresolved rather than choosing a suggestion.
      if (raw === 'Blocked @Martin') await title.press('Escape');
      await page.locator('#quick-add').click();
      await expect(page.locator('#quick-smart-errors')).toBeVisible(); await expect(title).toHaveValue(raw);
      await page.locator('#quick-details').click(); await expect(page.locator('#issue-dialog')).not.toBeVisible();
      expect(await requestCount(page)).toBe(0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.quick-queue.v1') || '[]'))).toEqual([]);
    }
    await title.fill('Detailed @“Martin Novak” 2w !highest due:2026-11-20');
    await page.locator('#quick-details').click();
    await expect(page.locator('#issue-dialog')).toBeVisible();
    for (const [name, value] of Object.entries({ summary: 'Detailed', assignee: 'Martin Novak', priority: 'Highest', startDate: '2026-11-09', dueDate: '2026-11-20', parentId: 'PRJ-1' })) {
      await expect(page.locator(`#issue-form [name="${name}"]`)).toHaveValue(value);
    }
    expect(await requestCount(page)).toBe(0);
  });

  test(`${view}: lost acknowledgement and queue retries use frozen dates while next draft keeps caret`, async ({ page }) => {
    await seed(page, true); await open(page, view);
    const title = page.locator('#quick-title');
    await title.fill('Frozen duration @"Martin Novak" 2w !high'); await title.press('Enter');
    await expect.poll(() => requestCount(page)).toBe(1);
    await title.fill('Frozen deadline due:tomorrow'); await title.press('Enter');
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.quick-queue.v1')));
    expect(queued[0].input).toMatchObject({ summary: 'Frozen deadline', dueDate: '2026-11-08' });
    await title.fill('Next unsent @Mar');
    await title.evaluate(input => input.setSelectionRange(14, 16));
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00'));
    await page.evaluate(() => window.finishSmart(0, true));
    await expect.poll(() => requestCount(page)).toBe(2);
    await expect(title).toHaveValue('Next unsent @Mar'); await expect(title).toBeFocused();
    expect(await title.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([14, 16]);
    await expect(page.locator('#quick-assignee-options')).toBeVisible();
    await page.evaluate(() => window.finishSmart(1));
    await page.getByRole('button', { name: 'Retry save', exact: true }).first().click();
    await expect.poll(() => requestCount(page)).toBe(3);
    const requests = await page.evaluate(() => window.smartHarness.requests.map(request => request.input));
    expect(requests[0]).toMatchObject({ summary: 'Frozen duration', startDate: '2026-11-09', dueDate: '2026-11-20', assignee: 'Martin Novak', priority: 'High' });
    expect(requests[1]).toMatchObject({ summary: 'Frozen deadline', dueDate: '2026-11-08' });
    expect(requests[2]).toEqual(requests[0]);
    await page.evaluate(() => window.finishSmart(2));
    await expect.poll(() => page.evaluate(() => window.smartHarness.issues.filter(issue => issue.summary === 'Frozen duration').length)).toBe(1);
    await expect(title).toHaveValue('Next unsent @Mar');
  });
}

test('batch paste remains literal and explains its boundary', async ({ page }) => {
  await seed(page); await open(page);
  await page.locator('#quick-title').evaluate(input => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', 'Batch @Martin 5d !high\nAnother due:tomorrow');
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#quick-batch-hint')).toContainText('only to single-title');
  await page.locator('#quick-batch-submit').click();
  await expect.poll(async () => (await stored(page)).length).toBe(6);
  for (const summary of ['Batch @Martin 5d !high', 'Another due:tomorrow']) {
    expect((await stored(page)).find(issue => issue.summary === summary)).toMatchObject({ assignee: '', priority: 'Medium', dueDate: '' });
  }
});

test('title length applies after parsing and preserves overlength drafts', async ({ page }) => {
  await seed(page); await open(page);
  const title = page.locator('#quick-title'), summary = 'x'.repeat(250);
  await title.fill(`${summary} !high 5d`); await title.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === summary)?.priority).toBe('High');
  await title.fill('y'.repeat(251) + ' !low'); await title.press('Enter');
  await expect(page.locator('#quick-smart-errors')).toContainText('250');
  await page.locator('#quick-details').click(); await expect(page.locator('#issue-dialog')).not.toBeVisible();
  await expect(title).toHaveValue('y'.repeat(251) + ' !low'); expect(await stored(page)).toHaveLength(5);
});

test('IME Enter and Escape do not accept suggestions, submit, or dismiss capture', async ({ page }) => {
  await seed(page); await open(page);
  const title = page.locator('#quick-title'); await title.fill('IME @Mar');
  await title.dispatchEvent('compositionstart');
  await title.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 });
  await title.dispatchEvent('keydown', { key: 'Escape', isComposing: true, keyCode: 229 });
  await expect(title).toBeVisible(); await expect(title).toHaveValue('IME @Mar'); expect(await stored(page)).toHaveLength(4);
  await title.dispatchEvent('compositionend'); await expect(page.locator('#quick-assignee-options')).toBeVisible();
});

for (const width of [1366, 390]) test(`assignee popover remains above pinned Sheet cells at ${width}px`, async ({ page }) => {
  await seed(page); await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ sheetLayoutVersion: 2, visibleColumns: ['summary', 'assignee', 'priority', 'dueDate'] })));
  await open(page); await page.locator('#quick-title').fill('Pointer @Mar');
  const list = page.locator('#quick-assignee-options'); await expect(list).toBeVisible();
  expect(await list.evaluate(element => element.matches(':popover-open'))).toBe(true);
  const option = list.getByRole('option', { name: 'Martin Novak', exact: true });
  await option.scrollIntoViewIfNeeded();
  const box = await option.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(await option.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await option.click(); await expect(page.locator('#quick-title')).toHaveValue('Pointer @"Martin Novak" ');
  await expect(page.locator('#quick-title')).toBeFocused(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Pointer')?.assignee).toBe('Martin Novak');
});

test('explicit deadlines are calendar dates and unknown syntax stays title text', async ({ page }) => {
  await seed(page); await open(page);
  const title = page.locator('#quick-title');
  for (const [raw, summary, dueDate] of [
    ['Today deadline due:today', 'Today deadline', '2026-11-07'],
    ['Tomorrow deadline due:tomorrow', 'Tomorrow deadline', '2026-11-08'],
    ['Fixed deadline due:2026-12-25', 'Fixed deadline', '2026-12-25'],
    ['Plain today a@b.test !urgent due:later v5d @Nobody', 'Plain today a@b.test !urgent due:later v5d @Nobody', '']
  ]) {
    await title.fill(raw); await title.press('Enter');
    await expect.poll(async () => (await stored(page)).find(issue => issue.summary === summary)).toMatchObject({ dueDate, startDate: '2026-11-07', assignee: '', priority: 'Medium' });
  }
});

test('literal choices work for each recognized property and can be edited back into syntax', async ({ page }) => {
  await seed(page); await open(page);
  const title = page.locator('#quick-title');
  await title.fill('Literal @"Martin Novak" 5d !high due:2026-11-13');
  for (const token of ['@"Martin Novak"', '5d', '!high', 'due:2026-11-13']) {
    await page.getByRole('button', { name: `Keep ${token} as title text`, exact: true }).click();
  }
  await expect(page.locator('#quick-smart-preview')).toBeHidden();
  await title.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Literal @"Martin Novak" 5d !high due:2026-11-13')).toMatchObject({ assignee: '', dueDate: '', priority: 'Medium' });
  await title.fill('Editable \\!low');
  await expect(page.locator('#quick-smart-preview')).toBeHidden();
  await title.fill('Editable !low');
  await expect(page.locator('[data-smart-kind="priority"]')).toContainText('Low');
  await title.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Editable')?.priority).toBe('Low');
});
