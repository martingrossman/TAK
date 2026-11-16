import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

test('the header shows the build version on desktop and hides it on phones', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#kanban');
  const badge = page.locator('.brand-version');
  await expect(badge).toHaveText(`v${version}`);
  await expect(badge).toHaveAttribute('title', `TAK version ${version}`);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(badge).toBeHidden();
});
