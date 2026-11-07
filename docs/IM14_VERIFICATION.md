# IM-14 verification — 2026-11-07

Implemented on `implement_mvp_ui`. This Ghost Capture refinement supersedes the earlier persistent shared-bar presentation while preserving its queue, recovery, parent-picker and keyboard-navigation guarantees.

## Behavior

- T/S opens one contextual Ghost Capture beside the focused row/card/label; Shift+T/S opens the compact editor with identical defaults. Visible Kanban/Sheet/Gantt Add controls use the same capture state. Escape hides and retains unfinished work; Clear explicitly discards it.
- Parent follows legal focus/selection/Epic context. Status follows the focused issue in Sheet/Gantt and the exact Kanban column. New work receives a safe sibling-relative rank when applicable; every queued request freezes context, rank, date and operation ID.
- Enter supports repeated capture. Multiline paste into an empty title opens an editable preview for up to 100 ordered titles. Failed saves hide the overlay so Retry remains pointer-accessible; the draft and operation identity remain recoverable.
- P/A/M/D opens anchored priority, assignee, status and due-date controls for one focused issue. E opens details and X toggles selection. Commands expose the same actions. Existing typing, IME, modifier, dialog and single-key preference guards apply.
- No backend API, schema, authentication, sharing or deployment behavior changed.

## Automated checks

- `npm.cmd run check`: **145/145 Node checks passed**, including source validation, generated `CoreScript.html` / `dist/index.html`, model/server checks, queue/retry behavior and browser/server syntax checks.
- `npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs e2e/ghost-capture-triage.spec.mjs --workers=2 --reporter=line`: **42/42 Edge checks passed**.
- Browser coverage exercised Sheet/Kanban/Gantt context inheritance, repeated and detailed creation, visible lane Add, sibling ordering, multiline preview/order, failed-save retry identity, Escape resume, parent search, IME/typing guards, responsive bounds at 1366/768/390 px, P/A/M/D/E/X and command parity.
- Scroll docking regression: `npx.cmd playwright test e2e/kanban-quick-create.spec.mjs --grep "docks inside" --workers=1 --reporter=line`: **1/1 passed** with the capture anchor scrolled both above and below the viewport.
- Sheet Epic-control regressions: focused context/navigation coverage **3/3 passed** and responsive Sheet coverage at 1366/768/390 px **3/3 passed**. Heading clicks select Task context without toggling; only the left **+ / −** changes one lane; **Expand all**, **Collapse all** and contextual **+ Task** preserve the expected parent.
- Cross-view Epic-context regression: focused Sheet/Kanban/Gantt coverage **3/3 passed**. Kanban and Gantt headings expose the same active **Task context**, retain lane expansion, persist context across view changes and create under the selected Epic.
- Ghost Capture width/Escape regression: focused desktop/tablet/mobile and draft-resume coverage **6/6 passed**. Desktop capture is at least 700 px wide, remains viewport-bounded at 768/390 px, and one `Esc` from title, parent search or status closes capture while preserving the draft and restoring origin focus.
- Dialog-parent context regression: focused Kanban coverage **1/1 passed**. A successful parent save moves active Task context to the new containing Epic; selecting **No parent** clears it, and subsequent `T` inherits the updated context.
- Ghost Capture parent-focus regression: Sheet/Kanban/Gantt coverage **3/3 passed**. Accepting a different parent immediately moves the visible Task context to its containing Epic, preserves the unsaved title and saves the new task under that parent.
- Parent-context reveal regression: cross-view collapsed-Epic parent selection **3/3 passed**; nested Story ancestor coverage **1/1 passed** across Gantt and Sheet. Parent-driven focus expands the destination hierarchy while ordinary Epic-heading focus preserves collapse state.
- Parent-context auto-scroll regression: distant destination coverage **3/3 passed** in Sheet, Kanban and Gantt. The selected Epic is fully visible in the upper portion of the viewport with capture clearance, while keyboard focus remains in Ghost Capture.
- Local persistence and synthetic `google.script.run` harnesses were used. No credentials, production spreadsheet, Apps Script upload or deployment was touched.

Re-run the focused regressions with:

```powershell
npx.cmd playwright test e2e/quick-entry-keyboard.spec.mjs e2e/kanban-quick-create.spec.mjs e2e/ghost-capture-triage.spec.mjs --workers=2 --reporter=line
```

## Release boundary and remaining checks

No backend API, task schema, authentication or sharing changes. Generated `dist/index.html` was rebuilt from source. No Git commit/push or Apps Script upload/deployment was performed for IM-14.

Before a live release, test a private Google copy for all three views, keyboard creation, save/reload/retry, context and menu launch. Real Apps Script latency, physical keyboard/assistive technology testing and the 2,000-task performance benchmark were not measured in this change. Existing copied bound scripts are not updated by local source changes.

Existing local backlog additions (including IM-15) and the untracked `docs/gemini_review.md` were preserved.

## Parent picker refinement — 2026-11-07

The quick-entry parent field now opens an explicit dropdown with search, pointer selection and Arrow/Enter keyboard selection. Labels show only the type and title (for example, EPIC: Website launch or STORY: Sign-in experience). The repeated visible breadcrumb line was removed; selection changes still have an accessible status announcement. IDs remain internal and searchable, but are not displayed in the picker, options, tooltips or missing-parent placeholder. Duplicate names show their containing parent, and selection resolves to the chosen underlying record without guessing.

No parent remains an explicit option. Story entries list only legal Epic parents. Escape cancels a parent search and retains its previous selection and the unsent title. Choosing another parent changes only the new entry until it is submitted.

Verification: npm.cmd run check passed all 145 Node checks. The focused quick-entry keyboard suite passed 32/32 browser cases, including eight new manual-picker cases: all three views, keyboard search, clearing a parent, Story restrictions, duplicate names, Escape and 1366/390-pixel layouts. Desktop and phone dropdown screenshots were visually reviewed. Test data is synthetic; no Google upload or live spreadsheet changes were performed.
