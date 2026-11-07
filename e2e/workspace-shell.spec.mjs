import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`shortcut help is discoverable and restores workspace focus at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#kanban');
    await expect(page.locator('#sync-status')).toHaveText('Saved in this browser');
    await page.locator('#search').fill('guide');
    const help = page.getByRole('button', { name: 'Shortcuts', exact: true });
    await expect(page.locator('.workspace-options')).not.toHaveAttribute('open', '');
    await expect(help).toBeInViewport();
    await help.click();
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts & help' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close help', exact: true })).toBeFocused();
    const essentials = dialog.locator('[aria-labelledby="shortcuts-essentials"]');
    await expect(essentials.locator('dd')).toHaveCount(5);
    for (const key of ['T', 'S', 'Enter', 'Shift', 'Esc']) {
      await expect(essentials.locator('kbd').filter({ hasText: new RegExp(`^${key}$`) }).first()).toBeInViewport();
    }
    await expect(dialog.locator('#single-key-shortcuts')).toBeHidden();
    // Global navigation must not run while help is open.
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/#kanban$/);
    for (const summary of await dialog.locator('summary').all()) {
      await summary.click();
      await expect(summary.locator('..')).toHaveAttribute('open', '');
    }
    const preference = dialog.getByRole('checkbox', { name: /single.key shortcuts/i });
    await expect(preference).toBeVisible();
    await preference.uncheck();
    await expect(preference).not.toBeChecked();
    await expect(dialog.locator('#help-storage')).toContainText('only in this browser');
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(help).toBeFocused();
    await expect(page.locator('#search')).toHaveValue('guide');
    await help.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /single.key shortcuts/i })).not.toBeChecked();
    await page.getByRole('button', { name: 'Close help', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(help).toBeFocused();
  });

  test(`workspace navigation and controls remain reachable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#kanban');
    await expect(page.locator('#sync-status')).toHaveText('Saved in this browser');
    await expect(page.locator('[data-view]')).toHaveCount(3);
    await expect(page.locator('.sidebar, .page-heading, #stats')).toHaveCount(0);
    await expect(page.locator('#search')).toBeVisible();
    await page.locator('#workspace-filters > summary').click();
    for (const control of ['#priority-filter','#assignee-filter','#type-filter-label']) await expect(page.locator(control)).toBeVisible();
    await page.locator('#workspace-filters > summary').click();
    expect((await page.locator('#view-content').boundingBox()).y).toBeLessThan(viewport.width > 700 ? 240 : viewport.height);
    await page.locator('#search').fill('guide');
    for (const view of ['sheet', 'gantt', 'kanban']) {
      await page.locator(`[data-view="${view}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${view}$`));
      await expect(page.locator(`[data-view="${view}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#search')).toHaveValue('guide');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.locator('#search').fill('');
    await page.locator('#workspace-filters > summary').click();
    await page.locator('#priority-filter').selectOption('High');
    await expect(page.locator('#active-filter-chips')).toContainText('High');
    await expect(page.locator('#status-filter')).toBeVisible();
    await page.locator('#status-filter').selectOption('In Progress');
    await page.locator('#workspace-filters > summary').click();
    await expect(page.locator('#active-filter-chips')).toBeVisible();
    await page.locator('[data-remove-filter="priority"]').click();
    if(viewport.width<700) await page.locator('#workspace-more > summary').click();
    await page.locator('.workspace-saved-views > summary').click();
    await expect(page.locator('#save-view-open')).toBeVisible();
    await page.locator('#save-view-open').click();
    await expect(page.locator('#saved-view-dialog')).toBeVisible();
    await page.locator('#saved-view-cancel').click();
    await expect(page.locator('#save-view-open')).toBeFocused();
    await page.locator('.workspace-saved-views > summary').click();
    const workspaceOptions = page.locator('.workspace-options');
    if(await workspaceOptions.getAttribute('open')!==null) await workspaceOptions.locator('summary').first().click();
    const more = workspaceOptions.locator('summary').first();
    await more.press('Enter');
    await expect(page.locator('#add-epic')).toBeVisible();
    await expect(page.locator('#connection-title')).toBeVisible();
    await expect(page.locator('#help-button')).toBeVisible();
    await expect(page.locator('#export')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('#add-epic').press('Escape');
    await expect(workspaceOptions).not.toHaveAttribute('open', '');
    await expect(more).toBeFocused();
    await more.press('Enter');
    await page.locator('#bulk-create-open').click();
    await expect(page.locator('#bulk-create-dialog')).toBeVisible();
    await page.locator('#bulk-create-cancel').click();
    if(await workspaceOptions.getAttribute('open')!==null) await more.click();
    await more.press('Enter');
    await page.locator('#create-issue').click();
    await expect(workspaceOptions).not.toHaveAttribute('open', '');
    await expect(page.locator('#issue-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#issue-dialog')).not.toBeVisible();
  });
}

test('view hashes, history and existing keyboard shortcuts remain usable', async ({ page }) => {
  await page.goto('/#gantt');
  await expect(page.locator('#view-title')).toHaveText('Gantt');
  await page.keyboard.press('1'); await expect(page).toHaveURL(/#sheet$/);
  await page.keyboard.press('2'); await expect(page).toHaveURL(/#kanban$/);
  await page.keyboard.press('3'); await expect(page).toHaveURL(/#gantt$/);
  await page.goBack(); await expect(page.locator('#view-title')).toHaveText('Kanban');
  await page.keyboard.press('/'); await expect(page.locator('#search')).toBeFocused();
  await page.locator('[data-view="kanban"]').click();
  await page.keyboard.press('n'); await expect(page.locator('#issue-dialog')).toBeVisible();
  await expect(page.locator('#issue-form [name="summary"]')).toHaveValue('');
  await page.keyboard.press('Escape'); await expect(page.locator('#issue-dialog')).not.toBeVisible();
});
