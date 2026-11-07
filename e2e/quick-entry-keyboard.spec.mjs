import { test, expect } from '@playwright/test';
import C from '../Core.js';
let pageErrors;
test.beforeEach(async ({page}) => { pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message)); });
test.afterEach(() => expect(pageErrors).toEqual([]));

const initial = [
  { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Website launch', parentId: '', rank: 1000, version: 'v1' },
  { ...C.blank(), id: 'PRJ-2', type: 'Story', summary: 'Sign-in experience', parentId: 'PRJ-1', rank: 2000, version: 'v2' },
  { ...C.blank(), id: 'PRJ-3', type: 'Task', summary: 'Password reset', parentId: 'PRJ-2', rank: 3000, version: 'v3' },
  { ...C.blank(), id: 'PRJ-4', type: 'Bug', summary: 'Login error', parentId: 'PRJ-1', status: 'To Do', rank: 4000, version: 'v4' },
  { ...C.blank(), id: 'PRJ-5', type: 'Epic', summary: 'Another epic', rank: 5000, version: 'v5' },
  { ...C.blank(), id: 'PRJ-6', summary: 'Independent task', rank: 6000, version: 'v6' }
];

async function seed(page, cloud = false, batch = false) {
  await page.addInitScript(({ initial, cloud, batch, blank }) => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify({ issues: initial, comments: [], sequence: 6 }));
    if (!cloud) return;
    const harness = window.entryHarness = { issues: initial, requests: [], receipts: {}, sequence: 6 };
    window.finishEntry = (index, outcome = 'success') => {
      const request = harness.requests[index];
      if (outcome === 'fail') { request.failure({ message: 'Temporary connection failure' }); return; }
      const save = input => {
        if (harness.receipts[input.operationId]) return harness.receipts[input.operationId];
        const saved = { ...blank, ...input, id: `PRJ-${++harness.sequence}`, version: `saved-${harness.sequence}` };
        harness.receipts[input.operationId] = saved; harness.issues.push(saved); return saved;
      };
      const result = request.inputs ? { items: request.inputs.map((entry, i) => ({ index: i, issue: save(entry.input) })), errors: [] } : save(request.input);
      if (outcome === 'lost') request.failure({ message: 'Save acknowledgement lost' }); else request.success(result);
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(callback) { this.success = callback; return this; },
      withFailureHandler(callback) { this.failure = callback; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: harness.issues, comments: {}, settings: [], mode: 'personal', quickBatchCreate: batch, spreadsheetUrl: '' })); },
      saveIssue(input) { harness.requests.push({ input, success: this.success, failure: this.failure }); },
      createIssuesBatch(inputs) { harness.requests.push({ inputs, success: this.success, failure: this.failure }); }
    }; } });
  }, { initial, cloud, batch, blank: C.blank() });
}
function item(page, view, id) {
  return page.locator(view === 'sheet' ? `.sheet-row-grip[data-sheet-drag-id="${id}"]` : view === 'kanban' ? `.card[data-issue="${id}"]` : `.gantt-label-hit[data-open="${id}"]`);
}
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues); }

