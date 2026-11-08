import { test, expect } from '@playwright/test';
import C from '../Core.js';

const sampleEpic = {
  ...C.blank(),
  id: 'PRJ-1',
  summary: 'Infrastructure Epic',
  type: 'Epic',
  priority: 'High',
  status: 'In Progress',
  startDate: '2026-11-01',
  dueDate: '2026-11-30',
  rank: 1000,
  version: 'v1'
};

const sampleTask = {
  ...C.blank(),
  id: 'PRJ-2',
  parentId: 'PRJ-1',
  summary: 'Server Migration Task',
  type: 'Task',
  taskTypeId: 'algo',
  priority: 'Medium',
  assignee: 'Sam Rivera',
  startDate: '2026-11-05',
  dueDate: '2026-11-15',
  status: 'In Progress',
  rank: 2000,
  version: 'v1'
};

const sampleMilestoneInEpic = {
  ...C.blank(),
  id: 'PRJ-3',
  parentId: 'PRJ-1',
  summary: 'Alpha Release Cut',
  type: 'Milestone',
  priority: 'High',
  assignee: 'Sam Rivera',
  startDate: '2026-11-20',
  dueDate: '2026-11-20',
  status: 'Backlog',
  rank: 3000,
  version: 'v1'
};

const sampleMilestoneRoot = {
  ...C.blank(),
  id: 'PRJ-4',
  parentId: '',
  summary: 'Beta Launch Event',
  type: 'Milestone',
  priority: 'Highest',
  startDate: '2026-11-28',
  dueDate: '2026-11-28',
  status: 'Backlog',
  rank: 4000,
  version: 'v1'
};

const sampleEpic2 = {
  ...C.blank(),
  id: 'PRJ-5',
  summary: 'Frontend Web App',
  type: 'Epic',
  priority: 'Medium',
  status: 'In Progress',
  startDate: '2026-11-01',
  dueDate: '2026-11-30',
  rank: 5000,
  version: 'v1'
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(items => {
    if (!localStorage.getItem('sheetflow.project.v1')) {
      localStorage.setItem('sheetflow.project.v1', JSON.stringify({
        issues: items,
        comments: [],
        sequence: 5
      }));
    }
  }, [sampleEpic, sampleTask, sampleMilestoneInEpic, sampleMilestoneRoot, sampleEpic2]);
});

