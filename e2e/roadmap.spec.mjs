import { test, expect } from '@playwright/test';

const year = new Date().getFullYear();

test('roadmap opens with shortcut 4, edits an increment and keeps it after reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#kanban');
  await expect(page.locator('#sync-status')).toHaveText('Saved in this browser');
  await page.keyboard.press('4');
  await expect(page).toHaveURL(/#roadmap$/);
  await expect(page.getByRole('button', { name: 'Roadmap', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.workspace-bar')).toBeHidden();
  await expect(page.getByLabel('Roadmap starts on')).toHaveValue(`${year}-01-01`);
  await expect(page.getByLabel('Roadmap ends on')).toHaveValue(`${year}-12-31`);
  await expect(page.locator('.roadmap-stream:not(.roadmap-milestones)')).toHaveCount(5);

  await page.getByRole('button', { name: 'Help bot', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit increment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Title')).toBeFocused();
  await dialog.getByLabel('Title').fill('Help bot v2');
  await dialog.getByLabel('End').fill(`${year}-03-31`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Help bot v2', exact: true })).toBeFocused();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Help bot v2', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('roadmap validates input, keeps the draft, and protects streams that still have items', async ({ page }) => {
  await page.goto('/#roadmap');
  await page.getByRole('button', { name: 'Add stream', exact: true }).first().click();
  const stream = page.getByRole('dialog', { name: 'New stream' });
  await stream.getByRole('button', { name: 'Save' }).click();
  await expect(stream.locator('#roadmap-status')).toHaveText(/title/);
  await stream.getByLabel('Title').fill('Analytics');
  await stream.getByText('Violet', { exact: true }).locator('..').click();
  await stream.getByRole('button', { name: 'Save' }).click();
  await expect(stream).toBeHidden();
  const added = page.locator('.roadmap-stream[aria-label="Analytics"]');
  await expect(added).toHaveAttribute('data-roadmap-color', 'violet');

  await added.getByRole('button', { name: '+ Add increment' }).click();
  const increment = page.getByRole('dialog', { name: 'New increment' });
  await expect(increment.getByLabel('Stream')).toHaveValue(/RM-\d+/);
  await increment.getByLabel('Title').fill('Usage dashboard');
  await increment.getByLabel('Start').fill(`${year}-06-01`);
  await increment.getByLabel('End').fill(`${year}-05-01`);
  await increment.getByRole('button', { name: 'Save' }).click();
  await expect(increment.locator('#roadmap-status')).toHaveText(/end date must be on or after/);
  await expect(increment.getByLabel('Title')).toHaveValue('Usage dashboard');
  await increment.getByLabel('End').fill(`${year}-07-15`);
  await increment.getByRole('button', { name: 'Save' }).click();
  await expect(added.getByRole('button', { name: 'Usage dashboard' })).toBeVisible();

  await added.getByRole('button', { name: 'Analytics', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit stream' });
  await edit.getByRole('button', { name: 'Delete' }).click();
  await expect(edit.locator('#roadmap-status')).toHaveText(/Delete again/);
  await edit.getByRole('button', { name: 'Delete' }).click();
  await expect(edit.locator('#roadmap-status')).toHaveText(/before deleting the stream/);
  await edit.getByRole('button', { name: 'Cancel' }).click();
  await expect(added).toBeVisible();
});

test('stream order moves with the keyboard buttons and period navigation hides other periods', async ({ page }) => {
  await page.goto('/#roadmap');
  const titles = page.locator('.roadmap-stream:not(.roadmap-milestones) .roadmap-stream-title');
  await expect(titles.first()).toHaveText('Self serve');
  await page.getByRole('button', { name: 'Move Self serve down' }).click();
  await expect(titles.nth(0)).toHaveText('Mobile');
  await expect(titles.nth(1)).toHaveText('Self serve');
  await expect(page.getByRole('button', { name: 'Move Self serve down' })).toBeFocused();
  await page.reload();
  await expect(titles.nth(0)).toHaveText('Mobile');

  await page.getByRole('button', { name: 'Show the next period' }).click();
  await expect(page.getByLabel('Roadmap starts on')).toHaveValue(`${year + 1}-01-01`);
  await expect(page.getByLabel('Roadmap ends on')).toHaveValue(`${year + 1}-12-31`);
  await expect(page.getByRole('button', { name: 'Show the next period' })).toBeFocused();
  await expect(page.locator('.roadmap-bar')).toHaveCount(0);
  await expect(page.locator('.roadmap-hidden').first()).toContainText('outside this range');
  await page.getByRole('button', { name: 'This year' }).click();
  await expect(page.getByLabel('Roadmap starts on')).toHaveValue(`${year}-01-01`);
  await expect(page.getByRole('button', { name: 'This year' })).toBeDisabled();
});

test('the theme toggle switches and remembers dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#roadmap');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute('aria-pressed', 'true');
});

async function dragBy(page, locator, dx, dy = 0, { release = true } = {}) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  if (release) await page.mouse.up();
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')));
const storedItem = async (page, title) => (await stored(page)).find(item => item.title === title);
const shiftDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

test('dragging an increment moves both dates and survives reload; a plain click still opens it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const bar = page.getByRole('button', { name: 'Help bot', exact: true });
  const before = await storedItem(page, 'Help bot');
  const dayWidth = (await page.locator('.roadmap-lane').first().boundingBox()).width / 365;
  await dragBy(page, bar, dayWidth * 30);
  await expect.poll(async () => (await storedItem(page, 'Help bot')).version).toBe('2');
  const after = await storedItem(page, 'Help bot');
  const moved = (Date.parse(after.startDate) - Date.parse(before.startDate)) / 86400000;
  expect(moved).toBeGreaterThanOrEqual(29);
  expect(moved).toBeLessThanOrEqual(31);
  expect((Date.parse(after.endDate) - Date.parse(after.startDate))).toBe(Date.parse(before.endDate) - Date.parse(before.startDate));
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  expect((await storedItem(page, 'Help bot')).startDate).toBe(after.startDate);
  await page.getByRole('button', { name: 'Help bot', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit increment' })).toBeVisible();
});

test('dragging a bar end changes only that date and never inverts the range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const before = await storedItem(page, 'Single sign-on');
  const bar = page.getByRole('button', { name: 'Single sign-on', exact: true });
  const box = await bar.boundingBox();
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 300, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await storedItem(page, 'Single sign-on')).version).toBe('2');
  const after = await storedItem(page, 'Single sign-on');
  expect(after.startDate).toBe(before.startDate);
  expect(after.endDate).toBe(before.startDate);
});

test('an increment can be dropped onto another stream and a milestone into a stream lane', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const target = page.locator('.roadmap-stream[aria-label="Help desk"] .roadmap-track');
  const bar = page.getByRole('button', { name: 'PCI compliance', exact: true });
  const from = await bar.boundingBox(), to = await target.boundingBox();
  await dragBy(page, bar, 0, to.y + to.height / 2 - (from.y + from.height / 2));
  await expect(page.locator('.roadmap-stream[aria-label="Help desk"]').getByRole('button', { name: 'PCI compliance', exact: true })).toBeVisible();
  const helpDesk = (await stored(page)).find(item => item.title === 'Help desk');
  await expect.poll(async () => (await storedItem(page, 'PCI compliance')).streamId).toBe(helpDesk.id);

  const milestone = page.getByRole('button', { name: /^Milestone Android launch/ });
  const mobileTrack = await page.locator('.roadmap-stream[aria-label="Mobile"] .roadmap-track').boundingBox();
  const mBox = await milestone.locator('.roadmap-diamond').boundingBox();
  await page.mouse.move(mBox.x + mBox.width / 2, mBox.y + mBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mBox.x + 40, mobileTrack.y + 10, { steps: 8 });
  await page.mouse.up();
  const mobile = (await stored(page)).find(item => item.title === 'Mobile');
  await expect.poll(async () => (await storedItem(page, 'Android launch')).streamId).toBe(mobile.id);
  await expect(page.locator('.roadmap-stream[aria-label="Mobile"]').getByRole('button', { name: /^Milestone Android launch/ })).toBeVisible();
});

test('Escape cancels a drag, a failed save puts the item back, and Alt + arrows nudge it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const bar = page.getByRole('button', { name: 'Guest checkout', exact: true });
  const before = await storedItem(page, 'Guest checkout');
  await dragBy(page, bar, 200, 0, { release: false });
  await expect(page.locator('#roadmap-drag-tip')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('#roadmap-drag-tip')).toBeHidden();
  expect(await storedItem(page, 'Guest checkout')).toEqual(before);

  // Another tab saved meanwhile: the drag is refused and the bar returns to the stored dates.
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('tak.roadmap.v1'));
    const item = items.find(entry => entry.title === 'Guest checkout'); item.version = '9'; item.notes = 'edited elsewhere';
    localStorage.setItem('tak.roadmap.v1', JSON.stringify(items));
  });
  await dragBy(page, bar, 120);
  await expect(page.locator('#toast')).toContainText('was not saved');
  const left = await bar.evaluate(element => element.style.left);
  await page.reload();
  expect(await page.getByRole('button', { name: 'Guest checkout', exact: true }).evaluate(element => element.style.left)).toBe(left);

  const fresh = await storedItem(page, 'Guest checkout');
  await page.getByRole('button', { name: 'Guest checkout', exact: true }).focus();
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect.poll(async () => (await storedItem(page, 'Guest checkout')).startDate).toBe(shiftDays(fresh.startDate, 7));
  await expect(page.getByRole('button', { name: 'Guest checkout', exact: true })).toBeFocused();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(page.locator('.roadmap-stream[aria-label="Help desk"]').getByRole('button', { name: 'Guest checkout', exact: true })).toBeFocused();
});

