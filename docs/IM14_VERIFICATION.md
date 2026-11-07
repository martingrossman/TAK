# IM-14 verification — 2026-11-07

Implemented in the main TAK checkout on `implement_mvp`.

## Behavior

- Shared task/story entry in Sheet, Kanban and Gantt. T/S opens title entry; Shift+T/S opens the compact editor. Details transfers the title and defaults without a write. After an acknowledged single create, focus moves to the new item; a next title typed during remote latency keeps input focus. Escape keeps unfinished text; Clear discards it.
- Parent follows focus/remembered visible item, one checked row, then selected Epic. Tasks inside Stories become children; existing Task/Bug context creates siblings; Stories use the containing Epic. A focused empty grouped Kanban column supplies its Epic. Hover does not change context. Context freezes for the entry session.
- Up/down navigates visible rows/cards; Kanban left/right changes focused column. Navigation never mutates work. Sheet Escape returns to the row grip. Existing Alt+arrow mutations remain available. Focus survives redraw by identity; input focus/caret keeps its existing restoration path.
- New entries default to today, Backlog, Medium and unassigned; explicit column Add retains column status. Due date remains blank. Queues record the submitted payload before clearing the input, preserve dates and operation IDs, and retain recovery drafts before removing queue entries. Older queue entries keep their original blank schedule.
- Active filters remain in place, hidden creations have feedback, and a disappeared parent blocks submission without losing the title. Single-key shortcuts can be disabled in Help; the setting uses the existing workbook-scoped preference storage.

## Automated checks

- `npm.cmd run check`: **145/145 Node checks passed**, including build and browser/server syntax checks.
- Final focused run: `npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs --workers=2 --reporter=line`: **31/31 passed**. This includes all 24 new keyboard-entry cases and the seven existing quick-add checks.
- Existing compact-create, command-palette, save-intents, Sheet-focus and workspace-shell cases were also exercised. The first combined 62-case run passed 60: one selection fixture assumed filtering retained hidden selections, and one old Sheet Escape assertion expected input focus. Both were updated for the approved behavior. The corrected selection and Escape cases passed in subsequent targeted runs.
- The subsequent 36-case keyboard/Sheet/workspace run passed 35. Its remaining deep-board check compared page scroll offsets even though browser scroll anchoring preserved the card's screen position after the bar expanded. The final check asserts unchanged card position and board scroll, and passed in the final 31-case run.
- Local persistence and a synthetic `google.script.run` harness verified single and batch queues, delayed responses, midnight dates, lost acknowledgements, retry without duplicates, reload recovery, invalid parents and browser-storage failures. Harnesses use synthetic data, no credentials or live spreadsheets.
- Screenshots and bounds checks at 1366, 768 and 390 pixels wide confirmed reachable controls and no page-level horizontal overflow with long Epic titles. Desktop and phone screenshots were visually reviewed. Active phone entry uses the full row; the bar stays reachable in long grouped boards.
- `git diff --check`: passed.

Re-run the focused regressions with:

```powershell
npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs e2e/compact-create.spec.mjs e2e/sheet-focus.spec.mjs e2e/save-intents.spec.mjs e2e/command-palette.spec.mjs e2e/workspace-shell.spec.mjs --workers=2 --reporter=line
```

## Release boundary and remaining checks

No backend API, task schema, authentication or sharing changes. Generated `dist/index.html` was rebuilt from source. No Git commit/push or Apps Script upload/deployment was performed for IM-14.

Before a live release, test a private Google copy for all three views, keyboard creation, save/reload/retry, context and menu launch. Real Apps Script latency, physical keyboard/assistive technology testing and the 2,000-task performance benchmark were not measured in this change. Existing copied bound scripts are not updated by local source changes.

Existing local backlog additions (including IM-15) and the untracked `docs/gemini_review.md` were preserved.

## Parent picker refinement — 2026-11-07

The quick-entry parent field now opens an explicit dropdown with search, pointer selection and Arrow/Enter keyboard selection. Labels show only the type and title (for example, EPIC: Website launch or STORY: Sign-in experience). The repeated visible breadcrumb line was removed; selection changes still have an accessible status announcement. IDs remain internal and searchable, but are not displayed in the picker, options, tooltips or missing-parent placeholder. Duplicate names show their containing parent, and selection resolves to the chosen underlying record without guessing.

No parent remains an explicit option. Story entries list only legal Epic parents. Escape cancels a parent search and retains its previous selection and the unsent title. Choosing another parent changes only the new entry until it is submitted.

Verification: npm.cmd run check passed all 145 Node checks. The focused quick-entry keyboard suite passed 32/32 browser cases, including eight new manual-picker cases: all three views, keyboard search, clearing a parent, Story restrictions, duplicate names, Escape and 1366/390-pixel layouts. Desktop and phone dropdown screenshots were visually reviewed. Test data is synthetic; no Google upload or live spreadsheet changes were performed.

## Created-item focus refinement — 2026-11-07

An acknowledged single Ghost Capture now closes the entry surface, expands collapsed Epic/Story ancestors, reveals the created item and gives its row, card or Gantt label keyboard focus. If the user starts another title while the remote save is pending, the acknowledgement does not steal focus or discard that draft. Batch entry and creations hidden by active filters retain their existing feedback instead of forcing an unreachable focus target.