test('milestone displays diamond symbol and milestone styling on Kanban card', async ({ page }) => {
  await page.goto('/#kanban');
  const card = page.locator('.card[data-issue="PRJ-3"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/card-milestone/);

  // Type dropdown on milestone card should display Milestone and allow Task/Bug
  const typeSelect = card.locator('[data-card-type="PRJ-3"]');
  await expect(typeSelect).toHaveValue('Milestone');

  const options = await typeSelect.locator('option').allInnerTexts();
  expect(options.map(t => t.trim())).toEqual(['Task', 'Bug', 'Milestone']);
});

test('changing card type between Task and Milestone works seamlessly', async ({ page }) => {
  await page.goto('/#kanban');
  const taskCard = page.locator('.card[data-issue="PRJ-2"]');
  const taskTypeSelect = taskCard.locator('[data-card-type="PRJ-2"]');

  // Convert Task to Milestone
  await taskTypeSelect.selectOption('Milestone');
  await expect(taskCard).toHaveClass(/card-milestone/);
  await expect(taskTypeSelect).toHaveValue('Milestone');

  // Convert back to Task
  await taskTypeSelect.selectOption('Task');
  await expect(taskCard).not.toHaveClass(/card-milestone/);
  await expect(taskTypeSelect).toHaveValue('Task');
});

test('toggling Milestones on top pins milestones into dedicated summary lane', async ({ page }) => {
  await page.goto('/#kanban');

  const toggle = page.locator('#milestones-top-toggle');
  await expect(toggle).toBeVisible();

  // Initially milestonesOnTop is false: PRJ-3 is inside PRJ-1 epic lane, PRJ-4 in no-epic lane
  const epicLane = page.locator('.swimlane[data-epic-lane="PRJ-1"]');
  await expect(epicLane.locator('.card[data-issue="PRJ-3"]')).toBeVisible();

  // Turn on Milestones on top
  await toggle.check();

  // Dedicated project milestones lane appears at the top
  const milestonesLane = page.locator('.swimlane[data-epic-lane="__milestones__"]');
  await expect(milestonesLane).toBeVisible();
  await expect(milestonesLane.locator('.swimlane-header')).toContainText('Project Milestones');

  // Both milestones are grouped into the project milestones lane
  await expect(milestonesLane.locator('.card[data-issue="PRJ-3"]')).toBeVisible();
  await expect(milestonesLane.locator('.card[data-issue="PRJ-4"]')).toBeVisible();

  // Milestone is no longer inside the epic lane
  await expect(epicLane.locator('.card[data-issue="PRJ-3"]')).toHaveCount(0);

  // State persists across reload
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(page.locator('.swimlane[data-epic-lane="__milestones__"]')).toBeVisible();
});

test('milestone renders as diamond on Gantt timeline', async ({ page }) => {
  await page.goto('/#gantt');

  // Milestones should have .gantt-milestone diamonds
  const milestoneRow = page.locator('[data-gantt-row-id="PRJ-3"]');
  await expect(milestoneRow).toBeVisible();
  await expect(milestoneRow.locator('.gantt-milestone')).toBeVisible();
  await expect(milestoneRow.locator('.gantt-milestone-diamond')).toBeVisible();

  // Tasks should have regular bars .gantt-bar
  const taskRow = page.locator('[data-gantt-row-id="PRJ-2"]');
  await expect(taskRow).toBeVisible();
  await expect(taskRow.locator('.gantt-bar')).toBeVisible();
  await expect(taskRow.locator('.gantt-milestone')).toHaveCount(0);
});

test('milestone displays in Sheet view and shows diamond icon with ID', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sheetflow.ui.v1', JSON.stringify({ visibleColumns: ['id', 'summary', 'type', 'status', 'dueDate'] }));
  });
  await page.goto('/#sheet');

  const row = page.locator('[data-sheet-row-id="PRJ-3"]');
  await expect(row).toBeVisible();

  // ID cell shows diamond icon
  const idCell = row.locator('td[data-column-key="id"]');
  await expect(idCell).toContainText('PRJ-3');
  await expect(idCell).toContainText('◆');

  // Type cell shows Milestone
  const typeSelect = row.locator('td[data-column-key="type"] select');
  await expect(typeSelect).toHaveValue('Milestone');
});

test('swimlanes can be vertically ordered for both epics and milestones', async ({ page }) => {
  await page.goto('/#kanban');

  // Turn on milestone lane
  const toggle = page.locator('#milestones-top-toggle');
  await toggle.check();

  const getSwimlaneIds = async () => {
    return page.locator('.swimlane').evaluateAll(lanes => lanes.map(l => l.dataset.epicLane).filter(id => id && id !== ''));
  };

  // Initially: __milestones__, PRJ-1, PRJ-5
  expect(await getSwimlaneIds()).toEqual(['__milestones__', 'PRJ-1', 'PRJ-5']);

  // Move __milestones__ down below PRJ-1
  const milestoneDownBtn = page.locator('[data-swimlane-id="__milestones__"][data-swimlane-move="down"]');
  await milestoneDownBtn.click();
  await expect(page.locator('.swimlane').first()).toHaveAttribute('data-epic-lane', 'PRJ-1');
  expect(await getSwimlaneIds()).toEqual(['PRJ-1', '__milestones__', 'PRJ-5']);

  // Move PRJ-5 up above __milestones__
  const epic5UpBtn = page.locator('[data-swimlane-id="PRJ-5"][data-swimlane-move="up"]');
  await epic5UpBtn.click();
  await expect(page.locator('.swimlane').nth(1)).toHaveAttribute('data-epic-lane', 'PRJ-5');
  expect(await getSwimlaneIds()).toEqual(['PRJ-1', 'PRJ-5', '__milestones__']);

  // Move PRJ-1 down below PRJ-5
  const epic1DownBtn = page.locator('[data-swimlane-id="PRJ-1"][data-swimlane-move="down"]');
  await epic1DownBtn.click();
  await expect(page.locator('.swimlane').first()).toHaveAttribute('data-epic-lane', 'PRJ-5');
  expect(await getSwimlaneIds()).toEqual(['PRJ-5', 'PRJ-1', '__milestones__']);

  // Order persists across page reload
  await page.reload();
  expect(await getSwimlaneIds()).toEqual(['PRJ-5', 'PRJ-1', '__milestones__']);
});