test('a custom start and end date sets the visible range, is remembered, and rejects an inverted range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const from = page.getByLabel('Roadmap starts on'), to = page.getByLabel('Roadmap ends on');
  await from.fill(`${year}-04-01`);
  await expect(from).toHaveValue(`${year}-04-01`);
  await expect(from).toBeFocused();
  await to.fill(`${year}-06-30`);
  await expect(page.locator('.roadmap-month-row span')).toHaveText([`Apr ${year}`, 'May', 'Jun']);
  // Help bot (10 Jan – 20 Feb) is outside; Single sign-on (20 Apr – 5 Jul) runs past the end and is clipped.
  await expect(page.getByRole('button', { name: 'Help bot', exact: true })).toHaveCount(0);
  const sso = page.getByRole('button', { name: 'Single sign-on', exact: true });
  await expect(sso).toBeVisible();
  expect(await sso.evaluate(element => parseFloat(element.style.left) + parseFloat(element.style.width))).toBeCloseTo(100, 1);

  // Moving by a period keeps the same three-month span.
  await page.getByRole('button', { name: 'Show the next period' }).click();
  await expect(from).toHaveValue(`${year}-07-01`);
  await expect(to).toHaveValue(`${year}-09-30`);
  await page.getByRole('button', { name: 'Show the previous period' }).click();
  await expect(from).toHaveValue(`${year}-04-01`);

  // Dragging uses the day width of the chosen range.
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Abandoned cart reminders');
  const days = 91, lane = await page.locator('.roadmap-lane').first().boundingBox();
  const bar = page.getByRole('button', { name: 'Abandoned cart reminders', exact: true });
  const box = await bar.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + lane.width / days * 10, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Abandoned cart reminders').startDate)
    .toBe(new Date(Date.parse(before.startDate + 'T00:00:00Z') + 10 * 86400000).toISOString().slice(0, 10));

  await to.fill(`${year}-03-01`);
  await expect(page.locator('#toast')).toContainText('end date must be on or after');
  await expect(to).toHaveValue(`${year}-06-30`);
  await page.reload();
  await expect(from).toHaveValue(`${year}-04-01`);
  await expect(to).toHaveValue(`${year}-06-30`);
});

