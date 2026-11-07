Here is a deep-dive technical audit of the TAK codebase, focusing specifically on **usage speed** (against your 2,000-task dataset, <100 ms local feedback, <150 ms view navigation, and <2 s Apps Script save targets), **functional and concurrency bugs**, and **architectural/contract compliance**.

---

### A) Usage Speed & Scaling Bottlenecks (2,000-Task Target)

Your speed rules require local feedback p95 < 100 ms and loaded-view navigation p95 < 150 ms on a 2,000-task dataset, with Apps Script saves < 2 s. Several hot paths currently scale as $O(N^2)$ or force full-DOM teardown on routine edits:

* **Full DOM rebuild (`innerHTML`) on almost every state mutation (`Client.html`):**
* **The bottleneck:** `persist()` has a surgical fast path *only* for a single-field `priority` edit in the Sheet view (`directSheetPriority`). Changing any other field inline in the Sheet (`summary`, `status`, `assignee`, `dueDate`, `estimate`), typing a single character into `#search` (`input` event without debounce), or completing a save in Kanban/Gantt calls `render()`, which rebuilds the entire `#view-content.innerHTML` from scratch.
* **Impact at 2,000 tasks:** In Sheet view with 6 columns, 2,000 rows generate ~12,000 DOM nodes plus thousands of `<select>` and `<input>` elements, plus a `ResizeObserver` reconnection on every keystroke or cell blur. This will easily exceed 150–400 ms per keystroke in `#search` and per cell edit.
* **Fix:** Add a targeted row/card update path in `persist()` when filters, sort keys, and hierarchy (`parentId`, `status` in Kanban) are unaffected; debounce `#search` input by 60–100 ms (or use `requestAnimationFrame`); and avoid tearing down the Sheet `<table>` when updating scalar cells.


* **$O(N^2)$ linear scans inside `renderBoard` and `boardScopeItems` (`Client.html`):**
* **The bottleneck:** When `state.swimlanes` is enabled on the Kanban board, `renderBoard` filters `pending` items and `boardScopeItems` filters `state.issues` by calling `state.issues.some(epic => epic.type === 'Epic' && inEpicWithin(item, epic.id))` for *every* issue. Inside `renderColumns`, `items.filter(i => i.status === status)` runs 5 times per swimlane.
* **Impact at 2,000 tasks:** With 30 Epics and 2,000 tasks, checking `hasEpic` via nested `inEpicWithin` walks costs up to $2,000 \times 30 \times \text{depth}$ iterations per column/lane.
* **Fix:** Precompute a `Map<issueId, rootEpicId>` once inside `indexedIssues()` in $O(N)$ time, reducing `inEpic()`, `inEpicWithin()`, `boardEpicId()`, and `epicLanes()` to $O(1)$ lookups.


* **$O(N^2)$ Epic schedule derivation across filtered views (`Core.js` & `Client.html`):**
* **The bottleneck:** `effectiveDates(issue)` calls `C.epicScheduleRange(epic.id, state.issues)` for each Epic. Inside `epicScheduleRange`, it builds `new Map(issues.map(...))` and iterates over all 2,000 issues for *each* Epic.
* **Impact at 2,000 tasks:** With 40 Epics, rendering the Gantt view or filtering by `startAfter`/`dueBefore` scans the 2,000-issue array 40 separate times (80,000 iterations + 40 Map allocations).
* **Fix:** Compute all Epic schedule ranges in a single bottom-up pass inside `indexedIssues()` whenever `state.issues` changes.


* **$O(N^2)$ validation in `TrackerCore.validate` and batch operations (`Core.js`):**
* **The bottleneck:** `TrackerCore.validate(issue, issues)` clones the array, builds `byId`, checks all children, and then runs a parent-cycle check across **every issue in the project** (`all.forEach(...)`), not just the ancestor chain of `issue`. Worse, `bulkEditPreviewData()`, `updateIssuesBatch()`, and `duplicateIssue()` call `C.validate(candidate, projected)` inside a loop for up to 100 items.
* **Impact at 2,000 tasks:** Previewing or submitting a 100-item bulk edit executes $100 \times 2,000 = 200,000$ cycle-check loops on the main thread (and inside the 20s Apps Script lock on the server).
* **Fix:** In `TrackerCore.validate(issue, issues)`, only walk the ancestor chain and dependency subgraph starting from `issue.id` ($O(\text{depth} + E)$). For batch operations (`bulkEditPreviewData`, `updateIssuesBatch`, `duplicateIssue`), call `TrackerCore.validateProject(projected)` **once** on the projected state.


