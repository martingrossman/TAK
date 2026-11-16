# TAK release notes

Newest first. One entry per released version. The version number is set once, in `package.json`, and the build writes it into `Version.js` and the header badge; see [RELEASE.md](RELEASE.md) for the full release steps.

| Version | Date | Summary |
| --- | --- | --- |
| 1.1.0 | 2026-11-16 | Light/dark themes, Roadmap view with drag editing, milestone styling |
| 1.0.0 | 2026-11-16 | Baseline: versioning and a documented release process |

## v1.1.0 — 2026-11-16

- Added light and dark themes with a header toggle.
- Added a **Roadmap** view (key `4`): streams as lanes, drag to move or resize items, custom date range, milestone icons, colours and vertical lines.
- Fixed the milestone editor ignoring stream and date changes.
- Roadmap edits appear at once and save in the background; quick successive moves are merged, and a failed save restores the last saved state with a message.
- Starter template copies can open in the Google web app: the first open asks the user to select their copy once. The public template needs its launcher updated separately ([RELEASE.md](RELEASE.md)).
- Fixed saving and deleting Roadmap items in the Google web app (Sheets API mode): header formatting is supported and queued writes are now flushed.
- No change to stored data; the roadmap layout is kept in the browser.

## v1.0.0 — 2026-11-16

First tracked version of the `implement_mvp` line, which already included the shared TAK app and starter template ([SHARED_APP_RELEASE.md](SHARED_APP_RELEASE.md)).

- Added a single version source (`package.json`), a generated `Version.js`, and a version badge in the header (hidden on phones).
- Added the release guide [RELEASE.md](RELEASE.md) with a human-gated `/dev` → version → deploy flow for the shared host, the starter template and independent installs.
- Added `scripts/stage-package.mjs` to stage clasp-ready host and template folders.
- No change to stored data or to existing spreadsheet copies.
