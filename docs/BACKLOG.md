# Process Improvements

- **PRC-01** `[Open]` — Minimize token usage by doing tests locally.
- **PRC-02** `[Open]` — Review and update `AGENTS.md` and other coding instructions.
- **PRC-03** `[Open]` — Update the README to match the code and setup process.
- **PRC-04** `[Open]` — Confirm whether saved views in `implement_mvp` are approved for this release; the MVP requirements place them in P2. Keep the release decision separate from the two data-safety fixes below.

# Issues

- **ISS-01** `[Done · 2026-11-01]` — Existing issues open in the compact editor. More options opens the full details view.
- **ISS-02** `[Done · 2026-11-01]` — Use clear Gantt day, week, two-week and month scales while preserving task dates and drag/resize behavior.
- **ISS-03** `[Done · 2026-11-01]` — Sheet keyboard navigation keeps the focused cell visible around the pinned column and sticky header. Verified locally and in Apps Script; commit `3608c99`.
- **ISS-04** `[Open]` — Fix the spreadsheet's **Open tracker** link so it opens the deployed tracker.
- **ISS-05** `[Open · P1]` — Make standalone batch creation idempotent across storage failures and retries. At `implement_mvp` commit `e6eddcb`, `Client.html` writes an issue before separately storing its operation receipt; if the receipt write fails, retry can create a duplicate. Commit issue data and retry identity together, then test a failed receipt write and retry to confirm exactly one issue exists.
- **ISS-06** `[Open · P1]` — Persist bulk-edit retry details across reloads. At `implement_mvp` commit `e6eddcb`, `Client.html` keeps `bulkEditDraft` only in memory, losing its operation IDs after an uncertain save and reload. Restore the immutable batch and provide a safe retry/reconciliation path; test timeout, reload and retry in local and simulated Apps Script modes.

# Improvements

- **IM-10** `[Done]` — Publish a blank TAK Google Sheets template with the complete bound Apps Script. Users make a copy, run `setupTracker`, and create their own private web-app deployment without manually copying source files. Before publishing, verify that a copied template works and that it contains no user data, private IDs or existing deployment configuration.
- **IM-01** `[Open]` — Consider renaming the Sheet view to List view.
- **IM-02** `[Open]` — Allow users to edit comments, assignee and description without opening issue details.
- **IM-03** `[Open]` — Let users copy local demo issues into a separate test Google Sheet. Preserve issue IDs, hierarchy, assignees, labels and dates; preview differences and protect existing Sheet data. This is a one-time transfer, not automatic synchronization.
- **IM-04** `[Done · 2026-11-01]` — Getting started help describes shortcuts for view switching, search, new issue, the command palette and Escape.
- **IM-05** `[Open]` — Remove unnecessary information, such as issue numbers, from dashboards and compact dialogs.
- **IM-06** `[Done · 2026-11-05]` — Sheet pins Summary by default and places selection, hierarchy and reorder controls there. The optional ID column shows only the stable key, eliminating the duplicate issue name.
- **IM-07** `[Open]` — Add controls to expand all swim lanes and collapse them again.
- **IM-08** `[Open]` — Optionally show team member holidays in Gantt so availability is clear.
- **IM-09** `[Open]` — Optionally connect people's calendars to Google Calendar; the user has a code proposal to review.
- **IM-11** `[Open]` — Milestone type task addition , displayed as diamond on Gant view
- **IM-12** `[Open]` — Improve mobile view and usage like trelo
- **IM-13** `[Open]` — Improve colors not to mimic Jira too much
- **IM-14** `[Implemented on implement_mvp_ui · live verification pending]` — Contextual Ghost Capture and focused-item micro-triage across Sheet, Kanban and Gantt.
  - T/S opens one temporary title-only capture beside the focused work; Shift+T/S opens the compact editor. Visible Add controls use the same state machine. The toolbar has no permanent empty entry field.
  - Parent, status and sibling-relative rank inherit legal focus/lane context and freeze with the operation ID. Enter supports repeated creation; Escape hides but retains unfinished work; Clear explicitly discards it.
  - Multiline paste opens an editable preview for up to 100 ordered titles without smart parsing. Existing durable queues, pending/failed/conflict states and retries remain authoritative.
  - P/A/M/D opens focused priority/assignee/status/due-date controls; E opens details and X toggles selection. Commands expose the same actions. Typing, IME, modifiers, dialogs and the single-key preference guard every shortcut.
  - Acceptance: keyboard/mouse/touch creation, compact handoff, context/rank fidelity, multiline order, micro-triage, selection/filter/focus retention, durable failures/retries and responsive controls. Local/simulated-cloud checks are recorded in `docs/IM14_VERIFICATION.md`; private Google-copy verification precedes any live release.
- **IM-15** `[Open]` - CLI

## Future ideas — discussion on 2026-11-07

These items are recorded as **Future / Open**, not approved MVP scope or implemented capabilities. Each requires a separate scope, UX, data-safety and security review before implementation. Preserve the standalone/local and Google Sheets modes without implying synchronization between them.

