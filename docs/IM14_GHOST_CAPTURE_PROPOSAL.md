# IM-14 — Ghost Capture and Micro-Triage Proposal

**Status:** Approved for implementation on `implement_mvp_ui`  
**Scope:** MVP interaction refinement; no schema, dependency, persistence-adapter, or workflow changes  
**Requirements:** FR-02, FR-03, FR-09, FR-10, FR-11; UI/UX §§5, 9–12

## Decision

Replace the persistent shared quick-entry bar with one reusable **Ghost Capture** control rendered in the user's current work context. Keep the full editor behind `N`, `Shift+T`, `Shift+S`, and **Details**. Add focused-item **micro-triage** shortcuts that use the existing save/conflict path.

The result should feel absent until invoked, then require only a title and Enter. Mouse, touch, keyboard, and command-palette paths remain equivalent.

## Product goals

1. Capture a Task or Story without leaving Sheet, Kanban, or Gantt.
2. Preserve the currently focused item's hierarchy and visible status context.
3. Keep repeated entry ready after each successful submission.
4. Make common property changes possible without opening the editor.
5. Preserve drafts, operation IDs, save-state truth, conflict handling, filters, selection, focus, and scroll.
6. Avoid syntax that corrupts technical titles or surprises non-programmers.

## Non-goals

- Natural-language or token parsing such as `@alice`, `!high`, or `tomorrow`.
- Custom shortcuts, macros, agent workflows, schema changes, or a new command framework.
- Replacing the compact/full issue editor.
- Changing existing hierarchy, ordering, status, validation, or persistence semantics.

## Interaction model

### One control, many placements

Ghost Capture is the same component and state machine in every view:

- **Sheet:** a temporary row directly below the focused row, or the existing new-row position when no row is focused.
- **Kanban:** a temporary card in the focused card's status column and Epic lane, immediately after the focused card; otherwise at the column add position.
- **Gantt:** a temporary label row below the focused issue; it remains unscheduled unless dates are supplied later.
- **No issue context:** a compact workspace insertion row using the selected Epic filter when legal, otherwise no parent.

Only one Ghost Capture may be active. Moving views or invoking it elsewhere moves the visual control but never discards an unfinished draft.

### Invocation

| Input | Result |
|---|---|
| `T` | Open/resume Task Ghost Capture in current context |
| `S` | Open/resume Story Ghost Capture in current context |
| `Shift+T` / `Shift+S` | Open compact editor with identical contextual defaults |
| Visible `+ Add task` / new row | Open Task Ghost Capture in that surface |
| `N` | Open compact New issue editor |
| Command palette action | Run the same capture/editor action as its shortcut |

Single-key shortcuts remain disabled while typing, during IME composition, in dialogs, with unsafe modifiers, or when the user's **Single-key shortcuts** preference is off.

### Active Ghost Capture

The default active surface contains:

- one focused title input;
- quiet context text: type, status, and parent/lane when applicable;
- **Details** to continue in the compact editor without losing the title or defaults;
- **Clear** as the explicit destructive action;
- visible pending/failed/conflict feedback when applicable.

No permanent empty input occupies the toolbar. The inactive affordance is `+ Add task`, a sheet new-row hint, or nothing until the shortcut is pressed.

### Submission

- `Enter`: enqueue exactly one issue, retain immutable defaults and operation ID, then reset only the title for the next item.
- `Esc`: leave capture and restore origin focus; keep a non-empty draft for resume.
- `Clear`: discard the draft after an explicit pointer/keyboard action.
- Blank or whitespace-only titles do not submit.
- A failed submission remains visible/recoverable with Retry and Copy.
- Hidden-by-filter feedback explains where the created issue went.

## Context and ordering rules

### Parent

Use the existing legal hierarchy rules:

- Focused Epic/Story + `T`: child Task when legal.
- Focused Task/Bug + `T`: sibling using the focused item's parent.
- Focused Epic + `S`: child Story.
- Focused Story/Task/Bug + `S`: Story in the containing Epic when available, otherwise no parent.
- No focused issue: one selected row, then selected Epic filter, then no parent.

Hover never supplies context. The user may change the parent using the existing accessible parent picker before submission.

### Status

- Kanban: inherit the rendered column status.
- Sheet/Gantt: inherit the focused issue's status for contextual capture.
- No issue context: use Backlog.

### Rank

Place the new issue immediately after the focused sibling when both share the same legal parent and ordering scope. Otherwise append to the inherited parent/status scope using the existing rank allocator. Retries reuse the original rank/default snapshot and operation ID.

## Multiline paste

Pasting text containing line breaks into an empty Ghost Capture opens an inline batch preview instead of silently creating tasks.

