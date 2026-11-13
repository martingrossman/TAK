# TAK — Unified Product Contract, Current State, and Roadmap

**Consolidation date:** 2026-11-01  
**Current code source:** `C:\Users\martin\Documents\GitHub\TAK`, branch `implement_mvp` (renamed 2026-11-04; original review baseline `49eca0c`)
**Historical working copy:** local folder `tak-inline-capture` (outside this repository), based on `28b8d1e`\
**Purpose:** provide one decision document for TAK that separates confirmed decisions, current implementation, open questions, and later ideas.

---

## 1. Consolidated Decision

TAK should not be implemented as a new product from scratch. The current GSheetJira/SheetFlow codebase provides the technical core: the item model, validation, Google Sheets/Apps Script persistence, local mode, Sheet, Kanban, Gantt, filters, drafts, conflicts, retries, and a significant part of the fast-editing experience.

TAK is the next product layer built on that core:

> **Capture → Organize → Plan → Execute**

The first TAK should be a fast, calm team workspace—not a simultaneous replacement for Jira, an HR capacity system, Miro, enterprise IAM, and an autonomous agent platform.

Therefore:

- the current `implement_mvp` branch is the sole source of truth for code and current technical status;
- `tak-inline-capture` is a historical working/review copy, not a second product or a deployment branch;
- the original `ProductRequiremtns.md` and `IMPLEMENTATION_PLAN.md` remain inventories of longer-term possibilities, not the automatic scope of the first TAK;
- the focused MVP documents remain binding for data safety, persistence, supported runtimes, and existing acceptance scenarios;
- this document consolidates the new TAK product direction and identifies what should be promoted into the next PRD and UX specification.

---

## 2. Source Authority

When sources conflict, use this precedence:

1. data safety, observed code, and the current `implement_mvp` branch;
2. explicit product decisions confirmed by the user;
3. the current focused MVP documents under `docs/`;
4. this consolidated product contract for the next TAK stage;
5. the historical `tak-inline-capture` copy;
6. the original broad requirements and implementation plan;
7. assistant proposals that the user did not confirm.

Observed code establishes current behavior; it does not cancel an unmet product or UX requirement. Requirements, implementation, and verification remain separate claims.

“Implemented” does not automatically mean “verified in a live Google environment.” Local and synthetic Apps Script tests must never be presented as proof of a published `/exec` deployment.

---

## 3. Source Inventory and Time Layers

### 3.1 Current layer

The current repository contains the latest code and these main contracts:

- `AGENTS.md` — working and safety rules;
- `docs/PRODUCT_REQUIREMENTS_MVP.md` — focused MVP and AT-01 through AT-13;
- `docs/UI_UX_DESIGN_SPEC.md` — current compact-dialog UX, Kanban, Sheet, and Gantt;
- `docs/IMPLEMENTATION_PLAN_MVP.md` — Phases 0–5 and release gates;
- `docs/PHASE_0_REVIEW.md` — historical audit plus current checkpoints in Sections 14–16;
- `docs/FUTURE_ROADMAP.md` and `LEGACY_SCOPE_MAPPING.md` — deliberately deferred scope;
- `docs/BACKLOG.md` — open issues and improvements;
- `docs/Manual Google test.md` — proposed live smoke test, currently untracked and referencing an older HEAD;
- root `ProductRequiremtns.md`, `IMPLEMENTATION_PLAN.md`, `readme.md`, `README_FIRST.md`, and `TESTING.md` — broader or historical context.

### 3.2 Historical `tak-inline-capture` layer

This copy stops around P2.4/commit `28b8d1e`. Its documents are mostly identical to the current versions, but:

- `PHASE_0_REVIEW.md` ends at Section 13 and lacks the current checkpoint;
- the older PRD and UX specification still use a side drawer for existing issues;
- the local `tak-inline-capture` branch contains two experimental commits, `2c60650` and `d5f6c14`;
- its working tree contains additional uncommitted changes;
- `PHASE_0_TO_MVP_RELEASE_PLAN.md` correctly separates completion of the original MVP from new TAK workflows.

The directory must therefore not be merged or deployed wholesale. It is evidence of historical decisions and patches, not a release source.

### 3.3 Relevant chats

The consolidation included these conversations in particular:

- **Color Palette Feedback** — rejected dominant olive/sage styling and proposed a neutral + cobalt direction;
- **Design review and improvements** — promoted Epic swimlanes to mandatory MVP scope;
- **Kontrola branchu Implement MVP** — confirmed Team Home, a calm summary strip, Simple/Expanded, panel/full-page detail, and direct editing;
- **Branch · Kontrola branchu Implement MVP** — established Capture/Organize/Plan/Execute and the high-level TAK direction;
- **Summarize MVP Status** — requested a conservative comparison of documentation with actual implementation;
- **GSheetJira Overview** and the `AGENTS.md` conversations — development workflow guidance, not additional product scope.

### 3.4 Explicit review of the requested MVP and UX sources

**Reviewed in full on 2026-11-01:**

- historical working-copy file `tak-inline-capture/docs/PRODUCT_REQUIREMENTS_MVP.md` (outside this repository) — version 1.0, dated 2026-10-28; Sections 1–9, including FR-ENV, FR-01–FR-12, and AT-01–AT-13.
- historical working-copy file `tak-inline-capture/docs/UI_UX_DESIGN_SPEC.md` (outside this repository) — version 1.0, dated 2026-10-28; Sections 1–14, including design tokens, interaction rules, accessibility, nine UX scenarios, and the reference first slice.

These historical files were also compared with the current repository's [PRD](PRODUCT_REQUIREMENTS_MVP.md) and [UX specification](UI_UX_DESIGN_SPEC.md). The differences concern the existing-issue editor: historical PRD FR-04 and UX Sections 2, 5.2, 5.3, 13.3, and 14 specify a drawer; the current counterparts specify a compact dialog expanded through More options. The remaining content is equivalent.

