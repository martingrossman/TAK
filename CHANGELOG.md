# TAK changelog

Newest first. Every change that reaches `implement_mvp` gets a version and an entry here. The version number is set once, in `package.json`, and the build writes it into `Version.js` and the header badge; see [RELEASE.md](docs/RELEASE.md) for the full release steps.

| Version | Date | Summary |
| --- | --- | --- |
| 1.1.4 | 2026-11-17 | Release process: every web app release also updates the starter template to the same version |
| 1.1.3 | 2026-11-17 | Roadmap: drag Milestone and Increment chips onto the grid; click renames in place, double-click opens details |
| 1.1.2 | 2026-11-16 | Version shown in the Apps Script project; changelog moved to CHANGELOG.md |
| 1.1.1 | 2026-11-16 | Direct links can open the Roadmap; README brought up to date |
| 1.1.0 | 2026-11-16 | Light/dark themes, Roadmap view with drag editing, milestone styling |
| 1.0.0 | 2026-11-16 | Baseline: versioning and a documented release process |

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
