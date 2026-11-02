
Start with a **manual smoke test in your separate test Google Sheet**. Allow about 20–30 minutes. You run the app; send me only failures and brief results.

**1. Confirm what you’re testing**

- Open the Google-backed app and use **Open Google Sheet**. Confirm it opens your test workbook.
- Record whether the app URL ends in `/dev` or `/exec`.
- In its Apps Script editor, run the existing **`startupHealthCheck`** function. Record success or the error.
- Record the last source revision uploaded, if known. Current local HEAD is `72f52ef`; a local build does not update Apps Script.

Do not run setup, migration or deployment commands for this check. If the workbook is production or the target is unclear, resolve that before creating test records.

**2. Test the ordinary workflows**

Use titles starting with `MVP-CHECK` so the records are easy to identify. Wait for save acknowledgement after each change.

|Test|What to do|Pass condition|
|---|---|---|
|Fast creation|In Kanban, create `MVP-CHECK A`, `B`, `C` using title + Enter|Exactly three records, correct status; input stays ready|
|Compact editor|Open A, expand More options, edit description and an advanced field, return to compact|Values remain; reopening restores saved values|
|Direct edits|Change A’s priority and assignee on its card|Both survive app reload and match the Sheet|
|Sheet editing|Edit B’s title, use Tab/Enter to continue|Focus stays useful; values persist|
|Epic grouping|Create two temporary Epics; group by Epic; move a standalone test task using Move|Correct parent/status after reload; grouping preference persists|
|Gantt|Give C start/due dates; move its bar, then resize its end|Expected dates survive reload|
|Filters/export|Search `MVP-CHECK`, switch views, export CSV|Matching test tasks remain consistent; CSV contains the filtered tasks|
|Native Sheet edit|Change B’s summary directly in the **active data tab**, then Refresh the app|App shows the changed summary|

If v2 is active, the legacy `Issues` tab is a snapshot—use the active task tab for the native edit.

**3. Check failure recovery**

Use an existing temporary task, not a new create:

1. Load the app, then set the browser’s DevTools Network setting to **Offline**.
2. Edit the task’s title.
3. Wait for failure or timeout—up to about 30 seconds.
4. Verify the draft remains available and the app does **not** report it saved.
5. Restore network access and use **Retry**.
6. Reload and confirm the title matches the Sheet.

If offline mode does not interrupt the request, record **“failure not simulated”**, rather than a pass.

**4. Check conflict protection**

Open the same test task in two browser tabs:

1. Load both tabs before editing.
2. Save a new title in tab A.
3. Without refreshing tab B, save a different title there.
4. Expect a conflict, retained draft and **Compare with latest**—no silent overwrite.

If tab B automatically refreshed first, the conflict was not exercised; report that.

**5. Send this short result**

```
Test workbook confirmed: yes/no
App: /dev or /exec
Uploaded revision: known revision / unknown
Startup health check: pass / error

Creation:
Compact editor:
Card edits:
Sheet keyboard:
Epic moves:
Gantt:
Filters/CSV:
Native Sheet edit:
Failure/retry:
Conflict:

Approximate save wait:
Failures: steps + expected result + actual result
```

Keep the temporary records until failures are diagnosed. This first pass establishes whether the live workflows work; accessibility and large-data performance remain separate checks.

```
  Worked for 48s • 10:54 AM
```


Issues to follow
1. **Open tracker** link remains a follow-up issue.
2. New Issue takes about 2.5 seconds
