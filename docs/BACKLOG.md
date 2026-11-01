# Process Improvements

- **PRC-01** `[Open]` — Minimize token usage by doing tests locally.
- **PRC-02** `[Open]` — Review and update `AGENTS.md` and other coding instructions.
- **PRC-03** `[Open]` — Update the README to match the code and setup process.

# Issues

- **ISS-01** `[Done · 2026-11-01]` — Existing issues open in the compact editor. More options opens the full details view.
- **ISS-02** `[Done · 2026-11-01]` — Use clear Gantt day, week, two-week and month scales while preserving task dates and drag/resize behavior.
- **ISS-03** `[Done · 2026-11-01]` — Sheet keyboard navigation keeps the focused cell visible around the pinned column and sticky header. Verified locally and in Apps Script; commit `3608c99`.
- **ISS-04** `[Open]` — Fix the spreadsheet's **Open tracker** link so it opens the deployed tracker.

# Improvements

- **IM-10** `[Open]` — Provide a ready-to-copy Google Sheets template with the complete bound SheetFlow Apps Script. Users should be able to make a copy, run `setupTracker`, and deploy a private web app without manually copying source files. Publish and verify the template before directing users to it.
- **IM-01** `[Open]` — Consider renaming the Sheet view to List view.
- **IM-02** `[Open]` — Allow users to edit comments, assignee and description without opening issue details.
- **IM-03** `[Open]` — Let users copy local demo issues into a separate test Google Sheet. Preserve issue IDs, hierarchy, assignees, labels and dates; preview differences and protect existing Sheet data. This is a one-time transfer, not automatic synchronization.
- **IM-04** `[Done · 2026-11-01]` — Getting started help describes shortcuts for view switching, search, new issue, the command palette and Escape.
- **IM-05** `[Open]` — Remove unnecessary information, such as issue numbers, from dashboards and compact dialogs.
- **IM-06** `[Open]` — The Sheet view displays the issue name twice: in the pinned ID column and again in the Summary column. See [`issue_sheet_twice_names.png`](../issue_sheet_twice_names.png).
- **IM-07** `[Open]` — Add controls to expand all swimlanes and collapse them again.
- **IM-08** `[Open]` — Optionally show team member holidays in Gantt so availability is clear.
- **IM-09** `[Open]` — Optionally connect people's calendars to Google Calendar; the user has a code proposal to review.
