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

- **IM-10** `[Done]` — Publish a blank TAK Google Sheets template with the complete bound Apps Script. Users make a copy, run `setupTracker`, and create their own private web-app deployment without manually copying source files. Before publishing, verify that a copied template works and that it contains no user data, private IDs or existing deployment configuration.
- **IM-01** `[Open]` — Consider renaming the Sheet view to List view.
- **IM-02** `[Open]` — Allow users to edit comments, assignee and description without opening issue details.
- **IM-03** `[Open]` — Let users copy local demo issues into a separate test Google Sheet. Preserve issue IDs, hierarchy, assignees, labels and dates; preview differences and protect existing Sheet data. This is a one-time transfer, not automatic synchronization.
- **IM-04** `[Done · 2026-11-01]` — Getting started help describes shortcuts for view switching, search, new issue, the command palette and Escape.
- **IM-05** `[Open]` — Remove unnecessary information, such as issue numbers, from dashboards and compact dialogs.
- **IM-06** `[Open]` — The Sheet view displays the issue name twice: in the pinned ID column and again in the Summary column. See [[issue_sheet_twice_names.png]]
- **IM-07** `[Open]` — Add controls to expand all swim lanes and collapse them again.
- **IM-08** `[Open]` — Optionally show team member holidays in Gantt so availability is clear.
- **IM-09** `[Open]` — Optionally connect people's calendars to Google Calendar; the user has a code proposal to review.
- **IM-11** `[Open]` — Milestone type task addition , displayed as diamond on Gant view
- **IM-12** `[Open]` — Improve mobile view and usage like trelo
- **IM-13** `[Open]` — Improve colors not to mimic Jira too much
- **IM-14** `[Implemented · live verification pending]` — Shared keyboard entry across Sheet, Kanban and Gantt.
  - T/S focuses title-only task/story entry; Shift+T/S opens the compact editor. Enter supports repeated creation; Escape resumes the originating item and retains unfinished text; Clear discards it.
  - Focus/selection supplies a visible, frozen parent. Epic/Story creates child tasks; Task/Bug creates sibling tasks; new Stories use the containing Epic. No hover-based context.
  - Start date defaults to today and stays fixed through queue delays/retries. Existing column status defaults and failed-save recovery remain supported.
  - Arrow navigation selects visible rows/cards without moving work. Existing Alt+arrow movement remains available. Single-key shortcuts can be disabled in Help.
  - Acceptance: keyboard-only creation/context, compact handoff, selection and filter fallback, grouped/collapsed navigation, moved ID column, typing/IME guards, durable queues, failures/retries, midnight dates and responsive controls. Local/simulated-cloud checks are recorded in docs/IM14_VERIFICATION.md; private Google-copy verification precedes any live release.
- **IM-15** `[Open]` - CLI