test('adding milestone simply in milestone swimlane works in Kanban, Gantt, and Sheet', async ({ page }) => {
  await page.goto('/#kanban');

  // Turn on Milestones on top
  const toggle = page.locator('#milestones-top-toggle');
  await toggle.check();

  const milestonesLane = page.locator('.swimlane[data-epic-lane="__milestones__"]');
  await expect(milestonesLane).toBeVisible();

  // 1. Swimlane header has + Milestone button
  const swimlaneAddBtn = milestonesLane.locator('.swimlane-add[data-ghost-kind="Milestone"]');
  await expect(swimlaneAddBtn).toBeVisible();
  await expect(swimlaneAddBtn).toHaveText('+ Milestone');

  // 2. Each column has + Add milestone ghost button and milestone new button
  const backlogColumn = milestonesLane.locator('.column[data-status="Backlog"]');
  const ghostAddBtn = backlogColumn.locator('.ghost-add[data-ghost-kind="Milestone"]');
  await expect(ghostAddBtn).toBeVisible();
  await expect(ghostAddBtn).toHaveText('+ Add milestone');

  const columnNewBtn = backlogColumn.locator('button[data-new="Backlog"][data-new-kind="Milestone"]');
  await expect(columnNewBtn).toBeVisible();

  // 3. Click + Add milestone to open quick entry in the milestone lane
  await ghostAddBtn.click();
  const quickTitle = page.locator('#quick-title');
  await expect(quickTitle).toBeFocused();
  await expect(quickTitle).toHaveAttribute('placeholder', 'Add a milestone…');

  // Type title and submit
  await quickTitle.fill('Sprint 4 Milestone');
  await quickTitle.press('Enter');

  // New milestone card is created in Backlog column with diamond
  const newCard = milestonesLane.locator('.card', { hasText: 'Sprint 4 Milestone' });
  await expect(newCard).toBeVisible();
  await expect(newCard).toHaveClass(/card-milestone/);
  await expect(newCard.locator('.card-due-badge')).toContainText('◆');

  // Verify in Gantt view: milestone row has Add button
  await page.goto('/#gantt');
  const ganttMilestoneRow = page.locator('.gantt-milestones-row');
  await expect(ganttMilestoneRow).toBeVisible();
  const ganttAddBtn = ganttMilestoneRow.locator('.gantt-add-button[data-ghost-kind="Milestone"]');
  await expect(ganttAddBtn).toBeVisible();

  // Verify in Sheet view: milestone lane header has + Milestone button
  await page.goto('/#sheet');
  const sheetMilestoneLane = page.locator('.sheet-lane-row[data-sheet-parent-target="__milestones__"]');
  await expect(sheetMilestoneLane).toBeVisible();
  const sheetAddBtn = sheetMilestoneLane.locator('.swimlane-add[data-ghost-kind="Milestone"]');
  await expect(sheetAddBtn).toBeVisible();
  await expect(sheetAddBtn).toHaveText('+ Milestone');
});