- one non-empty trimmed line becomes one title;
- preserve order;
- show count and inherited context once;
- allow editing/removing lines before submission;
- maximum 100 items, matching existing batch constraints;
- submit through existing batch operation IDs and retry semantics;
- `Esc` returns to the single-title draft without data loss.

Single-line paste remains normal text input. No smart parsing is performed.

## Focused-item micro-triage

Micro-triage applies only when exactly one issue surface owns focus or selection and no editor/input/menu/dialog is active.

| Key | Action | UI behavior |
|---|---|---|
| `P` | Priority | Open anchored priority picker |
| `A` | Assignee | Open anchored assignee editor/picker |
| `M` | Status/move | Open status picker; existing move rules remain authoritative |
| `D` | Due date | Open compact due-date control |
| `E` | Edit | Open compact issue editor |
| `X` | Select | Toggle the issue selection without deleting or mutating it |
| `Enter` | Open | Open compact issue editor |

Rules:

- Never use a single key for deletion.
- Pickers are visible, keyboard navigable, touch reachable, and announced accessibly.
- Mutations use the current optimistic/pending/failed/conflict pipeline.
- Escape closes the picker and restores focus to the issue.
- Command palette entries call the same actions; no duplicate mutation code.

## Accessibility and discoverability

- Visible `+ Add task`, **New task**, **Details**, and issue menus provide non-shortcut paths.
- Shortcuts Help shows context and states, not merely a key list.
- Ghost Capture uses a real label/accessibility description including inherited type/status/parent.
- Keyboard focus has a visible ring; errors use text, not color alone.
- Pointer targets remain practical on touch; placement must not depend on hover.
- At 200% zoom or narrow width, context wraps while the title input and submit path remain usable.
- Focus returns to the originating issue/add affordance after exit and to the created item only when requested, avoiding scroll jumps during repeated capture.

## Performance constraints

- Opening capture performs no backend request and should update only the local insertion region.
- Submission uses existing loaded data and mutation queues; no full reload.
- Do not rebuild unrelated view DOM merely to show/hide Ghost Capture.
- Measure opening, title submission feedback, and repeated creation with the 2,000-task fixture; targets remain local feedback p95 <100 ms and loaded-view action p95 <150 ms.

## Delivery slices

### IM-14.1 — Context fidelity

- Inherit Sheet/Gantt status from the focused issue.
- Preserve legal parent defaults.
- Allocate sibling-relative rank when safe.
- Freeze defaults and operation IDs per queued submission.

### IM-14.2 — Ghost Capture surface

- Remove the persistent toolbar entry.
- Reuse one capture state machine in Sheet, Kanban, and Gantt placements.
- Keep draft resume, Details handoff, repeated Enter, failure recovery, and focus restoration.

### IM-14.3 — Multiline paste

- Detect multiline paste.
- Show editable batch preview.
- Submit with existing batch idempotency and recovery semantics.

### IM-14.4 — Micro-triage

- Add P/A/M/D/E/X only for a safely focused issue.
- Reuse existing editors/mutations.
- Add command-palette and Help parity.

## Acceptance checks

1. Create three Tasks consecutively in each view; titles, type, status, parent, rank order, save states, and operation IDs are correct.
2. Start a draft, press Esc, change view, invoke capture, and recover the exact draft and original context.
3. Use Details and Shift shortcuts; title and all contextual defaults transfer without duplication.
4. Simulate delayed, failed, retried, and conflicting creates; no title is lost or submitted twice.
5. Paste 3 and 100 lines; preview, edit, submit, retry, and order remain correct.
6. Verify P/A/M/D/E/X on Sheet rows, Kanban cards, and Gantt labels with keyboard and pointer alternatives.
7. Verify shortcuts never fire in inputs, dialogs, menus, IME composition, or when single-key shortcuts are disabled.
8. Verify active filters, selection, focus, and scroll survive capture and triage.
9. Verify local mode honestly says browser-local and Apps Script mode does not claim success before acknowledgement.
10. Run Node checks, focused Playwright flows, desktop/narrow keyboard smoke, and record that live Apps Script verification remains separate.

## Risks and controls

| Risk | Control |
|---|---|
| Invisible shortcuts reduce discoverability | Keep visible Add/New/menu actions and contextual Help |
| Context changes while requests are queued | Freeze defaults/rank/operation ID at enqueue time |
| Focused status conflicts with hierarchy/filter context | Validate through existing Core/server rules; retain failed draft |
| New rank collides after remote edits | Use existing allocator/version conflict path; never overwrite silently |
| Shortcut collisions while typing | Central guard for inputs, menus, dialogs, modifiers, IME, and preference |
| Ghost placement causes full rerenders | Reuse local view insertion points and targeted state updates |
| Advanced title parsing damages technical text | No token or natural-language parsing in MVP |