for (const view of ['sheet', 'kanban', 'gantt']) {
  test(`${view}: all hierarchy contexts create tasks and stories through the shared bar`, async ({ page }) => {
    await seed(page); await page.goto('/#' + view);
    for (const [source, taskParent, storyParent] of [['PRJ-1', 'PRJ-1', 'PRJ-1'], ['PRJ-2', 'PRJ-2', 'PRJ-1'], ['PRJ-3', 'PRJ-2', 'PRJ-1'], ['PRJ-4', 'PRJ-1', 'PRJ-1'], ['PRJ-6', '', '']]) {
      for (const [key, type, parentId] of [['t', 'Task', taskParent], ['s', 'Story', storyParent]]) {
        await item(page, view, source).focus(); await page.keyboard.press(key);
        const title = `${view}-${source}-${type}`;
        await expect(page.locator('#quick-title')).toBeFocused();
        await expect(page.locator('#quick-kind')).toHaveValue(type);
        await expect(page.locator('#quick-context')).toHaveText(parentId ? initial.find(i => i.id === parentId).type === 'Story' ? 'STORY: Sign-in experience' : 'EPIC: Website launch' : 'No parent');
        await page.locator('#quick-title').fill(title); await page.keyboard.press('Enter');
        await expect.poll(async () => (await stored(page)).find(i => i.summary === title)?.parentId).toBe(parentId);
        const created = (await stored(page)).find(i => i.summary === title);
        expect(created).toMatchObject({ type, status: initial.find(i => i.id === source).status, priority: 'Medium', assignee: '', dueDate: '' });
        expect(created.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        await expect(item(page, view, created.id)).toBeFocused();
        await expect(page.locator('#quick-title')).toBeHidden();
      }
    }
  });
  test(`${view}: Shift creation and Details preserve title and context without writing`, async ({ page }) => {
    await seed(page); await page.goto('/#' + view);
    await item(page, view, 'PRJ-2').focus(); await page.keyboard.press('Shift+T');
    await expect(page.locator('#issue-dialog')).toBeVisible();
    await expect(page.locator('[name="type"]')).toHaveValue('Task');
    await expect(page.locator('[name="parentId"]')).toHaveValue('PRJ-2');
    await expect(page.locator('[name="startDate"]')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    await page.keyboard.press('Escape');
    await item(page, view, 'PRJ-3').focus(); await page.keyboard.press('s');
    await page.locator('#quick-title').fill('A new story'); await page.locator('#quick-details').click();
    await expect(page.locator('[name="summary"]')).toHaveValue('A new story');
    await expect(page.locator('[name="type"]')).toHaveValue('Story');
    await expect(page.locator('[name="parentId"]')).toHaveValue('PRJ-1');
    expect((await stored(page)).length).toBe(initial.length);
  });
}

test('Escape retains unfinished entry; mouse hover and different shortcuts cannot retarget it', async ({ page }) => {
  await seed(page); await page.goto('/#kanban');
  await item(page, 'kanban', 'PRJ-2').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Unfinished'); await page.keyboard.press('Escape');
  await item(page, 'kanban', 'PRJ-5').hover(); await page.keyboard.press('s');
  await expect(page.locator('#quick-kind')).toHaveValue('Task');
  await expect(page.locator('#quick-title')).toHaveValue('Unfinished');
  await expect(page.locator('#quick-context')).toHaveText('STORY: Sign-in experience');
  await page.locator('#quick-clear').click(); await expect(page.locator('#quick-title')).toHaveValue('');
  await page.locator('#quick-parent').fill('PRJ-5'); await page.locator('#quick-parent').press('Enter');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Another epic');
});

test('Sheet arrows, edit Escape, grouped headings, and movable ID preserve context', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ sheetLayoutVersion: 2, visibleColumns: ['summary', 'id', 'status'], swimlanes: true })));
  await page.goto('/#sheet');
  await page.locator('[data-select-lane="PRJ-1"]').focus(); await page.keyboard.press('ArrowDown');
  await expect(item(page, 'sheet', 'PRJ-2')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(item(page, 'sheet', 'PRJ-3')).toBeFocused();
  const summary = page.locator('[data-id="PRJ-3"][data-field="summary"]');
  await summary.fill('Unsent edit'); await summary.press('Escape');
  await expect(summary).toHaveValue('Password reset'); await expect(item(page, 'sheet', 'PRJ-3')).toBeFocused();
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('STORY: Sign-in experience');
});

