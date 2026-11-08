# Slim & Modern UI Implementation Plan

> [!IMPORTANT]
> **Strict Guardrails for the Executing Model**
> 1. **Do not rename or remove DOM IDs, `data-*` attributes, `role`, or `aria-*` labels** used by [Client.html](file:///c:/Users/martin/Documents/GitHub/TAK/Client.html) or the Playwright `e2e/*.spec.mjs` suite.
> 2. **Keep elements keyboard-focusable and visible to Playwright:** Do not use `display: none` or `visibility: hidden` on interactive controls that tests click directly (such as `[data-issue-select]`, `[data-card-priority]`, `[data-card-assignee]`, `[data-board-move]`, `#gantt-expand-all`, `#gantt-collapse-all`, `#kanban-expand-all`, `#kanban-collapse-all`). Use borderless/transparent resting styles instead so Playwright can still click/focus them immediately.
> 3. **Preserve fixed Gantt vertical math unless updated in lockstep:** [`renderGantt()`](file:///c:/Users/martin/Documents/GitHub/TAK/Client.html#L2397-L2441) calculates SVG dependency connector `y` coordinates using row height `45` (`topOffset + row * 45 + 22`). Keep `.gantt-row { height: 45px }` or update both CSS and JS constants together in Slice 3.
> 4. **Always run `npm.cmd run check`** after every slice to regenerate `CoreScript.html` and `dist/index.html` and verify all 194 Node tests pass.

---

## Slice 1 — Design Tokens, CSS Consolidation & Slim Chrome

### Goal
Replace heavy mid-gray control borders and dated colors with a crisp, modern Linear/Notion-inspired slate palette, consolidate the 12 `<style>` blocks in [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html), and reduce top chrome height by ~35%.

### Files to Modify
* [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html)
* [Index.html](file:///c:/Users/martin/Documents/GitHub/TAK/Index.html)

### Exact Changes
1. **Update root tokens in [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L2-L17):**
   * `--ink: #0f172a` (crisp slate-900)
   * `--muted: #64748b` (slate-500)
   * `--canvas: #f8fafc` (ultra-clean slate-50 background)
   * `--surface: #ffffff`
   * `--surface-muted: #f1f5f9` (subtle slate-100 for columns/pills)
   * `--line: #e2e8f0` (hairline borders)
   * `--control-border: #cbd5e1` (softer interactive border; only darken to `#94a3b8` on `:hover`)
   * `--primary: #2563eb`, `--primary-dark: #1d4ed8`, `--primary-soft: #eff6ff`
   * `--purple: #6d28d9`, `--purple-soft: #f5f3ff`
   * `--radius-control: 6px`, `--radius-panel: 8px`
2. **Prune dead legacy CSS in [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L18-L25):**
   * Remove unused rules from the old sidebar layout (`.sidebar`, `.brand-mark`, `.workspace`, `.workspace-icon`, `.stats`, `.stat`, `.stat-number`, `.mini-progress`, `.page-heading`, `.tabs`, `.profile`, `.breadcrumb`).
3. **Slim `.topbar` & `.toolbar` ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L155-L214), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L391-L396)):**
   * Reduce `.topbar` from `min-height: 58px; padding: 10px var(--page-gutter)` to `min-height: 46px; padding: 6px var(--page-gutter)`.
   * Reduce desktop button/input/select heights in `.topbar` and `.toolbar` from `36px` to `30px` (`min-height: 30px`), keeping `@media (max-width: 700px)` at `40px–44px` so mobile touch target assertions in `e2e/` still pass.
   * Collapse `.workspace-controls` vertical padding when empty/hidden: set `.workspace-controls { padding: 4px 0 }` and `.workspace-controls:not(:has(.entry-active, #sheet-actions > *)) { display: none }` so Kanban and Gantt have zero wasted gap below `.toolbar`.
   * Replace heavy `border-color: var(--control-border)` on resting toolbar selects/buttons ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L125-L128)) with `1px solid var(--line)` and subtle hover fill `var(--surface-muted)`.

