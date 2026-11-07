import { test, expect } from '@playwright/test';
import C from '../Core.js';

const storageKey = 'sheetflow.project.v1';
const epic = { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Example Epic', rank: 1000 };
const form = page => page.locator('#issue-form');
const field = (page, name) => form(page).locator(`[name="${name}"]`);
const issues = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).issues, storageKey);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, epic }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ issues: [epic], comments: {}, sequence: 1 }));
  }, { key: storageKey, epic });
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`compact create, keyboard focus and More options preserve values at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#kanban');
    await page.locator('#create-issue').click();
    const dialog = page.locator('#issue-dialog');
    await expect(dialog).toHaveClass(/quick-create/);
    await expect(field(page, 'summary')).toBeFocused();
    await expect(field(page, 'estimate')).toBeHidden();
    await expect(field(page, 'description')).toBeVisible();
    const box = await dialog.boundingBox();
    if (viewport.width > 520) {
      expect(box.width).toBeGreaterThanOrEqual(440); expect(box.width).toBeLessThanOrEqual(520);
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2);
      expect(box.height).toBeLessThanOrEqual(viewport.height * .85 + 1);
    } else { expect(box.width).toBe(viewport.width); expect(box.height).toBe(viewport.height); }
    await field(page, 'summary').fill('Compact draft');
    await field(page, 'description').fill('Keep the context');
    await field(page, 'type').selectOption('Story');
    await field(page, 'priority').selectOption('High');
    await field(page, 'parentId').selectOption(epic.id);
    await field(page, 'status').selectOption('Review');
    await field(page, 'assignee').fill('Example person');
    await field(page, 'dueDate').fill('2026-12-01');
    await page.locator('#close-dialog').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#save-issue')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#close-dialog')).toBeFocused();
    // A real user can Tab through every field; focus must stay in the modal.
    await field(page, 'summary').focus();
    for (let n = 0; n < 18; n++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.locator('#create-more-options').click();
    await expect(dialog).not.toHaveClass(/quick-create/);
    await expect(field(page, 'type')).toBeFocused();
    await expect(field(page, 'estimate')).toBeVisible();
    await expect(field(page, 'summary')).toHaveValue('Compact draft');
    await expect(field(page, 'description')).toHaveValue('Keep the context');
    await expect(field(page, 'priority')).toHaveValue('High');
    await expect(field(page, 'parentId')).toHaveValue(epic.id);
    await expect(page.locator('#create-more-options')).toHaveText('Back to compact');
    await expect(page.locator('#create-more-options')).toHaveAttribute('aria-expanded', 'true');
    const expandedBox = await dialog.boundingBox();
    if (viewport.width > 520) {
      expect(expandedBox.width).toBeGreaterThan(box.width);
      expect(expandedBox.width).toBeLessThanOrEqual(720);
      expect(Math.abs(expandedBox.x + expandedBox.width / 2 - (box.x + box.width / 2))).toBeLessThan(2);
      expect(Math.abs(expandedBox.y + expandedBox.height / 2 - (box.y + box.height / 2))).toBeLessThan(2);
    } else { expect(expandedBox.width).toBe(viewport.width); expect(expandedBox.height).toBe(viewport.height); }
    await field(page, 'estimate').fill('3');
    await page.locator('#create-more-options').click();
    await expect(dialog).toHaveClass(/quick-create/);
    await expect(page.locator('#create-more-options')).toHaveText('More options');
    await expect(page.locator('#create-more-options')).toHaveAttribute('aria-expanded', 'false');
    await expect(field(page, 'summary')).toBeFocused();
    await expect(field(page, 'estimate')).toBeHidden();
    await expect(field(page, 'estimate')).toHaveValue('3');
    await expect(field(page, 'description')).toHaveValue('Keep the context');
    await expect(field(page, 'parentId')).toHaveValue(epic.id);
    const compactAgain = await dialog.boundingBox();
    expect(compactAgain.width).toBe(box.width);
    await page.locator('#save-issue').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('#create-issue')).toBeFocused();
    const saved = (await issues(page)).find(issue => issue.summary === 'Compact draft');
    expect(saved).toMatchObject({ type: 'Story', priority: 'High', parentId: epic.id, status: 'Review', assignee: 'Example person', dueDate: '2026-12-01', estimate: 3, description: 'Keep the context' });
    await page.reload();
    expect((await issues(page)).filter(issue => issue.summary === 'Compact draft')).toHaveLength(1);
    await page.locator(`.card[data-issue="${saved.id}"] .card-title`).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveClass(/create-dialog/);
    await expect(dialog).toHaveClass(/quick-create/);
    await expect(field(page, 'estimate')).toBeHidden();
    await expect(page.locator('#editor-related')).toBeHidden();
    await expect(page.locator('#duplicate-issue')).toBeHidden();
    await expect(page.locator('#create-more-options')).toBeVisible();
    const editBox = await dialog.boundingBox();
    if (viewport.width > 520) {
      expect(editBox.width).toBe(box.width);
      expect(Math.abs(editBox.x + editBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
    } else { expect(editBox.width).toBe(viewport.width); expect(editBox.height).toBe(viewport.height); }
    await page.locator('#create-more-options').click();
    await expect(field(page, 'estimate')).toBeVisible();
    await expect(page.locator('#editor-related')).toBeVisible();
    await expect(page.locator('#duplicate-issue')).toBeVisible();
    await expect(field(page, 'estimate')).toHaveValue('3');
    await expect(field(page, 'description')).toHaveValue('Keep the context');
    await expect(page.locator('#save-issue')).toHaveText('Save issue');
    await page.locator('#create-more-options').click();
    await expect(dialog).toHaveClass(/quick-create/);
    await expect(field(page, 'estimate')).toBeHidden();
    await expect(field(page, 'estimate')).toHaveValue('3');
  });
}

test('new drafts wait for Create; N, title Enter, IME and Escape keep their meaning', async ({ page }) => {
  await page.goto('/#kanban');
  await expect(page.locator('#create-issue')).toBeEnabled();
  await page.keyboard.press('n');
  await expect(field(page, 'summary')).toBeFocused();
  await expect(field(page, 'summary')).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  await page.locator('#create-issue').click();
  await field(page, 'summary').fill('Only after Enter');
  // Wait beyond the existing editor debounce: creating while typing is forbidden.
  await page.waitForTimeout(850);
  expect(await issues(page)).toHaveLength(1);
  await field(page, 'summary').dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true });
  expect(await issues(page)).toHaveLength(1);
  page.once('dialog', confirmation => confirmation.dismiss());
  await page.keyboard.press('Escape');
  await expect(field(page, 'summary')).toHaveValue('Only after Enter');
  await expect(page.locator('#issue-dialog')).toBeVisible();
  await field(page, 'summary').press('Enter');
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  expect((await issues(page)).filter(issue => issue.summary === 'Only after Enter')).toHaveLength(1);
});

for (const modifier of ['Control', 'Meta']) {
  test(`${modifier}+Enter creates from description while Shift+Enter inserts a newline`, async ({ page }) => {
    await page.goto('/#kanban'); await page.locator('#create-issue').click();
    await field(page, 'summary').fill(`${modifier} item`);
    await field(page, 'description').fill('First line');
    await field(page, 'description').press('Shift+Enter');
    await page.keyboard.type('Second line');
    await expect(field(page, 'description')).toHaveValue('First line\nSecond line');
    expect(await issues(page)).toHaveLength(1);
    await field(page, 'description').press(`${modifier}+Enter`);
    await expect(page.locator('#issue-dialog')).not.toBeVisible();
    expect((await issues(page)).find(issue => issue.summary === `${modifier} item`).description).toBe('First line\nSecond line');
  });
}

test('required/trimmed titles validate in compact mode and selected Epic supplies context', async ({ page }) => {
  await page.goto('/#kanban');
  await page.locator('#workspace-filters > summary').click();
  await page.locator(`[data-epic="${epic.id}"]`).click();
  await page.locator('#workspace-filters > summary').click();
  await page.locator('#create-issue').click();
  await expect(field(page, 'parentId')).toHaveValue(epic.id);
  await page.locator('#save-issue').click();
  await expect(field(page, 'summary')).toBeFocused();
  expect(await issues(page)).toHaveLength(1);
  await field(page, 'summary').fill('   '); await page.locator('#save-issue').click();
  await expect(page.locator('#form-error')).toBeVisible();
  expect(await issues(page)).toHaveLength(1);
  await field(page, 'summary').fill('Valid title'); await field(page, 'summary').press('Enter');
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  expect((await issues(page)).find(issue => issue.summary === 'Valid title').parentId).toBe(epic.id);
});

test('invalid advanced values reveal details again after returning to compact', async ({ page }) => {
  await page.goto('/#kanban'); await page.locator('#create-issue').click();
  await field(page, 'summary').fill('Validate advanced fields');
  await page.locator('#create-more-options').click();
  await field(page, 'estimate').fill('-1');
  await page.locator('#create-more-options').click();
  await expect(field(page, 'estimate')).toBeHidden();
  await page.locator('#save-issue').click();
  await expect(field(page, 'estimate')).toBeVisible();
  await expect(field(page, 'estimate')).toBeFocused();
  await expect(field(page, 'summary')).toHaveValue('Validate advanced fields');
  expect(await issues(page)).toHaveLength(1);
  await field(page, 'estimate').fill('2');
  await page.locator('#create-more-options').click();
  await page.locator('#save-issue').click();
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  expect((await issues(page)).find(issue => issue.summary === 'Validate advanced fields').estimate).toBe(2);
});

test('unconfirmed cloud create keeps its draft and retries with the original identity', async ({ page }) => {
  await page.addInitScript(({ blank, epic }) => {
    const h = window.compactCloud = { requests: [], receipts: {}, issues: [epic] };
    window.finishCompact = (index, loseResponse) => {
      const request = h.requests[index];
      let saved = h.receipts[request.input.operationId];
      if (!saved) {
        saved = { ...blank, ...request.input, id: 'PRJ-2', version: 'created-v1' };
        h.receipts[request.input.operationId] = saved; h.issues.push(saved);
      }
      if (loseResponse) request.failure({ message: 'Response lost' }); else request.success(structuredClone(saved));
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(handler) { this.success = handler; return this; },
      withFailureHandler(handler) { this.failure = handler; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: h.issues, comments: {}, settings: [], mode: 'personal', spreadsheetUrl: '' })); },
      saveIssue(input, version) { h.requests.push({ input: structuredClone(input), version, success: this.success, failure: this.failure }); }
    }; } });
  }, { blank: C.blank(), epic });
  await page.goto('/#kanban'); await page.locator('#create-issue').click();
  await field(page, 'summary').fill('Retry this create');
  await page.locator('#save-issue').click();
  // Repeated submit while the original request is held must not create again.
  await form(page).dispatchEvent('submit');
  await expect.poll(() => page.evaluate(() => compactCloud.requests.length)).toBe(1);
  await page.evaluate(() => finishCompact(0, true));
  await expect(page.locator('#issue-dialog')).toBeHidden();
  const recovery = page.locator('#draft-recovery');
  await expect(recovery).toContainText('Retry this create');
  await recovery.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => page.evaluate(() => compactCloud.requests.length)).toBe(2);
  expect(await page.evaluate(() => compactCloud.requests[1].input)).toEqual(await page.evaluate(() => compactCloud.requests[0].input));
  await page.evaluate(() => finishCompact(1, false));
  await expect(page.locator('#issue-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => compactCloud.issues.filter(issue => issue.summary === 'Retry this create').length)).toBe(1);
});

test('local paste list gives every new task today, including weekends', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
  await page.goto('/#kanban');
  await page.locator('#workspace-more > summary').click();
  await page.locator('#bulk-create-open').click();
  await page.locator('#bulk-create-input').fill('Local pasted one\n\nLocal pasted two');
  await page.locator('#bulk-create-submit').click();
  await expect(page.locator('#bulk-create-dialog')).toBeHidden();
  const saved = (await issues(page)).filter(issue => issue.type === 'Task');
  expect(saved.map(issue => ({ summary: issue.summary, startDate: issue.startDate }))).toEqual([
    { summary: 'Local pasted one', startDate: '2026-11-07' },
    { summary: 'Local pasted two', startDate: '2026-11-07' }
  ]);
  await page.reload();
  expect((await issues(page)).filter(issue => issue.type === 'Task')).toEqual(saved);
  expect((await issues(page)).find(issue => issue.id === epic.id).startDate).toBe('');
});

for (const type of ['Task', 'Story', 'Bug']) {
  test(`compact New ${type} defaults to today and preserves explicit dates and clearing`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
    await page.goto('/#kanban');
    for (const [label, startDate] of [['default', '2026-11-07'], ['override', '2026-10-01'], ['clear', '']]) {
      await page.locator('#create-issue').click();
      await field(page, 'type').selectOption(type);
      await expect(field(page, 'startDate')).toHaveValue('2026-11-07');
      await field(page, 'summary').fill(`${type} ${label}`);
      if (label !== 'default') {
        await page.locator('#create-more-options').click();
        await field(page, 'startDate').fill(startDate);
        await page.locator('#create-more-options').click();
      }
      await page.locator('#save-issue').click();
      await expect(page.locator('#issue-dialog')).toBeHidden();
      expect((await issues(page)).find(issue => issue.summary === `${type} ${label}`).startDate).toBe(startDate);
    }
    // Editing an already blank issue on a later day must not apply creation defaults.
    const cleared = (await issues(page)).find(issue => issue.summary === `${type} clear`);
    await page.clock.setFixedTime(new Date('2026-11-08T12:00:00'));
    await page.reload();
    await page.locator(`.card[data-issue="${cleared.id}"] .card-title`).click();
    await expect(field(page, 'startDate')).toHaveValue('');
    await field(page, 'summary').fill(`${type} still blank`);
    await page.locator('#save-issue').click();
    await expect.poll(async () => (await issues(page)).find(issue => issue.id === cleared.id)).toMatchObject({ summary: `${type} still blank`, startDate: '' });
  });
}

test('switching a new Epic to a Task uses today without losing a later cleared date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
  await page.goto('/#kanban');
  await page.locator('#workspace-more > summary').click();
  await page.locator('#add-epic').click();
  await field(page, 'type').selectOption('Task');
  await expect(field(page, 'startDate')).toHaveValue('2026-11-07');
  await page.locator('#create-more-options').click();
  await field(page, 'startDate').fill('');
  await field(page, 'type').selectOption('Epic');
  await field(page, 'type').selectOption('Task');
  await expect(field(page, 'startDate')).toHaveValue('');
  await field(page, 'summary').fill('Explicitly unscheduled after type switch');
  await page.locator('#save-issue').click();
  await expect(page.locator('#issue-dialog')).toBeHidden();
  expect((await issues(page)).find(issue => issue.summary === 'Explicitly unscheduled after type switch').startDate).toBe('');
});

for (const type of ['Task', 'Epic']) {
  test(`${type} can have no activity type across reload and all views, then regain one`, async ({ page }) => {
    await page.goto('/#kanban');
    await page.locator('#create-issue').click();
    await field(page, 'summary').fill(`Untyped ${type}`);
    await field(page, 'type').selectOption(type);
    await page.locator('#create-more-options').click();
    await expect(field(page, 'taskTypeId')).toHaveValue('algo');
    await field(page, 'taskTypeId').selectOption({ label: 'No activity type' });
    await page.locator('#save-issue').click();
    await expect(page.locator('#issue-dialog')).toBeHidden();
    const created = (await issues(page)).find(issue => issue.summary === `Untyped ${type}`);
    expect(created.taskTypeId).toBe('none');
    for (const view of ['sheet', 'gantt', 'kanban']) {
      await page.goto('/#' + view);
      const row = page.locator(view === 'sheet' ? `[data-sheet-row-id="${created.id}"]` : view === 'gantt' ? `[data-gantt-row-id="${created.id}"]` : `.card[data-issue="${created.id}"]`);
      await expect(row).toBeVisible();
      await expect(row.locator('.task-type-badge')).toHaveCount(0);
      expect((await issues(page)).find(issue => issue.id === created.id).taskTypeId).toBe('none');
    }
    await page.locator(`.card[data-issue="${created.id}"] .card-title`).click();
    await page.locator('#create-more-options').click();
    await expect(field(page, 'taskTypeId')).toHaveValue('none');
    await field(page, 'taskTypeId').selectOption('data');
    await page.locator('#save-issue').click();
    await expect(page.locator('#issue-dialog')).toBeHidden();
    await expect(page.locator(`.card[data-issue="${created.id}"] .task-type-badge`)).toHaveAttribute('aria-label', 'Data');
    expect((await issues(page)).find(issue => issue.id === created.id).taskTypeId).toBe('data');
    expect((await issues(page)).find(issue => issue.id === epic.id).taskTypeId).toBe('algo');
  });
}
