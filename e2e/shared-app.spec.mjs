import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../Core.js');

test('shared connection renders all views and keeps recovery storage separate across copies',async({context,page})=>{
  const issues=Core.sample('2026-11-06').map(issue=>({...issue,version:'v1'}));
  await context.route('**/*',async route=>{
    if(route.request().resourceType()!=='document')return route.continue();
    const response=await route.fetch(),id=new URL(route.request().url()).searchParams.get('copy')||'copy-a';
    await route.fulfill({response,body:(await response.text()).replace('data-shared-sheet=""',`data-shared-sheet="${id}"`)});
  });
  await context.addInitScript(({issues})=>{
    window.sharedRequests=[];
    window.google={script:{run:{withSuccessHandler(success){return{withFailureHandler(failure){return{sharedTrackerRpc(sheet,method,args){
      window.sharedRequests.push({sheet,method,args});
      queueMicrotask(()=>{
        if(method==='getProject')success({issues,comments:{},commentsLazy:true,mode:'team',settings:[],spreadsheetUrl:`https://docs.google.com/spreadsheets/d/${sheet}/edit`,name:sheet});
        else if(method==='getTaskComments')success([]);
        else failure({message:'Simulated save failure'});
      });
    }}}}}}}};
  },{issues});
  await page.goto('/?copy=copy-a');
  await expect(page.locator('#sync-status')).toHaveText('Synced with Sheets');
  for(const view of ['sheet','gantt','kanban']){
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator('#view-title')).toHaveText({sheet:'Sheet',gantt:'Gantt',kanban:'Kanban'}[view]);
    await expect(page.locator('#view-content')).not.toBeEmpty();
  }
  await page.locator('#create-issue').click();
  await page.locator('[name="summary"]').fill('Only copy A draft');
  await page.locator('#issue-form').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#error-banner')).toContainText('Simulated save failure');
  await expect.poll(()=>page.evaluate(()=>JSON.stringify(localStorage.getItem('sheetflow.pending-drafts.v1.sheet.copy-a')))).toContain('Only copy A draft');
  const second=await context.newPage();
  await second.goto('/?copy=copy-b');
  await expect(second.locator('#sync-status')).toHaveText('Synced with Sheets');
  await second.locator('#create-issue').click();
  await expect(second.locator('[name="summary"]')).toHaveValue('');
  const requests=await second.evaluate(()=>window.sharedRequests);
  expect(requests.every(request=>request.sheet==='copy-b')).toBe(true);
  await expect(second.locator('#sheet-link')).toHaveAttribute('href',/copy-b/);
});
