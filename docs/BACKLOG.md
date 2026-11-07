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
- **IM-14** [Open] — create a plan and imeplent UI and shortcuts to be easier
	- Applies to all views
		- new task entry quickly without opening even details "t", under given epics is selected or mouse is over
		- new task entry quickly with  opening  compact details "Shift+t", under given epics is selected or mouse is over
		- start date is always default today
		- Same for story s and Shift+S
- 
