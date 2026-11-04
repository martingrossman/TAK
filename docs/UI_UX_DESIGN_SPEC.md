# TAK — UI/UX Design Specification

**Version:** 1.0 · **Date:** 2026-10-28 · **Status:** Target design, not current implementation  
**North star:** **Minimal appearance + balanced visible functionality + power-user speed.**  
**Functional contract:** [`PRODUCT_REQUIREMENTS_MVP.md`](PRODUCT_REQUIREMENTS_MVP.md)

## 1. Experience principles

1. **Work first.** Show tasks, not decorative dashboards or large welcome areas.
2. **One interaction for common actions.** New task, priority, assignee, status and search must be close at hand.
3. **Depth on demand.** Quick capture is small; detailed editing is powerful but secondary.
4. **Quiet, not empty.** Remove visual noise, *not* useful information and visible controls.
5. **Fast with integrity.** Immediate feedback plus honest saving, failure and conflict states.
6. **Keyboard, mouse and touch parity.** Advanced shortcuts are additive; critical actions remain discoverable.
7. **Consistent across views.** A task has the same meaning and can be found in Sheet, Kanban and Gantt.
8. **Readable and accessible.** No 9px metadata as a design language; meaningful contrast and focus.
9. **No feature theater.** Hidden future capabilities must not appear as half-working navigation entries.

**Reference influences:** Linear (restraint, keyboard-first, compact issue lists), Todoist (rapid capture), Asana (inline task edits), Notion (quiet workspace). Inspiration, not a pixel-perfect clone.

## 2. Minimal vs. balanced: the adopted hybrid

| Topic | Too minimal | Too busy | Chosen balanced treatment |
|---|---|---|---|
| Create | Hidden behind command palette | Large full-page create form | Visible **New**, inline `+ Add`, `N`/`C` shortcut |
| Kanban card | Title only | Every task field | Title, ID/type, priority, assignee; conditional due date/blocker |
| Filters | Hidden behind several menus | Every criterion always expanded | Visible search and one Filters panel; removable active filter chips |
| Priority | Task detail only | Multiple colored text badges | Small icon, direct editable click/focus |
| Dashboard | No progress visibility | Persistent row of four oversized cards | Move summary to optional Overview or compact collapsible strip |
| Details | No access to advanced data | Full 21-field form for everything | Compact issue dialog with an expandable grouped editor |
| Density | Tiny text | Huge whitespace/cards | Comfortable default + Compact preference |

The goal is **minimum action cost**, not minimum element count.

## 3. Information architecture

### Desktop layout

The header contains the project identity, save status and one switcher for Sheet, Kanban and Gantt. Undo, Commands, Shortcuts and New task sit on its right.

The filter strip below shows Search, Filters, Group by epic, Saved views and More. Filters contains every existing criterion; active filter chips and Clear all remain outside it. More contains Paste list, Refresh, Export CSV, New epic and connection details. Quick task entry shares its row with Sheet layout controls. On narrow screens grouping, saved views and manual order move into More; Columns remains visible. The current view remains available as a screen-reader heading.

**Style reference, 2026-11-04:** adopt the simplicity of `G:\My Drive\gsheetPLannerSimple` in the main `implement_mvp` checkout. Keep its compact top navigation, blue/gray palette, white cards and softly tinted status headers without replacing the MVP's newer commands, inline editing or timeline features.

The work view uses the full width below the toolbar. Keep each view’s filters, selection and scroll position when switching views.

### Narrow screens

The header and toolbar wrap to fit the screen. Keep the view names and save status visible. The board, table and timeline scroll horizontally within their own regions. The editor uses the full phone screen.

## 4. Design tokens (light theme first)

The workspace uses SmartGantAI’s light gray canvas, white surfaces, navy text and blue actions.

| CSS token | Value | Intended role |
|---|---|---|
| `--primary` | `#0052CC` | Primary action and active view |
| `--primary-dark` | `#0747A6` | Hovered primary action |
| `--canvas` | `#F4F5F7` | Workspace background |
| `--surface` | `#FFFFFF` | Cards, header, menus and dialogs |
| `--surface-muted` | `#EBECF0` | Board columns and view switcher |
| `--ink` | `#172B4D` | Headings and body text |
| `--muted` | `#5E6C84` | Secondary text |
| `--line` | `#DFE1E6` | Dividers and surface borders |
| `--success` | `#006644` | Confirmed save |
| `--gold` | `#804B00` | High priority |
| `--red` | `#BF2600` | Errors, overdue work and highest priority |
| `--focus` | `#0052CC` | Keyboard focus |

Use text or an accessible name alongside each status or priority color. Use the system font at 14px for body text, 13px for controls and 12px for metadata.