Verification: `npm.cmd run check` passed all 145 Node checks. `npm.cmd run test:browser -- e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs` passed all 44 browser cases, including created-item focus in Sheet, Kanban and Gantt plus delayed cloud acknowledgement.

## Shortcut-help prioritization — 2026-11-07

The in-app shortcut reference now starts with creation: T/S, Shift+T/S, Ghost Capture Enter and N. Focus navigation and opening an issue follow, then search, view switching, Commands and Escape. View-specific and advanced editing controls remain in collapsed groups. The README and UX specification use the same priority order.

Verification: `npm.cmd run check` passed all 145 Node checks. `npm.cmd run test:browser -- e2e/workspace-shell.spec.mjs` passed all five browser cases at desktop and phone widths, including priority order, dialog focus restoration, reachable groups and no horizontal overflow.

## Quiet inline capture and immediate pending focus

The approved interaction supersedes the earlier acknowledged-item focus refinement: Enter closes capture and focuses pending work immediately; Shift+Enter keeps an empty composer focused for another title. Acknowledgement may transfer focus only from that pending item, never after navigation. Sheet uses an inline row, Kanban an inline card in its intended lane/status, and Gantt a label row under the parent. Primary controls are title, searchable parent, Create and Details; secondary options contain Type, Status and Discard draft. Help starts with five capture actions and expands into navigation, editing, view controls and preferences.

Regression coverage has been updated for repeat capture, immediate pending focus in all three views, navigation before acknowledgement, failed/lost-acknowledgement retries, preserved filters/context and drafts, secondary-control discoverability, and a reduced mobile viewport. Help tests exercise visible keys, expandable groups, the single-key preference and restored focus rather than exact prose or incidental ordering.

Verification: `npm.cmd run check` passed all 141 Node checks. The six-suite capture/help/triage/batch run below passed 80/80 Edge browser cases with retries disabled. Obsolete source-text assertions were removed rather than updated to mirror the new markup; browser regressions cover pending placement, parent context and retry behavior.

```powershell
npm.cmd run check
npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs e2e/ghost-capture-triage.spec.mjs e2e/workspace-shell.spec.mjs e2e/gantt-quick-create.spec.mjs e2e/quick-create-batch.spec.mjs --workers=2 --retries=0 --reporter=line
```

Additional checks: all eight `e2e/sheet-focus.spec.mjs` cases passed, the seven Kanban capture cases passed again after adding contextual shortcut hints, and all three `e2e/gantt-epic-view.spec.mjs` cases passed. The Gantt run first exposed an obsolete assertion nesting the Epic title inside its collapse button; that incidental-markup assertion was removed. Expand/restore, keyboard focus, filtered descendants and unchanged project data remain covered.

Desktop Sheet, Kanban and Gantt composers and simplified Help were visually reviewed in Edge. A compact 390×520 viewport was also visually reviewed. Manual smoke confirmed parent selection, Shift+Enter repeat entry, Enter focus transfer and no routine success toast. Still require real-phone keyboard/touch review and live Apps Script acceptance. Reduced desktop viewport tests do not verify a native mobile keyboard. Synthetic cloud fixtures verify client behavior only; no deployment, spreadsheet or schema changes are part of this work.

### Large-project feedback measurement

Synthetic project: 2,000 tasks and 20 Epics, five statuses, eight assignees, descriptions, dates and acyclic dependencies. Windows, Intel Core i5-1145G7, Edge 156.0.4314.58, 1440×900. Cloud responses held; 20 Enter submissions per view; event dispatch to two animation frames, including pending-item rendering/focus. Browser regression workers were running concurrently, so these are loaded-machine observations, not an isolated baseline or server-save timings.

| View | p50 feedback (ms) | p95 feedback (ms) |
|---|---:|---:|
| Sheet | 2996 | 6024 |
| Kanban | 1146 | 1787 |
| Gantt | 337 | 541 |

All views retained the 20 pending items with no JavaScript errors. The <100 ms target was not met; whole-view rendering at this dataset size remains a performance limitation. No claim of production performance or live Sheets latency is made.

## Keep capture open until Escape

User-requested behavior supersedes the earlier Enter-to-close contract: Enter, Shift+Enter and Create clear the submitted title and keep capture open and focused for the next task. Escape hides it and retains an unfinished draft. The same interaction applies in Sheet, Kanban and Gantt; frozen parent/status/rank, durable queue and acknowledgement focus protections are unchanged.

Manual local Edge smoke created two consecutive tasks with Enter without reopening capture, observed an empty focused title after each save, closed with Escape and resumed the unfinished draft with T. Live Apps Script was not exercised; no deployment or schema change.

Targeted local command: `npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs --workers=2 --retries=0 --reporter=line`. Build and all 170 Node checks passed. Kanban/Gantt capture, batch queue and multi-selection suites passed alongside the keyboard cases; three hierarchy tests initially retained the superseded focus-the-created-item assertion and were updated to verify continued title focus and explicit Escape instead.

Final keyboard rerun: all 51 cases passed with retries disabled. Together with the other four passing suites, 102 distinct browser cases passed for this change.