### Verification
* Run: `npm.cmd run check`
* Run: `npx.cmd playwright test e2e/gantt-epic-view.spec.mjs --workers=2 --retries=0 --reporter=line`

---

## Slice 2 — Quiet Kanban Cards & Slim Epic Swimlanes

### Goal
Eliminate the "90 visible form boxes" clutter on the Kanban board while keeping every card control directly clickable and keyboard-accessible.

### Files to Modify
* [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html)

### Exact Changes
1. **Slim columns and cards ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L215-L228), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L315-L340)):**
   * `.board`: `gap: 10px` (down from `14px`).
   * `.column`: `background: var(--surface-muted); border: 1px solid var(--line); border-radius: var(--radius-panel)`.
   * `.column-header`: `min-height: 34px; padding: 6px 10px; font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--ink)`.
   * `.card-list`: `padding: 8px`.
   * `.card`: `padding: 8px 10px; margin-bottom: 6px; border: 1px solid var(--line); border-radius: 6px; transition: border-color .12s, box-shadow .12s`. On `.card:hover`: `border-color: var(--control-border); box-shadow: 0 2px 5px rgba(15, 23, 42, 0.05)`.
2. **Quiet-at-rest card controls ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L323-L340)):**
   * Remove `border-top: 1px solid var(--line)` and lower `margin-top`/`padding-top` on `.card-footer` (`border-top: 0; margin-top: 6px; padding-top: 0`).
   * `.card-priority`: `appearance: none; padding: 1px 6px; min-height: 22px; border-radius: 4px; font-size: 11.5px; background: var(--surface-muted); border: 1px solid transparent` — looks like a clean pill badge until hovered/focused.
   * `.card-assignee-field input`: `height: 22px; font-size: 12px; color: var(--muted)` with `border-color: transparent; background: transparent` at rest; reveal border and surface background on `:hover` / `:focus`.
   * `.card-move` & `.card .issue-select`: Keep in DOM and clickable (`opacity: 0.45` at rest on desktop, `opacity: 1` on `.card:hover`, `.card:focus-within`, `.card.selected`, or `@media (max-width: 700px)`).
3. **Slim Epic swimlane headers ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L341-L362), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L398)):**
   * Replace the full purple header fill (`--epic-lane-surface: var(--purple-soft)`) with a clean white/neutral header (`--epic-lane-surface: #f8fafc`), keeping the `inset 3px 0 var(--epic-lane-accent)` left accent bar.
   * Reduce `.swimlane > .swimlane-header .swimlane-collapse` from `min-height: 48px` to `min-height: 36px; padding-block: 4px`.

### Verification
* Run: `npm.cmd run check`
* Run: `npx.cmd playwright test e2e/swimlane-progress.spec.mjs e2e/multi-selection.spec.mjs --workers=2 --retries=0 --reporter=line`

---

## Slice 3 — High-Density Sheet & Gantt Polish

### Goal
Give Sheet and Gantt a tight, modern spreadsheet/timeline density (`36px` Sheet rows, cleaner cell controls, full-viewport height).

### Files to Modify
* [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html)
* [Client.html](file:///c:/Users/martin/Documents/GitHub/TAK/Client.html) *(only if adjusting Gantt row height constant, otherwise CSS-only)*

### Exact Changes
1. **Expand Sheet & Gantt viewport height ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L19)):**
   * Change `.table-wrap, .gantt-viewport { max-height: 65vh }` to `max-height: calc(100dvh - 135px)` so large screens don't waste 35% of the viewport.