**Shape and spacing:** 4px base rhythm; 6–10px corner radii; borders rather than dramatic shadows; card gap 8–12px; major section spacing 16–24px. Icons ~16–18px, always paired with text or accessible labels where meaning is uncertain.

**Density:** Comfortable default (table rows ~40–44px, card padding ~12–16px); optional Compact (rows ~32–36px, card padding ~8–12px). Density changes spacing, not available functionality. Verify mobile/touch targets ~44px when practical.

**Themes:** Light only for first release; plan semantic variables for dark/system later. Do not spend P0 time implementing an unvalidated theme configurator.

## 5. Task creation: three levels, one mental model

### 5.1 Inline Add — primary workflow

In Kanban: under each status column show `+ Add task`; in Sheet: visible new-row/quick-add surface. On activation, a focused single-line title input appears.

```text
Backlog (8)                       To Do (3)
┌────────────────────────┐       ┌────────────────────────┐
│ Improve toolbar        │       │ Write release notes    │
│ PRJ-24          ↑  JM  │       │ PRJ-27          −  AK  │
└────────────────────────┘       └────────────────────────┘
[ + Add task             ]       [ + Add task             ]
```

**Interaction:** Type a title → Enter → create in the correct context → show a pending state → keep a ready input for the next task. Esc exits. Blank title cannot create. On a save failure retain the title (or a visibly recoverable pending item) and present Retry; do not discard the only copy. Do not duplicate on slow/retried requests. Support keyboard and touch.

**Context:** Status comes from board column; selected epic/parent only if legal under current model. No hidden invalid parent assignment. Current default issue type `Task`, priority `Medium`, status `Backlog` outside board context. Do not add a new backend workflow solely for this.

### 5.2 Compact Quick Create — secondary

**Desktop:** modal centered, target width 440–520px, intrinsic height, max ~85vh. **Mobile:** full-screen sheet. Show title, optional description, compact type/priority controls and relevant status/assignee/due-date selectors as chips or short rows. Provide **Create**, **Cancel**, **More options** and optionally **Create another**. Don't show two dozen form fields at once.

- Default focus: title field; visible labels and validation.
- Primary `N` shortcut preserved; optionally add `C` as alias after collision checks.
- Enter in one-line title submits unless IME/autocomplete is active; Ctrl/Cmd+Enter submits from long fields; Shift+Enter creates a newline in a multiline field.
- Esc closes if empty; if edited, respect unsaved draft through a lightweight discard confirmation or safe draft retention.
- **More options** expands the new-issue dialog in place, keeping its center and revealing planning/hierarchy/effort fields (desktop expanded width up to ~720px, max ~85vh). **Back to compact** restores the compact layout. Preserve all entered values, including advanced fields hidden after collapsing. Mobile keeps the full-screen sheet in both modes. Existing issues also open in the compact layout; More options reveals their full editor, related work, comments and secondary actions without losing edits.

### 5.3 Detailed issue editor — deep work

**Desktop:** the expanded compact dialog stays centered, up to ~720px wide and at most ~85vh tall. **Mobile:** full-screen. Header has title, ID, close, secondary actions; group content in readable sections:

1. **Primary:** status, priority, type, assignee and parent.
2. **Description** with appropriately large edit area.
3. **Planning:** start/due, sprint, labels, dependencies.
4. **Effort:** estimate, time spent, progress.
5. **Metadata:** reporter, timestamps and remaining existing fields.

Collapse secondary sections where practical. Autosave on safe property changes; debounce long text. Clear draft/pending/failed/conflict states. Avoid surprise close, focus loss or auto-overwrite after concurrent edit. Keep child navigation intact. Delete requires explicit confirmation and existing reference checks.

## 6. Kanban specification

- Columns: target 280–320px desktop, consistent header with status dot/label, issue count and add action. Scroll board horizontally at smaller widths.
- Cards: clean white surface and subtle border, 2-line title before ellipsis; visible issue ID and task type marker; priority icon and assignee avatar/initials. Show due/blocked/dependency signal only when present and useful. Rare metadata stays in details.
- Card click opens details; interactive controls do not accidentally open details due to event bubbling.
- Priority and assignee are editable with a focused click/tap and keyboard alternative. Status change via drag or select/context menu.
- Accessible reorder alternative: keyboard Move up/down or menu; no hover-only affordances.
- Drag: clearly show insertion point and target column; preserve existing rank semantics. Filtering/sorting cannot accidentally rewrite hidden item order; conflicting moves present a recoverable error.
- Empty columns show useful add affordance. Loading/empty/filter-no-match/errors have distinct states.
- Keep existing Epic filtering. **Epic swimlanes are required for the MVP (P1, Phase 3)**. Generic grouping builders and WIP limits are deferred.