* **Apps Script `saveIssue` latency in Team / Default mode (`Code.js`, `History.js`, `Settings.js`):**
* **The bottleneck:** While `personal` mode uses `Sheets.Spreadsheets.Values.batchGet` and `batchUpdate`, the default `team` mode runs `SpreadsheetApp`:
1. `getBook_()` opens the spreadsheet and reads `Issues!A1:U1` (`assertHeaders_`).
2. `readSystemRows_()` reads all of `_System!A2:B`.
3. `readIssues_()` reads all of `Issues!A2:U` and computes **2,000 SHA-256 digests** via `Utilities.computeDigest` unless `snapshot.onlyVersionFor` is passed (note: `moveIssue`, `deleteIssue`, `updateIssuesBatch`, and `duplicateIssue` do **not** pass `onlyVersionFor`, hashing all 2,000 rows on every move/delete!).
4. `reserveUpdate()` writes to `_System` and calls `SpreadsheetApp.flush()` (network round-trip #1).
5. `writeIssue_()` writes the row, optionally writes `TASK_TYPE:` to `_System`, and calls `SpreadsheetApp.flush()` (network round-trip #2).
6. `readWrittenIssue_()` reads the row back.
7. `recordAndReceipt()` calls `sheet.getLastRow()` on `Change History` and `_System` (which forces an implicit Apps Script read flush), writes both rows, and calls `SpreadsheetApp.flush()` (network round-trip #3).


* **Impact:** Three sequential `SpreadsheetApp.flush()` calls plus 2,000 `Utilities.computeDigest` calls in `moveIssue` easily push Team-mode saves to 2.5–5.0 seconds.
* **Fix:** Pass `onlyVersionFor: id` in `moveIssue` and `deleteIssue`; pass `onlyVersionForSet` for `updateIssuesBatch`; and in `History.js`, pass the known `_System` row count from `systemRows` instead of calling `sheet.getLastRow()` again.


* **Unbounded `_System` and `Change History` growth (`Code.js`, `History.js`):**
* Every save appends an `IDEMPOTENCY:<opId>` row and an `IDEMPOTENCY_UPDATE_PENDING:<opId>` row to `_System`. Over 5,000 edits, `_System` grows to 10,000+ rows, and `readSystemRows_` / `readPersonalSaveBook_` pulls the entire `_System` tab on every single save.
* **Fix:** Reuse the reservation row in `_System` when writing the final `IDEMPOTENCY:` receipt (updating `IDEMPOTENCY_UPDATE_PENDING:<opId>` in place to `IDEMPOTENCY:<opId>`), and periodically prune receipts older than N days or cap the active receipt window.



---

### B) Functional, Concurrency & Data-Safety Bugs

1. **Duplicate / Quick-Add / Dialog `rank` scale mismatch (`Core.js`, `Client.html`, `Code.js`):**
* **The bug:** In `Core.js`, `blank()` sets `rank: Date.now()` ($\approx 1.76 \times 10^{12}$). When a user creates an issue via the full Dialog (`openIssue` -> `saveForm`) or `quickCreateIssue` (Sidebar) or `createQuickTask`, `input.rank` is omitted, so `C.prepare()` inherits `blank().rank` (`Date.now()`).
* **How it breaks ordering:** Next, when the user duplicates an issue (`duplicateIssue`), moves a card to the end of a column, or appends in Gantt/Sheet, the code calculates the new rank as `maxRank + 1000`. Once *any* issue in a column/parent has a `Date.now()` rank ($1.76 \times 10^{12}$), `maxRank + 1000` is $1.76 \times 10^{12} + 1000$. Even worse, in IEEE-754 double precision, averaging two `Date.now()` ranks that differ by less than a few milliseconds or repeatedly bisecting numbers at $10^{12}$ loses mantissa precision $40\text{ bits}$ faster than small integers ($1000, 2000, \dots$), causing `sheetRankForDrop` (`Number.EPSILON * Math.abs(left) * 8`) to hit its precision floor after only ~10 drag-and-drop reorders between two `Date.now()`-ranked tasks!
* **Fix:** Never use `Date.now()` as default `rank` in `prepare()` when creating a new issue; assign `(maxSiblingRank || 0) + 1000` on create, or normalize ranks cleanly.


2. **Personal-mode `CacheService` metadata desync on Delete, Duplicate, and Bulk Edit (`Code.js`):**
* **The bug:** `personalSaveMetadata_` caches `{ sheetId, rowCount }` for `Issues` and `_System` in `CacheService` for 30 seconds. `savePersonalIssueBatch_` invalidates this cache when `appendDimension` grows the sheet. However, `deleteIssue` (which calls `sheet.deleteRow`, shrinking `maxRows` by 1), `undoDuplicateIssues` (`deleteRow`), `duplicateIssue` (`ensureRows_`), and `updateIssuesBatch` do **not** call `invalidatePersonalSaveMetadata_(book.getId())`.
* **How it breaks:** If a user in personal mode deletes 5 issues (reducing `Issues` maxRows) and within 30 seconds adds a task when the sheet is near capacity, `planPersonalIssueWrite_` relies on the stale cached `rowCount`, skips `appendDimension`, and `Sheets.Spreadsheets.batchUpdate` fails with an out-of-bounds range error.
* **Fix:** Call `invalidatePersonalSaveMetadata_(book.getId())` inside `deleteIssue`, `duplicateIssue`, `undoDuplicateIssues`, and `updateIssuesBatch`.


3. **Timezone shift in `readPersonalSaveBook_` breaks optimistic concurrency hashes (`Code.js`):**
* **The bug:** In `readPersonalSaveBook_`:
```javascript
var local = new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, -1);
return Utilities.parseDate(local, zone, "yyyy-MM-dd'T'HH:mm:ss.SSS");

```


And in `planPersonalIssueWrite_`:
```javascript
var local = Utilities.formatDate(new Date(value), zone, "yyyy-MM-dd'T'HH:mm:ss.SSS");
return { userEnteredValue: { numberValue: Date.parse(local + 'Z') / 86400000 + 25569 } ... };

```


* **How it breaks:** When a row is written by `SpreadsheetApp` (e.g., during `loadSampleData`, `updateIssuesBatch`, `moveIssue`, or `handleSheetEdit`), `toRow_` writes `new Date(value)` directly. Google Sheets converts `Date` objects to serial numbers in the spreadsheet's local timezone. However, for `date` fields (`startDate`, `dueDate`, `completedDate`), `planPersonalIssueWrite_` writes `Date.parse(value + 'T00:00:00Z') / 86400000 + 25569` (midnight UTC). When `SpreadsheetApp` later reads that cell in `readIssues_` (`Utilities.formatDate(v, zone, 'yyyy-MM-dd')`), if the spreadsheet timezone is behind UTC (e.g., Americas) or if `readPersonalSaveBook_` parses `00:00:00.000` in `zone` and `issueFromRow_` formats it, the date or timestamp can shift or produce a different `.toISOString()` millisecond value than what was hashed into `saved.version` during `planPersonalIssueWrite_`. That causes the very next edit to fail with a false `"This issue changed elsewhere"` conflict!


4. **Missing `moveIssue` handler in local browser RPC (`Client.html`):**
* **The bug:** `persist()` checks `mutation === 'moveIssue' && isCloud ? await rpc('moveIssue', ...) : await rpc('saveIssue', ...)`. While this guards the call inside `persist()`, `rpc()` itself has no `if (method === 'moveIssue')` implementation for standalone browser mode. Any direct call or future refactor calling `rpc('moveIssue', ...)` in local mode throws `Unknown operation.`


5. **Kanban keyboard reorder (`moveCardWithKeyboard`) lacks float-underflow and rank-collision guards (`Client.html`):**
* **The bug:** Unlike `sheetRankForDrop` and `ganttSiblingRank`, `moveCardWithKeyboard` computes `rank = (targetRank + previousRank) / 2` with no check for `targetRank === previousRank` or epsilon exhaustion. If two cards share the same rank (e.g. from a sheet edit or bulk paste), `Alt+ArrowUp/Down` computes the exact same `rank`, hits `if (status === issue.status && rank === issue.rank) return;`, and silently refuses to move the card.


6. **Child-issue navigation inside the Issue Dialog loses focus or fails when `state.busy` (`Client.html`):**
* **The bug:** When clicking a child issue in `#child-issues`, the listener runs:
```javascript
if (target && closeIssue()) openIssue(target.dataset.child);

```


Calling `closeIssue()` triggers `dialog.close()`, which queues a `close` event on `dialog`. Then `openIssue(target.dataset.child)` synchronously re-opens the dialog (`dialog.showModal()`) and focuses `form.elements.summary`. When the queued `close` event from `dialog.close()` fires on the next microtask/tick, the `close` listener (`if (dialog.open) return;`) bails out, **or** in some browsers `close` fires before `openIssue` finishes and resets `issueReturnFocus = null`. Worse, switching to a child issue shouldn't close and re-open the native `<dialog>` modal at all—it causes a visual flash and screen-reader announcement churn. Just check unsaved changes and call `openIssue(target.dataset.child)` in place.


7. **Unbounded `localStorage` growth for `sheetflow.local-receipts.v1` (`Client.html`):**
* Every local batch create, duplicate, and bulk edit writes full issue objects into `sheetflow.local-receipts.v1` and never prunes old receipts. Unlike `undoStack` (which is sliced to `-50`), `localReceiptStorageKey` will eventually exhaust the 5 MB `localStorage` quota and cause `saveDraft` to throw `"Browser storage is unavailable"`.



---

### C) Governance, UX & Accessibility Polish (`AGENTS.md` Compliance)

* **Working Agreement Boundary Violations (`AGENTS.md`):**
* **Committed IDs:** `.clasp.json` contains an Apps Script `scriptId`, and `Help.html` hardcodes a Google Sheet template ID. Verify whether both are intentional public starter IDs or whether `.clasp.json` violates *"Do not commit credentials, tokens, private Sheet IDs, `.clasp` secrets"*.


* **Agentic remnants:** `Authorization.js` defines the `'agent'` role and `'agentWorkflow'` capability, and `Code.js` (`handleVersionedSheetEdit_` / `managedMetadata_`) still references `'Claimed By'`, `'Claimed At'`, and `'Last Agent Activity'`.




* **UX & Accessibility Gaps:**
* **Unsaved draft loss on Escape/Cancel in Issue Dialog (`Client.html`):** `AGENTS.md` states: *"Dialogs must trap/restore focus, support Escape appropriately and preserve unsaved drafts."* Currently, `closeIssue()` prompts `confirm('Discard your unsaved changes?')` if `formSnapshot() !== initialForm` (i.e. within the 700 ms debounce window before `autosaveForm` fires), and if the user clicks OK, those typed characters are lost rather than saved as a local draft. Meanwhile, if the user waited 700 ms, `autosaveForm()` *already mutated the server/local issue* without the user clicking "Save issue"! That hybrid behavior (autosaving after 700 ms while having a "Cancel" button and a "Discard your unsaved changes?" prompt) is contradictory: pressing "Cancel" 800 ms after typing does **not** cancel the edit because `autosaveForm` already persisted it and updated `initialForm`.


* **Bulk Create / Bulk Edit / Saved View dialogs lack custom focus return (`Client.html`):** While `#issue-dialog` and `#command-dialog` carefully track `issueReturnFocus` and `commandReturnFocus`, `#bulk-create-dialog`, `#bulk-edit-dialog`, `#saved-view-dialog`, and `#help-dialog` rely on default browser `<dialog>` focus restoration, which fails when the trigger button (like `[data-bulk-edit-open]` or `#bulk-create-open` inside a closed `<details>` menu) is re-rendered or hidden during `render()`.




* **Missing files in the uploaded archive snippet:**
* Note that `Index.html` is truncated mid-line at `<label class="field">Estimate (hours)<in...`, and `Styles.html`, `Schema.js`, `Migrations.js`, `Repository.js`, `Settings.js`, `Ordering.js`, `PersonalBatch.js`, `QuickAdd.html`, `scripts/build.mjs`, and `tests/` were not included in the extracted stream.





---

### Recommended Action Plan (Small, Reviewable Slices)

1. **Slice 1 — Core Speed & Indexing (`Core.js`, `Client.html`):**
* Precompute `epicByIssueId` and `epicSchedules` in `indexedIssues()` ($O(N)$ once per state change instead of $O(N^2)$ per render).
* Optimize `TrackerCore.validate(issue, issues)` to only walk the target issue's ancestor path and dependency subgraph, and use `validateProject` once for batch validations.
* Pass `onlyVersionFor` in `moveIssue` and `deleteIssue` (`Code.js`) so moving a card on a 2,000-task Sheet doesn't compute 2,000 SHA-256 hashes.


2. **Slice 2 — Rank Integrity & Personal Cache Safety (`Core.js`, `Code.js`, `Client.html`):**
* Replace `rank: Date.now()` on new issues with sibling-relative rank (`maxRank + 1000`), and add the epsilon/collision guard to `moveCardWithKeyboard`.
* Add `invalidatePersonalSaveMetadata_(book.getId())` to `deleteIssue`, `duplicateIssue`, `undoDuplicateIssues`, and `updateIssuesBatch`.
* Add `moveIssue` fallback in local `rpc()` and cap `sheetflow.local-receipts.v1` to the most recent 200 entries.


3. **Slice 3 — DOM Render & Dialog UX (`Client.html`):**
* Avoid full `render()` table teardown on scalar Sheet cell edits and debounce `#search` input.
* Fix `#child-issues` navigation so it updates the open dialog in place without calling `dialog.close()` + `dialog.showModal()`.



Let me know which slice you want to tackle first (or share `PersonalBatch.js` and the rest of `Index.html` if you'd like those inspected before we start Slice 1).