# MyVault --- Personal Owner's Guide

**Purpose:** A practical guide for the owner of MyVault. It explains
where the project lives, how its services connect, how to run it
locally, how to deploy it, where backups are stored, and what to do when
something stops working.

**Last updated:** 1 November 2026\
**Project status:** Production deployment was confirmed working. A later
PWA cleanup was completed locally and passed checks; deployment of that
cleanup has not yet been confirmed in this guide.

------------------------------------------------------------------------

## 1. What MyVault is

MyVault is a personal cloud-storage web application. It has:

-   A React + TypeScript frontend built with Vite.
-   A Cloudflare Worker backend using Hono.
-   Cloudflare D1 for application data and metadata.
-   Google Drive API for the actual file storage.
-   PIN-based owner login and recovery-key functionality.
-   Features confirmed working in production: folders, file upload,
    preview, download, favorites and trash.

The website is hosted by Cloudflare. Your laptop is only needed when you
want to edit the code, run the development environment, or deploy an
update. Turning off your laptop does **not** turn off the production
website.

**Live website:**\
YOUR-PRODUCTION-WORKER-URL

------------------------------------------------------------------------

## 2. Where the project is saved

### Main project folder

``` text
C:\Web_Devlopment\Crazy Projects\myvault
```

Open PowerShell and move into the folder:

``` powershell
cd "C:\Web_Devlopment\Crazy Projects\myvault"
```

Important project files and folders:

  -----------------------------------------------------------------------
  Path                                What it is for
  ----------------------------------- -----------------------------------
  `src/client/`                       React frontend code

  `src/client/App.tsx`                Main application UI and client-side
                                      application logic

  `src/client/main.tsx`               React application entry point

  `src/client/styles.css`             Main styling

  `src/client/settings.css`           Settings-related styling

  `src/client/lib/api.ts`             Frontend API communication

  `src/worker/`                       Cloudflare Worker backend

  `src/worker/index.ts`               Hono app setup, middleware, routes
                                      and Worker entry point

  `src/worker/routes/auth.ts`         Authentication endpoints

  `src/worker/routes/drive.ts`        Google Drive-related API routes

  `src/worker/routes/vault.ts`        Vault metadata/features such as
                                      favorites, recent items, trash and
                                      settings

  `src/worker/lib/auth.ts`            Authentication helpers

  `src/worker/lib/crypto.ts`          Cryptographic helpers

  `src/worker/lib/google-drive.ts`    Google Drive API and token-related
                                      helpers

  `src/worker/types.ts`               Worker environment and binding
                                      types

  `migrations/`                       D1 database schema migrations

  `scripts/initialize-owner.mjs`      Owner initialization script

  `tests/`                            Automated tests

  `public/`                           Static public assets

  `index.html`                        Frontend HTML entry point

  `vite.config.ts`                    Vite development/build
                                      configuration

  `wrangler.jsonc`                    Cloudflare Worker, assets and D1
                                      configuration

  `package.json`                      Project scripts and dependencies

  `package-lock.json`                 Locked dependency versions

  `.dev.vars`                         Local-only secret values; never
                                      share or commit this file

  `.dev.vars.example`                 Example environment variable names;
                                      should contain placeholders only

  `dist/`                             Generated frontend build output;
                                      recreated by `npm run build`

  `node_modules/`                     Installed dependencies; recreated
                                      with `npm install`
  -----------------------------------------------------------------------

The project uses **`wrangler.jsonc`**, not `wrangler.toml`.

------------------------------------------------------------------------

## 3. How the pieces connect

A simplified view:

``` text
Browser (laptop / phone / another computer)
                 |
                 v
       Cloudflare-hosted website
                 |
                 v
       Cloudflare Worker (Hono API)
          /                 \
         v                   v
 Cloudflare D1          Google Drive API
 app metadata           actual stored files
```

### What each service stores

**Cloudflare Pages/Worker assets:** The deployed frontend website files
are served through the Worker assets configuration.

**Cloudflare Worker:** Runs the backend API. It handles authentication,
application logic, Google Drive requests and D1 operations.

**Cloudflare D1:** Stores application records and metadata. It is not
the same thing as the Google Drive file store.

**Google Drive:** Stores the actual uploaded files and folders managed
by MyVault.

**Your laptop:** Holds the editable source code and local development
environment. It is not the production host.

