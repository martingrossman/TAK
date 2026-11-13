# TAK — Local Testing Guide

This guide describes the existing local Node.js and Playwright workflow for the `implement_mvp` branch. Run tests from a normal VS Code PowerShell terminal, not through the AI assistant, to reduce AI assistant usage.

## Setup (Windows PowerShell)

```powershell
git switch implement_mvp
npm.cmd install
npm.cmd run build
npx.cmd playwright install
```

## Run the local app

In terminal 1:

```powershell
npm.cmd start
```

Open http://127.0.0.1:4180 in your browser. Set `PORT` to use a different port. The local build uses browser storage; it does not sync with Google Sheets.

## Run tests

In terminal 2:

```powershell
npm.cmd test                  # Node.js unit/integration tests
npm.cmd run check             # Build + Node.js tests
npm.cmd run test:browser      # Existing Playwright suite (default port 4587; SHEETFLOW_TEST_PORT overrides it)
npx.cmd playwright test e2e/sheet-reparenting.spec.mjs  # Targeted tests
```

The existing browser suite was reported as 52 passing tests (1.6 minutes) on Edge on October 28, 2026. This is a previously reported baseline, not a verification of future changes.

## Reports and diagnostics

If an HTML report is not configured, generate one explicitly:

```powershell
npx.cmd playwright test --reporter=html
npx.cmd playwright show-report
```

For a concise failure log:

```powershell
npx.cmd playwright test --reporter=line *> playwright-failures.txt
```