**Disposition:** preserve the historical drawer decision as context, retain the current compact/expanded dialog contract for the original MVP, and carry the confirmed panel/full-page TAK target in Section 5.5. Do not claim that the modal already fulfills that target or silently change the current editor because an older file says “drawer.” All other baseline requirements remain applicable unless explicitly superseded through a recorded product decision.

This review consolidates requirements only. It does not approve their implementation, migrate the source specifications, or refresh the implementation/test claims in Section 6. Both source documents describe target requirements, not proof that those requirements have passed.

### 3.5 Product requirement traceability

The following mapping makes the retained baseline explicit. “Retained” means required or preserved according to the original priority; it is not an implementation or verification status.

| PRD source | Retained contract in this document | Acceptance anchor |
|---|---|---|
| Sections 1–2 — outcome and priorities | Capture/Organize/Plan/Execute (Section 4); original P0/P1/P2 sequencing and no regression (5.8.1). | AT-01–AT-13 and Section 11 |
| FR-ENV — supported environments | Local/browser, Apps Script/Sheets, and native Sheet editing; honest limitations (5.8.1). | AT-10 |
| FR-01 — workspace/navigation | Single navigation, compact shell, visible context/mode/save state, no dead routes or large hero (5.1–5.3, 5.8.2). | AT-11; 1366×768 work-first check |
| FR-02 — inline create | Title + Enter, repeat capture, legal defaults/context, recoverable failures and no duplicate retries (4.3, 5.8.3). | AT-01 |
| FR-03 — Compact Quick Create | Focused compact form, visible Create/Cancel, in-place More options/Back to compact and draft retention (5.8.3). | AT-02 |
| FR-04 — detailed editor | Current dialog versus historical drawer versus TAK panel/full-page target; preserve every existing field and recovery/deletion protections (5.5, 5.8.4). | AT-04–AT-06 |
| FR-05 — Kanban/Epic lanes | Direct edits, stable status/rank, accessible moves, persistent grouping and hierarchy-safe leaf progress (5.6, 5.8.5). | AT-03, AT-07, AT-13 |
| FR-06 — Sheet | Editable/sortable/filterable table, identity/header visibility, keyboard flow, retained failed edits and filtered CSV (5.3, 5.8.6). | AT-05, AT-08 |
| FR-07 — Gantt | Existing scheduling, dates/progress/dependencies, markers/unscheduled access and calendar-day rules (5.8.6). | AT-09 |
| FR-08 — search/context | One search, ID/title and existing description search, existing filters/reset, consistent results and preserved context (5.8.7). | AT-07–AT-09; cross-view UX scenario |
| FR-09 — keyboard | Existing keys plus Ctrl/Cmd+K, typing/IME/modifier guards and discoverable mouse/touch equivalents (5.8.7). | AT-02, AT-03, AT-11 |
| FR-10 — integrity | Honest persistence states, server acknowledgement, draft/retry/conflict safety and unchanged model protections (5.8.1, 5.8.8). | AT-01, AT-05–AT-07, AT-10, AT-13 |
| FR-11 — appearance/accessibility | Semantic tokens, readable Comfortable default, WCAG 2.2 AA target, focus/dialog/reflow/touch checks (5.7, 5.8.2, 5.8.9). | AT-11 |
| FR-12 — performance | Separate local/network measurements, safe targeted updates, defined budgets and 2,000-task conditions (5.8.8, 11.2). | AT-12 |
| Sections 5–6 — model/non-goals | Existing 21-column compatibility, enums, parent/rank rules and explicit deferred scope (5.8.1, 7.2, 9–10). | AT-07, AT-09–AT-10, AT-13 |
| Sections 7–9 — acceptance/success/change control | AT-01–AT-13 preserved (11.1); measured friction/evidence (11.2); product decision and PRD update before P0/P1 changes (5.8.1, 13). | Section 11 in addition to original anchors |

### 3.6 UX specification traceability

| UX source section | Retained treatment / destination |
|---|---|
| 1 — experience principles | Work first, visible common actions, depth on demand, integrity, input parity, cross-view consistency and no feature theater (4–5, 5.8.2–5.8.9). |
| 2 — balanced hybrid | Visible New/inline add/filter chips, useful card metadata, direct priority edit, compact summary, progressive detail and Comfortable density (5.1–5.8). |
| 3 — information architecture | One view switcher, compact contextual shell, responsive owned scroll regions and preserved context (5.8.2, 5.8.9). |
| 4 — design tokens | Semantic neutral/indigo/cobalt palette, typography/spacing/shape/density reference and light-first theme (5.7, 5.8.2). |
| 5.1–5.2 — creation | Repeated inline capture and compact/expanded create, keyboard submission, legal defaults and retained values (5.8.3). |
| 5.3 — deep editor | Complete field groups, safe text/property saves, child navigation and explicit deletion; editor version difference resolved in 3.4 and 5.5 (5.8.4). |
| 6–6.1 — Kanban/Epics | Card interaction, insertion/order safety, legal ancestry-based grouping, counts/progress, collapse and non-drag moves (5.6, 5.8.5). |
| 7 — Sheet | Cell editing/navigation, identity/header visibility, clear filters/sorts, quick-add, CSV and recoverable failures (5.8.6). |
| 8 — Gantt | Move versus resize, date preview, existing schedule features and unchanged calendar-day semantics (5.8.6). |
| 9 — navigation/commands | Preserved shortcuts, guarded command palette, focus and Help; optional keys remain optional (5.8.7). |
| 10 — persistence/feedback | Draft, Pending/Saving, Saved, local saved, Failed, Conflict and unavailable states; pending work remains findable (5.8.8). |
| 11 — micro-interactions | Input parity, subtle feedback, deliberate drag, descriptive states, supplementary tooltips and viewport-safe drafts (5.8.5, 5.8.9). |
| 12 — accessibility | Keyboard, names/labels/errors, focus trap/restore, contrast, 200% reflow and reduced motion (5.8.9). |
| 13 — nine UX scenarios | Repeated capture, direct edits, deep edit, keyboard, failures, cross-view context, narrow/touch, 2,000 tasks and Epic lanes (11.1–11.2). |
| 14 — reference first slice | Inline create → Pending → real Saved/Failed → priority edit → current editor → description → reload → failure/conflict; retain as a bounded regression slice (11.2). |

