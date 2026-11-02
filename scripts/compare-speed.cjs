/* Run after npm run build: node scripts/compare-speed.cjs path/to/reference-planner.html 500
   Opens two disposable Edge contexts and supplies the same synthetic work to both apps. */
const fs = require('node:fs');
const path = require('node:path');
const referencePath = process.argv[2];
if (!referencePath || !fs.statSync(referencePath, { throwIfNoEntry: false })?.isFile()) {
  throw Error('Pass the path to reference-planner.html from the preview ZIP, followed by an optional task count.');
}
const { chromium } = require('@playwright/test');
const core = require('../Core.js');
const count = Number(process.argv[3] || 100);
if (!Number.isInteger(count) || count < 10 || count > 2000) throw Error('Choose 10–2,000 tasks.');
const tasks = Array.from({ length: count }, (_, i) => ({
  id: 'ID' + (i + 1), title: (i % 4 === 0 ? 'Design' : 'Build') + ' item ' + i, epic: 'Group ' + (1 + Math.floor(i / 100)),
  type: 'Task', owner: 'Owner ' + (i % 8), status: ['Not Started','In Progress','Completed'][i % 3],
  start: '2026-11-02', end: '2026-11-09', workdays: 6, progress: i % 3 === 2 ? 100 : 0, priority: 'Medium', desc: ''
}));
const epics = [...new Set(tasks.map(t => t.epic))];
const issues = [...epics.map((name, i) => ({ ...core.blank(), id: 'E' + (i+1), type: 'Epic', summary: name, rank: i, version: '1' })),
  ...tasks.map((t, i) => ({ ...core.blank(), id: t.id, summary: t.title, parentId: 'E' + (1 + Math.floor(i / 100)), rank: i+100, version: '1',
    status: {'Not Started':'Backlog','In Progress':'In Progress','Completed':'Done'}[t.status], assignee: t.owner, startDate: t.start, dueDate: t.end, progress: t.progress }))];
async function measure(browser, name, file) {
  const tak = name === 'TAK', context = await browser.newContext({viewport:{width:1440,height:900}});
  const html = fs.readFileSync(file, 'utf8');
  await context.route('http://127.0.0.1/planner', route => route.fulfill({contentType:'text/html',body:html}));
  const page = await context.newPage();
  page.on('pageerror', e => console.error(name,e.message));
  await page.addInitScript(({tasks,epics,issues}) => {
    localStorage.setItem('sheetflow.ui.v1', JSON.stringify({swimlanes:true}));
    const script = {};
    Object.defineProperty(script, 'run', {get:()=>({
      withSuccessHandler(f){this.ok=f;return this}, withFailureHandler(){return this},
      getKanbanData(){queueMicrotask(()=>this.ok(JSON.stringify({success:true,tasks,epics})))},
      getProject(){queueMicrotask(()=>this.ok({issues, mode:'personal', settings:[], comments:{}}))}
    })});window.google={script};
  }, {tasks,epics,issues});
  const ready = tak ? '[data-issue="ID1"]' : '.card[data-task-id="ID1"]';
  const times = [];
  for(let i=0;i<5;i++){
    await page.goto('http://127.0.0.1/planner');
    await page.locator(ready).waitFor({state:'attached'});
    times.push(await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()))))));
  }
  const results={startupMedian:times.sort((a,b)=>a-b)[2]};
  const selectors=tak?['[data-view="sheet"]','[data-view="gantt"]','[data-view="kanban"]','#search']:['[data-view="list"]','[data-view="gantt"]','[data-view="kanban"]','#filterSearch'];
  for(let sample=0;sample<20;sample++){
    for(const [action,selector,value] of [['Sheet',selectors[0]],['Gantt',selectors[1]],['Kanban',selectors[2]],['Search',selectors[3],'Design'],['Clear search',selectors[3],'']]){
      const ms=await page.evaluate(async ({selector,value})=>{
        const el=document.querySelector(selector); const start=performance.now();
        if(value===undefined) el.click(); else {el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-start;
      },{selector,value});
      (results[action] ||= []).push(ms);
    }
  }
  await context.close();
  return Object.fromEntries(Object.entries(results).map(([k,v])=>[k,Math.round(Array.isArray(v)?v.sort((a,b)=>a-b)[18]:v)]));
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try {
   console.log('Edge',browser.version(),count,'tasks. Cold document startup median (5 loads), other actions p95 (20 samples), ms to two animation frames; simulated Sheets.');
   const planner=await measure(browser,'Reference',referencePath);
   const tak=await measure(browser,'TAK',path.join(__dirname, '..', 'dist', 'index.html'));
   console.table(Object.keys(planner).map(action=>({action,planner:planner[action],TAK:tak[action],differenceMs:tak[action]-planner[action]})));
 } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