test('command palette and shortcuts support quick milestone actions', async ({ page }) => {
  await page.goto('/#kanban');

  // 1. Open command palette via Ctrl+K
  await page.keyboard.press('Control+k');
  const commandDialog = page.locator('#command-dialog');
  await expect(commandDialog).toBeVisible();

  // Search for "milestone"
  const commandQuery = page.locator('#command-query');
  await commandQuery.fill('milestone');

  const results = page.locator('#command-results button');
  await expect(results).toHaveCount(5);
  await expect(results.filter({ hasText: 'Quick milestone' })).toBeVisible();
  await expect(results.filter({ hasText: 'Milestone with details (Shift+M)' })).toBeVisible();
  await expect(results.filter({ hasText: 'Filter: Milestones only' })).toBeVisible();
  await expect(results.filter({ hasText: 'Jump to Project Milestones (M)' })).toBeVisible();
  await expect(results.filter({ hasText: 'Group milestones on top' })).toBeVisible();

  // Click "Filter: Milestones only"
  const filterBtn = results.filter({ hasText: 'Filter: Milestones only' });
  await filterBtn.click();
  await expect(commandDialog).not.toBeVisible();

  // Active filter chip shows Type: Milestone
  const chip = page.locator('#active-filter-chips .filter-chip', { hasText: 'Type: Milestone' });
  await expect(chip).toBeVisible();

  // Only milestone cards visible
  await expect(page.locator('.card[data-issue="PRJ-3"]')).toBeVisible();
  await expect(page.locator('.card[data-issue="PRJ-2"]')).toHaveCount(0); // Task should be filtered out

  // Clear filter chip
  await chip.locator('b').click();
  await expect(page.locator('.card[data-issue="PRJ-2"]')).toBeVisible();

  // 2. Press 'm' when no card is focused to jump to Project Milestones
  await page.keyboard.press('m');
  const milestonesLane = page.locator('.swimlane[data-epic-lane="__milestones__"]');
  await expect(milestonesLane).toBeVisible();

  // 3. Press Shift+M to open milestone details creation
  await page.keyboard.press('Shift+M');
  const issueDialog = page.locator('#issue-dialog');
  await expect(issueDialog).toBeVisible();
  const typeSelect = issueDialog.locator('select[name="type"]');
  await expect(typeSelect).toHaveValue('Milestone');
  await page.locator('#cancel-dialog').click();
  await expect(issueDialog).not.toBeVisible();
});


test('pressing Escape in quick adding of milestones keeps focus in the milestone swimlane instead of shifting down', async ({ page }) => {
  await page.goto('/#kanban');

  // Turn on Milestones on top
  const toggle = page.locator('#milestones-top-toggle');
  await toggle.check();

  const milestonesLane = page.locator('.swimlane[data-epic-lane="__milestones__"]');
  await expect(milestonesLane).toBeVisible();

  // Test 1: Escape from column + Add milestone button
  const backlogColumn = milestonesLane.locator('.column[data-status="Backlog"]');
  const ghostAddBtn = backlogColumn.locator('.ghost-add[data-ghost-kind="Milestone"]');
  await ghostAddBtn.click();
  const quickTitle = page.locator('#quick-title');
  await expect(quickTitle).toBeFocused();

  // Press Escape to cancel quick entry
  await page.keyboard.press('Escape');

  // Focus must stay on the + Add milestone button in the milestone swimlane, NOT shift down to __no_epic__
  await expect(ghostAddBtn).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.closest('[data-epic-lane]')?.dataset.epicLane)).toBe('__milestones__');

  // Test 2: Escape from swimlane header + Milestone button
  const swimlaneAddBtn = milestonesLane.locator('.swimlane-add[data-ghost-kind="Milestone"]');
  await swimlaneAddBtn.click();
  await expect(quickTitle).toBeFocused();

  // Press Escape to cancel quick entry
  await page.keyboard.press('Escape');

  // Focus must stay on the + Milestone button in the milestone swimlane
  await expect(swimlaneAddBtn).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.closest('[data-epic-lane]')?.dataset.epicLane)).toBe('__milestones__');
});
