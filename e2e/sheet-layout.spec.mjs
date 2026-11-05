import { test, expect } from '@playwright/test';
const defaults=['id','summary','status','assignee','priority','dueDate'];
const legacy=['id','type','taskTypeId','parentId','summary','status','priority','assignee','startDate','dueDate','progress','estimate','sprint'];
const order=page=>page.locator('th[data-column-key]').evaluateAll(els=>els.map(el=>el.dataset.columnKey));
async function ready(page){await page.goto('/#sheet');await expect(page.locator('#sync-status')).toHaveText('Saved in this browser');}
async function columns(page){await page.locator('.sheet-columns-menu>summary').click();}
test('legacy defaults migrate once, customized layouts and older saved views remain compatible',async({page})=>{
 await page.addInitScript(legacy=>{if(!localStorage.getItem('sheetflow.ui.v1'))localStorage.setItem('sheetflow.ui.v1',JSON.stringify({visibleColumns:legacy}));},legacy);
 await ready(page);expect(await order(page)).toEqual(defaults);
 await page.evaluate(legacy=>localStorage.setItem('sheetflow.ui.v1',JSON.stringify({visibleColumns:legacy,sheetLayoutVersion:2})),legacy);
 await page.reload();expect(await order(page)).toEqual(legacy);
 await page.evaluate(()=>{localStorage.setItem('sheetflow.ui.v1',JSON.stringify({visibleColumns:['summary','id','status']}));localStorage.setItem('sheetflow.saved-views.v1',JSON.stringify([{id:'old',name:'Older view',state:{view:'sheet',visibleColumns:['summary','id','priority']}}]));});
 await page.reload();expect(await order(page)).toEqual(['summary','id','status']);
 await page.locator('.workspace-saved-views>summary').click();await page.locator('#saved-view-select').selectOption('old');
 expect(await order(page)).toEqual(['summary','id','priority']);await expect(page.locator('.issue-table')).not.toHaveClass(/id-pinned/);
});
test('resize, cancel, keyboard width and reset preserve task records',async({page})=>{
 await ready(page);const records=await page.evaluate(()=>localStorage.getItem('sheetflow.project.v1'));
 const handle=page.locator('[data-column-resize="summary"]');const b=await handle.boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+10);await page.mouse.down();await page.mouse.move(b.x+84,b.y+10);await page.mouse.up();
 await expect(handle).toHaveAttribute('aria-valuenow','400');await page.reload();await expect(handle).toHaveAttribute('aria-valuenow','400');
 const next=await handle.boundingBox();await page.mouse.move(next.x+4,next.y+10);await page.mouse.down();await page.mouse.move(next.x+104,next.y+10);await page.keyboard.press('Escape');await page.mouse.up();await expect(handle).toHaveAttribute('aria-valuenow','400');
 await handle.focus();await page.keyboard.press('ArrowRight');await expect(handle).toHaveAttribute('aria-valuenow','410');
 await columns(page);await page.locator('[data-sheet-width="summary"]').fill('460');await page.locator('[data-sheet-width="summary"]').press('Tab');await expect(handle).toHaveAttribute('aria-valuenow','460');
 await page.getByRole('button',{name:'Reset layout',exact:true}).click();await expect(handle).toHaveAttribute('aria-valuenow','320');
 expect(await page.evaluate(()=>localStorage.getItem('sheetflow.project.v1'))).toBe(records);
});
test('header drag moves ID with selection and hierarchy; active cell draft survives',async({page})=>{
 await ready(page);const title=page.locator('[data-sheet-row-id="PRJ-1"] [data-field="summary"]');await title.fill('Uncommitted title');
 const grip=page.locator('[data-column-grip="id"]'), target=page.locator('th[data-column-key="summary"]');const a=await grip.boundingBox(),b=await target.boundingBox();
 await page.mouse.move(a.x+5,a.y+5);await page.mouse.down();await page.mouse.move(b.x+b.width-15,b.y+12,{steps:5});await page.mouse.up();
 expect(await order(page)).toEqual(['summary','id','status','assignee','priority','dueDate']);await expect(title).toHaveValue('Uncommitted title');await expect(page.locator('.issue-table')).not.toHaveClass(/id-pinned/);
 await expect(page.locator('[data-sheet-row-id="PRJ-1"] td[data-column-key="id"] [data-sheet-select]')).toBeVisible();
 await page.reload();expect((await order(page))[0]).toBe('summary');
 await columns(page);await page.locator('[data-sheet-column-key="id"][data-sheet-column-move="up"]').click();await expect(page.locator('.issue-table')).toHaveClass(/id-pinned/);
});
test('hidden columns retain widths, saved views restore layout, sort remains independent',async({page})=>{
 await ready(page);await columns(page);await expect(page.locator('[data-sheet-column-toggle="taskTypeId"]')).toHaveCount(1);await page.locator('[data-sheet-width="priority"]').fill('180');await page.locator('[data-sheet-width="priority"]').press('Tab');
 await page.locator('[data-sheet-column-toggle="priority"]').uncheck();await page.locator('[data-sheet-column-toggle="priority"]').check();await expect(page.locator('[data-column-resize="priority"]')).toHaveAttribute('aria-valuenow','180');
 await page.locator('.sheet-columns-menu>summary').click();await page.locator('[data-sort="summary"]').click();await expect(page.locator('[data-sort="summary"]')).toContainText('↑');
 await page.locator('.workspace-saved-views>summary').click();await page.locator('#save-view-open').click();await page.locator('#saved-view-name').fill('My layout');await page.locator('#saved-view-form').evaluate(form=>form.requestSubmit());
 await columns(page);await page.getByRole('button',{name:'Reset layout',exact:true}).click();await page.locator('.sheet-columns-menu>summary').click();await page.locator('.workspace-saved-views>summary').click();await page.locator('#saved-view-select').selectOption({label:'My layout'});await expect(page.locator('[data-column-resize="priority"]')).toHaveAttribute('aria-valuenow','180');
});
for(const viewport of [{width:1366,height:768},{width:768,height:900},{width:390,height:844}])test(`compact controls, filters and all views at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await ready(page);expect((await page.locator('.table-wrap').boundingBox()).y).toBeLessThan(viewport.width>1000?180:300);
 await expect(page.locator('.sheet-id-summary')).toHaveCount(0);await page.locator('#workspace-filters>summary').click();await expect(page.locator('#priority-filter')).toBeVisible();await page.locator('#priority-filter').selectOption('High');await page.locator('#workspace-filters>summary').click();await expect(page.locator('#active-filter-chips')).toContainText('High');
 for(const view of ['kanban','gantt','sheet']){await page.locator(`[data-view="${view}"]`).click();await expect(page.locator('#priority-filter')).toHaveValue('High');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
 await page.locator('[data-remove-filter="priority"]').click();
 if(viewport.width<700)await page.locator('#workspace-more>summary').click();await page.locator('#swimlanes-toggle').check();
 if(viewport.width<700)await page.locator('#workspace-more>summary').click();await expect(page.locator('.sheet-lane-row')).toHaveCount(3);
 const group=page.locator('.sheet-lane-row [data-toggle-lane]').first();
await expect(group.locator('.swimlane-toggle')).toHaveCSS('height','24px');
const limits=await page.locator('.table-wrap').evaluate(el=>({right:el.getBoundingClientRect().left+el.clientWidth,edit:el.querySelector('.swimlane-edit').getBoundingClientRect().right}));expect(limits.edit).toBeLessThanOrEqual(limits.right+1);
await group.click();await expect(group).toHaveAttribute('aria-expanded','false');await group.click();await expect(group).toHaveAttribute('aria-expanded','true');
const story=page.locator('.sheet-tree-toggle').first();await expect(story).toHaveCSS('height','24px');await story.click();await expect(story).toHaveAttribute('aria-expanded','false');await story.click();
await columns(page);await expect(page.locator('[data-sheet-column-toggle="summary"]')).toBeInViewport();
});
