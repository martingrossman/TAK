# Shared TAK release evidence — 2026-11-06

## Released behavior

The public starter's bound script has one menu item, **🔷 TAK → Open tracker**. It selects its own copied spreadsheet and launches the stable shared app URL in a full browser tab. A visible Open tracker link handles blocked popups. Copies need no personal web-app deployment.

The separate shared app is deployed as version 2, with `USER_ACCESSING` execution and `ANYONE` signed-in access verified by API readback. Explicit host scopes are Google Sheets and email identity; the bound launcher's scopes are current spreadsheet and container UI. The existing owner-only app and production task data were not changed by this release.

## Verification

- `npm run check`: build and Node checks pass. Coverage includes request identity, inaccessible books, malformed IDs, operation allowlist, direct legacy-call rejection, context cleanup, per-workbook counters/receipts, stale edits, bulk edits, moves, duplication/undo, comments and browser request routing/storage isolation.
- `npx playwright test e2e/shared-app.spec.mjs --workers=1 --reporter=line`: passes in an isolated Edge session with a mocked Google transport. It exercises all three views, failed-create draft retention, a second tracker tab, and its connection link. This is separate from live Google verification.
- The owner confirmed the live shared app synced 21 issues from the private test copy.
- The owner confirmed a fresh private copy had the single menu item, browser-tab launch, working Sheet/Kanban/Gantt switching, task creation, persistence after refresh, and deletion of the temporary test task.
- Connector readback confirmed the fresh private copy was owner-only and its original 21 example issue rows remained after that test.
- Public starter source readback matched the tested template package. Its 21 issue rows were compared before/after and were unchanged. The only cell updates were two operational metadata keys in the existing `_System` tab.
- Public template link sharing remained Viewer; no copied spreadsheet was made public. Backups of template source and metadata were retained locally before updates. Shared deployment version 1 remains available for rollback.

## Limits and follow-ups

- No independent second Google account was available for live cross-account or view-only testing. Rejection paths have automated coverage; a second-account live check remains outstanding.
- Google OAuth verification is not complete. The initial release can show Google's unverified-app warning and is subject to Google's authorization limits. Removing that warning requires the owner's standard Cloud project/domain/application details and Google's review.
- Direct native-sheet validation remains in the copied script. Its shared workbook counter path is covered by Node checks; a separate live native-edit concurrency test was not performed. Native Sheet edits and app writes are not a cross-script transaction.
- The shared app intentionally accepts prepared, legacy-Issues starter copies. Existing migrated v2 trackers use their existing deployment. Older copies retain older bound script code.

## Reproduction and rollback

The copy/open/authorize instructions are in the README. The access model is in [SHARED_APP_DESIGN.md](SHARED_APP_DESIGN.md). `scripts/google-package.mjs` builds separate host/template API content packages; it does not modify `.clasp.json`. The host package must stay on an accessing-user deployment. The template package takes the verified stable host URL. For independent owner-only installations, use [INSTALL_FROM_SOURCE.md](INSTALL_FROM_SOURCE.md).

To roll back, restore the previous shared deployment version and/or the backed-up template script. Do not delete users' copied spreadsheets or task rows. Private project IDs, workbook IDs, source backups and deployment records are kept outside source control.