test('a long range switches the header to quarters', async ({ page }) => {
  await page.goto('/#roadmap');
  await page.getByLabel('Roadmap ends on').fill(`${year + 1}-12-31`);
  await expect(page.locator('.roadmap-month-row span')).toHaveText([`Jan ${year}`, 'Apr', 'Jul', 'Oct', `Jan ${year + 1}`, 'Apr', 'Jul', 'Oct']);
});

test('a milestone can change icon and colour, draw its own line, and the toolbar shows lines for all milestones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#roadmap');
  const lines = page.locator('.roadmap-mline');
  await expect(lines).toHaveCount(1);
  await expect(page.locator('.roadmap-mline[data-for]')).toHaveAttribute('data-roadmap-color', 'slate');

  await page.getByRole('button', { name: /^Milestone Android launch/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit milestone' });
  await expect(dialog.getByRole('radio', { name: 'Flag' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Green' })).toBeChecked();
  await expect(dialog.getByRole('group', { name: 'Icon' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Triangle' }).check();
  await dialog.getByRole('radio', { name: 'Rose' }).check();
  await dialog.getByRole('checkbox', { name: 'Draw a vertical line across the roadmap' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const android = page.getByRole('button', { name: /^Milestone Android launch/ });
  await expect(android).toHaveAttribute('data-roadmap-color', 'rose');
  await expect(android.locator('.roadmap-diamond')).toHaveAttribute('data-shape', 'triangle');
  await expect(lines).toHaveCount(2);
  const saved = (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Android launch');
  expect([saved.icon, saved.color, saved.line]).toEqual(['triangle', 'rose', true]);

  // Default colour and the diamond go back to the plain marker.
  await android.click();
  await dialog.getByRole('radio', { name: 'Default' }).check();
  await dialog.getByRole('radio', { name: 'Diamond' }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(android).not.toHaveAttribute('data-roadmap-color', /./);
  await expect(android.locator('.roadmap-diamond')).toHaveAttribute('data-shape', 'diamond');

  // Streams have no icon or line choices, and no Default colour.
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  const stream = page.getByRole('dialog', { name: 'Edit stream' });
  await expect(stream.getByRole('group', { name: 'Icon' })).toBeHidden();
  await expect(stream.getByRole('checkbox', { name: 'Draw a vertical line across the roadmap' })).toBeHidden();
  await expect(stream.getByRole('radio', { name: 'Default' })).toBeHidden();
  await stream.getByRole('button', { name: 'Cancel' }).click();

  const toggle = page.getByRole('button', { name: 'Milestone lines' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'All milestone lines' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'All milestone lines' })).toBeFocused();
  await expect(lines).toHaveCount(4);
  await page.reload();
  await expect(lines).toHaveCount(4);

  // The line follows a milestone while it is dragged.
  const marker = page.getByRole('button', { name: /^Milestone iOS launch/ }).locator('.roadmap-diamond');
  const line = page.locator('.roadmap-mline[data-for="RM-26"]');
  const before = await line.evaluate(element => element.style.getPropertyValue('--x'));
  const box = await marker.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 6 });
  expect(Number(await line.evaluate(element => element.style.getPropertyValue('--x')))).toBeGreaterThan(Number(before));
  await page.mouse.up();
});

test('the milestone editor moves a milestone to another stream and changes its date', async ({ page }) => {
  await page.goto('/#roadmap');
  await page.getByRole('button', { name: /^Milestone Community beta/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit milestone' });
  await dialog.getByLabel('Stream').selectOption({ label: 'Mobile' });
  await dialog.locator('input[name="roadmapStart"]').fill('2026-03-10');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Milestone Community beta, .*10/ })).toBeVisible();
  const stored = (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Community beta');
  const mobileId = (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Mobile').id;
  expect([stored.streamId, stored.startDate]).toEqual([mobileId, '2026-03-10']);
  await page.getByRole('button', { name: /^Milestone Community beta/ }).click();
  await dialog.getByLabel('Stream').selectOption({ label: 'None (top lane)' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const back = (await page.evaluate(() => JSON.parse(localStorage.getItem('tak.roadmap.v1')))).find(item => item.title === 'Community beta');
  expect(back.streamId).toBe('');
});