### Production identifiers

  ----------------------------------------------------------------------------------------------------------------------------------
  Item                                Value
  ----------------------------------- ----------------------------------------------------------------------------------------------
  Production website                  `YOUR-PRODUCTION-WORKER-URL`

  Production Worker name              `myvault-personal-cloud` in the configuration; deployed production Worker is
                                      `YOUR-PRODUCTION-WORKER-NAME`

  Production D1 database name         `myvault-production`

  Production D1 database ID           `YOUR-PRODUCTION-D1-DATABASE-ID`

  Production app origin               `YOUR-PRODUCTION-WORKER-URL`

  Production Google OAuth callback    `YOUR-PRODUCTION-WORKER-URL/api/drive/callback`
  ----------------------------------------------------------------------------------------------------------------------------------

**Important:** `wrangler.jsonc` has a default D1 configuration with a
placeholder database ID (`00000000-0000-0000-0000-000000000000`) and a
production environment with the real production D1 ID. Always select
`--env production` for production deployments and production D1
commands. Do not deploy against the default environment.

------------------------------------------------------------------------

## 4. How to run MyVault on your laptop

### First-time setup or after reinstalling dependencies

1.  Open PowerShell.
2.  Go to the project folder:

``` powershell
cd "C:\Web_Devlopment\Crazy Projects\myvault"
```

3.  Install dependencies:

``` powershell
npm install
```

4.  Confirm that your private local `.dev.vars` file exists. It contains
    local development secrets and must not be recreated from guesses. If
    it is missing, restore it from your own secure backup or configure
    the required local values in accordance with the project setup
    instructions. Do not paste secrets into chat.

### Start the local development environment

Run:

``` powershell
npm run dev
```

This starts both: - Vite frontend at `http://localhost:5173/` - Wrangler
local Worker at `http://127.0.0.1:8787`

Open:

http://localhost:5173/

The frontend proxies `/api` requests to the local Worker.

**Do not start a second separate `npx wrangler dev` process while
`npm run dev` is already running.** The `npm run dev` command already
starts the Worker and frontend together.

To stop local development, focus the PowerShell terminal and press:

``` text
Ctrl + C
```

### Local database versus production database

The default D1 binding in the local development environment is
`myvault-db` in local mode. The production environment uses the remote
database `myvault-production`.

Local development and production are separate environments. A file or
metadata change made in local D1 does not automatically change
production D1. Google Drive authorization can also have separate local
and production connection state.

Do not run production database commands unless you intentionally mean to
affect the live application.

------------------------------------------------------------------------

## 5. Useful commands

Run these from the project directory.

  ----------------------------------------------------------------------------------------------------
  Purpose                             Command
  ----------------------------------- ----------------------------------------------------------------
  Start local frontend + Worker       `npm run dev`

  TypeScript check                    `npm run typecheck`

  Run automated tests                 `npm run test`

  Build frontend and type-check       `npm run build`

  Preview Worker locally              `npm run preview`

  Apply migrations to local D1        `npm run db:local`

  Apply migrations to production D1   `npx wrangler d1 migrations apply myvault-production --remote`

  Deploy production Worker + assets   `npx wrangler deploy --env production`
  ----------------------------------------------------------------------------------------------------

### Recommended pre-deployment checks

Run:

``` powershell
npm run typecheck
npm run test
npm run build
```

Proceed only if all three pass.

### Production deployment

The safe deployment command for this project's current configuration is:

``` powershell
npx wrangler deploy --env production
```

This explicitly selects the production environment and its
`myvault-production` D1 binding.

**Do not use `npm run deploy` as currently defined without changing its
script first.** Its current definition is
`npm run build && wrangler deploy`, which does not specify
`--env production`. The default D1 configuration contains a placeholder
ID, so use the explicit production command above.

A normal Worker deployment updates code/assets. It does not run database
migrations, initialize an owner, reset the PIN, or erase Google Drive
files. Do not run initialization or migration commands as part of an
ordinary code deployment.

------------------------------------------------------------------------

## 6. Secrets and credentials --- keep private

### Local secrets file

The local development secrets are stored in:

``` text
C:\Web_Devlopment\Crazy Projects\myvault\.dev.vars
```

Known variable names:

