import { test, expect } from '@playwright/test';
import C from '../Core.js';

const sampleIssue = {
  ...C.blank(),
  id: 'PRJ-1',
  summary: 'Original Title',
  type: 'Task',
  taskTypeId: 'algo',
  priority: 'Medium',
  assignee: 'Sam Rivera',
  dueDate: '2026-12-15',
  status: 'In Progress',
  rank: 1000,
  version: 'v1'
};

const sampleStory = {
  ...C.blank(),
  id: 'PRJ-2',
  summary: 'User Story Feature',
  type: 'Story',
  taskTypeId: 'none',
  priority: 'Medium',
  status: 'Backlog',
  rank: 2000,
  version: 'v1'
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(items => {
    localStorage.setItem('sheetflow.project.v1', JSON.stringify({
      issues: items,
      comments: [],
      sequence: 2
    }));
  }, [sampleIssue, sampleStory]);
  await page.goto('/#kanban');
});

test('card title is directly editable inline on click', async ({ page }) => {
  const card = page.locator('.card[data-issue="PRJ-1"]');
  const titleText = card.locator('[data-card-title="PRJ-1"]');
  const titleInput = card.locator('[data-card-title-input="PRJ-1"]');

  await expect(titleText).toHaveText('Original Title');
  await expect(titleInput).toBeHidden();

  // Click on title text triggers inline editing
  await titleText.click();
  await expect(titleInput).toBeVisible();
  await expect(titleInput).toBeFocused();

  // Type new title and press Enter
  await titleInput.fill('Updated Title Inline');
  await titleInput.press('Enter');

  // Verify persistence and re-render
  await expect(titleText).toBeVisible();
  await expect(titleText).toHaveText('Updated Title Inline');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].summary))
    .toBe('Updated Title Inline');
});

test('card type and activity are directly selectable from card header for task/bug', async ({ page }) => {
  const card = page.locator('.card[data-issue="PRJ-1"]');
  const typeSelect = card.locator('[data-card-type="PRJ-1"]');
  const activitySelect = card.locator('[data-card-activity="PRJ-1"]');

  // Change type from Task to Bug
  await typeSelect.selectOption('Bug');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].type))
    .toBe('Bug');

  // Change activity type
  await activitySelect.selectOption('none');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].taskTypeId))
    .toBe('none');
});

test('card due date opens immediately, waits for Enter to persist, and supports Escape cancel', async ({ page }) => {
  const card = page.locator('.card[data-issue="PRJ-1"]');
  const dueInput = card.locator('[data-card-due="PRJ-1"]');

  await expect(dueInput).toHaveValue('2026-12-15');

  // Focus/click opens the visible date editor immediately and waits for Enter before saving
  await dueInput.focus();
  await dueInput.fill('2026-12-25');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].dueDate)).toBe('2026-12-15');

  await dueInput.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].dueDate))
    .toBe('2026-12-25');

  // Escape cancels an unsaved date change
  await dueInput.focus();
  await dueInput.fill('2027-01-10');
  await dueInput.press('Escape');
  await expect(dueInput).toHaveValue('2026-12-25');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).issues[0].dueDate)).toBe('2026-12-25');
});

test('card quick comment adds comment and updates comment count', async ({ page }) => {
  const card = page.locator('.card[data-issue="PRJ-1"]');
  const commentBtn = card.locator('[data-card-comment-toggle="PRJ-1"]');
  const commentBox = card.locator('[data-card-comment-box="PRJ-1"]');
  const commentInput = card.locator('[data-card-comment-input="PRJ-1"]');

  await expect(commentBox).toBeHidden();

  // Toggle quick comment box
  await commentBtn.click();
  await expect(commentBox).toBeVisible();
  await expect(commentInput).toBeFocused();

  // Type and submit comment via Enter
  await commentInput.fill('Great progress on this task!');
  await commentInput.press('Enter');

  // Box closes, comment is saved in storage and counter updates
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).comments.length))
    .toBe(1);

  const comment = await page.evaluate(() => JSON.parse(localStorage.getItem('sheetflow.project.v1')).comments[0]);
  expect(comment.taskId).toBe('PRJ-1');
  expect(comment.body).toBe('Great progress on this task!');

  // Verify counter on card
  await expect(card.locator('.card-comment-count')).toHaveText('1');
});

test('story card cannot change type to task or other on kanban', async ({ page }) => {
  const storyCard = page.locator('.card[data-issue="PRJ-2"]');
  // Type select must NOT exist on Story card
  await expect(storyCard.locator('[data-card-type="PRJ-2"]')).toHaveCount(0);
  await expect(storyCard.locator('.card-type-static')).toBeVisible();

  // Task card cannot select Story or Epic (only Task and Bug are options)
  const taskCard = page.locator('.card[data-issue="PRJ-1"]');
  const options = await taskCard.locator('[data-card-type="PRJ-1"] option').allTextContents();
  expect(options).toEqual(['Task', 'Bug']);
});
