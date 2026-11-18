# TAK changelog

Newest first. Every change that reaches `implement_mvp` gets a version and an entry here. The version number is set once, in `package.json`, and the build writes it into `Version.js` and the header badge; see [RELEASE.md](docs/RELEASE.md) for the full release steps.

| Version | Date | Summary |
| --- | --- | --- |
| 1.1.10 | 2026-11-18 | README redesign: professional header, Why TAK, screenshot grid and Obsidian-compatible rendering |
| 1.1.9 | 2026-11-18 | Organize Apps Script sources in src while preserving build and deployment packages |
| 1.1.8 | 2026-11-18 | README: serverless Google Sheets architecture, private personal use and a compact diagram |
| 1.1.7 | 2026-11-18 | README refresh: personal and hosted setup, permissions, troubleshooting and concise feature reference |
| 1.1.6 | 2026-11-17 | New starter copies guide their owners through creating and opening their own Apps Script web app |
| 1.1.5 | 2026-11-17 | Release command: names the Option 2 web app correctly and hides the full deployment ID in dry runs |
| 1.1.4 | 2026-11-17 | Release process: every web app release also updates the starter template to the same version |
| 1.1.3 | 2026-11-17 | Roadmap: drag Milestone and Increment chips onto the grid; click renames in place, double-click opens details |
| 1.1.2 | 2026-11-16 | Version shown in the Apps Script project; changelog moved to CHANGELOG.md |
| 1.1.1 | 2026-11-16 | Direct links can open the Roadmap; README brought up to date |
| 1.1.0 | 2026-11-16 | Light/dark themes, Roadmap view with drag editing, milestone styling |
| 1.0.0 | 2026-11-16 | Baseline: versioning and a documented release process |

## v1.1.10 — 2026-11-18

- Redesigned the README with a centered header, link badges, section navigation and a hero Kanban screenshot.
- Added a **Why TAK** section explaining data ownership, no hosting, privacy, shared views, fast capture and honest save states.
- Shows all four views in a 2×2 screenshot grid; setup is presented as Option A (starter template) and Option B (hosted app); developer and release details are grouped near the end.
- Kept the header as one contiguous HTML block so it renders in Obsidian as well as GitHub; left-aligned table headers.
- Documentation only, apart from the generated version badge. No task behavior, data, permissions or deployment changed.

## v1.1.9 — 2026-11-18

- Moved the Apps Script and UI sources into `src/` so the GitHub repository page has fewer root-level files.
- Updated the standalone build, clasp content directory, staged host/template packages, tests and source documentation for the new layout.
- Kept the Apps Script upload filenames and application behavior unchanged; no spreadsheet data or schema changed.

## v1.1.8 — 2026-11-18

- Highlighted that Google Sheets stores project data and Google Apps Script runs TAK, with no server or separate database for the owner to maintain.
- Clarified private personal use: keep the copied Sheet unshared and deploy the owner's app with access set to **Only myself**.
- Added a compact, accessible diagram showing the browser, personal app and Sheet, with Google hosting the services.
- Documentation only, apart from the generated version badge. No task behavior, data, permissions or deployment changed.

## v1.1.7 — 2026-11-18

- Reorganized the README around choosing a setup and completing the personal template's first run, with permission and popup troubleshooting.
- Corrected outdated claims about template deployments, automatic updates and Google permissions; documented current Roadmap interactions and the Milestone task type.
- Placed full-width Kanban, Gantt and Roadmap screenshots at the beginning, each linked to its demo view. Kept the Sheet preview, keyboard shortcuts and the 21-column reference in collapsible sections, with developer/release details linked to their guides.
- Documentation only, apart from the generated version badge. No task behavior, data, permissions or deployment changed.

## v1.1.6 — 2026-11-17

- New starter-template copies no longer launch the centrally maintained web app. **Open tracker** prepares the copied Sheet and opens that copy's own Apps Script web app when it has been deployed.
- Before the owner creates that one-time web-app deployment, the launcher gives a direct Apps Script link and the exact three deployment steps. Google requires the owner to authorize this; TAK cannot create a deployment on their behalf.
- The template package requests the Apps Script trigger permission required to prepare a copied Sheet.
- Retrying **Open tracker** safely completes an interrupted personal-template setup, including its edit trigger.
- Existing template copies retain their existing launcher. Owners of new copies update their own web-app deployment to receive future code updates.
- No stored task data or schema changed.

## v1.1.5 — 2026-11-17

- `npm run release -- install` now says it releases the "Option 2 web app and starter template" (or "independent install" with `--skip-template`), instead of always "independent install".
- `--dry-run` shows only the last six characters of the production deployment ID, like a real run.
- No change to the app's behaviour or stored data.

## v1.1.4 — 2026-11-17

- Every Option 2 web app release now also updates the starter template's script to the same version, right after production moves. `npm run release -- install` does it and needs `TAK_TEMPLATE_SCRIPT_ID` in your shell; `--skip-template` is for independent installs without a template. If the template push fails, the command says production is already released and how to retry.
- AGENTS.md, RELEASE.md and the README describe the template step as part of every release.
- No change to the app's behaviour or stored data. New template copies get this version; existing copies keep their script.

## v1.1.3 — 2026-11-17

- Roadmap toolbar has **Milestone** and **Increment** chips. Drag one onto a stream (or a milestone onto the Milestones lane) to add it at that date; it appears with its name ready to type. Enter or clicking away keeps it, Esc removes it. Clicking a chip opens the full dialog instead.
- Clicking an increment, milestone or stream name now renames it in place (Enter saves, Esc keeps the old name). Double-click, or Enter on a focused item, opens the details. F2 renames the focused item.
- No change to stored data.

## v1.1.2 — 2026-11-16

- `Version.js` in the Apps Script project now shows the version and its one-line summary at the top of the file, and exposes `TAK_APP_VERSION`.
- The release notes moved from `docs/RELEASE_NOTES.md` to `CHANGELOG.md` in the repository root.
- No change to the app's behaviour or stored data.

## v1.1.1 — 2026-11-16

- A link ending in `?view=roadmap` now opens the Roadmap in the Google web app (it opened Kanban before).
- README describes the web app, starter template, Roadmap and release flow as they are now.
- No change to stored data.

## v1.1.0 — 2026-11-16

- Added light and dark themes with a header toggle.
- Added a **Roadmap** view (key `4`): streams as lanes, drag to move or resize items, custom date range, milestone icons, colours and vertical lines.
- Fixed the milestone editor ignoring stream and date changes.
- Roadmap edits appear at once and save in the background; quick successive moves are merged, and a failed save restores the last saved state with a message.
- Starter template copies can open in the Google web app: the first open asks the user to select their copy once. The public template needs its launcher updated separately ([RELEASE.md](docs/RELEASE.md)).
- Fixed saving and deleting Roadmap items in the Google web app (Sheets API mode): header formatting is supported and queued writes are now flushed.
- No change to stored data; the roadmap layout is kept in the browser.

## v1.0.0 — 2026-11-16

First tracked version of the `implement_mvp` line, which already included the shared TAK app and starter template ([SHARED_APP_RELEASE.md](docs/SHARED_APP_RELEASE.md)).

- Added a single version source (`package.json`), a generated `Version.js`, and a version badge in the header (hidden on phones).
- Added the release guide [RELEASE.md](docs/RELEASE.md) with a human-gated `/dev` → version → deploy flow for the shared host, the starter template and independent installs.
- Added `scripts/stage-package.mjs` to stage clasp-ready host and template folders.
- No change to stored data or to existing spreadsheet copies.