``` text
APP_PEPPER
SETUP_SECRET
APP_ENCRYPTION_KEY
APP_ORIGIN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The actual values are private. Never paste them into a chat, GitHub
issue, screenshot, public document, or source-control repository.

### Production secrets

Production secrets are stored in Cloudflare Worker secrets, not in this
guide.

A private production-secrets backup was previously created at:

``` text
C:\Users\shaik\OneDrive\Documents\MyVault-Private\production-secrets.txt
```

Treat this file as highly confidential. Do not upload it to GitHub or
share it with an AI assistant.

### Google OAuth

The Google OAuth client is configured with a production callback URL:

``` text
YOUR-PRODUCTION-WORKER-URL/api/drive/callback
```

The local callback used during development was:

``` text
http://127.0.0.1:8787/api/drive/callback
```

The OAuth app was in Testing mode, and the owner was configured as a
test user. A Google warning/consent screen can be expected in that mode.

The local `.dev.vars` Google client secret needed updating after the
production Google client secret was rotated. If local Drive calls fail
with a message that Google authorization could not be refreshed, check
that the local secret matches the currently active secret for the same
OAuth client. Do not change the production secret just to fix local
development.

If a local refresh token is no longer valid after the client
configuration is corrected, reconnect Google Drive from the local
MyVault Settings. Do not reset the production database.

### PIN and recovery key

-   The existing 4-digit PIN is the owner login PIN.
-   A recovery key was generated during owner initialization and later
    replaced once.
-   The current recovery key is private and must be kept in the owner's
    secure password manager or private offline storage.
-   The owner explicitly does not want the PIN changed as part of
    routine maintenance.

**Never put the PIN or recovery key in this guide, GitHub, `.env`
examples, screenshots, or an AI prompt.**

------------------------------------------------------------------------

## 7. Backups

### Source-code backup

A successful source backup was created at:

``` text
C:\Users\shaik\OneDrive\Documents\MyVault-Backups\Working-Version-20261101-211535
```

The backup operation copied 44 files and reported 0 failures. It
excluded: - `node_modules` - `dist` - `.git` - `.wrangler` - `.venv` -
`TempData` - `.dev.vars`

### Production D1 SQL export

A successful production database export was created at:

``` text
C:\Users\shaik\OneDrive\Documents\MyVault-Backups\Working-Version-20261101-211535\myvault-production.sql
```

The exported file was 6,832 bytes at the time of export.

The SQL export may contain private application records. Keep it private
and do not commit it to GitHub.

### Create a new source backup

From the project directory:

``` powershell
$source = (Get-Location).Path
$backupRoot = "$env:USERPROFILE\OneDrive\Documents\MyVault-Backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $backupRoot "Working-Version-$timestamp"

New-Item -ItemType Directory -Path $backup -Force | Out-Null

robocopy $source $backup /E /XD node_modules dist .git .wrangler .venv TempData /XF .dev.vars

if ($LASTEXITCODE -le 7) {
    Write-Host "Backup created successfully: $backup" -ForegroundColor Green
} else {
    Write-Host "Backup encountered an error. Check the Robocopy output." -ForegroundColor Red
}
```

This copies source files but intentionally excludes `.dev.vars`. Keep
secrets backed up separately and securely.

### Create a fresh production D1 export

First make sure `$backup` points to the intended backup folder, then
run:

``` powershell
$dbBackup = Join-Path $backup "myvault-production.sql"
npx wrangler d1 export myvault-production --remote --output="$dbBackup"
Get-Item $dbBackup | Select-Object FullName, Length
```

Cloudflare may warn that the database can be temporarily unavailable
during export. Confirm only when you are comfortable with that brief
interruption. Keep the generated SQL file private.

**Google Drive files are not included in the D1 SQL export.** They
remain in Google Drive. The SQL export protects the D1 records/metadata,
not the actual Drive file contents.

------------------------------------------------------------------------

## 8. Troubleshooting

### A. Website is live but laptop is off

This is normal. Production is hosted by Cloudflare and the files are
stored in Google Drive. Your laptop can be shut down.

### B. Local website does not open

1.  Open PowerShell.
2.  Change to the project folder.
3.  Run `npm install` if dependencies are missing.
4.  Run `npm run dev`.
5.  Open `http://localhost:5173/`.
6.  Check that the terminal reports Vite ready and Wrangler ready.

### C. Local page opens but API calls fail

The frontend runs on port `5173`, and the local Worker runs on port
`8787`. `vite.config.ts` proxies `/api` to `http://127.0.0.1:8787`.

Use only `npm run dev` to start both processes together. Do not start
another separate Worker process at the same time.

### D. Google Drive says it cannot refresh authorization

