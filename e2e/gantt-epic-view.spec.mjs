import { test, expect } from '@playwright/test';
import C from '../Core.js';

const project = {
  issues: [
    { id: 'PRJ-1', type: 'Epic', summary: 'Planning' },
    { id: 'PRJ-2', type: 'Epic', summary: 'Delivery' },
    { id: 'PRJ-3', type: 'Story', parentId: 'PRJ-1', summary: 'Design story', priority: 'Low' },
    { id: 'PRJ-4', parentId: 'PRJ-3', summary: 'Design task' },
    { id: 'PRJ-5', parentId: 'PRJ-2', summary: 'Delivery task' },
    { id: 'PRJ-6', summary: 'Independent task' },
    { id: 'PRJ-7', type: 'Epic', summary: 'Later epic', priority: 'Low' },
    { id: 'PRJ-8', parentId: 'PRJ-7', summary: 'Later task', priority: 'Low' }
  ].map((issue, rank) => ({ ...C.blank(), rank, version: '1', priority: 'High', ...issue })),
  comments: [], sequence: 8
};
async function openGantt(page, preferences) {
  await page.addInitScript(({ project, preferences }) => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify(project));
    if (!localStorage.getItem('sheetflow.ui.v1')) localStorage.setItem('sheetflow.ui.v1', JSON.stringify(preferences));
  }, { project, preferences });
  await page.goto('/#gantt');
  await expect(page.locator('.gantt-grid')).toBeVisible();
}
const branch = (page, id) => page.locator(`.gantt-grid [data-toggle-lane="${id}"]`);
const row = (page, id) => page.locator(`[data-gantt-row-id="${id}"]`);
const storedProject = page => page.evaluate(() => localStorage.getItem('sheetflow.project.v1'));

for (const grouped of [false, true]) {
  test(`expand and go back restore a mixed Epic layout in ${grouped ? 'grouped' : 'flat'} Gantt`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGantt(page, { swimlanes: grouped, collapsedEpics: { 'PRJ-2': true, __no_epic__: true }, collapsedGanttStories: { 'PRJ-3': true } });
    const originalProject = await storedProject(page);
    const all = page.locator('#gantt-epic-view');
    await expect(branch(page, 'PRJ-1')).toHaveAttribute('aria-expanded', 'true');
    await expect(branch(page, 'PRJ-2')).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 'PRJ-5')).toHaveCount(0);
    const sign = grouped ? branch(page, 'PRJ-2').locator('.swimlane-toggle') : branch(page, 'PRJ-2');
    await expect(sign).toHaveText('+');
    await expect(sign).toBeInViewport({ ratio: 1 });
    await expect(row(page, 'PRJ-2').getByRole('button', { name: 'Add work under PRJ-2' })).toHaveText('Add');

    await page.locator('.gantt-viewport').evaluate(el => { el.scrollLeft = 130; });
    await expect(all).toHaveText('Expand all epics');
    await all.press('Enter');
    await expect(all).toHaveText('Go back');
    await expect(all).toBeFocused();
    await expect(sign).toHaveText('−');
    await expect(row(page, 'PRJ-5')).toBeVisible();
    await expect(row(page, 'PRJ-4')).toHaveCount(0);
    expect(await page.locator('.gantt-viewport').evaluate(el => el.scrollLeft)).toBe(130);
    if (grouped) await expect(branch(page, '__no_epic__')).toHaveAttribute('aria-expanded', 'false');

    // An individual adjustment during the expanded view must not change its return point.
    await branch(page, 'PRJ-1').press('Space');
    await expect(branch(page, 'PRJ-1')).toHaveAttribute('aria-expanded', 'false');
    await expect(branch(page, 'PRJ-1')).toBeFocused();
    await expect(page.locator('#issue-dialog')).toBeHidden();
    await page.reload();
    await expect(all).toHaveText('Go back');
    await all.click();
    await expect(branch(page, 'PRJ-1')).toHaveAttribute('aria-expanded', 'true');
    await expect(branch(page, 'PRJ-2')).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 'PRJ-3')).toBeVisible();
    await expect(row(page, 'PRJ-4')).toHaveCount(0);
    await expect(row(page, 'PRJ-5')).toHaveCount(0);
    await expect(all).toHaveText('Expand all epics');
    expect(await storedProject(page)).toBe(originalProject);
  });
}