---

## 4. TAK Product Definition

### 4.1 Product in one sentence

> TAK is a fast team workspace where a person can capture an idea or task, deliberately organize it, plan ownership/priority/dates, and communicate execution without unnecessary forms or disconnected modules.

### 4.2 Primary users

- a small-team or project lead;
- a team member who needs to capture and update work quickly;
- an individual using the same core in personal mode.

The first TAK is not an enterprise multi-tenant platform. However, a team-first direction means identity, sharing, and ownership cannot remain permanently as unverified free-text concepts.

### 4.3 Four activities

#### Capture

- create an item with title + Enter only;
- create repeatedly without opening a large form;
- retain the draft after an error, timeout, or conflict;
- inherit known context when legal, but never create a hidden invalid relationship;
- support quick lists/paste; an advanced visual brainstorming canvas is not required in the first release.

#### Organize

- an item may exist without an Epic or complete planning data;
- Inbox represents deliberate processing of captured items, not automatically a new work status;
- organizing an item must not copy it, replace its ID, or lose content;
- Project, Epic, and parent are distinct concepts and must not be conflated.

#### Plan

- priority, owner, due date, status, and Project/Epic context are directly accessible;
- List, Sheet, Kanban, and Gantt display the same items and use the same rules;
- Epic progress counts leaf work and is not distorted by the active filter;
- manual order, priorities, and due dates must not silently overwrite one another.

#### Execute

- the team can see who owns what and what is urgent, overdue, or blocked;
- Status Notes provide short updates with author and timestamp;
- standup is a view over existing work, not a duplicate module;
- detail, comments, history, and related items are available without losing workspace context.

---

## 5. Confirmed UX Decisions

### 5.1 Team Home is the target default

The TAK start screen should show relevant team work, not only “my tasks.” It should provide quick access to Inbox, Backlog, and current priorities.

### 5.2 Problems should be visible, not dominant

Use a small clickable summary such as:

`10 overdue · 5 blocked · 8 this week`

Clicking a value applies a filter. The old large hero/statistics band must not return.

### 5.3 Simple List and Expanded Sheet are two modes of one table

- Simple List is the calm default with minimal information;
- Expanded Sheet exposes more columns and bulk editing;
- they are not separate data models or separate editors;
- switching is immediate and the choice is remembered.

Simply renaming today’s Sheet view to List is insufficient. The actual Simple/Expanded behavior must exist first.

### 5.4 Direct editing is primary

Status, owner, priority, and due date should be editable without requiring the detail view. The same principle should apply in List, Kanban, and where practical in Gantt. Bulk editing remains available.

### 5.5 Detail has a panel and full-page mode

The TAK target is:

- a side panel for quick context and common properties;
- a full-page detail view for description, comments, children, dependencies, history, and future extensions;
- transitions in both directions without losing drafts, filters, selection, or scroll context.

The current compact/expanded modal is a useful intermediate stage of the original MVP, not the final implementation of this TAK decision.

### 5.6 Epic swimlanes remain mandatory

Required behavior includes Flat/Group by Epic, No Epic, collapse, aligned status columns, leaf-work progress, contextual creation, safe status/Epic moves, and non-drag alternatives. Assignee/project/nested grouping is later scope.

### 5.7 Visual direction

- neutral backgrounds and surfaces;
- cobalt/indigo primary actions;
- semantic status and priority colors;
- strong contrast and readability;
- calm, professional character;
- do not imitate Jira branding or return to dominant olive/sage styling.

### 5.8 Retained MVP and UX contract

The details below carry forward the reviewed source contracts. They apply to the existing core and to TAK work unless an explicit replacement is identified; they do not turn deferred ideas into release requirements.

#### 5.8.1 Scope, data, and runtime compatibility

- Original **P0** covers safe existing behavior, design foundation, inline/compact create, complete editing, direct common-property edits, persistence/drafts and both runtimes. **P1** adds stronger search/keyboard, refined views, required optional Epic presentation and measured responsiveness. A safe P0 slice need not wait for all P1 work. P2 polish remains optional; already-working features in any tier must be preserved. TAK-1 is the next release scope, not a retroactive rewrite of these priorities.
- Preserve standalone/browser `localStorage` (`npm start`, built HTML, and GitHub Pages), Apps Script persistence to `Issues`, and direct native Google Sheets editing with its existing triggers/validation. External Sheet edits may bypass the UI. Local browser storage provides neither collaboration, Sheets synchronization, nor a durable backup.
- Preserve the legacy **21-column** contract, stable IDs, `parentId` restrictions, dependency/date/title/delete validation, and `rank` order. Types remain **Epic, Story, Task, Bug**; statuses **Backlog, To Do, In Progress, Review, Done**; priorities **Highest, High, Medium, Low, Lowest**. Hierarchy kind and future work categories are separate concepts.
- New Project/Team/Inbox/Blocked semantics must follow Section 10 and an approved compatibility/migration plan where needed. Do not silently add `Ready`/`Blocked` statuses, an `epicId` column, new hierarchy, or schema changes for a visual redesign. Existing v2 foundations do not require a migration as part of this review.
- No new frontend framework, native desktop build, external database/API server, automatic local↔Sheets sync, offline collaboration, capacity/calendar engine, custom-field engine, or agent workflow is implied. Preserve existing advanced capabilities while keeping the deferred families in TAK-2.
- Changing original P0/P1 scope requires a product decision and explicit PRD update. Preserve historical requirements until their migration/archival is decided; implementation reports should cite requirement/acceptance IDs.