1.  Confirm local `.dev.vars` has the current Google OAuth client secret
    for the configured client ID.
2.  Stop and restart `npm run dev` after changing `.dev.vars`.
3.  If the local refresh token is invalid, reconnect Drive from local
    MyVault Settings.
4.  Do not reset the production database or change the production PIN to
    solve a local OAuth issue.

### E. Typecheck, tests or build fail

Run each command separately to identify the failure:

``` powershell
npm run typecheck
npm run test
npm run build
```

Fix the first relevant error, then rerun all three. Do not deploy a
build that fails.

### F. Production website stops working after a deployment

1.  Do not immediately run database migrations or owner initialization.
2.  Capture the deployment output and the exact browser error.
3.  Check Cloudflare Worker logs for the failing endpoint.
4.  Compare with the last known-good source backup.
5.  If necessary, use Cloudflare's Worker deployment/version controls to
    roll back to the last known-good version. A rollback changes
    deployed code, not D1 data.

### G. Production login or recovery issue

Do not guess the PIN, repeatedly attempt random values, or run owner
initialization against production. Use the recovery process implemented
in MyVault and the privately stored current recovery key. If the
recovery key is unavailable, inspect the existing authentication
implementation and database state before taking action.

------------------------------------------------------------------------

## 9. Current known project state

As of 1 November 2026:

-   Production website was confirmed working after deployment.
-   Production login with the existing PIN was tested.
-   Google Drive file/folder listing was tested.
-   Upload, preview and download were tested.
-   Favorites and trash were tested.
-   A security update was applied to the Worker code and deployed.
-   TypeScript check, tests and build passed after that deployment.
-   A PWA cleanup was then performed locally:
    -   `index.html` was simplified.
    -   `public/manifest.webmanifest` was removed.
    -   `public/offline.html` was removed.
    -   `public/sw.js` was removed.
    -   `public/icons/` was removed.
    -   `npm run typecheck`, `npm run test` and `npm run build` all
        passed after the cleanup.
-   **The production deployment of this final PWA cleanup was not
    confirmed in the conversation when this guide was written.** Check
    before assuming the live site has received that last cleanup.

### Last confirmed production Worker version before the PWA cleanup

``` text
3564abc8-48d5-4298-9aa2-127b82b0041d
```

This is a historical reference, not necessarily the current version
after later deployment.

------------------------------------------------------------------------

## 10. Important rules for future changes

1.  Make a source backup before changing project structure or important
    code.
2.  Export production D1 before database schema changes.
3.  Never share `.dev.vars`, production secrets, OAuth client secret,
    PIN or recovery key.
4.  Do not commit secret files or database exports to GitHub.
5.  Keep local D1 and production D1 clearly separate.
6.  Use `npx wrangler deploy --env production` for production
    deployment.
7.  Run `npm run typecheck`, `npm run test` and `npm run build` before
    deployment.
8.  Do not run `owner:init` against an already initialized production
    database.
9.  Do not apply database migrations unless a code change actually
    requires them and the migration has been reviewed.
10. Do not replace the working Google OAuth client or reset
    authentication as a first troubleshooting step.
11. Test local changes before deploying them to the live site.
12. Keep a copy of the current known-good source and database export.

------------------------------------------------------------------------

## 11. Quick reference

  ---------------------------------------------------------------------------------------------------------------
  Question                            Answer
  ----------------------------------- ---------------------------------------------------------------------------
  Where is my project?                `C:\Web_Devlopment\Crazy Projects\myvault`

  What command starts local           `npm run dev`
  development?                        

  What is the local URL?              `http://localhost:5173/`

  What is the local Worker URL?       `http://127.0.0.1:8787`

  What command checks TypeScript?     `npm run typecheck`

  What command runs tests?            `npm run test`

  What command builds?                `npm run build`

  What command deploys production?    `npx wrangler deploy --env production`

  What is the live URL?               `YOUR-PRODUCTION-WORKER-URL`

  What is the production D1 database? `myvault-production`

  Where are local secrets?            `.dev.vars` in the project folder

  Where is the source backup?         `OneDrive\Documents\MyVault-Backups\Working-Version-20261101-211535`

  Where is the D1 export?             `myvault-production.sql` inside that backup folder
  ---------------------------------------------------------------------------------------------------------------

**Remember:** If the laptop is off, the deployed website remains online.
Start `npm run dev` only when you want to work on the project locally.


