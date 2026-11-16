# TAK release notes

Newest first. One entry per released version. The version number is set once, in `package.json`, and the build writes it into `Version.js` and the header badge; see [RELEASE.md](RELEASE.md) for the full release steps.

| Version | Date | Summary |
| --- | --- | --- |
| 1.0.0 | 2026-11-16 | Baseline: versioning and a documented release process |

## v1.0.0 — 2026-11-16

First tracked version of the `implement_mvp` line, which already included the shared TAK app and starter template ([SHARED_APP_RELEASE.md](SHARED_APP_RELEASE.md)).

- Added a single version source (`package.json`), a generated `Version.js`, and a version badge in the header (hidden on phones).
- Added the release guide [RELEASE.md](RELEASE.md) with a human-gated `/dev` → version → deploy flow for the shared host, the starter template and independent installs.
- Added `scripts/stage-package.mjs` to stage clasp-ready host and template folders.
- No change to stored data or to existing spreadsheet copies.