#### 5.8.2 Work-first shell and visual foundation

- Keep one Sheet/Kanban/Gantt switcher, a lightweight header and contextual toolbar, visible New and Filter actions, active filter chips/reset, and relevant Sort/Group/Display controls. Display active view, selected context, item count, backend mode and save state. Hide unfinished routes. At **1366×768**, tasks are visible without scrolling past a welcome hero or four-card statistics band.
- Retain the UX sizing reference: collapsible desktop sidebar about **208–224px**, top bar **52–60px**, toolbar **40–48px**; board/table/Gantt own appropriate scroll regions. These are design targets subject to responsive and accessibility review, not proof of current dimensions.
- Retain the semantic token roles in UX Section 4: primary/hover, canvas/surface/sidebar, text/muted/border, success/warning/danger and focus. Its proposed `#4F46E5` indigo primary is a starting reference; Section 5.7 carries the neutral/cobalt direction. Validate palette changes with screenshots and contrast rather than arbitrary per-control colors. Status and priority always have text/icon/name meaning in addition to color, consistently across views.
- Typography reference: Inter with system fallback; body **13–14px**, secondary **12–13px**, section titles **16–20px**, workspace title about **20–24px**. Avoid 9–11px critical controls. Use a **4px** spacing rhythm, **6–10px** radii, subtle borders, **8–12px** card gaps, **16–24px** major spacing and labeled **16–18px** icons.
- Comfortable is the default: rows about **40–44px**, card padding **12–16px**. Optional Compact reference: rows **32–36px**, padding **8–12px**, without removing functionality and only after accessibility checks. Touch targets should approach **44px** where practical. Light-first tokens prepare for later dark/system themes; they do not make theme configuration P0.

#### 5.8.3 Creation and compact expansion

- Expose inline Add task in each Kanban column/cell and a visible Sheet new-row path. Title is the only mandatory field: Enter submits, blank titles do not create, successful submission leaves capture ready for the next title, and Esc exits. Preserve order, legal column/Epic/parent context, and exactly-once retry behavior. Outside contextual overrides, defaults remain **Task / Medium / Backlog**.
- Quick Create has focused/labeled title, optional description and compact type/priority plus relevant status/assignee/due controls. Provide visible Create, Cancel and More options; Create another is optional. Desktop reference is centered **440–520px**, intrinsic height, at most about **85vh**; mobile is full-screen.
- More options expands in place, up to about **720px** on desktop; Back to compact retains all values, including hidden planning/hierarchy/effort fields. Both transitions preserve drafts and validation access. No advanced field is required for title-only creation.
- Preserve `N`; `C` is optional after conflict checks. Enter submits from a single-line title only when IME/autocomplete is inactive; Ctrl/Cmd+Enter submits from long fields; Shift+Enter permits a multiline newline. Empty Esc close is immediate; entered content requires safe retention or a lightweight discard decision only when loss would occur.

#### 5.8.4 Complete detailed editing

- Retain summary/title/ID and the complete existing field set, organized as primary type/status/priority/assignee/parent; description; planning start/due/sprint/labels/dependencies; effort estimate/time spent/progress; and reporter/timestamps/remaining metadata. Advanced fields and child navigation must remain available.
- Keep validation, save state, conflict comparison/recovery, and draft preservation through navigation or failure. Use safe property saves and debounced long-text saves where supported; do not overwrite concurrent edits or close unexpectedly. Delete stays explicit, confirmed, and subject to existing reference checks.
- Editor presentation follows the version resolution in Section 3.4. The historical **560–720px** right drawer is a reference for the TAK panel design, not the current modal contract. The final panel/full-page field split remains an open decision in Section 10; transitions must retain values, filters, focus/selection and scroll context.

#### 5.8.5 Kanban, Epic lanes, and safe movement

- Preserve status columns, vertical rank and drag/drop. Desktop column reference is **280–320px** with label/count/add; cards show a two-line title, ID/type, directly editable priority and assignee, and due/blocker/dependency indicators only when meaningful data exists. Full titles remain available on focus/details. Card controls must not accidentally open detail or start a drag.
- Show insertion/invalid-target feedback and distinct loading, empty-column, no-match and error states. Provide keyboard/menu/touch alternatives for status changes, up/down ordering and legal cross-Epic movement. Temporary filters/sorts must not rewrite hidden or manual order; failed/conflicting moves retain recoverable state and useful focus/scroll.
- Grouping is a presentation of the same records: remember Flat/Group by Epic per browser, distinguish grouping from Epic filtering, align columns, show Epics as headers without duplicate cards, and derive No Epic membership from existing ancestry. Collapse must be keyboard accessible and remembered at least for the session; progress stays visible when collapsed.
- Show filtered visible counts separately from Epic-wide Done/total **leaf work items**, without double-counting parent Stories; handle zero-leaf Epics. Epic/status add inherits only legal parents; No Epic add has no parent. Story moves and direct Epic-child Task/Bug moves stay valid; Story-nested children require explicit explained detach/reparent or safe rejection. Combined status/Epic changes must persist together or recover safely. Verify both runtimes.
- Generic assignee/project grouping, nested lanes, lane reordering, WIP limits/automation and a configurable grouping engine remain deferred.

#### 5.8.6 Sheet and Gantt preservation

