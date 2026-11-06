# Shared TAK app: implementation and access model

Status: access model, testing, and release after passing checks approved on 2026-11-06. Implementation and release evidence are recorded separately.

## User experience

1. Make a private copy of the public TAK starter spreadsheet.
2. Choose **🔷 TAK → Open tracker**, the only item in its menu.
3. Open the shared TAK app in a browser tab and authorize Google Sheets access if prompted.

The app starts in Kanban and offers Sheet and Gantt. The copied spreadsheet is its storage. Users do not create an Apps Script deployment. A small launcher provides an **Open tracker** link when the browser blocks automatic new-tab opening. Browser-tab opening cannot be guaranteed without that extra user click.

The shared app and starter template are updated centrally. Existing spreadsheet copies retain their bound launcher code. The launcher uses a stable shared deployment URL so normal shared-app updates do not require replacing copies.

## Google identity and permissions

- Create a separate Apps Script project for the shared app. Keep the existing owner-only project and deployment available.
- Deploy as **USER_ACCESSING**, accessible to **ANYONE** signed in to Google. Never use USER_DEPLOYING for this shared service. Anonymous access is disabled.
- Request explicit `https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/userinfo.email` scopes for the shared host. The Sheets permission covers the user's spreadsheets; it is broader than access to only the copied file. A sheet ID in a URL is a selector, never an authorization credential.
- Google checks the signed-in user's access when the app opens or changes the selected spreadsheet. An inaccessible sheet is rejected. Google also enforces protected ranges and read-only sharing on writes.
- No user OAuth tokens are sent to the client, stored in spreadsheet cells, or committed to the repository. No Drive sharing permissions are changed by opening the tracker.
- The bound launcher requests only current-spreadsheet and container-UI permissions. It reads its own spreadsheet ID and opens the shared URL. It does not set up a separate deployment or grant the shared app access under the template owner's identity.

The host's owner can change the centrally served code, so users are trusting TAK as an application provider when they authorize it. They can revoke that authorization through their Google account.

## Workbook and request isolation

- Every browser request includes the selected spreadsheet ID and an operation from a fixed allowlist. There is no globally selected spreadsheet and no fallback to the developer's tracker.
- Validate the ID, authenticate the request, open the book using the accessing user's Google permissions, verify TAK headers and supporting tabs, and establish a request-local context. Clear that context in `finally`, including after failures.
- Route the existing client operations through this dispatcher: project loading, issue creation/editing/deletion, bulk changes, moves, duplication/undo, and comments. Exclude setup, migration, environment switching, role configuration, sample loading, and deployment administration.
- Direct calls to legacy public server functions on the shared host must fail without a validated request context. Configuration operations remain unavailable even within a normal tracker request.
- Counters and idempotency receipts belong to the selected workbook. Read their fresh values while holding the mutation lock. Do not use shared Script Properties for spreadsheet IDs, task counters, schema selection, roles, or personal preferences.
- Keep browser drafts, pending operations, undo, filters, saved views, and column layouts separate for each selected spreadsheet. Preserve existing browser keys for the local demo and existing owner-only app.

## Initial storage compatibility

The first shared release supports new copies of the updated, legacy-Issues starter template. Add an operational marker to its existing `_System` metadata, declaring that storage mode explicitly. Do not infer the active storage from whichever tabs happen to contain rows.

Reject unprepared trackers or migrated v2 trackers with a clear message instead of silently reading a retained Issues snapshot. Do not change task columns, task IDs, or existing task rows. The synthetic template and private test copy may receive operational metadata; the original production tracker stays on its existing deployment during this release.

Retain the attached script's native-sheet edit validation. Verify that it operates within the copied workbook and does not require a centrally owned installable trigger.

## Verification before release

- Build and existing Node checks.
- Request isolation between two workbook IDs, missing/invalid IDs, inaccessible sheets, wrong headers, unprepared/migrated trackers, and context cleanup after failure.
- Reject methods outside the allowlist and direct legacy/admin calls. Verify missing identity and incorrect execution identity fail safely.
- Exercise create/edit/delete, move, bulk edit, duplication/undo and comments through the shared dispatcher. Check conflict detection, retried operations, workbook-specific counters and no task-row writes when opening.
- Targeted browser checks for launcher/popup fallback, all three views, drafts, saved layouts and filters in two tracker tabs.
- Private-copy live test from a fresh copy, authorization, sync, reload and one reversible synthetic edit. Verify the actual deployment reports USER_ACCESSING and signed-in access.
- Test with a second Google account: its private copy works; a sheet it cannot access is rejected; view-only access cannot write. If no second account is available, record that check as outstanding.

## Release and rollback

Publish a versioned shared deployment using a stable URL, then update the public starter's launcher only after private-copy verification. Update the README and GitHub demo instructions to match the observed flow. Keep backups of the starter's prior script and metadata, plus all previous deployment versions.

Rollback restores the previous starter script and shared deployment version. It does not delete copied spreadsheets or task data. Existing owner-only deployments remain available.

## Public onboarding limitation

Google may show an unverified-app warning and impose an authorization-user cap until its OAuth verification is complete. A general public release without that warning requires a standard Google Cloud project, a verified domain, application identity/support information, a privacy policy and Google's review. Do not describe the release as verified before that review succeeds. No paid service, domain purchase, or verification submission is included without the owner's choices.

## Platform references

- [Web app execution identity and user consent](https://developers.google.com/apps-script/guides/web#permissions)
- [Manifest execution and access settings](https://developers.google.com/apps-script/manifest/web-app-api-executable)
- [HTML navigation and popup restrictions](https://developers.google.com/apps-script/guides/html/restrictions)
- [OAuth client verification](https://developers.google.com/apps-script/guides/client-verification)