### 6.1 Epic swimlanes — required MVP

**Purpose:** Show progress by Epic while keeping the default flat board simple and fast. The Epic view is an optional presentation of the same tasks, not a new task model.

- **Toggle:** The Board toolbar offers `No grouping` and `Group by Epic`. Remember the selected mode per browser across reloads and view switches. Do not confuse Epic filtering (which narrows results) with Epic grouping (which organizes results).
- **Layout:** Each Epic gets a horizontal, collapsible lane with status columns aligned across lanes. A compact lane header displays the Epic title, task count, and completion progress. Epic records appear as lane headers, not duplicate task cards.
- **No Epic:** A separate `No Epic` lane holds issues without an Epic ancestor. Determine ancestry from existing `parentId` relationships; do not add an `epicId` column or migrate the current schema.
- **Counts and progress:** Distinguish the number of tasks matching active filters from Epic-wide completion. Completion counts **leaf work items** in Done / total leaf work items in an Epic's descendant tree; avoid double counting parent Stories. Handle an Epic with zero leaf tasks gracefully. Show progress even if lane is collapsed.
- **Collapse:** One click or keyboard action collapses/expands the lane. Persist collapse preferences at least for the session, ideally per browser. Grouping must stay usable with many Epics and on narrow screens.
- **Contextual add:** `+ Add task` in an Epic/status cell inherits its status and a legal parent Epic. In `No Epic`, new tasks have no parent. Respect current type/parent validation and preserve any failed-entry draft.
- **Moves:** Support dragging within/across status columns, reordering within a lane, and legal cross-Epic moves. Provide a non-drag menu/keyboard/touch alternative for all such moves. A Story may change its Epic parent. A Task/Bug directly under an Epic may change Epic parent. A Task/Bug nested under a Story **must never silently detach** from its Story: explicitly ask for an explained detach/reparent action or block the move with a clear message. Combined status+Epic moves must be validated and either persisted together or safely recovered; preserve unaffected filtered/hidden ordering.
- **Feedback:** Highlight legal insertion targets and invalid targets, preserve focus/scroll, and handle pending/failed/conflict states consistently with flat board.
- **Not MVP:** Group by assignee/project, nested swimlanes, lane-order reordering, new hierarchy schema, configurable grouping engine, WIP automation.

**Acceptance:** Toggle modes and reload; verify aligned columns, No Epic, collapsible lanes, visible vs overall counts/progress, valid contextual add, legal status/Epic moves, safe rejection or confirmation of Story-child cross-Epic moves, non-drag controls and successful persistence in local and Apps Script modes.

## 7. Sheet view specification

- Spreadsheet-like but with deliberate typography, cell padding and row separation.
- Keep the issue ID/title readily visible when horizontally scrolling; sticky header and optional pinned identity columns when technically feasible.
- Direct cell edit on click/Enter; Tab advances logically; Escape cancels current edit without destroying another draft. Keyboard arrow navigation must not break native text selection.
- Selects for type/status/priority open immediately; show tooltip/help for ambiguous icons and columns.
- Make active filters/sorts unmistakable. Manual order is not silently replaced when users sort temporarily.
- Support new-row quick-add. Keep CSV export of filtered results.
- Save feedback can be per-cell/row and in global status, but a failed save **must not silently revert the cell**. Focus/selection should survive unrelated updates.
- Default Comfortable rows; Compact is a preference, never required to see sufficient tasks.

## 8. Gantt specification

- Preserve existing day/week zoom, bar drag and resize, current date, progress, dependency lines, unscheduled issues and saved dates.
- Match the same header, font, spacing, icons, contextual menus and error states as Kanban/Sheet.
- Clearly distinguish moving a bar (shift both dates) from resizing the right edge (change end date). Show a visual preview/tooltip with expected dates before commit where feasible.
- Do not silently change from calendar-day to working-day rules. Warn when unscheduled tasks lack dates rather than inventing them.
- Avoid a new scheduling engine, automatic propagation, holiday overlays and workload planner in MVP.
- For long lists, scroll performance and legible labels matter more than animation.

## 9. Navigation, command palette and shortcuts

| Interaction | Shortcut | Priority/notes |
|---|---|---|
| Switch Sheet/Kanban/Gantt | `1` / `2` / `3` | Existing; preserve |
| Search | `/` | Existing; preserve |
| New task / Quick Create | `N` | Existing; preserve |
| Optional Quick Create alias | `C` | Only if no typing/focus conflict |
| Open command palette | `Ctrl/Cmd+K` | P1: actions, views, issue lookup |
| Open selected task | `Enter` | Only when card/row is focused |
| Close dialog/menu | `Esc` | Preserve unsaved work |
| Contextual priority/assignee | `P` / `A` | Future enhancement after selection model is safe |
| Undo last action | `Ctrl/Cmd+Z` | Only for actions with a correct inverse; later work |