- Sheet retains the editable table, details access, sorting/filtering, sticky headers and feasible pinned ID/title visibility. Click/Enter edits; Tab/Enter navigation is logical; arrows respect native text selection; Escape cancels the current edit without deleting another draft. Type/status/priority selectors open directly. Keep filters/sorts clear, quick-add visible, and **filtered CSV export** correct and safe. Unrelated updates must preserve focus/selection; failed cells stay visibly recoverable.
- Gantt retains existing day/week behavior and newer implemented scales, task dates/bars/progress, dependencies, today/weekend markers and unscheduled access. Move shifts both dates; right-edge resize changes the end date. Use expected-date preview/tooltip where feasible, consistent labels/controls/focus/errors, and verify dates after reload without broken geometry or lost selection.
- Keep calendar-day semantics unless separately approved. Do not invent dates for unscheduled work. Working-day/leave engines, holiday overlays, automatic dependency propagation and workload planning remain later scope; existing dependencies and schedule validation must not regress.

#### 5.8.7 Search, context, and keyboard

- Use one search entry point for ID/title and existing description search. Preserve type/status/assignee/sprint/Epic filters, clear active filters and one-click reset. Equivalent filters return equivalent item sets across views, subject to rendering rules; view switches retain applicable filters and meaningful focus/selection/scroll. Personal saved views already implemented remain supported; advanced/shared views do not become original MVP blockers.
- Preserve **N**, **/**, **1/2/3**, and **Esc**; Ctrl/Cmd+K provides usable navigation, creation and issue lookup. Enter opens a focused card/row. Show shortcuts in Help/menus and maintain visible focus plus mouse/touch access. No shortcuts may hijack typing, IME, modal content, relevant modifier combinations or platform/browser conventions.
- Optional `C`, contextual `P`/`A`, palette property commands and Ctrl/Cmd+Z are not new release blockers. Undo only applies where a correct inverse exists; preserve existing undo paths and omit dead commands.

#### 5.8.8 Persistence, recovery, and responsive updates

- Distinguish **Draft/not queued**, **Pending/Saving**, **Saved** after server acknowledgement, **Saved in this browser**, **Failed**, **Conflict**, and **Offline/unavailable**. Local optimism is not a confirmed server save; local mode must not imply cloud sync.
- Retain the user's only copy after validation rejection, timeout, connection loss, failed create/edit/move or stale-version conflict. Offer Retry/Copy/Resolve/Compare as appropriate; retries must not create duplicates. Closing an editor during a pending save leaves submitted work findable with its actual state. Never silently replace newer remote values.
- Server validation and existing version/concurrency checks remain authoritative. Test rapid successive edits and slow responses as well as ordinary failures. Prefer shared loaded data, safe targeted rendering, batching and justified debouncing; do not relax integrity or lose focus/scroll for speed. Avoid blocking the entire view for an independent routine edit.

#### 5.8.9 Accessibility, responsive layout, and interaction evidence

- Target **WCAG 2.2 AA** on applicable flows: logical keyboard order, visible focus, accessible names/labels, validation and error announcements, dialog focus trap/restore, contrast, **200% zoom/reflow**, and reduced motion. Important actions/labels/errors cannot depend on hover, color or supplementary tooltips alone.
- On smaller laptops/tablets, collapse navigation and use contextual filter popovers. On mobile, offer usable List/Sheet or horizontally scrolling columns, a visible add action, full-screen editing and touch equivalents for all drag/hover actions. Keep Gantt labels/navigation and save errors accessible; do not crush five columns into tiny cards or hide essential controls behind overflow.
- Preserve active issue and draft when the viewport changes. Use deliberate drag thresholds/grips and subtle hover/press feedback, typically **100–160ms** with reduced-motion support. Show useful words for loading, empty, no-results, success, failed and conflict states.
- Acceptance needs desktop/mobile screenshots, keyboard walkthroughs, data round trips, failure/conflict checks and measured performance. Visual polish or animation alone is not verification; Section 11.2 carries the evidence requirements.

---

## 6. Current Implementation State

### 6.1 Implemented in code

- local `localStorage` runtime and Google Apps Script/Sheets runtime;
- Sheet, Kanban, and Gantt over one shared collection;
- stable IDs, parent/dependency validation, dates, status, and priority enums;
- title-only and inline creation, pending/queued/failed items, and safe retry;
- Compact Quick Create and a compact-first existing-issue editor with More options;
- direct Kanban priority and assignee editing;
- Move dialog and hierarchy-safe Epic/status moves;
- Sheet keyboard flow, pinned identity/title, and CSV export;
- Flat/Epic preference, No Epic, collapse, and overall leaf-work progress;
- search, filters, personal saved views, and bulk editing;
- comments, duplication with descendants, and several undo paths;
- command palette and core shortcuts;
- Gantt drag/resize, dependencies, hierarchy, quick creation, and day/week/two-week/month scales;
- draft recovery, Retry/Copy/Compare/Discard, timeout, and conflict protection;
- legacy and v2 repository foundations, migration/rollback, and role scaffolding.

### 6.2 Verification

- current Node tests: 122/122 passed during the consolidation audit;
- current Playwright inventory: 102 tests in 22 files;
- a clean 97/97 browser run was reported historically;
- the latest stored pass marker predates the newest Gantt-scale change, so it does not certify the complete current HEAD;
- local and synthetic-cloud tests do not use a live Google workbook;
- the exact identity of the last tested Apps Script project, workbook, schema, and `/dev`/`/exec` version is not recorded as complete release evidence.

### 6.3 Current performance evidence

- 2,000 records, Epic-grouped initial median: 3,288 ms — above the 3-second target;
- 500 records, Sheet navigation p95: 3,103 ms — far above the 150 ms target;
- Kanban navigation p95: 973 ms;
- search p95: 557 ms;
- targeted Sheet priority edit p95: 92 ms;
- older live create measurements: approximately 2.5–3.5 seconds — above the typical 2-second target.

Performance is therefore not complete merely because one targeted edit is fast.

---

## 7. Priorities

New labels are used to avoid confusion with the old P0/P1/P2 terminology:

- **TAK-1:** required for the first trustworthy TAK or its safe release;
- **TAK-2:** valuable expansion after the first stable release.

### 7.1 TAK-1 — first TAK

| Order | Area | Minimum outcome |
|---:|---|---|
| 1 | Product contract | Approved meanings for Team Home, Inbox, Project, Blocked, Status Notes, and Simple/Expanded. |
| 2 | Release identity and live acceptance | Recorded commit, Apps Script project, workbook, environment, schema, and `/dev`/`/exec`; live AT-01–13. |
| 3 | Integrity/recovery | Bounded tests for native Sheet concurrency, ordering scope, rank exhaustion, and receipt retention; precise documented limits. |
| 4 | Performance | Profile and repair the largest Sheet/navigation/search paths, or approve a supported scale explicitly. |
| 5 | Accessibility/mobile | Contrast, 200% reflow, screen reader, physical touch, and non-drag alternatives. |
| 6 | Team Home | Default team workspace rather than an analytics-heavy dashboard. |
| 7 | Calm problem summary | Clickable overdue/blocked/this-week values connected to filters. |
| 8 | Simple List ↔ Expanded Sheet | Two densities of one table, immediate switching, and remembered preference. |
| 9 | Unified direct editing | Status, assignee, priority, and due date using the same persistence/recovery path. |
| 10 | Minimal Capture + Inbox | Title-only capture and deliberate triage without changing IDs or losing context. |
| 11 | Minimal Project/Team context | Project filter/backlog and verified member/owner meaning, without enterprise capacity planning. |
| 12 | Side panel ↔ full-page detail | Seamless transition without losing drafts or workspace context. |
| 13 | Status Notes + standup | Separate short update with author/date and a simple team view. |
| 14 | Blocked semantics | One explicit meaning, reason, and presentation in summary/List/Kanban. |
| 15 | Core Gantt acceptance | Live move/resize/reload, dependencies, unscheduled access, scales, and touch/keyboard. |
| 16 | Open tracker | Spreadsheet menu opens the correct deployment or explains that none exists. |
| 17 | Setup/release documentation | Current beginner setup, update, test, and rollback instructions without historical contradictions. |
| 18 | TAK naming/branding | One product name and visual language before public release. |

### 7.2 TAK-2 — later extensions

| Area | Scope |
|---|---|
| Advanced brainstorming | Visual canvas, clustering, and conversion of idea groups. |
| Project portfolio | Multiple projects, programs, cross-project reporting, and advanced permissions. |
| Team directory/capacity | Workweek, daily capacity, active members, overload, and defaults. |
| Holidays/availability | Holidays, leave, partial days, and work calendars. |
| Google Calendar | Optional integration after a privacy/security design. |
| Workload planning | Effort/capacity model and person/project drill-down. |
| Advanced Gantt | Milestones, drag-to-schedule tray, working days, conflict warnings, and optional rescheduling. |
| Task-type Settings UI | Rename/order/deactivate/delete/default lifecycle. |
| Custom attributes/badges | Text/number/date/checkbox/select and configurable badge source. |
| Templates | Personal/shared templates and advanced bulk application. |
| Advanced ordering/grouping | Lane reorder, scope revisions, Group by Project/Assignee, and nested grouping. |
| Shared saved views | Server-backed team views, ownership, and permissions. |
| Analytics/reporting | Throughput, cycle time, historical reports, and configurable dashboard. |
| Universal history/undo | History UI and undo for create/comment/archive/batch and other mutations. |
| Agent workflow/API | Claims, progress, blockers, evidence, review, and authenticated API after the identity/security gate. |
| Enterprise access | Admin/editor/viewer/reviewer/agent and protection of the direct-Sheet surface. |
| Blank Google template | Safe Make-a-copy template with no user data or deployment IDs. |
| Local → test Sheet transfer | One-time preview/import, never automatic synchronization. |
| Inline comments/description | Assignee/common properties are TAK-1; rich inline comment/description editing can follow. |
| UX polish | Dark mode, density, configurable cards, collapse-all, and minor duplication cleanup. |
| Smart capture | Natural-language dates, `@person`, `#label`, and `!priority`. |

---

## 8. Open `BACKLOG.md` Mapping

| ID | Consolidated interpretation | Priority |
|---|---|---|
| PRC-01 | Run tests efficiently and share only failures; process rule. | ongoing |
| PRC-02 | Align coding instructions after this document is approved. | TAK-1 docs |
| PRC-03 | Align README with actual setup and release process. | TAK-1 |
| ISS-01 | Compact existing-issue editor. | done |
| ISS-02 | Day/week/two-week/month Gantt scales. | done in code; current full regression remains open |
| ISS-03 | Sheet focus visibility. | done in code; live evidence must be tied to a deployment |
| ISS-04 | Shared-starter launcher verified on 2026-11-06; identify any older-copy or independent-installation failure before closing the original report. | TAK-1 follow-up, target unclear |
| IM-01 | Do not solve with rename only; incorporate into Simple List ↔ Expanded Sheet. | TAK-1 |
| IM-02 | Direct assignee/common properties are TAK-1; inline comments/description are TAK-2. | split |
| IM-03 | One-time local → test Sheet import. | TAK-2 |
| IM-04 | Shortcut help. | done |
| IM-05 | Remove unnecessary IDs/information. | TAK-2 polish |
| IM-06 | Duplicate title in pinned and Summary columns. | TAK-2 polish |
| IM-07 | Expand/collapse all lanes. | TAK-2 polish |
| IM-08 | Holidays in Gantt. | TAK-2 |
| IM-09 | Google Calendar. | TAK-2 |
| IM-10 | Blank SheetFlow template. | TAK-2 onboarding |
| IM-11 | Milestone/diamond was implemented in code on 2026-11-08; release inclusion and live acceptance remain undecided. | Originally TAK-2; scope decision open |
| IM-12 | Mobile usability. | TAK-1 for basic touch/reflow; advanced mobile patterns TAK-2 |
| IM-13 | Differentiate colors from Jira. | TAK-1 branding; neutral/cobalt foundation already exists |

Remove the empty `_` and blank bullets at the end of the backlog during the next approved documentation update.

---

## 9. Consolidation of the Original 20 Requirement Sections

| Original area | TAK decision |
|---|---|
| Purpose/architecture | Preserve Sheets + Apps Script + local mode; rename and refocus the product around teams. |
| Task model | Preserve IDs, hierarchy, dependencies, and compatibility; deliberately design Project/Team semantics. |
| Fast creation/editing | TAK-1; most of the technical foundation exists. |
| Vertical ordering | Preserve the foundation; scope revisions and lane/group reorder are TAK-2, while safety testing is TAK-1. |
| Task List | Transform into Simple List ↔ Expanded Sheet; TAK-1. |
| Kanban | Preserve and unify direct edits/moves; TAK-1. |
| Epic swimlanes | Mandatory and largely implemented; live/release acceptance is TAK-1. |
| Filters/saved views | Preserve core filters; Project filter TAK-1, shared views TAK-2. |
| Gantt | Preserve/verify the core in TAK-1; capacity/calendar/rescheduling are TAK-2. |
| Team/capacity | Minimal team identity TAK-1; capacity and overload TAK-2. |
| Holidays/availability | TAK-2. |
| Types/settings | Preserve current types; full management lifecycle TAK-2. |
| Custom attributes | TAK-2. |
| Dashboard | Replace with Team Home + subtle summary in TAK-1; analytics dashboard TAK-2. |
| Agentic workflow/API | Not first TAK; TAK-2 after explicit security/identity decisions. |
| Ready/Blocked statuses | Do not add silently; decide Blocked semantics in TAK-1 and treat workflow expansion separately. |
| Integrity/concurrency | Core safety and precise limits TAK-1. |
| Performance | TAK-1 release gate. |
| Reliability/history | Draft/retry/conflict TAK-1; universal history/undo/reporting TAK-2. |
| Access control | Safe owner/test sharing TAK-1; enterprise roles TAK-2. |
| Development/verification | Current tests plus live Google release evidence TAK-1. |

---

## 10. Open Product Decisions

These questions must be confirmed before their corresponding implementation work:

1. **Inbox:** triage property/view, or a new workflow status? Recommendation: begin with a triage view/metadata and avoid expanding the status enum prematurely.
2. **Project:** is it required? Can an item remain in a project without an Epic? How is Project represented in legacy and v2?
3. **Team:** what is the minimum verified identity and sharing policy for the first TAK?
4. **Status Notes:** append-only entry or editable latest update? What history and authorship rules apply?
5. **Blocked:** explicit property, status, or dependency-derived state? What is blocker reason?
6. **Ordering:** relationship between manual rank, priority, and due date; nothing should reorder automatically without an explicit choice.
7. **Default:** Team Home → Simple List; what is the initial flat/Epic grouping and how are existing preferences preserved?
8. **Detail:** which fields belong in the side panel and which are full-page only?
9. **Brand:** final `TAK`, `tak.`, or another name; migration of user-facing text and documentation.

---

## 11. First TAK Acceptance

The first TAK can be called released only when:

1. a user captures three items consecutively without loss or duplication;
2. an item can be triaged from Inbox without changing its ID;
3. Team Home, Simple List, Expanded Sheet, Kanban, and Gantt return consistent filter results;
4. status, owner, priority, and due date are directly and safely editable;
5. side-panel/full-page transitions preserve drafts and workspace context;
6. Epic grouping calculates correct leaf progress and moves items safely;
7. failed save, timeout, and conflict retain content and offer usable recovery;
8. a Status Note appears with author/date and in the standup view;
9. mobile/touch and keyboard flows have no known blocker;
10. performance is measured at 100/500/2,000 records and misses are fixed or explicitly accepted;
11. the live test is tied to a specific commit, Apps Script project, workbook, schema, and deployment version;
12. backup/rollback instructions exist and production publication is separately approved.

### 11.1 Original MVP acceptance remains required

The twelve TAK outcomes above extend rather than replace the original [PRD Section 7](PRODUCT_REQUIREMENTS_MVP.md). Preserve these IDs in test/release evidence; the current compact editor is the baseline for AT-04 until the TAK detail transition is delivered.

| ID | Retained outcome |
|---|---|
| AT-01 | Three title/Enter captures remain in legal context, persist exactly once, and keep entry ready. |
| AT-02 | New / N opens compact create; title-only submission works without advanced options. |
| AT-03 | Board priority changes directly, has a keyboard alternative, and survives refresh. |
| AT-04 | Complete detailed metadata remains editable; successful advanced edits survive reload. |
| AT-05 | Failed Sheet write keeps the draft, marks failure, and exposes usable Retry/Copy/Resolve. |
| AT-06 | Stale-version conflict cannot silently overwrite remote work and has understandable recovery. |
| AT-07 | Kanban status/reorder persists with non-drag fallback, no loss/duplication, and safe filtered order. |
| AT-08 | Sheet keyboard/cell editing works and filtered CSV matches the selection criteria. |
| AT-09 | Gantt move/resize persists expected dates without dependency regression. |
| AT-10 | Local and Apps Script modes identify themselves accurately and persist independently as documented. |
| AT-11 | Keyboard/mobile navigation, focus/restore, Esc, search/view keys and touch create/edit work. |
| AT-12 | Record 2,000-task flat/Epic benchmarks, conditions, budget misses and investigated regressions. |
| AT-13 | Verify remembered grouping, No Epic, collapse, aligned columns, visible counts versus leaf progress, contextual add, safe legal Epic/status moves, Story-child protection and non-drag access in both runtimes. |

### 11.2 UX evidence and performance budgets

Preserve all nine scenarios from UX Section 13: repeated capture (AT-01), direct priority/assignee edits (AT-03 plus assignee), deep description/dependency edit (AT-04), keyboard-only completion (AT-11), failed inline edit/create with successful non-duplicating retry (AT-01/05/06), cross-view filters/selection/context (FR-08), narrow-screen touch without inaccessible controls (AT-11), 2,000-task usability across views (AT-12), and full Epic lane behavior (AT-13).

Retain UX Section 14 as a bounded regression sequence: **Kanban inline create → Pending → acknowledged Saved or recoverable Failed → direct priority edit → compact issue dialog → More options → description update → reload → deliberate failure/conflict**. For the future TAK panel/full-page slice, repeat the same safety checks with both detail surfaces. This is acceptance coverage, not a request to rebuild already-working capture code.

| Measurement | Original target, not a current guarantee |
|---|---|
| Local interaction feedback | p95 **under 100ms** |
| Loaded-view navigation | p95 **under 150ms** |
| Initial usable view | **under 3s** |
| Normal Apps Script save | **under 2s** under documented conditions |

Measure local feedback separately from server round trips. Record dataset size/distribution, runtime/browser/device, network conditions, operation and sample/percentile method; include **100/500/2,000 records**, realistic flat/Epic distributions, slower-network cases, and navigation/search/Sheet/Kanban/Gantt interactions. Track clicks/keystrokes, median/p95 response, save success/recoverability, keyboard completion, mobile usability and visual consistency. Section 6.3 records known misses; they remain open until fixed or explicitly accepted with a documented supported-scale limit.

Release evidence must include applicable desktop/mobile screenshots, keyboard/focus/contrast/reflow checks, reload/round-trip results and failed-save/timeout/conflict/rapid-edit recovery. Distinguish local, synthetic Apps Script and live Google results. This documentation review itself supplies no new runtime, accessibility or performance pass.

---

## 12. Recommended Delivery Order

### Stage A — close the technical foundation

1. update and run the current full Node/browser regression;
2. identify the test Apps Script project, workbook, schema, and deployment;
3. run bounded live AT-01–13, including failure, conflict, and native Sheet tests;
4. fix `ISS-04` Open tracker;
5. close or explicitly accept integrity and performance limits.

### Stage B — approve the TAK contract

1. confirm the open decisions in Section 10;
2. update the PRD, UX specification, implementation plan, roadmap, and scope mapping;
3. preserve Phase 0 as a historical audit and add only a current status/link;
4. remove stale test counts, the old HEAD in the manual-test document, and historical contradictions.

### Stage C — first TAK workspace layer

1. Team Home + subtle summary;
2. Simple List ↔ Expanded Sheet;
3. unified direct editing for status/assignee/priority/due date;
4. minimal Project/Team filter and context;
5. Capture + Inbox.

### Stage D — deep work and execution

1. side panel ↔ full-page detail;
2. Status Notes;
3. standup view;
4. accessibility/mobile and performance hardening;
5. TAK naming/branding.

### Stage E — release

1. complete the acceptance criteria in Section 11;
2. create a documented release candidate;
3. make separate decisions for `/exec`, template, GitHub Pages, and production publication.

---

## 13. Documentation Migration Plan

After this document is approved:

- convert `PRODUCT_REQUIREMENTS_MVP.md` into a new TAK PRD with unambiguous requirement IDs;
- extend `UI_UX_DESIGN_SPEC.md` with Team Home, Simple/Expanded, Inbox, side/full detail, and standup;
- replace `IMPLEMENTATION_PLAN_MVP.md` with sequenced TAK-1 slices and a new release gate;
- align `FUTURE_ROADMAP.md` with TAK-2;
- update `LEGACY_SCOPE_MAPPING.md` using Section 9;
- preserve `PHASE_0_REVIEW.md` as historical evidence instead of rewriting old findings;
- remap `BACKLOG.md` to TAK-1/TAK-2 and remove duplicates/blank lines;
- update `Manual Google test.md` to the current HEAD and commit it only after review;
- update `README_FIRST.md`, `readme.md`, `TESTING.md`, and `AGENTS.md` only after the contract is approved;
- label `ProductRequiremtns.md` and `IMPLEMENTATION_PLAN.md` as historical long-term sources, not the active MVP plan;
- stop maintaining `tak-inline-capture` as a parallel source of truth after its history is safely preserved.

---

## 14. Claims That Must Not Be Made

- that the complete TAK product is implemented;
- that a local/browser test proves the live Apps Script deployment;
- that localStorage synchronizes with Google Sheets;
- that the existence of a Team schema means a finished team product;
- that a Project ID in v2 means a finished multi-project UX;
- that comments or Change History automatically constitute Status Notes;
- that a mobile full-screen modal is the desktop full-page task detail;
- that all 2,000-task performance goals are met;
- that the app has a secure agent API or task-claim workflow;
- that application roles override Google Sheets sharing permissions;
- that `tak-inline-capture` is the current release branch.

---

## 15. Final Summary

TAK has a strong technical foundation, and most of the original focused MVP is implemented locally or against a synthetic Apps Script adapter. The largest mistake now would be either to rewrite everything or to declare today’s SheetFlow a completed TAK product.

The correct path is:

1. verify and stabilize the current foundation;
2. approve the meanings of Team Home, Inbox, Project, Blocked, and Status Notes;
3. build the team-oriented Simple/Expanded workspace and direct editing;
4. add panel/full-page detail and standup without losing data or context;
5. only then expand into capacity, calendars, custom fields, agents, and enterprise permissions.

This preserves the investment already made in GSheetJira while establishing TAK as a clear, distinct product.
