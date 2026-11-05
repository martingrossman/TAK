# Install TAK from source

Most people should [make a copy of the starter template](https://docs.google.com/spreadsheets/d/1HaBavwDoxemGXhrAPas_9ppTmRmHAHOlMc5NSjOJ2iE/copy). It already contains the script and example project. Use this guide only when you need to attach the source to a different blank spreadsheet.

## 1. Prepare your spreadsheet

Sign in to the Google account that should own the tracker and create a blank Google Sheet. Back up an existing sheet before using it: TAK checks the `Issues` headers and stops if they differ. Download and extract the [TAK source ZIP](https://github.com/martingrossman/TAK/archive/refs/heads/implement_mvp.zip).

## 2. Attach the script

In the spreadsheet, choose **Extensions → Apps Script** and give the attached project a name such as **My TAK tracker**. For each `.js` file below, choose **+ → Script**, enter its name without `.js`, then paste the matching file's full contents. For each `.html` file, choose **+ → HTML** and do the same. Keep `Index.html` as an HTML file, and include the generated `CoreScript.html`.

**Script files (12):**

```text
Code.js · PersonalBatch.js · Core.js · Schema.js · Migrations.js
Environment.js · Repository.js · History.js · Authorization.js
Settings.js · Ordering.js · Comments.js
```

**HTML files (7):**

```text
Index.html · Styles.html · Client.html · QuickAdd.html · Help.html · FullScreen.html · CoreScript.html
```

In **Project Settings**, turn on **Show “appsscript.json” manifest file in editor**. Replace its contents with the matching file from the source ZIP. The manifest enables the Advanced Sheets v4 service and V8 runtime. If Apps Script asks you to add the Google Sheets API service, choose **Add service → Google Sheets API**.

## 3. Open TAK

Reload the spreadsheet. Choose **🔷 TAK → Open tracker**. Review Google's authorization request for this attached script if prompted. TAK creates the `Issues` and supporting tabs, formats them, installs the edit trigger, then opens Sheet, Kanban, and Gantt. A manual install starts empty; use `loadSampleData` in the Apps Script editor only if you want the example project and the tracker has no issues.

If Google shows an unverified-app warning, verify the script project and account owner before deciding whether to continue. Do not approve an unexpected project. See [Google's Apps Script authorization guide](https://developers.google.com/apps-script/guides/services/authorization).

TAK uses the broader Google Sheets scope because its server opens a spreadsheet by ID and can create a spreadsheet during manual setup. Restricting it to the current document would break those operations.

For a separate browser-tab link or phone access, follow the [optional web-app steps](../readme.md#optional-full-screen-web-app).

## Updating or administering an installation

After changing source files, regenerate `CoreScript.html`, copy changed files into Apps Script, and save. For a versioned `/exec` web app, choose **Deploy → Manage deployments → Edit → New version → Deploy**; saving source alone does not update its `/exec` link.

The repository's `.clasp.json` points at the maintainer's script project. **Do not run `clasp push` from a copied checkout** until you configure and verify your own script ID. `.claspignore` includes the runtime files and excludes tests, build scripts, and `dist/`.

The administrator functions remain in Apps Script: `setupTracker`, `schemaHealthCheck`, `startupHealthCheck`, `loadSampleData`, `migrationDryRun`, `migrateLegacyIssues`, `activateVersionedRepository`, and `deactivateVersionedRepository`. Migration must be tested against a separate workbook before use with real data. Run health and dry-run checks first; resolve duplicates and invalid rows before migrating. Activation compares IDs and validates hierarchy. Rollback copies active v2 records back to `Issues`; changes made to that legacy copy must be reconciled before reactivation.

If the tracker reports **Cannot read properties of null (reading 'issues')**, run `startupHealthCheck` and `getProject` in the Apps Script editor. Upload all current source files, test `/dev`, and update the versioned deployment before testing `/exec`. Browser transport cannot accept raw `Date` objects; current TAK responses convert timestamps to strings while Sheet cells retain native dates.