**Command palette:** simple search and executable actions: New task, open issue by ID/title, switch view, focus search, optionally status/priority on selected task. One palette, not a mini-IDE. If it cannot be implemented reliably within P1, leave out incomplete commands rather than adding dead items.

Shortcuts never hijack text editing, IME composition or modal content, and must respect platform/browser conventions. Provide keyboard Help. Visible focus on every interactive card/icon/toolbar.

## 10. Persistence and feedback design

| State | UI treatment | Meaning / user action |
|---|---|---|
| Local draft | Input or task marked Draft | User typed it; not yet queued for server |
| Saving/Pending | Small spinner + `Saving…`/`Pending` | Local feedback is immediate; server not confirmed |
| Saved (Sheets mode) | Subtle check/text `Saved` | Server acknowledged; may fade after a short interval |
| Saved locally (demo) | `Saved in this browser` | No Sheets sync; avoid cloud checkmark |
| Failed | Error indicator + Retry/Copy | Keep typed value in recoverable form |
| Conflict | Explicit different-value/refresh/resolve state | Do not silently replace remote changes |
| Offline/unavailable | Visible limited connectivity state | User understands sync cannot presently finish |

Do not use blocking full-screen spinners for every routine edit if the data model permits independent operations. Do not show a saved state based on local optimism alone. When a modal closes during a pending save, the submitted work must remain findable, with progress/error status and no duplicate re-submission.

## 11. Micro-interaction and responsive standards

- Hover may reveal optional quick actions; keyboard focus/touch must offer the same access.
- Clickable controls show affordance/feedback within performance budget; hover/press effects should be subtle (typically 100–160ms) and respect reduced motion.
- Avoid accidental drag from a quick-edit control; use deliberate drag thresholds/grips as appropriate.
- Show empty, loading, no-search-results, success, failed and conflicting states with helpful words, not only icons.
- Tooltips are supplementary: important labels must be discernible without hover.
- Do not conceal status/priority in color alone; pair symbols or text with semantic colors.
- On viewport changes, preserve the active issue and user draft; do not change workflow just because layout shifts.

## 12. Accessibility quality bar

Aim for **WCAG 2.2 AA** on applicable UI. Verify keyboard tab order, visible focus, screen-reader names, validation/error announcements, dialog focus trap/restore, meaningful label association, contrast, 200% zoom/reflow where applicable and reduced-motion preference. Provide touch equivalents of drag and hover. Treat 2-line title truncation as a visual rule, not content loss; full title is available on focus/details.

## 13. UX scenarios to verify

1. **Repeated capture:** Enter three titles in one column with no full-form opening. Context is correct, save state visible, no duplicate on retry.
2. **One-click editing:** Change a card priority and assignee without leaving board; use keyboard equivalents.
3. **Deep edit:** Expand More options, change description and dependency, confirm validation and persistence.
4. **Keyboard-only:** Switch views, focus search, create, edit, close, and return focus correctly.
5. **Failure state:** Fail an inline Sheet edit and task creation; draft remains available and Retry succeeds without duplicate.
6. **Cross-view:** Filter Kanban, switch to Sheet and Gantt, confirm consistent issue selection and context.
7. **Narrow screen:** Create/edit with touch; no controls inaccessible behind sideways overflow.
8. **2,000 tasks:** Navigation, search, flat and Epic-grouped Kanban interactions and Gantt remain measurable and usable.
9. **Epic swimlanes:** Flat/Epic toggle, collapse, No Epic, accurate counts and leaf-work progress, safe cross-Epic movement and non-drag equivalents are verified.

## 14. Reference first slice

Build this before polishing every screen: **Kanban inline create → optimistic Pending → real Saved/Failed → direct priority edit → compact issue dialog → More options → description update → reload → deliberate failure/conflict test.** This validates the entire design philosophy end-to-end.

---

**Design acceptance is evidence-based:** screenshots at desktop/mobile widths, keyboard walkthrough, data round-trip tests, failure cases and measured performance; not merely a visual before/after.

### Sheet layout preferences

Default columns are ID, Summary, Status, Assignee, Priority and Due Date. Every column can move; ID pins only while first. Header grips reorder, header edges resize, and Columns provides width and movement controls plus Reset layout. Widths/order belong to browser preferences and Saved Views, never to the Google Sheet schema. Legacy untouched defaults migrate once; custom layouts remain intact.
