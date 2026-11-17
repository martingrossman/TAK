import { test, expect } from '@playwright/test';

const year = new Date().getFullYear();

async function dragChip(page, name, target, fraction) {
  const chip = page.getByRole('button', { name, exact: true });
  const from = await chip.boundingBox(), to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 3 });
  await page.mouse.move(to.x + to.width * fraction, to.y + to.height / 2, { steps: 8 });
  return { release: () => page.mouse.up() };
}

test('a chip dropped on a stream creates the item there, named in place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const stream = page.locator('.roadmap-stream[aria-label="Help desk"]'), track = stream.locator('.roadmap-track');
  const rename = page.locator('#roadmap-rename');

  const milestone = await dragChip(page, 'Milestone', track, 0.5);
  await expect(page.locator('#roadmap-drag-tip')).toContainText('New milestone');
  await expect(page.locator('#roadmap-drag-tip')).toContainText('Help desk');
  await expect(stream).toHaveClass(/roadmap-drop-target/);
  await milestone.release();
  await expect(page.locator('#roadmap-dialog')).toBeHidden();
  await expect(stream.locator('#roadmap-rename')).toBeFocused();
  await expect(rename).toHaveValue('New milestone');
  await page.keyboard.type('Beta opens');
  await page.keyboard.press('Enter');
  await expect(rename).toHaveCount(0);
  await expect(stream.getByRole('button', { name: /Beta opens/ })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')).find(item => item.title === 'Beta opens'));
  expect(stored.type).toBe('Milestone');
  expect(stored.startDate).toMatch(new RegExp(`^${year}-0[67]-`));
  expect(stored.streamId).toBe(await stream.locator('[data-roadmap-stream-id]').getAttribute('data-roadmap-stream-id'));

  // Clicking away keeps the default name; Esc removes the draft without saving anything.
  await (await dragChip(page, 'Increment', track, 0.25)).release();
  await expect(rename).toHaveValue('New increment');
  await page.getByLabel('Roadmap starts on').click();
  await expect(stream.getByRole('button', { name: 'New increment', exact: true })).toBeVisible();
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')).length);
  await (await dragChip(page, 'Milestone', track, 0.7)).release();
  await expect(rename).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rename).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')).length)).toBe(count);
});

test('an increment dropped on the Milestones lane is refused, Escape cancels, and a click still opens the dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const top = page.locator('.roadmap-milestones .roadmap-track');
  const refused = await dragChip(page, 'Increment', top, 0.5);
  await expect(page.locator('#roadmap-drag-tip')).toHaveText('Drop an increment on a stream');
  await refused.release();
  await expect(page.locator('#toast')).toContainText('Drop an increment on a stream');
  await expect(page.locator('#roadmap-dialog')).toBeHidden();

  await dragChip(page, 'Milestone', top, 0.5);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('#roadmap-dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'New milestone' })).toBeVisible();
});

test('a click renames an item in place and a double-click opens its details', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const rename = page.locator('#roadmap-rename');
  const stored = title => page.evaluate(name => JSON.parse(localStorage.getItem('tak.roadmap.v1')).find(item => item.title === name), title);

  await page.getByRole('button', { name: 'Help bot', exact: true }).click();
  await expect(rename).toBeFocused();
  await expect(rename).toHaveValue('Help bot');
  await expect(page.locator('#roadmap-dialog')).toBeHidden();
  await page.keyboard.type('Support bot');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Support bot', exact: true })).toBeFocused();
  expect(await stored('Support bot')).toBeTruthy();

  await page.getByRole('button', { name: /^Milestone Android launch/ }).click();
  await expect(rename).toBeFocused();
  await page.keyboard.type('Changed');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Milestone Android launch/ })).toBeFocused();
  expect(await stored('Changed')).toBeFalsy();

  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  await expect(rename).toHaveValue('Mobile');
  await expect(rename).toBeFocused();
  await page.keyboard.type('Mobile apps');
  await page.getByLabel('Roadmap starts on').click();
  await expect(page.getByRole('button', { name: 'Mobile apps', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Support bot', exact: true }).dblclick();
  await expect(page.getByRole('dialog', { name: 'Edit increment' })).toBeVisible();
  await expect(rename).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Support bot', exact: true }).focus();
  await page.keyboard.press('F2');
  await expect(rename).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit increment' })).toBeVisible();
});
