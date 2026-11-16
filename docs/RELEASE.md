# Releasing TAK

How a change gets from this repository to the two places TAK runs, in a fixed order, with a human decision before anything reaches users. It adapts the Apps Script `clasp` flow (push, test on `/dev`, freeze a version, move the deployment) to TAK's two release targets. For why the shared app exists see [SHARED_APP_DESIGN.md](SHARED_APP_DESIGN.md); for the first release's evidence see [SHARED_APP_RELEASE.md](SHARED_APP_RELEASE.md).

## Targets

| Target | What it is | Who gets it | How it updates |
| --- | --- | --- | --- |
| **Shared host** | One Apps Script web app, `USER_ACCESSING`, signed-in access | Everyone using the starter template | Moving its `/exec` deployment to a new version updates all users at once |
| **Starter template** | The bound launcher script in the public starter spreadsheet | New copies only | Pushed to the template project; **existing copies keep the script they were made with** |
| **Independent install** | An owner-only copy attached to someone's own spreadsheet ([INSTALL_FROM_SOURCE.md](INSTALL_FROM_SOURCE.md)) | That owner | Owner updates by hand; the maintainer's own install uses the same `clasp` flow below |

The demo on GitHub Pages is separate: it publishes automatically from `implement_mvp` and never touches Apps Script.

## Rules

- **Production is human-gated.** An agent or script may push to `/dev`. Moving a production deployment (`clasp deploy -i … -V …`) happens only after the owner has tested on `/dev` and says so in writing ("approved", "deploy to prod").
- **No IDs in the repository.** Script IDs, deployment IDs, spreadsheet IDs and the shared `/exec` URL stay outside source control (a password manager or your shell profile). Examples below use placeholders.
- **Never run `clasp` from the repository root for the shared host.** The root has no `SharedConfig.js`, so it builds an independent install. Host and template folders are staged with `scripts/stage-package.mjs`.
- **Release from a clean, tagged checkout** of the branch you intend to ship, after `npm run check` passes.
- Back up before you deploy: note the current production version number from `clasp deployments`; that is your rollback target.

## Before any release