test('Sheet Epic headings switch task context without toggling lanes and bulk lane controls work', async ({ page }) => {
  await seed(page); await page.goto('/#sheet'); await page.locator('#swimlanes-toggle').check();
  const firstHeading = page.locator('[data-select-lane="PRJ-1"]');
  const firstToggle = page.locator('[data-toggle-lane="PRJ-1"]');
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await firstHeading.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.sheet-lane-title.context-active')).toContainText('Website launch');
  await expect(page.locator('.sheet-lane-title.context-active .task-context-badge')).toHaveText('Task context');
  await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Website launch');
  await page.keyboard.press('Escape');

  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.locator('.sheet-lane-title [data-toggle-lane][aria-expanded="false"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.locator('.sheet-lane-title [data-toggle-lane][aria-expanded="true"]')).toHaveCount(0);

  await page.locator('[data-select-lane="PRJ-5"]').click();
  await expect(page.locator('[data-toggle-lane="PRJ-5"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.sheet-lane-title.context-active')).toContainText('Another epic');
  const add = page.getByRole('button', { name: 'Add task under Another epic' });
  await add.click();
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Another epic');
  await page.locator('#quick-title').fill('Task in second epic'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Task in second epic')?.parentId).toBe('PRJ-5');
});

test('Kanban and Gantt Epic headings expose the same independent Task context', async ({ page }) => {
  await seed(page); await page.goto('/#kanban'); await page.locator('#swimlanes-toggle').check();
  const kanbanHeading = page.locator('.swimlane[data-epic-lane="PRJ-1"] [data-select-lane="PRJ-1"]');
  const kanbanToggle = page.locator('.swimlane[data-epic-lane="PRJ-1"] [data-toggle-lane="PRJ-1"]');
  await expect(kanbanToggle).toHaveAttribute('aria-expanded', 'true');
  await kanbanHeading.click();
  await expect(kanbanToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(kanbanHeading).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.swimlane[data-epic-lane="PRJ-1"] .task-context-badge')).toHaveText('Task context');
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('EPIC: Website launch');
  await page.keyboard.press('Escape');

  await page.locator('[data-view="gantt"]').click();
  await expect(page.locator('.gantt-swimlane[data-epic-lane="PRJ-1"] .task-context-badge')).toHaveText('Task context');
  const ganttHeading = page.locator('.gantt-swimlane[data-epic-lane="PRJ-5"] [data-select-lane="PRJ-5"]');
  const ganttToggle = page.locator('.gantt-swimlane[data-epic-lane="PRJ-5"] [data-toggle-lane="PRJ-5"]');
  await expect(ganttToggle).toHaveAttribute('aria-expanded', 'true');
  await ganttHeading.click();
  await expect(ganttToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(ganttHeading).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.gantt-swimlane[data-epic-lane="PRJ-5"] .task-context-badge')).toHaveText('Task context');
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('EPIC: Another epic');
  await page.locator('#quick-title').fill('Task from Gantt Epic context'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).find(issue => issue.summary === 'Task from Gantt Epic context')?.parentId).toBe('PRJ-5');
});

test('successful dialog parent changes move and clear the active Epic context', async ({ page }) => {
  await seed(page); await page.goto('/#kanban'); await page.locator('#swimlanes-toggle').check();
  await page.locator('[data-select-lane="PRJ-1"]').click();
  await item(page, 'kanban', 'PRJ-3').click();
  await page.locator('#issue-form [name="parentId"]').selectOption('PRJ-5');
  await expect(page.locator('#form-save-status')).toHaveText('Saved');
  await expect(page.locator('[data-select-lane="PRJ-5"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.locator('.swimlane[data-epic-lane="PRJ-5"] .task-context-badge')).toHaveText('Task context');
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('EPIC: Another epic');
  await page.keyboard.press('Escape');

  await item(page, 'kanban', 'PRJ-3').click();
  await page.locator('#issue-form [name="parentId"]').selectOption('');
  await expect(page.locator('#form-save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.locator('.swimlane-header.context-active')).toHaveCount(0);
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('No parent');
});

test('Kanban arrows cross columns without changing data and focus empty headings', async ({ page }) => {
  await seed(page); await page.goto('/#kanban');
  await item(page, 'kanban', 'PRJ-3').focus(); await page.keyboard.press('ArrowRight');
  await expect(item(page, 'kanban', 'PRJ-4')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('.column[data-status="In Progress"] .column-header')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(page.locator('.column[data-status="Review"] .column-header')).toBeFocused();
  expect(await stored(page)).toEqual(initial);
});

test('typing, composition, repeats and disabled single-key shortcuts never create', async ({ page }) => {
  await seed(page); await page.goto('/#kanban');
  await item(page, 'kanban', 'PRJ-3').focus();
  for (const event of [{ key: 't', repeat: true }, { key: 's', isComposing: true }, { key: 't', keyCode: 229 }, { key: 't', altKey: true }]) await item(page, 'kanban', 'PRJ-3').dispatchEvent('keydown', event);
  await expect(page.locator('.quick-entry')).not.toHaveClass(/entry-active/);
  await page.locator('#help-button').click(); await page.locator('#single-key-shortcuts').uncheck(); await page.keyboard.press('Escape');
  await page.reload(); await item(page, 'kanban', 'PRJ-3').focus(); await page.keyboard.press('t');
  await expect(page.locator('.quick-entry')).not.toHaveClass(/entry-active/);
  await page.keyboard.press('Control+k'); await expect(page.locator('#command-dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await page.locator('#search').fill('task story t s');
  await expect(page.locator('#search')).toHaveValue('task story t s');
});

for (const batch of [false, true]) test(`cloud ${batch ? 'batch' : 'single'} queue freezes dates and retries lost acknowledgement`, async ({ page }) => {
  await seed(page, true, batch); await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
  await page.goto('/#kanban'); await item(page, 'kanban', 'PRJ-2').focus(); await page.keyboard.press('t');
  for (const title of ['First', 'Second', 'Third']) { await page.locator('#quick-title').fill(title); await page.keyboard.press('Enter'); }
  await expect.poll(() => page.evaluate(() => window.entryHarness.requests.length)).toBe(1);
  await page.clock.setFixedTime(new Date('2026-11-08T12:00:00'));
  await page.locator('#quick-title').fill('Next unsent');
  await page.evaluate(() => window.finishEntry(0, 'lost'));
  await expect.poll(() => page.evaluate(() => window.entryHarness.requests.length)).toBe(2);
  const pendingCount = batch ? 2 : 3;
  await page.evaluate(() => window.finishEntry(1));
  if (!batch) { await expect.poll(() => page.evaluate(() => window.entryHarness.requests.length)).toBe(3); await page.evaluate(() => window.finishEntry(2)); }
  await expect(page.locator('#quick-title')).toHaveValue('Next unsent');
  await page.getByRole('button', { name: 'Retry save', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => window.entryHarness.requests.length)).toBe(pendingCount + 1);
  await page.evaluate(index => window.finishEntry(index), pendingCount);
  await expect.poll(() => page.evaluate(() => window.entryHarness.issues.length)).toBe(9);
  const created = await page.evaluate(() => window.entryHarness.issues.filter(i => ['First', 'Second', 'Third'].includes(i.summary)));
  expect(created).toHaveLength(3);
  for (const issue of created) expect(issue).toMatchObject({ parentId: 'PRJ-2', startDate: '2026-11-07', type: 'Task' });
});

test('unavailable storage and invalid parents leave the title intact', async ({ page }) => {
  await seed(page); await page.goto('/#sheet'); await item(page, 'sheet', 'PRJ-6').focus(); await page.keyboard.press('t'); await page.locator('#quick-title').fill('Keep me');
  await page.locator('#quick-parent').fill('Not a valid parent'); await page.locator('#quick-title').press('Enter');
  await expect(page.locator('#quick-title')).toHaveValue('Keep me'); expect((await stored(page)).length).toBe(6);
  await page.locator('#quick-parent').fill('No parent'); await page.locator('#quick-parent').press('Enter');
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.includes('quick-queue')) throw new Error('Storage unavailable'); return set.call(this, key, value); }; });
  await page.locator('#quick-title').press('Enter'); await expect(page.locator('#quick-title')).toHaveValue('Keep me');
  expect((await stored(page)).length).toBe(6);
});

for (const width of [1366, 768, 390]) test(`entry controls fit and remain reachable at ${width}px`, async ({ page }) => {
  await seed(page); await page.addInitScript(() => { const data = JSON.parse(localStorage.getItem('sheetflow.project.v1')); data.issues[0].summary = 'Website launch with a very long epic title '.repeat(3); localStorage.setItem('sheetflow.project.v1', JSON.stringify(data)); }); await page.setViewportSize({ width, height: 844 }); await page.goto('/#sheet');
  await item(page, 'sheet', 'PRJ-2').focus(); await page.keyboard.press('t');
  for (const selector of ['#quick-title', '#quick-add', '#quick-details', '#quick-clear', '#quick-parent', '#quick-kind', '#quick-status']) {
    const box = await page.locator(selector).boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  }
  const entryBox = await page.locator('.ghost-entry').boundingBox();
  if (width >= 1000) expect(entryBox.width).toBeGreaterThanOrEqual(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.local-release/im14-${width}.png` });
});

test('view switching remembers context; filtering removes stale context and never clears filters on create', async ({ page }) => {
  await seed(page); await page.goto('/#kanban'); await item(page, 'kanban', 'PRJ-2').focus();
  await page.locator('[data-view="gantt"]').click(); await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('STORY: Sign-in experience');
  await page.keyboard.press('Escape');
  await page.locator('#search').fill('Another epic'); await page.locator('#help-button').focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('No parent');
  await page.locator('#quick-title').fill('Hidden creation'); await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toContainText('Hidden by current filters');
  await expect(page.locator('#search')).toHaveValue('Another epic');
});

test('single checked row supplies fallback; multiple selections do not create multiple children', async ({ page }) => {
  await seed(page); await page.goto('/#sheet');
  await page.locator('[data-sheet-select="PRJ-2"]').check();
  // Empty-column focus clears navigation context while retaining checked rows.
  await page.locator('[data-view="kanban"]').click(); await page.locator('.column[data-status="In Progress"] .column-header').focus(); await page.locator('[data-view="sheet"]').click();
  await page.locator('#help-button').focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('STORY: Sign-in experience');
  await page.keyboard.press('Escape');
  await page.locator('[data-sheet-select="PRJ-4"]').check();
  await page.locator('[data-view="kanban"]').click(); await page.locator('.column[data-status="In Progress"] .column-header').focus(); await page.locator('[data-view="sheet"]').click();
  await page.locator('#help-button').focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('No parent');
  await page.locator('#quick-title').fill('One independent item'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).length).toBe(7);
  expect((await stored(page)).find(i => i.summary === 'One independent item').parentId).toBe('');
});

test('selected Epic is the fallback when no visible item is active', async ({ page }) => {
  await seed(page); await page.goto('/#sheet');
  await page.locator('#workspace-filters > summary').click();
  await page.locator('#epic-nav [data-epic="PRJ-5"]').click();
  await page.locator('#help-button').focus(); await page.keyboard.press('s');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Another epic');
});

test('Gantt grouped navigation skips collapsed Story children and preserves focus after redraw', async ({ page }) => {
  await seed(page); await page.goto('/#gantt');
  await page.locator('#swimlanes-toggle').check();
  await page.locator('[data-toggle-gantt-story="PRJ-2"]').click();
  await expect(item(page, 'gantt', 'PRJ-3')).toHaveCount(0);
  await item(page, 'gantt', 'PRJ-2').focus(); await page.keyboard.press('ArrowDown');
  await expect(item(page, 'gantt', 'PRJ-4')).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(item(page, 'gantt', 'PRJ-2')).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(page.locator('[data-select-lane="PRJ-1"]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-select-lane="PRJ-1"]')).toBeFocused();
  await page.keyboard.press('t'); await expect(page.locator('#quick-context')).toHaveText('EPIC: Website launch');
});

test('legacy queued entries keep their original blank schedule', async ({ page }) => {
  await seed(page, true);
  await page.addInitScript(() => localStorage.setItem('sheetflow.quick-queue.v1', JSON.stringify([{ title: 'Legacy entry', status: 'To Do', kind: 'Task', parentId: '', draftKey: 'quick-legacy', operationId: 'quick-legacy' }])));
  await page.goto('/#sheet');
  await expect.poll(() => page.evaluate(() => window.entryHarness.requests.length)).toBe(1);
  const input = await page.evaluate(() => window.entryHarness.requests[0].input);
  expect(input).toMatchObject({ summary: 'Legacy entry', status: 'To Do', parentId: '' });
  expect(input.startDate).toBeUndefined();
});

test('missing frozen parent blocks submission without retargeting or losing the title', async ({ page }) => {
  await seed(page, true); await page.goto('/#kanban'); await item(page, 'kanban', 'PRJ-2').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Keep the original parent');
  await page.evaluate(() => { window.entryHarness.issues = window.entryHarness.issues.filter(i => !['PRJ-2', 'PRJ-3'].includes(i.id)); });
  await page.locator('#workspace-more > summary').click(); await page.locator('#refresh').click();
  await expect(page.locator('#quick-context')).toHaveText('Parent unavailable');
  await page.locator('#quick-title').press('Enter');
  await expect(page.locator('#quick-title')).toHaveValue('Keep the original parent');
  expect(await page.evaluate(() => window.entryHarness.requests.length)).toBe(0);
});

test('deep Epic lanes keep shared entry visible without moving the board', async ({ page }) => {
  await seed(page); await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/#kanban');
  await page.locator('#swimlanes-toggle').check();
  await item(page, 'kanban', 'PRJ-6').scrollIntoViewIfNeeded(); await item(page, 'kanban', 'PRJ-6').focus();
  const before = await item(page, 'kanban', 'PRJ-6').boundingBox();
  const scroll = await page.locator('.swimlane[data-epic-lane=""] .board').evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }));
  await page.keyboard.press('t'); await expect(page.locator('#quick-title')).toBeInViewport();
  const after = await item(page, 'kanban', 'PRJ-6').boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(await page.locator('.swimlane[data-epic-lane=""] .board').evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }))).toEqual(scroll);
});

test('empty grouped Kanban column retains its Epic and status context', async ({ page }) => {
  await seed(page); await page.goto('/#kanban'); await page.locator('#swimlanes-toggle').check();
  await page.locator('.swimlane[data-epic-lane="PRJ-1"] .column[data-status="In Progress"] .column-header').focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-context')).toHaveText('EPIC: Website launch');
  await expect(page.locator('#quick-status')).toHaveValue('In Progress');
});

for (const view of ['sheet', 'kanban', 'gantt']) test(`${view}: parent dropdown shows names and manually overrides the inferred parent`, async ({ page }) => {
  await seed(page); await page.goto('/#' + view); await page.locator('#swimlanes-toggle').check();
  const targetToggle = page.locator('[data-toggle-lane="PRJ-5"]');
  await targetToggle.click(); await expect(targetToggle).toHaveAttribute('aria-expanded', 'false');
  await item(page, view, 'PRJ-2').focus(); await page.keyboard.press('t');
  await expect(page.locator('#quick-parent')).toHaveValue('STORY: Sign-in experience');
  await page.locator('#quick-title').fill('Manually assigned ' + view);
  await page.locator('#quick-parent-toggle').click();
  await expect(page.getByRole('listbox', { name: 'Available parents' })).toBeVisible();
  expect(await page.locator('#quick-parent-options').innerText()).not.toMatch(/PRJ-\d+/);
  await page.locator('#quick-parent-options').getByRole('option', { name: 'EPIC: Another epic', exact: true }).click();
  await expect(page.locator('#quick-parent')).toHaveValue('EPIC: Another epic');
  await expect(page.locator('[data-select-lane="PRJ-5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-select-lane="PRJ-5"] .task-context-badge')).toHaveText('Task context');
  await expect(targetToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#quick-title')).toHaveValue('Manually assigned ' + view);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).find(i => i.summary === 'Manually assigned ' + view)?.parentId).toBe('PRJ-5');
});

test('parent search supports keyboard choice, No parent, and Story parent restrictions', async ({ page }) => {
  await seed(page); await page.goto('/#sheet'); await item(page, 'sheet', 'PRJ-6').focus(); await page.keyboard.press('t');
  await page.locator('#quick-parent').focus(); await page.locator('#quick-parent').fill('Sign-in');

  await expect(page.locator('#quick-parent-options').getByRole('option')).toHaveCount(1);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(page.locator('#quick-parent')).toHaveValue('STORY: Sign-in experience');
  await expect(page.locator('#quick-title')).toBeFocused();
  await page.locator('#quick-parent-toggle').click(); await page.locator('#quick-parent-options').getByRole('option', { name: 'No parent', exact: true }).click();
  await expect(page.locator('#quick-parent')).toHaveValue('No parent');
  await page.locator('#quick-kind').selectOption('Story'); await page.locator('#quick-parent-toggle').click();
  await expect(page.locator('#quick-parent-options').getByRole('option')).toHaveCount(3);
  expect(await page.locator('#quick-parent-options').innerText()).not.toMatch(/STORY:|TASK:|BUG:|PRJ-\d+/);
});
test('parent-driven focus reveals collapsed Epic and Story ancestors in Sheet and Gantt', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const data = JSON.parse(localStorage.getItem('sheetflow.project.v1'));
    data.issues.push(
      { ...data.issues[1], id: 'PRJ-7', summary: 'Another epic story', parentId: 'PRJ-5', rank: 7000 },
      { ...data.issues[2], id: 'PRJ-8', summary: 'Nested destination task', parentId: 'PRJ-7', rank: 8000 }
    );
    data.sequence = 8;
    localStorage.setItem('sheetflow.project.v1', JSON.stringify(data));
  });
  await page.goto('/#sheet'); await page.locator('#swimlanes-toggle').check();
  await page.locator('[data-toggle-sheet-parent="PRJ-7"]').click();
  await expect(page.locator('[data-toggle-sheet-parent="PRJ-7"]')).toHaveAttribute('aria-expanded', 'false');

  await page.locator('[data-view="gantt"]').click();
  await page.locator('[data-toggle-gantt-story="PRJ-7"]').click();
  await expect(page.locator('[data-toggle-gantt-story="PRJ-7"]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-toggle-lane="PRJ-5"]').click();
  await expect(page.locator('[data-toggle-lane="PRJ-5"]')).toHaveAttribute('aria-expanded', 'false');

  await item(page, 'gantt', 'PRJ-2').focus(); await page.keyboard.press('t');
  await page.locator('#quick-parent-toggle').click();
  await page.locator('#quick-parent-options').getByRole('option', { name: 'STORY: Another epic story', exact: true }).click();
  await expect(page.locator('[data-toggle-lane="PRJ-5"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-toggle-gantt-story="PRJ-7"]')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('[data-view="sheet"]').click();
  await expect(page.locator('[data-toggle-sheet-parent="PRJ-7"]')).toHaveAttribute('aria-expanded', 'true');
});

for (const view of ['sheet', 'kanban', 'gantt']) test(`${view}: parent-driven focus scrolls a distant Epic into view`, async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const data = JSON.parse(localStorage.getItem('sheetflow.project.v1'));
    for (let index = 0; index < 30; index++) data.issues.push({ ...data.issues[2], id: `PRJ-${index + 10}`, summary: `Long lane task ${index + 1}`, parentId: 'PRJ-1', rank: 10000 + index * 1000 });
    data.sequence = 39;
    localStorage.setItem('sheetflow.project.v1', JSON.stringify(data));
  });
  await page.setViewportSize({ width: 1366, height: 500 });
  await page.goto('/#' + view); await page.locator('#swimlanes-toggle').check();
  const destination = page.locator('[data-select-lane="PRJ-5"]');
  await item(page, view, 'PRJ-2').focus(); await page.keyboard.press('t');
  await expect(destination).not.toBeInViewport();
  await page.locator('#quick-parent-toggle').click();
  await page.locator('#quick-parent-options').getByRole('option', { name: 'EPIC: Another epic', exact: true }).click();
  await expect(destination).toBeInViewport();
  const destinationBox = await destination.boundingBox();
  expect(destinationBox.y).toBeGreaterThanOrEqual(0);
  expect(destinationBox.y + destinationBox.height).toBeLessThanOrEqual(500);
  expect(destinationBox.y).toBeLessThan(300);
  await expect(page.locator('#quick-title')).toBeFocused();
});

test('same-name parents remain distinct without showing IDs', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => { const data = JSON.parse(localStorage.getItem('sheetflow.project.v1')); data.issues.push({ ...data.issues[1], id: 'PRJ-7', parentId: 'PRJ-5', rank: 7000 }); data.sequence = 7; localStorage.setItem('sheetflow.project.v1', JSON.stringify(data)); });
  await page.goto('/#kanban'); await item(page, 'kanban', 'PRJ-6').focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Choose the other sign-in story');
  await page.locator('#quick-parent').fill('Sign-in experience');
  await expect(page.locator('#quick-parent-options').getByRole('option')).toHaveCount(2);
  expect(await page.locator('#quick-parent-options').innerText()).not.toMatch(/PRJ-\d+/);
  await page.locator('#quick-parent-options').getByRole('option', { name: 'STORY: Sign-in experience EPIC: Another epic', exact: true }).click();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await stored(page)).find(i => i.summary === 'Choose the other sign-in story')?.parentId).toBe('PRJ-7');
});

test('Escape closes Ghost Capture from every control and preserves its draft', async ({ page }) => {
  await seed(page); await page.goto('/#gantt'); const origin = item(page, 'gantt', 'PRJ-2'); await origin.focus(); await page.keyboard.press('t');
  await page.locator('#quick-title').fill('Keep title');
  await page.locator('#quick-parent').fill('Another'); await page.keyboard.press('Escape');
  await expect(page.locator('#quick-title')).toBeHidden();
  await expect(origin).toBeFocused();

  await page.keyboard.press('t');
  await expect(page.locator('#quick-title')).toHaveValue('Keep title');
  await expect(page.locator('#quick-parent')).toHaveValue('STORY: Sign-in experience');
  await page.locator('#quick-status').focus(); await page.keyboard.press('Escape');
  await expect(page.locator('#quick-title')).toBeHidden();
  await expect(origin).toBeFocused();
});

for (const width of [1366, 390]) test(`parent choices fit without IDs at ${width}px`, async ({ page }) => {
  await seed(page); await page.setViewportSize({ width, height: 844 }); await page.goto('/#kanban');
  await item(page, 'kanban', 'PRJ-2').focus(); await page.keyboard.press('t'); await page.locator('#quick-parent-toggle').click();
  const box = await page.locator('#quick-parent-options').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.local-release/parent-picker-${width}.png` });
});