- **IM-16** `[Future · Open]` — **Optional GitHub Integration per TAK Google Sheet copy**
  - **Goal:** Let a team see related development work from its own repository without turning TAK into a workflow automation or agent orchestration tool.
  - **Connection:** Each Google Sheet copy can manually connect its own GitHub repository. Configuration and authorization belong to that copy; copying a template must not silently reuse another team's credentials or private repository access.
  - **Linking and display:** Match a stable TAK task ID mentioned in a PR or commit to the corresponding task. Display only the related PR link and PR status in TAK; a commit mention is a matching source, not a new commit-feed feature.
  - **Workflow:** Preserve the current task states: Backlog / To Do / In Progress / Review / Done. PR opening, closing or merging must not automatically change task status, ownership, ordering or workflow.
  - **Refresh:** Use Apps Script background polling for the connected copy, with bounded frequency, quota/rate-limit handling and visible last-refresh/error information. Polling must not depend on keeping the TAK browser tab open.
  - **Access safety:** Review least-privilege repository access, safe credential storage, revocation/disconnection and who can view private PR metadata. Do not expose secrets in the browser, copied templates, source control or logs; do not assume Sheet sharing alone authorizes GitHub access.
  - **Acceptance:** Two independent copies can connect different repositories without leaking settings or access; task-ID matching shows the correct PR and status; polling failures are clear; task workflow remains unchanged.

- **IM-17** `[Future · Open]` — **Smart Quick Notepad**
  - **Goal:** One clean, keyboard-first window for capturing tasks during a standup without repeatedly opening task forms.
  - **Default parsing:** Use a local, deterministic parser without AI for syntax such as `Task @Person #Epic +5d !high`. Resolve people and epics against existing records and offer immediate autocomplete while typing.
  - **Interaction:** Support keyboard navigation and suggestion acceptance, multiple task lines, and an editable preview of parsed titles, assignees, epics, dates and priorities before batch create.
  - **Validation:** Make unknown or ambiguous people/epics and invalid tokens visible in the preview rather than silently inventing records. Define relative-date semantics, including calendar versus working days, before implementation.
  - **Optional AI:** Gemini may be explicitly enabled for free-text interpretation. Structured syntax and normal capture must work without it; review data sharing and credentials separately. AI suggestions remain editable and require the same preview/validation.
  - **Reliability:** Preserve drafts on close, reload, parsing errors and save failures. Retain failed or unconfirmed batch items for safe retry without duplicate creation, using existing hierarchy, ID and persistence safeguards.
  - **Acceptance:** A standup list can be captured, autocompleted, corrected and batch-created with the keyboard and no AI; failures retain recoverable drafts. This is a future extension of IM-14's plain multiline preview, not a change to its current contract.

- **IM-18** `[Future · Open]` — **Manual Product Roadmap Editor**
  - **Goal:** Build a presentation-ready customer roadmap that is maintained separately from the internal delivery forecast and operational Gantt.
  - **Canvas:** Provide monthly and quarterly timeline scales, labeled initiative rectangles that can be dragged and resized, and diamond-shaped milestones.
  - **Structure:** Support multiple rows for products, areas or customers, with initiative value and priority available to guide planning.
  - **Planning model:** Keep dates, durations and layout manually controlled. Customer presentation plans must not automatically overwrite internal forecast/task dates or be silently recalculated from them.
  - **Sharing outputs:** Save roadmap versions and export the chosen version to PDF and PowerPoint (PPT/PPTX), preserving readable labels, rows, periods and milestones.
  - **Later option:** Linking initiatives to existing epics may be considered separately; it is optional future work, not a prerequisite for the manual editor.
  - **Acceptance:** A user can create and revise a multi-row quarterly/monthly plan, move/resize initiatives, place milestones, reopen a saved version and export it without changing operational tasks or Gantt scheduling. IM-11's operational Gantt milestone idea remains a separate item.

- **IM-19** `[Future · Open]` — **Image Attachments & Comments**
  - **Capture:** Attach images to tasks and comments through Ctrl+V paste and drag-and-drop. Automatically optimize image size/quality before upload, with clear progress, errors and recoverable drafts.
  - **Storage:** Use a Google Drive folder per TAK Google Sheet copy by default, or let the owner configure an existing folder, including a shared folder where permissions allow. Keep Google Sheets and Drive as the storage foundation; do not introduce a new database.
  - **Setup:** Provide a **Test connection** action that checks the configured destination and the access needed for upload and viewing, with actionable errors for missing access or an unavailable folder.
  - **Viewing:** Show useful thumbnails/previews on the associated task or comment and allow opening the image. Define file-type/size limits and optimization behavior before implementation.
  - **Permissions:** Respect Drive folder/file permissions and the actual user/deployment identity. A task link does not grant image access; do not make private images public automatically. Review shared-folder support and who can upload, view or remove attachments.
  - **Mode boundary:** Drive-backed storage requires an explicitly configured Sheets/Drive connection; the standalone demo must explain its capabilities without implying automatic upload or synchronization.
  - **Acceptance:** Paste and drop both produce an optimized image attached to the correct task/comment; previews work for authorized viewers; Test connection and failed uploads provide clear feedback without losing the draft.

- **IM-20** `[Future · Open]` — **Product Strategy & Early Team Validation**
  - **Positioning:** Develop a new, fast team planning tool with a focused, consistent experience; avoid becoming a Jira clone or accumulating features without demonstrated user value.
  - **Distribution:** Open source first. Offer a usable demo and straightforward onboarding by copying a TAK Google Sheet, with clear setup and ownership. Explain that local demo data and a copied Google Sheet are separate environments.
  - **Initial audience:** Start with small companies and validate recurring use with **10 active small teams**. Define what counts as active use and collect concrete feedback on capture, planning speed, onboarding friction and missing essentials.
  - **Reach:** Use LinkedIn to explain the product, show practical workflows and recruit early teams for validation.
  - **Later audience:** Consider small teams inside large companies after the initial small-company use cases are validated; assess their access/sharing needs before broadening scope.
  - **Decision rule:** Prioritize observed problems from active teams and core speed/usability over broad feature parity. This strategy does not authorize enterprise features, integrations, schema changes or implementation of the future items above.
  - **Acceptance:** Document the demo/copy onboarding journey, validation criteria and findings from 10 active small teams before using those findings to propose the next product scope.