1. Make sure the working tree is clean and you are on the branch to ship (`git status`).
2. `npm run check` passes (builds `CoreScript.html` and `dist/index.html`, runs the Node tests). Run the targeted Playwright specs for what changed, as in [TESTING.md](../TESTING.md).
3. Choose the next semantic version (`vX.Y.Z`: patch for fixes, minor for features, major for breaking storage or behavior) and set it **only** in `package.json`: `npm version <patch|minor|major> --no-git-tag-version`.
4. Run `npm run build`. It generates `Version.js` (the backend's `takAppVersion_()`) and the header badge from `package.json`, so there is nothing else to edit by hand. Commit the regenerated files.
5. Add the release notes to [RELEASE_NOTES.md](RELEASE_NOTES.md): one entry for the new version at the top and a row in its table (a Node test fails if they disagree with `package.json`). Say what changed and anything users must do. For the template, say that existing copies are unchanged.
6. Commit, then tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`.

The same `vX.Y.Z` appears in the Git tag, `package.json`, `Version.js`, the header badge (hidden on phones), the release notes, the Apps Script version description and the deployment description. Only `package.json` is written by hand.

## Release the shared host

Needs the host's script ID (`HOST_SCRIPT_ID`) and its production deployment ID (`HOST_DEPLOYMENT_ID`). The host deployment must stay `USER_ACCESSING` with `ANYONE` access; never switch it to run as you.

**1. Stage the host folder.** In PowerShell from the repository root (`TAK_SCRIPT_ID` makes the staged folder a clasp project without storing the ID in Git):

```powershell
npm.cmd run build
$env:TAK_SCRIPT_ID = "<HOST_SCRIPT_ID>"
node scripts/stage-package.mjs host
cd .release\host
```

The folder holds the runtime files, a generated `SharedConfig.js` (`TAK_SHARED_HOST_ = true`) and the host manifest with its explicit Sheets and email scopes. `.release/` is ignored by Git. Run the remaining `clasp` commands from inside it.

**2. Push to the draft (`@HEAD`).** This never affects live users.

```powershell
npx.cmd @google/clasp push -f
```

**3. Test on `/dev`.** Find the `@HEAD` line in `npx.cmd @google/clasp deployments` and open it with a **test copy** of the starter spreadsheet, never a real tracker:

```text
https://script.google.com/macros/s/<HEAD_DEPLOYMENT_ID>/dev?sheet=<TEST_COPY_ID>&view=kanban
```

Confirm the header badge shows the new `vX.Y.Z` (on a desktop-width window), check Sheet, Kanban and Gantt, create, edit, move and delete a task, refresh and confirm it persisted, and exercise whatever this release changed. Live users on `/exec` are unaffected.

**4. Stop and get approval.** Do not continue until the owner confirms the `/dev` test.

**5. Freeze a version.** This snapshots `@HEAD` as the next integer version.

```powershell
npx.cmd @google/clasp version "vX.Y.Z - <short release notes>"
```

**6. Move production to it.** The `/exec` URL does not change.

```powershell
npx.cmd @google/clasp deployments
npx.cmd @google/clasp deploy -i <HOST_DEPLOYMENT_ID> -V <NEW_VERSION_NUMBER> -d "vX.Y.Z - <short release notes>"
```

**7. Verify production.** Open the real `/exec` link from a private test copy with **🔷 TAK → Open tracker**, load a tracker, confirm the badge shows the released version, and make one change. Confirm the deployment still reads `USER_ACCESSING` (a deployment readback or **Deploy → Manage deployments**). Then `git push origin vX.Y.Z`.

## Release the starter template

Only when the launcher or `Code.js`/`SharedHost.js` copies bundled in the template changed. Release the host first, because the template embeds the host's verified `/exec` URL.

```powershell
# from the repository root
$env:TAK_SCRIPT_ID = "<TEMPLATE_SCRIPT_ID>"
node scripts/stage-package.mjs template "<HOST_EXEC_URL>"
cd .release\template
npx.cmd @google/clasp push -f
```

The template is a container-bound script, so there is no `/dev` page: test by making a **fresh copy** of the starter spreadsheet and choosing **🔷 TAK → Open tracker**. It must open the shared app and load the copy's tracker. Do this before you let anyone use the public template link. The template has no deployments to move, so there is no `clasp version` or `clasp deploy` step; record the tag in the release notes. Do not change the template's link sharing (Viewer).

Existing copies keep their old bound script. Say so in the release notes if a fix needs the new launcher.

## Release an independent install

For your own owner-only installation (the repository root is a normal clasp project; `.claspignore` selects the runtime files, and no `SharedConfig.js` means independent mode). Confirm `.clasp.json` points at **your** script before pushing.

```powershell
npm.cmd run build
npx.cmd @google/clasp push -f                     # draft only
# open <your web app>/dev, test, then get approval
npx.cmd @google/clasp version "vX.Y.Z - <short release notes>"
npx.cmd @google/clasp deployments
npx.cmd @google/clasp deploy -i <DEPLOYMENT_ID> -V <NEW_VERSION_NUMBER> -d "vX.Y.Z - <short release notes>"
```

People who run TAK from the source ZIP update by following [INSTALL_FROM_SOURCE.md](INSTALL_FROM_SOURCE.md) after you publish the tag.

## Roll back

Production rollback is one command and needs no code change. Find the last good version with `clasp versions`, then re-point the deployment:

```powershell
npx.cmd @google/clasp deploy -i <HOST_DEPLOYMENT_ID> -V <GOOD_VERSION_NUMBER> -d "Rollback to vX.Y.Z"
```

For the template, restore the previous template package (stage the older tag and push). Never delete users' spreadsheets or task rows to roll back. If a release changed stored data, stop and restore from the backup you took before releasing.

## Command reference

| Action | Command (from the staged folder or install root) |
| --- | --- |
| Push to draft / dev | `npx.cmd @google/clasp push -f` |
| List versions | `npx.cmd @google/clasp versions` |
| Freeze a version | `npx.cmd @google/clasp version "vX.Y.Z - notes"` |
| List deployments | `npx.cmd @google/clasp deployments` |
| Update a deployment | `npx.cmd @google/clasp deploy -i <ID> -V <N> -d "vX.Y.Z - notes"` |
| Pull remote edits first | `npx.cmd @google/clasp pull` |

`-f` skips the "remote files are newer" warning and any interactive prompt. Use it only when this repository is the source of truth; if anyone edited code in the Apps Script browser editor, run `clasp pull` and review the difference first. Do not use `clasp deploy` without `-i`: that creates a **new** deployment with a **new** `/exec` URL, which would orphan every existing template copy.
