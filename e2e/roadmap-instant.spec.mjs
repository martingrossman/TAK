import { test, expect } from '@playwright/test';
import C from '../Core.js';

const year = new Date().getFullYear();
const issue = { ...C.blank(), id: 'PRJ-1', summary: 'Any task', rank: 1000, version: 'v1' };
const seed = [
  { id: 'RM-1', type: 'Stream', streamId: '', title: 'Platform', startDate: '', endDate: '', color: 'teal', notes: '', order: 1, version: '1', icon: '', line: false },
  { id: 'RM-2', type: 'Increment', streamId: 'RM-1', title: 'Billing API', startDate: `${year}-03-01`, endDate: `${year}-03-20`, color: '', notes: '', order: 0, version: '1', icon: '', line: false }
];

/** A slow Google backend: every roadmap save waits until the test finishes it. */
async function slowBackend(page) {
  await page.addInitScript(({ item, items }) => {
    const h = window.roadmapHarness = { items: structuredClone(items), requests: [], next: 10 };
    h.finish = outcome => {
      const request = h.requests.find(entry => !entry.done); request.done = true;
      if (outcome === 'fail') return request.failure({ message: 'Temporary failure' });
      const current = h.items.find(entry => entry.id === request.input.id);
      const saved = { ...(current || { id: `RM-${h.next++}`, version: '0', order: 5, streamId: '', startDate: '', endDate: '', color: '', notes: '', icon: '', line: false }), ...request.input };
      saved.version = String(Number(saved.version) + 1);
      h.items = current ? h.items.map(entry => entry.id === saved.id ? saved : entry) : [...h.items, saved];
      request.success(structuredClone(saved));
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, 'run', { get() { return {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; },
      getProject() { queueMicrotask(() => this.success({ issues: [structuredClone(item)], comments: {}, settings: [], mode: 'team', spreadsheetUrl: '' })); },
      getRoadmap() { queueMicrotask(() => this.success({ items: structuredClone(h.items) })); },
      saveRoadmapItem(input, version) { h.requests.push({ input: structuredClone(input), version, success: this.success, failure: this.failure }); }
    }; } });
  }, { item: issue, items: seed });
}
const requests = page => page.evaluate(() => roadmapHarness.requests.map(entry => ({ input: entry.input, version: entry.version })));

test('a new stream and an increment inside it appear at once and save in order', async ({ page }) => {
  await slowBackend(page);
  await page.goto('/#roadmap');
  await page.getByRole('button', { name: 'Add stream', exact: true }).first().click();
  const stream = page.getByRole('dialog', { name: 'New stream' });
  await stream.getByLabel('Title').fill('Analytics');
  await stream.getByRole('button', { name: 'Save' }).click();
  await expect(stream).toBeHidden();
  const added = page.locator('.roadmap-stream[aria-label="Analytics"]');
  await expect(added).toBeVisible();
  expect(await requests(page)).toHaveLength(1);

  await added.getByRole('button', { name: '+ Add increment' }).click();
  const increment = page.getByRole('dialog', { name: 'New increment' });
  await increment.getByLabel('Title').fill('Usage dashboard');
  await increment.getByLabel('Start').fill(`${year}-06-01`);
  await increment.getByLabel('End').fill(`${year}-07-15`);
  await increment.getByRole('button', { name: 'Save' }).click();
  await expect(added.getByRole('button', { name: 'Usage dashboard' })).toBeVisible();
  expect(await requests(page), 'the increment waits for its stream to get a real ID').toHaveLength(1);

  await page.evaluate(() => roadmapHarness.finish('ok'));
  await expect.poll(async () => (await requests(page)).length).toBe(2);
  expect((await requests(page))[1].input.streamId).toBe('RM-10');
  await page.evaluate(() => roadmapHarness.finish('ok'));
  await expect(added.getByRole('button', { name: 'Usage dashboard' })).toBeVisible();
});

test('repeated moves stay responsive, are merged into one follow-up save, and a failure restores the last saved state', async ({ page }) => {
  await slowBackend(page);
  await page.goto('/#roadmap');
  const bar = page.getByRole('button', { name: 'Billing API', exact: true });
  await bar.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(bar).toBeFocused();
  expect(await requests(page), 'only one save is in flight').toHaveLength(1);
  expect((await requests(page))[0].input.startDate).toBe(`${year}-03-02`);

  await page.evaluate(() => roadmapHarness.finish('ok'));
  await expect.poll(async () => (await requests(page)).length).toBe(2);
  const second = (await requests(page))[1];
  expect(second.input.startDate).toBe(`${year}-03-04`);
  expect(second.version, 'the follow-up uses the version returned by the first save').toBe('2');

  await page.evaluate(() => roadmapHarness.finish('fail'));
  await expect(page.locator('#toast')).toContainText('was not saved');
  await bar.click();
  await expect(page.getByRole('dialog', { name: 'Edit increment' }).getByLabel('Start')).toHaveValue(`${year}-03-02`);
});