A nonzero exit code means tests failed. Do not assume an HTML report exists after a default run; it depends on Playwright reporter configuration. Configure `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, and `video: 'off'` in the existing Playwright config when approved, preserving all existing projects and settings. These are recommended settings, not claims that they are already applied.

## Efficient AI-assisted testing workflow

1. The AI assistant inspects the relevant code and writes a small implementation plus appropriate tests.
2. Run targeted tests manually in PowerShell.
3. If they fail, provide the AI assistant only the failing test names, concise errors, and relevant code context.
4. The AI assistant diagnoses and fixes; do not let it repeatedly run browser automation by default.
5. Rerun targeted tests manually; run the complete browser suite before a merge/release.
6. Request interactive browser investigation only for failures that cannot be diagnosed from concise reports.

Avoid feeding complete successful logs, entire traces, screenshots of passing tests, or large HTML reports into the AI assistant. Keep reports and traces locally; share selected artifacts only as needed.

## Safety

Use isolated test fixtures and local browser storage. Never point automated tests at a production Google Sheet or run Apps Script deployment commands without explicit approval. A passing local browser suite does not verify the Apps Script-backed mode.

## Smart Notepad and manual AI trial

Run the targeted browser cases from this worktree in VS Code PowerShell:

```powershell
npm.cmd run check
npx.cmd playwright test e2e/plan-notepad.spec.mjs --workers=2 --retries=0 --reporter=line
```

The browser file covers local Epic-child creation, existing Epic selection, new Epic headings, manual proposal selection, stale revisions, local receipt recovery and a simulated Apps Script acknowledgement loss. The simulated server is an isolated browser fixture; it does not verify a live Google Sheet. Review the downloaded context before uploading it to your chosen AI assistant because it contains task descriptions, assignees, dates and dependencies. The assistant must accept the context file and return the required JSON proposal; validate and review its output before applying changes. A live trial needs a separately verified test workbook and Apps Script project.

Verification in this worktree: `npm.cmd run check` passed 201 Node tests; the targeted Edge suite passed 6/6 cases with retries disabled. A live Apps Script workbook has not been tested.

## Private Gemini API trial

Use a verified private Apps Script test project and workbook. Put the API key in that project's Script Properties as `GEMINI_API_KEY`; keep it out of the repository. Set `GEMINI_MODEL` only if testing a different supported model. The API button sends all task fields and the planning notes to Gemini, so use synthetic data for the first live check. The shared Google app and local browser demo continue to use manual export/import.

The targeted browser command is:

```powershell
npx.cmd playwright test e2e/plan-notepad.spec.mjs --workers=2 --retries=0 --reporter=line
```

The new browser case simulates the private Apps Script endpoint, checks that the proposal survives reload, and verifies Epic-before-child save order. It cannot confirm a live Gemini response, API billing, or Apps Script authorization. The server unit tests check full context, key isolation, stale revisions, permissions and HTTP failures.

## Multi-item action verification

```powershell
npm.cmd run check
npx.cmd playwright test e2e/multi-selection.spec.mjs --workers=2 --retries=0 --reporter=line
```

The targeted suite exercises visible forward/reverse Shift+click ranges, individual keyboard/modifier selection, view changes, filtered/collapsed exclusions, the 100-item limit, bulk-edit persistence, confirmed deletion/cancellation, protected references, stale versions, failed/lost responses, recovery after reload, pending-work guards and unavailable storage.

Manual acceptance: in each view select an item and Shift+click another, inspect the count/highlighting, change a common field, and reload. Verify Shift+click inside a Sheet text field still selects text. Cancel a deletion before confirming a disposable selection. Confirm the dialog and selection bar remain reachable at a narrow viewport. Use synthetic local data only; do not test destructive actions on a production spreadsheet.

Local verification for this extension: 170 Node tests and the 100-case selection/capture/Sheet-focus/Gantt-folding browser run passed. Desktop Edge visual smoke demonstrated range selection, bulk priority editing, deletion cancellation and confirmed removal of only the selected items. A 390×700 viewport showed the selection bar and confirmation fitting onscreen. Live Apps Script, real-phone keyboard/touch and large-project selection performance remain unverified.

After the text-field gesture fix, `npm.cmd run check` passed again and all 33 multi-selection browser cases passed with retries disabled, including the new native-text-selection regression.

Sheets deletion uses bounded validation, persistent recovery intent and best-effort rollback, not a database transaction. Native spreadsheet edits do not participate in the script lock. Do not interpret local fixture coverage as a guarantee against concurrent native edits or a live-deployment check.

## Smart quick-entry verification

```powershell
npm.cmd run check
npx.cmd playwright test e2e/smart-entry.spec.mjs e2e/quick-entry-keyboard.spec.mjs --workers=2 --retries=0 --reporter=line
```

The parser suite covers inclusive weekdays, weekend starts, weeks, leap/year/DST boundaries, bounded dates, quoted/ambiguous names, token conflicts, literal escapes and unchanged calendar-day arithmetic. Browser cases exercise all three views, suggestions and keyboard precedence, literal choices, Details handoff, invalid input without writes, parsed-title limits, repeat capture, IME, literal batch paste and frozen payloads after lost acknowledgements/reload.

Manual local Edge smoke saved `Prepare release @Martin 5d !high` as title `Prepare release`, assignee `Martin Novak`, priority `High`, start `2026-11-09` and due `2026-11-13` when entered on Saturday `2026-11-07`. Capture remained ready for the next title. Literal opt-out removed duration metadata while retaining `5d` in the title; a conflicting explicit deadline retained the raw draft and showed an error. Desktop Sheet/Gantt and 390×700 Kanban previews/suggestions were visually checked. Escape dismissed assignee suggestions before closing capture.

No live Apps Script deployment, real-phone keyboard/touch, holiday calendar or large-project performance verification was performed. Assignees come from existing issue names; scheduling changes apply only when parsing a new quick-entry duration.

Results: `npm.cmd run check` passed all 181 Node tests. The final smart-entry/keyboard run passed 73/73 browser cases with retries disabled; the other 18 Kanban/Gantt capture and batch cases passed in the preceding run. Initial verification found and corrected a parent-picker Escape regression and an ambiguity test that needed to dismiss suggestions without selecting a name. Overall, 91 distinct browser cases passed.

## Collapse all and empty capture

Collapse all now closes empty/whitespace-only quick capture in Sheet and Gantt, resetting its creation context without touching queued items. Nonempty titles and pasted drafts stay open. Local Edge smoke reproduced the empty composer keeping its Epic open before the fix, then confirmed it closes and the Epic folds afterward; a typed draft remained visible and unchanged.

`npm.cmd run check` passed all 181 Node tests. `npx.cmd playwright test e2e/gantt-epic-view.spec.mjs e2e/quick-entry-keyboard.spec.mjs --workers=2 --retries=0 --reporter=line` passed all 60 browser cases, including empty cancellation, new-context reopening and title/batch draft preservation in both views. Live Apps Script was not exercised; persistence behavior was not changed.

## New-work start-date defaults

Run `npm.cmd run check`, then `npx.cmd playwright test e2e/compact-create.spec.mjs e2e/quick-create-batch.spec.mjs e2e/quick-entry-keyboard.spec.mjs e2e/smart-entry.spec.mjs --workers=2 --retries=0 --reporter=line`.

Local Edge smoke reproduced Paste list saving a blank start, then confirmed two new pasted tasks and a new Epic switched to Task saved `2026-11-07` on that local calendar day. The previously saved blank task remained blank. Automated coverage includes explicit dates/clearing, existing-item edits, spreadsheet timezone, native creation, frozen midnight retries, and working-day duration behavior.

Live Apps Script was not exercised. Existing versioned-native multi-row paste with several missing IDs remains outside this change; single-row native creation is covered by the server harness. The legacy-schema receipt-recovery harness also exposes an empty returned version before refresh; this pre-existing recovery concern is separate from start-date preservation and remains unchanged.

Date-default verification: `npm.cmd run check` passed all 191 Node tests; the targeted compact-create, batch, keyboard and smart-entry run passed all 91 browser cases.

## Double-click details

Local Edge smoke confirmed task and Epic double-clicks open the correct issue in Sheet, Kanban and Gantt. Before the change, neither Sheet title nor Epic-heading double-click opened details. Epic context updates now keep the heading mounted so the browser can deliver the second click; single clicks still select context without changing expansion.

Run `npm.cmd run check`, then `npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/gantt-epic-view.spec.mjs --workers=2 --retries=0 --reporter=line`. New cases cover task/Epic details, collapsed Epic preservation, subsequent quick-capture context and no data mutation across all views. No live Apps Script or real-phone verification was performed.

Results: `npm.cmd run check` passed all 191 Node tests; the targeted keyboard/Gantt run passed all 63 browser cases with retries disabled.

## Optional activity type

`npm.cmd run check` passed all 194 Node tests. `npx.cmd playwright test e2e/compact-create.spec.mjs e2e/multi-selection.spec.mjs --workers=2 --retries=0 --reporter=line` passed all 49 browser cases, including Task/Epic creation without a type, reload, badge absence in all views, reassignment, bulk removal and Undo.

Local Edge smoke changed an existing task to **No activity type**, reloaded Sheet/Kanban/Gantt and confirmed no activity badge while its original start date remained unchanged. Server harnesses verified the explicit `none` value survives legacy, versioned and optimized personal storage; live Apps Script was not exercised. Existing missing values still use the established default, with no schema migration.

## Compact comments

Comments for saved issues remain visible in compact mode, including Add, Save, loading and retry controls. Child work and duplication options remain expanded-only. Local Edge smoke added a comment without More options and confirmed it persisted after reload.

`npm.cmd run check` passed all 194 Node tests. `npx.cmd playwright test e2e/compact-create.spec.mjs e2e/personal-mode.spec.mjs --workers=2 --retries=0 --reporter=line` passed all 20 browser cases, including compact comment edits/additions at desktop and 390px, draft preservation across expansion, reload persistence, lazy loading, late-response isolation and retry. Live Apps Script was not exercised.

## Start-only Gantt bars

New work with a start date and no due date renders as a compact Gantt bar. Dragging preserves the blank due date; resizing establishes one and restores the normal bar. Clearing the due date, reloading, and moving the timeline restore or replace the compact bar correctly. Start-only bars do not render progress or dependency endpoints and stay inside the timeline boundary.

Local Edge smoke moved `2026-11-07` to `2026-11-09` while preserving an empty due date, then resized it to save `2026-11-10`. `npm.cmd run check` passed all 194 Node tests. The full Gantt Epic/quick-create run passed all 17 browser cases; the final lifecycle case separately covers drag, resize, clear, reload and outside-window presentation. Live Apps Script was not exercised.

## Gantt Epic folding controls

Gantt keeps a fixed **Epics** group at the start of its toolbar with separate **Expand all** and **Collapse all** controls. The group remains visible with disabled controls when a filter has no collapsible Epics. Each Epic's own +/− control remains independent; collapsing an Epic first dismisses an empty capture in that Epic so the draft row cannot hold it open. Nonempty capture drafts remain protected. Filtered-out Epic states are unchanged.

`npm.cmd run check` passed all 194 Node tests. `npx.cmd playwright test e2e/gantt-epic-view.spec.mjs --workers=1 --retries=0 --reporter=line` passed all 11 browser cases, covering persistent toolbar visibility, both controls, independent first/second Epic folding, flat/grouped layouts, filters, persistence and capture safety. Local Edge smoke confirmed the **Epics** group is first in the toolbar at 1280×800 and remains fully visible after wrapping at 390×844; its measured narrow box was 221 px inside the 390 px viewport. Live Apps Script was not exercised.

## Grouped Kanban Epic folding controls

Grouped Kanban now shows a fixed **Epics · Expand all · Collapse all** group above its lanes. Bulk actions affect only displayed Epic lanes, preserve filtered-out Epic preferences, leave **No epic** unchanged, close empty capture before folding, and retain nonempty title or pasted-list drafts.

All 14 `e2e/gantt-epic-view.spec.mjs` cases passed with Kanban added to the shared empty/title/batch capture-safety matrix. Both `e2e/swimlane-progress.spec.mjs` cases passed, covering visible controls, first/second Epic states, filtering, keyboard focus and a 390px viewport. Local Edge at 390×844 measured the complete control group at 241 px inside the 390 px viewport; both bulk actions and empty-capture folding worked. Live Apps Script was not exercised.

## Simple sample project

The built-in empty-project example contains exactly **3 Epics, 3 Stories, and 7 Tasks** across customer portal, team planning, and delivery-update themes. Every Epic owns one Story; every Story owns at least two Tasks. Dates, dependencies, descriptions, priorities, owners, statuses and two Sprints remain valid and varied enough to demonstrate Sheet, Kanban and Gantt.

`npm.cmd run check` passed all 194 Node tests. Local Edge with cleared browser storage created 13 items and measured the expected 3/3/7 type split; all 13 items rendered in Kanban, Sheet and Gantt. Live Apps Script sample loading was not exercised.