2. **Tighten Sheet rows & cells ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L403-L408)):**
   * `.issue-table th`: `height: 32px; padding: 4px 16px 4px 20px; font-size: 11.5px; color: var(--muted); background: var(--surface-muted)`.
   * `.issue-table td`: `height: 36px; padding: 2px 6px` on desktop (keep `54px` inside `@media (max-width: 700px)`).
   * `.issue-table .cell-input`: `height: 28px; padding: 3px 6px; font-size: 13px; border-radius: 4px`.
   * Make `.sheet-row-controls` more compact: `gap: 0`, and collapse the width of `[data-sheet-move]` buttons when not hovered/focused on fine pointers (`width: 0; min-width: 0; overflow: hidden; border: 0` when resting, `width: 17px; min-width: 17px` on `tr:hover` or `tr:focus-within`) so the task title aligns cleanly next to the drag grip `⠿`, while expanding immediately on row hover or keyboard focus.
3. **Gantt visual polish ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L19), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L86), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L387)):**
   * Keep `.gantt-row { height: 45px }` (preserving exact SVG dependency line coordinates in [`renderGantt()`](file:///c:/Users/martin/Documents/GitHub/TAK/Client.html#L2420-L2441)), but slim `.gantt-bar` to `top: 11px; height: 22px; border-radius: 6px; font-weight: 500; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06)`.
   * Make `.gantt-add-button` a quieter, compact pill (`min-width: 26px; min-height: 22px; font-size: 11px; color: var(--muted); border-color: transparent; background: transparent`) that reveals its border/tint on row hover or focus.
   * Compact `.gantt-tools` and `.sheet-tools` buttons to `height: 28px; font-size: 12px`.

### Verification
* Run: `npm.cmd run check`
* Run: `npx.cmd playwright test e2e/sheet-reparenting.spec.mjs e2e/gantt-epic-view.spec.mjs --workers=2 --retries=0 --reporter=line`

---

## Slice 4 — Sleek Inline Composer & Linear-Style Issue Dialog

### Goal
Condense the inline `.quick-entry` card and modernize `#issue-dialog` so creating and editing tasks feels lightweight and modern.

### Files to Modify
* [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html)

### Exact Changes
1. **Compact `.quick-entry.ghost-entry` ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L418-L456)):**
   * Reduce `.quick-entry.ghost-entry` padding to `6px 8px`, add a subtle elevation (`box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border-color: var(--primary)`).
   * Reduce `.quick-entry.ghost-entry #quick-title` desktop height from `44px` to `32px` (`padding: 4px; font-size: 13.5px; font-weight: 500`).
   * Make `#quick-smart-hint` (`@name · 5d workdays · !high`) `font-size: 11px; padding: 0 4px 2px; opacity: 0.75`.
   * Tighten `.quick-entry button` and `.quick-entry-options > summary` on desktop to `min-height: 26px; padding: 2px 6px; font-size: 11.5px` (preserving `min-height: 40px` in `@media (max-width: 700px)`).
2. **Linear-style `#issue-dialog` ([Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L19), [Styles.html](file:///c:/Users/martin/Documents/GitHub/TAK/Styles.html#L282-L313)):**
   * Style `input[name="summary"]` inside `#issue-dialog` as a clean, prominent title input: `font-size: 16px; font-weight: 600; padding: 6px 8px; border-color: transparent; background: var(--surface-muted)` that shows a crisp focus ring on edit.
   * Tighten `.create-dialog .dialog-header` (`padding: 12px 18px`), `.create-dialog .form-body` (`padding: 12px 18px`), and `.create-dialog .dialog-footer` (`padding: 10px 18px`).
   * Make `.quick-create .form-grid` a 3-column compact grid on desktop (`grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px`) with `height: 32px` selects/inputs so all primary properties sit in two tight rows instead of a tall form stack.

### Verification
* Run: `npm.cmd run check`
* Run: `npx.cmd playwright test e2e/compact-create.spec.mjs e2e/smart-entry.spec.mjs e2e/quick-entry-keyboard.spec.mjs --workers=2 --retries=0 --reporter=line`
