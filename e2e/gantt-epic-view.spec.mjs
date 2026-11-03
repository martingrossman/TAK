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
    if (grouped) await expect(branch(page, 'PRJ-2').getByText('Delivery', { exact: true })).toBeVisible();
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