test('bulk folding follows visible Epic ancestors through filters and preserves unrelated rows', async ({ page }) => {
  await openGantt(page, { collapsedEpics: { 'PRJ-7': true } });
  await page.locator('#workspace-filters > summary').click();
  await page.locator('#priority-filter').selectOption('High');
  await page.locator('#workspace-filters > summary').click();
  await expect(row(page, 'PRJ-3')).toHaveCount(0);
  await expect(row(page, 'PRJ-4')).toBeVisible();
  const all = page.locator('#gantt-epic-view');
  await expect(all).toHaveText('Collapse all epics');
  await all.click();
  await expect(row(page, 'PRJ-4')).toHaveCount(0);
  await expect(row(page, 'PRJ-5')).toHaveCount(0);
  await expect(row(page, 'PRJ-6')).toBeVisible();
  await all.click();
  await expect(row(page, 'PRJ-4')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.ui.v1')).collapsedEpics['PRJ-7'])).toBe(true);
  await all.click();
  await page.locator('#search').fill('Independent task');
  await expect(row(page, 'PRJ-6')).toBeVisible();
  await expect(all).toHaveCount(0);
});

for (const view of ['sheet', 'gantt']) {
  test(`${view}: Collapse all closes empty capture and actually folds its Epic`, async ({ page }) => {
    await openGantt(page, { swimlanes: true, collapsedEpics: {} });
    await page.locator(`[data-view="${view}"]`).first().click();
    await page.locator('[data-select-lane="PRJ-1"]').click();
    await page.keyboard.press('t');
    await page.locator('#quick-title').fill('   ');
    const before = await storedProject(page);
    await page.locator(view === 'sheet' ? '[data-sheet-lanes="collapse"]' : '#gantt-epic-view').click();
    await expect(page.locator('.quick-entry')).toBeHidden();
    await expect(page.locator('[data-toggle-lane="PRJ-1"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-issue-select="PRJ-3"]')).toHaveCount(0);
    expect(await storedProject(page)).toBe(before);
    await page.locator('[data-select-lane="PRJ-2"]').click();
    await page.keyboard.press('t');
    await expect(page.locator('#quick-title')).toBeFocused();
    await expect(page.locator('#quick-title')).toHaveValue('');
    await expect(page.locator('#quick-context')).toHaveText('Delivery');
  });

  for (const draft of ['title', 'batch']) test(`${view}: Collapse all preserves a nonempty ${draft} draft`, async ({ page }) => {
    await openGantt(page, { swimlanes: true, collapsedEpics: {} });
    await page.locator(`[data-view="${view}"]`).first().click();
    await page.locator('[data-select-lane="PRJ-1"]').click();
    await page.keyboard.press('t');
    if (draft === 'title') await page.locator('#quick-title').fill('Keep this draft 5d');
    else await page.locator('#quick-title').evaluate(input => {
      const data = new DataTransfer(); data.setData('text', 'First draft\nSecond draft');
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    const before = await storedProject(page);
    await page.locator(view === 'sheet' ? '[data-sheet-lanes="collapse"]' : '#gantt-epic-view').click();
    await expect(page.locator('.quick-entry')).toBeVisible();
    await expect(page.locator(draft === 'title' ? '#quick-title' : '#quick-batch-input')).toHaveValue(draft === 'title' ? 'Keep this draft 5d' : 'First draft\nSecond draft');
    expect(await storedProject(page)).toBe(before);
  });
}

test('start-only work is a compact movable bar and resizing establishes its due date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00'));
  const startOnlyProject = {
    issues: [
      { ...C.blank(), id: 'PRJ-1', type: 'Epic', summary: 'Start-only epic', rank: 1000, version: 'v1' },
      { ...C.blank(), id: 'PRJ-2', summary: 'Start-only task', parentId: 'PRJ-1', startDate: '2026-11-07', dueDate: '', rank: 2000, version: 'v2' }
    ],
    comments: [], sequence: 2
  };
  await page.addInitScript(project => {
    if (!localStorage.getItem('sheetflow.project.v1')) localStorage.setItem('sheetflow.project.v1', JSON.stringify(project));
    if (!localStorage.getItem('sheetflow.ui.v1')) localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ swimlanes: false, timelineStart: '2026-11-01' }));
  }, startOnlyProject);
  await page.goto('/#gantt');
  const bar = page.locator('[data-bar="PRJ-2"]');
  await expect(bar).toHaveClass(/start-only/);
  await expect(bar).toHaveAttribute('title', '2026-11-07 · No due date');
  await expect(bar.locator('.bar-progress')).toHaveCount(0);
  await expect(bar.locator('.resize-handle')).toHaveAttribute('title', 'Drag to set a due date');
  expect((await bar.boundingBox()).width).toBeGreaterThanOrEqual(18);

  let bounds = await bar.boundingBox(), dayWidth = Number(await bar.getAttribute('data-day-width'));
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 4 + dayWidth * 2, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const issue = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues.find(item => item.id === 'PRJ-2'));
    return { startDate: issue.startDate, dueDate: issue.dueDate };
  }).toEqual({ startDate: '2026-11-09', dueDate: '' });
  await expect(bar).toHaveAttribute('title', '2026-11-09 · No due date');
  await page.reload();
  await expect(bar).toHaveClass(/start-only/);

  bounds = await bar.boundingBox(); dayWidth = Number(await bar.getAttribute('data-day-width'));
  const handle = bar.locator('.resize-handle'), handleBounds = await handle.boundingBox();
  await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + handleBounds.width / 2 + dayWidth, handleBounds.y + handleBounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => {
    const issue = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues.find(item => item.id === 'PRJ-2'));
    return { startDate: issue.startDate, dueDate: issue.dueDate };
  }).toEqual({ startDate: '2026-11-09', dueDate: '2026-11-10' });
  await expect(bar).not.toHaveClass(/start-only/);
  await expect(bar.locator('.bar-progress')).toHaveCount(1);

  const label = page.locator('.gantt-label-hit[data-open="PRJ-2"]');
  await label.focus(); await label.press('Enter');
  await expect(page.locator('#issue-dialog')).toBeVisible();
  await page.locator('#issue-form [name="dueDate"]').fill('');
  await page.locator('#save-issue').click();
  await expect(page.locator('#issue-dialog')).toBeHidden();
  await expect(bar).toHaveClass(/start-only/);
  await page.reload();
  await expect(bar).toHaveClass(/start-only/);
  const boundaryStart = C.addDays('2026-11-09', -111);
  await page.locator('#timeline-date').fill(boundaryStart);
  await page.locator('#timeline-date').dispatchEvent('change');
  await expect(bar).toBeVisible();
  const boundaryBar = await bar.boundingBox();
  const boundaryTrack = await page.locator('[data-gantt-row-id="PRJ-2"] .gantt-track').boundingBox();
  expect(boundaryBar.x + boundaryBar.width).toBeLessThanOrEqual(boundaryTrack.x + boundaryTrack.width);
  await page.locator('[data-timeline="-1"]').click();
  await expect(page.locator('[data-gantt-row-id="PRJ-2"] .schedule-note')).toHaveText('Starts outside this window · 9 Nov');
  await expect(page.locator('[data-bar="PRJ-2"]')).toHaveCount(0);
});
