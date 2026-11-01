# MyVault --- Complete Technical Documentation & AI Handover

> **Purpose:** This is the master technical reference for the MyVault
> codebase. Give this document and, when possible, a fresh ZIP of the
> current source code to a future AI assistant before asking it to
> modify the application.
>
> **Evidence rule:** Code-specific descriptions below were derived from
> the source ZIP supplied for this document. Historical deployment and
> operational facts are based on the owner's conversation notes. Where
> those two sources differ, the difference is explicitly called out.
>
> **Documentation snapshot:** 1 November 2026\
> **Source archive inspected:** `MyVault-Source-For-Documentation.zip`\
> **Application version in package/UI:** `0.1.0`

------------------------------------------------------------------------

# 1. Executive summary

MyVault is a private, single-owner personal cloud file manager. It
provides a web interface for organizing and accessing files stored in
the owner's Google Drive account.

It is not a self-hosted file-content storage server. The actual file
bytes are stored in Google Drive. MyVault provides the private
application interface, owner authentication, Drive OAuth connection,
folder/file operations, and application metadata.

## 1.1 Technology stack

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                React 19, TypeScript    User interface and
                                                  client-side state

  Frontend tooling        Vite 7                  Local dev server and
                                                  static production build

  Styling                 CSS                     Responsive layout,
                                                  theme and component
                                                  styling

  Icons                   Lucide React            UI icons

  Backend                 Cloudflare Workers      Server-side API runtime

  Backend framework       Hono 4                  HTTP routing and
                                                  middleware

  Database                Cloudflare D1           Owner/auth records,
                          (SQLite-compatible)     sessions, file index
                                                  and app metadata

  File storage            Google Drive API v3     Actual files and
                                                  folders

  Authentication          PIN + server-side       Owner access
                          verifier + session      
                          cookie                  

  Encryption              Web Crypto API,         Token protection and
                          AES-GCM, HMAC-SHA-256   credential verification

  Deployment              Wrangler 4, Worker      Build/deploy frontend
                          Static Assets           and Worker
  -----------------------------------------------------------------------

## 1.2 Confirmed product capabilities

The supplied source code implements the following capabilities:

-   Owner setup with a 4- or 6-digit PIN.
-   PIN login and logout.
-   Session validation and logout from all sessions.
-   Recovery-key rotation.
-   PIN change using current PIN and recovery key.
-   Google OAuth connection and callback.
-   Google Drive storage quota display.
-   Dedicated `MyVault Storage` root folder.
-   Folder listing and folder creation.
-   Resumable file upload in chunks.
-   File content retrieval for preview and download.
-   File rename and move to Google Drive Trash.
-   Restore from Trash and permanent deletion.
-   Favorites and Recent lists.
-   Grid/list views, search, sorting and client-side type filters.
-   Light/dark appearance setting stored in browser local storage.
-   Responsive navigation and file preview UI.

The owner confirmed during the project conversation that production
login, Google Drive connection, file/folder listing, upload, preview,
download, favorites and trash were working after deployment.

## 1.3 What MyVault is not

The supplied source does not establish that MyVault currently provides:

-   Independent storage of file contents on Cloudflare.
-   End-to-end encryption of file contents before they reach Google
    Drive.
-   Multi-user accounts or user roles.
-   Username/password login.
-   Public share links.
-   Device-specific management UI beyond sign-out-everywhere.
-   Automatic synchronization of arbitrary local computer folders.
-   Offline-first or installable PWA functionality.
-   Guaranteed preview for every file format.
-   Automated database backups or disaster-recovery scheduling.

Do not tell the owner these features exist unless they are implemented
and verified in a newer source snapshot.

------------------------------------------------------------------------

# 2. Product architecture

## 2.1 High-level architecture

``` text
                 User's browser
        (desktop / laptop / mobile browser)
                         |
                         | HTTPS
                         v
          Cloudflare Worker + Static Assets
              |                      |
              | /api/*               | non-API paths
              v                      v
        Hono API routes          React build assets
              |
        +-----+-----------------------+
        |                             |
        v                             v
  Cloudflare D1                 Google OAuth / Drive API
  application metadata          file contents and folders
        |                             |
        +-----------------------------+
              encrypted OAuth tokens
              stored in D1
```

## 2.2 Request flow

1.  Browser downloads the React/Vite static assets from the deployed
    Cloudflare Worker.
2.  React calls same-origin `/api/...` endpoints.
3.  Worker routes `/api/*` requests through Hono.
4.  Hono middleware adds API security headers and checks the request
    Origin when an Origin header is present.
5.  Protected routes run `requireAuth`.
6.  Backend reads/writes metadata in D1.
7.  When a Drive operation is needed, backend obtains or refreshes an
    access token and calls Google Drive API.
8.  Google Drive returns file metadata or file content.
9.  Worker returns the response to the browser.

The browser does not receive the Google OAuth client secret or stored
refresh token.

## 2.3 System responsibilities

### Browser / React

-   PIN entry UI.
-   Display current folders and files.
-   Client-side search, sorting and filtering.
-   Upload file selection and chunk slicing.
-   Preview rendering using browser-supported content types.
-   Settings UI.
-   Sends authenticated same-origin API requests with cookies.

### Cloudflare Worker

-   Validates owner sessions.
-   Enforces PIN login attempt throttling.
-   Handles OAuth state and callback.
-   Encrypts and decrypts Google tokens and resumable upload session
    URLs.
-   Validates file/folder operations.
-   Checks that file IDs belong to the MyVault root tree before
    sensitive operations.
-   Streams/forwards file content from Drive to the browser.

### Cloudflare D1

-   One owner configuration row.
-   Session token hashes.
-   Login attempt counters.
-   Indexed file/folder metadata.
-   Upload session metadata and encrypted resumable URLs.
-   Favorites and recent-item timestamps.
-   A share-link schema table exists, but no share-link route is
    implemented in the supplied source.

### Google Drive

-   Stores actual file bytes.
-   Stores MyVault-managed folders.
-   Provides OAuth access and refresh tokens.
-   Reports account storage quota.
-   Handles resumable uploads, file content and trash operations.

------------------------------------------------------------------------

# 3. Current environment and deployment identifiers

These identifiers are taken from the owner's project configuration and
deployment history. They are useful for operating the existing personal
deployment. Keep the production database ID and deployment URL out of
public examples if the owner prefers privacy.

  ----------------------------------------------------------------------------------------------------------------------------------
  Setting                             Current known value
  ----------------------------------- ----------------------------------------------------------------------------------------------
  Local project directory             `C:\Web_Devlopment\Crazy Projects\myvault`

  Production website                  `YOUR-PRODUCTION-WORKER-URL`

  Wrangler config file                `wrangler.jsonc`

  Worker source entry                 `src/worker/index.ts`

  Production D1 name                  `myvault-production`

  Production D1 ID                    `YOUR-PRODUCTION-D1-DATABASE-ID`

  Local D1 binding name               `myvault-db`

  D1 binding name in Worker code      `DB`

  Assets binding                      `ASSETS`

  Local Vite URL                      `http://localhost:5173/`

  Local Worker URL                    `http://127.0.0.1:8787`

  Local Google OAuth callback         `http://127.0.0.1:8787/api/drive/callback`
  previously configured               

  Production Google OAuth callback    `YOUR-PRODUCTION-WORKER-URL/api/drive/callback`
  ----------------------------------------------------------------------------------------------------------------------------------

## 3.1 Important Wrangler environment distinction

The supplied `wrangler.jsonc` contains:

-   Default environment D1 database name `myvault-db`.
-   Default environment database ID
    `00000000-0000-0000-0000-000000000000` (a placeholder in the
    supplied source).
-   A named `production` environment that binds `DB` to
    `myvault-production` using the real production database ID.
-   Production `APP_ORIGIN` set to the production Worker URL.

**Production deployment must explicitly select the production
environment:**

``` powershell
npx wrangler deploy --env production
```

Do not use an unqualified `wrangler deploy` with this configuration
unless the Wrangler config has first been deliberately changed and
reviewed.

The `package.json` script currently defines:

``` json
"deploy": "npm run build && wrangler deploy"
```

That script does not select `--env production`. Therefore, for this
existing setup, prefer the explicit command:

``` powershell
npm run build
npx wrangler deploy --env production
```

## 3.2 Production Worker name nuance

The source `wrangler.jsonc` contains:

``` jsonc
"name": "myvault-personal-cloud"
```

The deployed production Worker reported by Wrangler is:

``` text
YOUR-PRODUCTION-WORKER-NAME
```

Wrangler's environment naming behavior can append the environment name.
Always trust the output from `npx wrangler deploy --env production` and
the Cloudflare dashboard for the active deployed name.

------------------------------------------------------------------------

# 4. Complete source directory map

This map reflects the uploaded source archive. Empty directories may be
included by ZIP even when they contain no source files.

``` text
myvault/
├── src/
│   ├── client/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   ├── settings.css
│   │   ├── components/          # Empty in supplied archive
│   │   └── lib/
│   │       └── api.ts
│   └── worker/
│       ├── index.ts
│       ├── types.ts
│       ├── lib/
│       │   ├── auth.ts
│       │   ├── crypto.ts
│       │   └── google-drive.ts
│       └── routes/
│           ├── auth.ts
│           ├── drive.ts
│           └── vault.ts
├── migrations/
│   ├── 0001_initial.sql
│   └── 0002_personal_features.sql
├── scripts/
│   └── initialize-owner.mjs
├── tests/
│   └── crypto.test.ts
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── package-lock.json
├── wrangler.jsonc
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.worker.json
├── README.md
├── SECURITY.md
├── DEPLOYMENT.md
├── TESTING.md
└── .dev.vars.example
```

The private local `.dev.vars` file was intentionally not included in the
uploaded archive. The production SQL export and secret backup were also
excluded.

## 4.1 File-by-file responsibilities

  -----------------------------------------------------------------------------
  File                                      Responsibility
  ----------------------------------------- -----------------------------------
  `src/client/App.tsx`                      Main application screen, state,
                                            navigation, file operations, upload
                                            progress, previews and settings UI

  `src/client/main.tsx`                     React DOM bootstrap; imports App
                                            and CSS

  `src/client/styles.css`                   Main application visual system and
                                            responsive styling

  `src/client/settings.css`                 Settings-related styling

  `src/client/lib/api.ts`                   Typed browser API wrapper, request
                                            helper, file type and content URL
                                            helper

  `src/worker/index.ts`                     Hono app, middleware, API routing,
                                            static assets handling and global
                                            error handler

  `src/worker/types.ts`                     Cloudflare Worker environment
                                            bindings and shared TypeScript
                                            interfaces

  `src/worker/lib/auth.ts`                  Cookie/session helpers, auth
                                            middleware, session
                                            creation/deletion, IP key hashing

  `src/worker/lib/crypto.ts`                Random tokens, Base64URL, SHA-256,
                                            HMAC, constant-time compare,
                                            AES-GCM, PIN verifier

  `src/worker/lib/google-drive.ts`          Google OAuth token refresh, Drive
                                            API wrapper, root-folder
                                            validation/discovery, paginated
                                            file listing

  `src/worker/routes/auth.ts`               Setup, login, session, logout,
                                            recovery rotation and PIN change
                                            endpoints

  `src/worker/routes/drive.ts`              OAuth, storage, listing, reindex,
                                            folder, upload, content,
                                            rename/trash/permanent-delete
                                            endpoints

  `src/worker/routes/vault.ts`              Favorites, recent, trash
                                            restore/delete, settings and
                                            MyVault ancestry validation

  `migrations/0001_initial.sql`             Initial D1 schema

  `migrations/0002_personal_features.sql`   Favorites and recent tables/index

  `scripts/initialize-owner.mjs`            Interactive owner setup script;
                                            reads SETUP_SECRET from `.dev.vars`
                                            and calls `/api/auth/setup`

  `tests/crypto.test.ts`                    Two crypto smoke tests: PIN
                                            verification and AES-GCM round trip

  `public/favicon.svg`                      Browser favicon

  `index.html`                              Vite HTML entry point

  `wrangler.jsonc`                          Worker deployment, assets, D1
                                            bindings, environment configuration

  `vite.config.ts`                          React plugin, alias, Vite port and
                                            API proxy, build settings

  `package.json`                            Scripts and dependencies

  `.dev.vars.example`                       Placeholder template for local
                                            secrets; never use real values in
                                            this file

  `README.md`                               Original project setup and
                                            milestone notes; some parts are
                                            stale compared with current code

  `SECURITY.md`                             Security policy and secret handling
                                            notes

  `DEPLOYMENT.md`                           Original production deployment
                                            runbook; some instructions are
                                            stale for the current named
                                            production environment

  `TESTING.md`                              Earlier foundation test report; it
                                            predates the later successful local
                                            tests
  -----------------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Frontend implementation

## 5.1 Entry point

`src/client/main.tsx` is intentionally small:

-   Imports React and ReactDOM.
-   Imports `App`.
-   Imports `styles.css`.
-   Mounts the React application into `#root` using
    `ReactDOM.createRoot`.
-   Wraps the app in `React.StrictMode`.

There is no service-worker registration in the supplied `main.tsx`.

## 5.2 Main application

`src/client/App.tsx` is the primary UI and contains most frontend
behavior. It is a single large component rather than a
component-per-feature architecture.

### Main state categories

-   Initialization and authentication: `initialized`, `pinLength`,
    `authenticated`, `pin`, `loginBusy`.
-   File navigation: `files`, `folderStack`, `rootFolderId`,
    `activeNav`.
-   Google Drive state: `driveConnected`, `storage`.
-   Search and display: `search`, `sortBy`, `fileFilter`, `view`.
-   Appearance: `dark`, persisted using localStorage key `mv-theme`.
-   UI state: mobile menu, loading, upload progress, toast
    notifications, folder dialog, settings modal, preview modal.
-   Security settings: current PIN, recovery key, new PIN, confirmation
    and selected PIN length.
-   Favorites: `favoriteIds`.

### Main frontend functions/handlers

  -----------------------------------------------------------------------
  Function/handler                    Responsibility
  ----------------------------------- -----------------------------------
  `toast`                             Displays success/error toast
                                      messages; removes them after 3.5
                                      seconds

  `loadFiles`                         Calls `api.files`, updates file
                                      list/root folder and marks Drive
                                      connected

  `loadSpecial`                       Loads Favorites, Recent or Trash

  `toggleFavorite`                    Toggles a favorite and updates
                                      local UI state

  `restoreFile`                       Restores a trashed item

  `permanentlyDelete`                 Confirms and permanently deletes an
                                      item

  `refreshSettings`                   Fetches auth/storage connection
                                      status

  `submitPinChange`                   Validates new PIN and confirmation,
                                      calls API, clears session UI

  `refreshStorage`                    Fetches Google account quota

  `boot`                              Reads auth status, checks session,
                                      checks Drive connection and loads
                                      data

  `handleSearchShortcut`              Supports Ctrl/Cmd+K search focus
                                      and Escape clear

  `visibleFiles`                      Derived filtered/sorted list for
                                      display

  `submitPin`                         Logs in with PIN and initializes
                                      authenticated UI

  `logout`                            Logs out current browser session

  `connectDrive`                      Requests OAuth URL then redirects
                                      browser to Google

  `uploadFiles`                       Creates resumable session and sends
                                      file chunks

  `createFolder`                      Creates a folder under current
                                      folder

  `renameFile`                        Uses browser prompt and calls
                                      rename endpoint

  `moveToTrash`                       Calls Drive patch with
                                      `trashed: true`

  `openFolder`                        Pushes folder into navigation stack

  `openFile`                          Records recent item and opens
                                      preview modal

  `navigateTo`                        Moves up/back through folder stack
  -----------------------------------------------------------------------

## 5.3 Main navigation sections

The UI declares:

-   My files
-   Photos
-   Videos
-   Documents
-   Favorites
-   Recent
-   Trash
-   Settings

Photos, Videos and Documents are presentation/navigation categories in
the UI. In the supplied implementation, the visible file list is loaded
from the selected folder and client-side filtering is used; these labels
should not be mistaken for separate server-side storage systems.

## 5.4 File operations in the UI

-   Folder click: opens folder and appends it to `folderStack`.
-   File click: tracks Recent, then opens preview.
-   Image files: use `<img>` with authenticated content URL.
-   Video files: use `<video controls>`.
-   Audio files: use `<audio controls>`.
-   PDFs: use `<iframe>`.
-   Other file types: show a preview-unavailable message and download
    link.
-   Download: opens content URL with `download=1`.
-   Rename: browser `window.prompt`.
-   Move to trash: Drive `PATCH` operation.
-   Permanent deletion: confirmation prompt, then API delete.
-   Favorites: heart button.
-   Trash: restore and permanent delete actions.

Browser preview support is format-dependent. Storing and downloading a
file does not guarantee that every browser can preview it.

## 5.5 Appearance and local browser state

The theme is stored in browser local storage under:

``` text
mv-theme
```

This is a local display preference, not a D1 setting. It may differ
between browsers/devices.

The supplied source contains no service worker registration and no PWA
plugin in `vite.config.ts`.

------------------------------------------------------------------------

# 6. Frontend API client

File: `src/client/lib/api.ts`

## 6.1 Shared request helper

The `request<T>` helper:

-   Prefixes paths with `/api`.
-   Uses `fetch`.
-   Sets `credentials: "same-origin"` so the session cookie is sent.
-   Adds JSON content type when a request body exists and is not
    `FormData`.
-   Parses JSON response, falling back to `{}` if parsing fails.
-   Throws an `Error` using the server's `error` property or an HTTP
    status fallback when response is not OK.

## 6.2 VaultFile shape

The frontend expects:

``` ts
interface VaultFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  createdTime?: string;
  modifiedTime?: string;
  isFolder: boolean;
  trashed?: boolean;
}
```

## 6.3 API wrapper methods

  ---------------------------------------------------------------------------------
  Client method                               HTTP endpoint
  ------------------------------------------- -------------------------------------
  `authStatus()`                              `GET /api/auth/status`

  `me()`                                      `GET /api/auth/me`

  `login(pin)`                                `POST /api/auth/login`

  `logout()`                                  `POST /api/auth/logout`

  `driveStatus()`                             `GET /api/drive/status`

  `driveConnect()`                            `GET /api/drive/connect`

  `storage()`                                 `GET /api/drive/storage`

  `files(folder, trashed)`                    `GET /api/drive/files`

  `createFolder(name, parentId)`              `POST /api/drive/folders`

  `initUpload(file, parentId)`                `POST /api/drive/upload/init`

  `uploadChunk(...)`                          `PUT /api/drive/upload/:id`

  `rename(id, name)`                          `PATCH /api/drive/files/:id`

  `trash(id)`                                 `PATCH /api/drive/files/:id`

  `favorites()`                               `GET /api/vault/favorites`

  `toggleFavorite(id)`                        `POST /api/vault/favorites/:id`

  `recent()`                                  `GET /api/vault/recent`

  `trackRecent(id)`                           `POST /api/vault/recent/:id`

  `trashList()`                               `GET /api/vault/trash`

  `restore(id)`                               `POST /api/vault/trash/:id/restore`

  `permanentlyDelete(id)`                     `DELETE /api/vault/trash/:id`

  `settings()`                                `GET /api/vault/settings`

  `logoutAll()`                               `POST /api/auth/logout-all`

  `rotateRecovery(currentPin, recoveryKey)`   `POST /api/auth/rotate-recovery`

  `changePin(...)`                            `POST /api/auth/change-pin`
  ---------------------------------------------------------------------------------

`contentUrl(file, download)` builds:

``` text
/api/drive/files/{encoded-file-id}/content?download=0|1&name={file-name}
```

The `name` query parameter is used for the Content-Disposition filename.

------------------------------------------------------------------------

# 7. Backend Worker architecture

File: `src/worker/index.ts`

## 7.1 Hono setup

The Worker creates a Hono app typed with the `Env` interface.

Routes are mounted:

``` text
/api/auth  -> authRoutes
/api/drive -> driveRoutes
/api/vault -> vaultRoutes
```

Health endpoint:

``` text
GET /api/health
```

Response:

``` json
{
  "status": "ok",
  "service": "myvault-api",
  "version": "0.1.0"
}
```

Unknown API route returns:

``` json
{ "error": "API route not found." }
```

## 7.2 API middleware

For `/api/*`, the Worker sets:

-   `X-Content-Type-Options: nosniff`
-   `X-Frame-Options: DENY`
-   `Referrer-Policy: no-referrer`
-   `Permissions-Policy: camera=(), microphone=(), geolocation=()`
-   `Cache-Control: no-store`
-   `Strict-Transport-Security: max-age=31536000` when request URL is
    HTTPS.

Origin middleware:

-   Reads request `Origin`.
-   Expected origin is `APP_ORIGIN`, or the request URL's origin if
    `APP_ORIGIN` is unset.
-   If Origin exists and does not equal expected origin, returns `403`
    with `Cross-origin request blocked.`
-   Requests with no Origin header are not rejected by this middleware.

Static asset responses receive: - `X-Content-Type-Options` -
`X-Frame-Options` - `Referrer-Policy` - `Permissions-Policy` - HTTPS
HSTS - Content Security Policy:

``` text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
media-src 'self' blob:;
connect-src 'self';
frame-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Global error handler returns generic JSON:

``` json
{ "error": "An unexpected server error occurred." }
```

It logs a generic message, not the detailed exception. This is
intentional to avoid exposing internal/provider data to the browser. For
local debugging, use temporary safe diagnostics and remove them before
production deployment.

------------------------------------------------------------------------

# 8. Worker environment bindings and secrets

File: `src/worker/types.ts`

## 8.1 Env interface

  ------------------------------------------------------------------------
  Binding/variable         Type                    Purpose
  ------------------------ ----------------------- -----------------------
  `DB`                     `D1Database`            D1 database

  `ASSETS`                 `Fetcher`               Static frontend assets

  `APP_PEPPER`             string                  HMAC pepper for
                                                   PIN/recovery
                                                   verification and IP
                                                   hashing

  `SETUP_SECRET`           string                  Authorizes first-time
                                                   owner setup

  `APP_ENCRYPTION_KEY`     string                  32-byte AES key encoded
                                                   as 64 hex characters

  `GOOGLE_CLIENT_ID`       optional string         OAuth client ID

  `GOOGLE_CLIENT_SECRET`   optional string         OAuth client secret

  `APP_ORIGIN`             optional string         Expected frontend
                                                   origin and OAuth
                                                   redirect destination
  ------------------------------------------------------------------------

## 8.2 Local `.dev.vars`

The owner has a private `.dev.vars` file in the project root. Known
variable names:

``` text
APP_PEPPER
SETUP_SECRET
APP_ENCRYPTION_KEY
APP_ORIGIN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The actual values must never be included in documentation, source
archives, GitHub, screenshots or AI prompts.

The supplied `.dev.vars.example` contains placeholders only.

## 8.3 Production secrets

Production values are configured as Cloudflare Worker secrets/variables.
They are not in `wrangler.jsonc` or source code.

Do not regenerate these casually:

-   Changing `APP_PEPPER` can invalidate PIN/recovery verification and
    IP-key derivation.
-   Changing `APP_ENCRYPTION_KEY` makes already encrypted Google
    refresh/access tokens and upload session URLs undecryptable unless
    migrated.
-   Changing `SETUP_SECRET` affects only setup authorization, but should
    still be protected.
-   Rotating Google OAuth client secret may require updating both
    Cloudflare production secret and local `.dev.vars`.

------------------------------------------------------------------------

# 9. Authentication and session system

Files: - `src/worker/routes/auth.ts` - `src/worker/lib/auth.ts` -
`src/worker/lib/crypto.ts`

## 9.1 Authentication model

The active implementation is PIN authentication. The schema has a
reserved `username_password` mode and username/password columns, but the
supplied auth routes do not implement username/password login.

PIN length is 4 or 6 digits. Setup defaults to 6 unless `pinLength` is
explicitly `4`. Existing production account is known from the owner to
use a 4-digit PIN. Do not change it without explicit instruction.

## 9.2 Owner setup

Endpoint:

``` text
POST /api/auth/setup
```

Requires: - `APP_PEPPER` configured and at least 32 characters. -
`X-Setup-Secret` header matching `SETUP_SECRET`. - Request body with PIN
and optional PIN length.

Body:

``` json
{
  "pin": "1234",
  "pinLength": 4
}
```

The example PIN is illustrative only. Never use it as a real credential.

Behavior: 1. Checks security configuration. 2. Compares setup header
using `safeEqual`. 3. Rejects if already initialized. 4. Validates PIN
length and digits. 5. Generates salted HMAC PIN verifier. 6. Generates
random recovery key and salt. 7. Stores HMAC of `salt:recoveryKey`. 8.
Writes owner config row. 9. Returns recovery key once.

The API explicitly states that the recovery key will not be shown again.
The owner must save it offline.

## 9.3 Login

Endpoint:

``` text
POST /api/auth/login
```

Body:

``` json
{ "pin": "owner-pin" }
```

Flow: 1. Requires valid `APP_PEPPER`. 2. Derives an HMAC of the client
IP (`CF-Connecting-IP`) using APP_PEPPER. 3. Checks `login_attempts` for
active lockout. 4. Loads owner config. 5. Validates PIN format. 6.
Verifies HMAC using stored salt and APP_PEPPER. 7. On failure, records a
failed attempt. 8. On success, clears failed attempts and creates
session.

### Login throttling implementation

`recordFailure`: - Stores attempts per HMAC-derived IP key. - Uses a
900-second (15-minute) attempt window. - Blocks when attempts reach 5. -
Block duration is 900 seconds (15 minutes).

The implementation is per IP hash, not per account/device. A user behind
shared NAT can share the same IP-based counter.

## 9.4 Session model

File: `src/worker/lib/auth.ts`

-   Cookie name: `mv_session`.
-   Session token: 32 random bytes encoded Base64URL.
-   Database stores SHA-256 hash of token, not raw cookie token.
-   Session lifetime: 4 hours (`SESSION_SECONDS` in auth helper).
-   Cookie flags:
    -   `HttpOnly`
    -   `SameSite=Strict`
    -   `Path=/`
    -   `Max-Age` matching session lifetime
    -   `Secure` when request uses HTTPS.
-   `requireAuth` reads cookie, hashes it, checks unexpired session in
    D1, updates `last_seen_at`, then allows request.

The cookie is not stored in localStorage. The frontend uses
`credentials: "same-origin"`.

## 9.5 Auth endpoints

  -------------------------------------------------------------------------------------
  Method           Endpoint                             Auth required? Purpose
  ---------------- ----------------------------- --------------------- ----------------
  GET              `/api/auth/status`                               No Returns
                                                                       initialized,
                                                                       authMode,
                                                                       pinLength

  POST             `/api/auth/setup`                      Setup secret First owner
                                                                       initialization

  POST             `/api/auth/login`                                No Verify PIN and
                                                                       create session

  GET              `/api/auth/me`                                  Yes Validate current
                                                                       session

  POST             `/api/auth/logout`                               No Delete current
                                                                       session and
                                                                       clear cookie

  POST             `/api/auth/logout-all`                          Yes Delete all
                                                                       sessions and
                                                                       clear current
                                                                       cookie

  POST             `/api/auth/rotate-recovery`                     Yes Verify current
                                                                       PIN + old
                                                                       recovery key,
                                                                       issue new key

  POST             `/api/auth/change-pin`                          Yes Verify current
                                                                       PIN + recovery
                                                                       key, update PIN,
                                                                       delete all
                                                                       sessions
  -------------------------------------------------------------------------------------

### `/api/auth/status` response

``` json
{
  "initialized": true,
  "authMode": "pin",
  "pinLength": 4
}
```

Values depend on the database.

### `/api/auth/me` response

``` json
{ "authenticated": true }
```

### Logout all

Deletes all rows from `sessions`. Current response also clears the
caller's cookie.

### Recovery rotation

Request:

``` json
{
  "currentPin": "owner-pin",
  "recoveryKey": "existing-recovery-key"
}
```

Returns a new recovery key. It is only returned once; save it privately.

### Change PIN

Request:

``` json
{
  "currentPin": "current-pin",
  "recoveryKey": "current-recovery-key",
  "newPin": "new-pin",
  "pinLength": 4
}
```

On success: - Updates PIN length, salt and hash. - Deletes every
session. - User must log in again.

The frontend has a Change PIN form and Replace recovery key action in
Settings.

------------------------------------------------------------------------

# 10. Cryptographic implementation

File: `src/worker/lib/crypto.ts`

## 10.1 Random token generation

`randomToken(bytes = 32)`: - Uses `crypto.getRandomValues`. - Encodes
bytes using Base64URL. - Used for sessions, OAuth state, recovery keys,
salts and upload IDs.

## 10.2 Base64URL

-   `toBase64Url` converts bytes to Base64URL without padding.
-   `fromBase64Url` converts Base64URL back to bytes.

## 10.3 SHA-256

`sha256(value)` uses Web Crypto SHA-256 and returns Base64URL.

Used for session token hashing.

## 10.4 HMAC-SHA-256

`hmac(value, secret)` imports a raw secret as HMAC SHA-256 and signs the
supplied value.

Used for: - PIN verifier. - Recovery-key verifier. - IP key derivation
for login attempts.

## 10.5 Constant-time string comparison

`safeEqual(a, b)`: - Returns false if lengths differ. - XORs
corresponding character codes and accumulates mismatch. - Returns true
only if mismatch is zero.

## 10.6 AES-GCM token encryption

`encryptText(plaintext, keyHex)`: - Requires exactly 64 hex
characters. - Converts 32 bytes of key material. - Imports AES-GCM
key. - Generates random 12-byte IV. - Encrypts plaintext. - Returns
`base64url(iv).base64url(ciphertext)`.

`decryptText(payload, keyHex)` reverses the process.

Used to protect: - Google refresh token. - Google access token. - Google
resumable upload session URL.

This is encryption of integration credentials/URLs, not client-side
end-to-end encryption of file content. File bytes are sent to Google
Drive.

## 10.7 PIN verifier

`createPinVerifier(pin, pepper)`: - Creates 16-byte random salt. -
Computes HMAC of `${salt}:${pin}` using APP_PEPPER. - Returns salt and
hash.

`verifyPin` recomputes HMAC and compares with `safeEqual`.

**Important security caveat:** This is a fast HMAC verifier, not a
deliberately slow password KDF such as Argon2id/scrypt/PBKDF2. Rate
limiting is therefore important. A 4-digit PIN has only 10,000 possible
values; it should not be treated as a high-entropy password. The owner's
current 4-digit PIN is a deliberate existing choice and must not be
changed without consent.

------------------------------------------------------------------------

# 11. Google OAuth and Drive integration

Files: - `src/worker/routes/drive.ts` - `src/worker/lib/google-drive.ts`

## 11.1 OAuth scope

The README documents Google Drive OAuth scope:

``` text
drive.file
```

This is narrower than full Drive access. The app is designed to manage
files created by or explicitly opened with the app, inside its dedicated
MyVault folder. Do not assume it can browse every arbitrary file in the
user's Drive.

## 11.2 OAuth connection flow

1.  User clicks Connect storage.
2.  Frontend calls `GET /api/drive/connect`.
3.  Backend checks `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4.  Backend creates random state (24 bytes).
5.  State and creation timestamp are stored in `app_config`.
6.  Backend returns Google authorization URL.
7.  Browser redirects to Google.
8.  Google redirects to `/api/drive/callback` with code and state.
9.  Callback validates state exists, is not older than 10 minutes, and
    is not from the future.
10. Callback atomically consumes state with conditional SQL update
    before exchanging the code.
11. Backend exchanges authorization code with Google token endpoint.
12. Refresh and access tokens are encrypted using APP_ENCRYPTION_KEY and
    saved to D1.
13. Backend ensures the MyVault root folder exists.
14. Browser is redirected to `/?drive=connected` or a specific error
    query.

### OAuth state behavior

The current code uses one OAuth state value in the single `app_config`
row. It is atomically consumed, so a replayed callback cannot pass the
same state check. Because there is one state slot, multiple simultaneous
connection attempts can overwrite one another; this is acceptable for a
single-owner personal app but should be considered if changing to
multi-user/multi-flow OAuth.

## 11.3 Root folder

Root folder name:

``` text
MyVault Storage
```

`ensureRootFolder`: 1. Reads `google_root_folder_id` from app_config. 2.
If present, fetches that Drive folder and verifies: - ID matches stored
ID. - Name is `MyVault Storage`. - MIME type is Google folder. - It is
not trashed. 3. If invalid/missing, clears stored root ID. 4. Searches
Google Drive for a non-trashed folder with the root name. 5. Reuses a
matching folder or creates one. 6. Stores root folder ID if still null.

This helps recover after D1 metadata loss without intentionally creating
a new folder when the existing app root can be rediscovered by name.

## 11.4 Access-token refresh

`getDriveAccessToken`: - Requires Google client ID and secret. - Loads
app config and encrypted refresh token. - If encrypted access token
exists and expiry is more than 60 seconds away, decrypts and returns
it. - Otherwise decrypts refresh token and sends a refresh-token grant
to `https://oauth2.googleapis.com/token`. - Encrypts returned access
token. - Saves access token and expiry timestamp in D1. - Returns access
token.

If refresh fails, API throws a generic reconnect-storage error. The
frontend should prompt reconnect from Settings.

## 11.5 Drive request helper

`driveRequest`: - Accepts only a path beginning with `/`, not `//`. -
Gets a Drive access token. - Adds `Authorization: Bearer ...`. - Calls
`https://www.googleapis.com/drive/v3`. - Throws a status-only error on
non-OK responses; it deliberately does not include provider response
body. - Returns undefined on HTTP 204, otherwise parses JSON.

## 11.6 File listing pagination

`listDriveFiles`: - Uses Drive query for a parent folder and trashed
status. - Requests page size 100. - Orders by `folder,name`. - Requests
file ID/name/MIME/size/parents/timestamps/webViewLink/trashed. - Follows
`nextPageToken`. - Stops when no token remains or 10,000 files have been
collected.

The README's older note claiming only first 100 files are listed is
stale relative to the supplied current `google-drive.ts`, which
implements pagination up to 10,000 per listing call.

------------------------------------------------------------------------

# 12. Drive API routes and file workflows

File: `src/worker/routes/drive.ts`

All routes below are mounted under `/api/drive`.

## 12.1 Drive route summary

  --------------------------------------------------------------------------------
  Method           Path                                    Auth Purpose
  ---------------- ---------------------- --------------------- ------------------
  GET              `/status`                                Yes Reports whether
                                                                refresh token
                                                                exists and root
                                                                folder ID is saved

  GET              `/connect`                               Yes Creates OAuth
                                                                state and returns
                                                                Google
                                                                authorization URL

  GET              `/callback`                      OAuth state Processes Google
                                                                OAuth callback

  GET              `/storage`                               Yes Returns Google
                                                                account quota

  GET              `/files`                                 Yes Lists items in a
                                                                MyVault folder

  POST             `/reindex`                               Yes Rebuilds file
                                                                metadata index
                                                                recursively

  POST             `/folders`                               Yes Creates a folder

  POST             `/upload/init`                           Yes Starts Google
                                                                resumable upload

  PUT              `/upload/:id`                            Yes Sends one upload
                                                                chunk

  GET              `/files/:id/content`                     Yes Streams/returns
                                                                file content for
                                                                preview/download

  PATCH            `/files/:id`                             Yes Rename and/or move
                                                                item to/from trash

  DELETE           `/files/:id`                             Yes Permanently
                                                                deletes a
                                                                non-trashed
                                                                managed item
  --------------------------------------------------------------------------------

## 12.2 `GET /api/drive/status`

Returns:

``` json
{
  "connected": true,
  "rootFolderReady": true
}
```

`connected` means an encrypted refresh token exists in D1. It does not
itself prove the refresh token is still accepted by Google. A later
Drive API request verifies actual authorization.

## 12.3 `GET /api/drive/connect`

Requires authenticated session and configured Google OAuth credentials.

Returns:

``` json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

The frontend redirects to this URL.

## 12.4 `GET /api/drive/callback`

Not protected by `requireAuth`, because Google redirects to it during
OAuth. It validates the state and authorization code.

Possible redirect query statuses include: - `drive=state-error` -
`drive=not-configured` - `drive=token-error` -
`drive=missing-refresh-token` - `drive=folder-error` - `drive=connected`

## 12.5 `GET /api/drive/storage`

Calls Drive `/about?fields=storageQuota`.

Returns numeric values:

``` json
{
  "limit": 0,
  "usage": 0,
  "usageInDrive": 0
}
```

The values above are shape examples, not the owner's actual quota.

## 12.6 `GET /api/drive/files`

Query parameters: - `folder` optional Drive folder ID; default is
MyVault root. - `trashed=true` optionally requests trashed children for
the chosen parent.

The selected parent must be within the MyVault root tree.

Response:

``` json
{
  "files": [
    {
      "id": "drive-file-id",
      "name": "example.pdf",
      "mimeType": "application/pdf",
      "size": 1234,
      "parentId": "parent-id",
      "createdTime": "ISO timestamp",
      "modifiedTime": "ISO timestamp",
      "isFolder": false,
      "trashed": false
    }
  ],
  "currentFolderId": "folder-id",
  "rootFolderId": "root-id"
}
```

For returned files, the backend upserts metadata into D1's `files`
table. This creates/refreshes the index used by Favorites, Recent and
Trash operations.

## 12.7 Folder ownership/ancestry checks

The Drive routes define `isManagedFolder` and `isManagedItem` helpers.

The general logic is: - Obtain MyVault root folder ID. - A folder is
managed if it is the root or its parent chain reaches the root. - The
traversal is bounded to 20 levels. - A file item is managed if its
metadata row exists, it is not trashed, it has a parent, and its parent
folder is managed.

The Vault routes have their own `managed` ancestry helper, also bounded
to 20 levels.

These checks are important because the OAuth scope and application
intent are to operate only inside the MyVault folder.

## 12.8 `POST /api/drive/reindex`

Recursively indexes files from the MyVault root: - Queue-based
traversal. - Maximum depth 20. - Maximum 5,000 indexed items. - Lists
children with `listDriveFiles`. - Upserts metadata into D1. - Batches D1
statements in groups of 100. - Returns
`{ success, indexed, truncated }`.

This endpoint is intended for metadata-index recovery after a D1
metadata loss or when index state needs rebuilding.

Note: the route has a 5,000-item total cap even though each individual
folder listing can retrieve up to 10,000 items. If the tree is larger,
`truncated` may be true and the reindex strategy needs to be improved.

## 12.9 `POST /api/drive/folders`

Body:

``` json
{
  "name": "College",
  "parentId": "optional-parent-folder-id"
}
```

Validation: - Valid JSON object. - Name is trimmed. - Name must be
1--120 characters. - Control characters are rejected. - Parent defaults
to MyVault root. - Parent must be a managed folder.

Returns HTTP 201 with folder ID and name.

## 12.10 Resumable upload

### Step 1: Initialize

Endpoint:

``` text
POST /api/drive/upload/init
```

Body:

``` json
{
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "size": 123456,
  "parentId": "optional-parent-id"
}
```

Validation: - Name required, trimmed, maximum 255 characters, no control
characters. - Size must be a positive safe integer. - Maximum declared
file size is 15 GiB. - Parent ID, if supplied, must be a non-empty
string. - MIME type maximum 255 characters and no CR/LF. - Destination
must be a managed folder.

Backend: - Obtains access token. - Starts Google Drive resumable
upload. - Validates returned upload URL starts with expected Google
upload endpoint. - Generates upload ID. - Encrypts resumable URL using
APP_ENCRYPTION_KEY. - Stores upload session in D1 for 7 days. - Returns
chunk size 8 MiB.

Response:

``` json
{
  "uploadId": "opaque-upload-id",
  "chunkSize": 8388608
}
```

### Step 2: Send chunks

Endpoint:

``` text
PUT /api/drive/upload/:id
```

Headers: - `Content-Type: application/octet-stream` -
`Content-Range: bytes start-end/total`

The frontend slices file with `file.slice(offset, end)` and sends chunks
sequentially.

Backend validation: - Upload session exists and is not expired. -
Destination folder remains within MyVault. - Content-Range follows
expected syntax. - Content-Length exists and is positive. - Chunk size
must not exceed 8 MiB (the code also checks 9 MiB upper bound before the
stricter 8 MiB validation). - Range values must be safe integers. - End
must be at least start and less than total file size. - Total must equal
the stored upload size. - Declared range byte count must match
Content-Length. - Decrypted session URL must use HTTPS, hostname
`www.googleapis.com`, and expected upload path prefix.

Google resumable responses: - HTTP 200/201: complete; upload session
deleted; response `{ complete: true, file }`. - HTTP 308: incomplete;
returns `{ complete: false, range }`. - Other status: returns 502 upload
failure.

The current upload session row is deleted on successful completion.
Expired/incomplete sessions are not shown to have a scheduled cleanup
task in the supplied source.

## 12.11 `GET /api/drive/files/:id/content`

Requires authenticated session and managed-file check.

-   Gets access token.
-   Supports incoming HTTP `Range` header.
-   Requests Drive file content with `alt=media`.
-   Returns 200 or 206 response body.
-   Sets `Cache-Control: private, no-store`.
-   Sets `Content-Disposition` to `inline` by default or `attachment`
    when `download=1`.
-   Uses encoded `name` query parameter for filename.
-   Passes through Content-Type, Content-Length and Content-Range if
    supplied.
-   Sets `Accept-Ranges: bytes`.

Browser previews rely on the returned MIME type and browser
capabilities.

## 12.12 `PATCH /api/drive/files/:id`

Supports one or both: - `name`: rename. - `trashed`: boolean to move
into/out of Drive Trash.

Body example:

``` json
{ "name": "renamed-document.pdf" }
```

or:

``` json
{ "trashed": true }
```

Validation: - File must be a managed, non-trashed item before
operation. - JSON object required. - Name must be non-empty, \<=255
characters, no control characters. - `trashed` must be boolean. - At
least one supported change must be supplied.

Updates Google Drive then updates D1 file metadata.

## 12.13 `DELETE /api/drive/files/:id`

This route permanently deletes a managed, non-trashed file from Google
Drive and deletes associated `files`, `favorites` and `recent_items`
rows from D1.

The UI's normal delete action is Move to Trash, not this
permanent-delete route. Permanent deletion from the Trash UI is handled
by `/api/vault/trash/:id`.

------------------------------------------------------------------------

# 13. Vault routes: Favorites, Recent, Trash and settings

File: `src/worker/routes/vault.ts`

Mounted under `/api/vault`.

  Method   Path                   Purpose
  -------- ---------------------- -------------------------------------------
  GET      `/favorites`           List favorited, non-trashed indexed items
  POST     `/favorites/:id`       Toggle favorite state
  GET      `/recent`              List recent, non-trashed indexed items
  POST     `/recent/:id`          Record opened timestamp
  GET      `/trash`               List indexed trashed items
  POST     `/trash/:id/restore`   Restore trashed Drive item
  DELETE   `/trash/:id`           Permanently delete trashed Drive item
  GET      `/settings`            Return auth/Drive/session summary

All these routes require a valid MyVault session.

## 13.1 Favorites

`GET /favorites`: - Joins `favorites` to `files`. - Excludes trashed
files. - Sorts newest favorite first. - Limits to 500. - Adds `isFolder`
based on MIME type.

`POST /favorites/:id`: - Checks item is managed. - If favorite exists,
deletes it. - Otherwise inserts favorite with current timestamp. -
Returns `{ favorite: true|false }`.

## 13.2 Recent

`GET /recent`: - Joins `recent_items` to `files`. - Excludes trashed
items. - Orders by opened timestamp descending. - Limits to 100.

`POST /recent/:id`: - Checks item is managed. - Upserts `opened_at`
timestamp.

The frontend records Recent on file open. It does not necessarily record
folder navigation as Recent.

## 13.3 Trash

`GET /trash`: - Reads `files` rows where `is_trashed=1`. - Orders by
modified timestamp descending. - Limits to 500. - Returns
`trashed: true` and `isFolder`.

`POST /trash/:id/restore`: - Confirms indexed row exists and is
trashed. - Checks MyVault ancestry. - Calls Google Drive PATCH
`{ trashed: false }`. - Updates D1 `is_trashed=0`.

`DELETE /trash/:id`: - Confirms indexed row exists and is trashed. -
Checks managed ancestry. - Permanently deletes from Google Drive. -
Deletes D1 `files`, `favorites`, `recent_items` rows in a batch.

## 13.4 Settings

`GET /settings` returns: - `authMode` - `pinLength` - `driveConnected`
based on presence of encrypted refresh token - `activeSessions` count

It does not return secret material.

------------------------------------------------------------------------

# 14. Database schema

Migrations: - `migrations/0001_initial.sql` -
`migrations/0002_personal_features.sql`

D1 is SQLite-compatible.

## 14.1 `app_config`

One row only (`id = 1` enforced by CHECK constraint).

  -----------------------------------------------------------------------
  Column                              Meaning
  ----------------------------------- -----------------------------------
  `id`                                Fixed primary key 1

  `is_initialized`                    Whether owner setup has completed

  `auth_mode`                         `pin` or reserved
                                      `username_password`

  `pin_length`                        4 or 6

  `pin_salt`, `pin_hash`              PIN verifier material

  `recovery_salt`, `recovery_hash`    Recovery-key verifier material

  `username`, `password_salt`,        Reserved schema fields; not used by
  `password_hash`                     supplied login route

  `google_refresh_token_enc`          Encrypted Drive refresh token

  `google_access_token_enc`           Encrypted access token

  `google_access_token_expires_at`    Unix expiry timestamp

  `google_root_folder_id`             MyVault Storage folder ID in Drive

  `google_oauth_state`                Temporary OAuth state

  `google_oauth_state_created_at`     OAuth state creation time

  `created_at`, `updated_at`          Unix timestamps
  -----------------------------------------------------------------------

## 14.2 `sessions`

  Column           Meaning
  ---------------- -----------------------------------------
  `id`             Session UUID primary key
  `token_hash`     Unique SHA-256 hash of raw cookie token
  `created_at`     Unix timestamp
  `expires_at`     Unix timestamp
  `last_seen_at`   Unix timestamp

Index: `idx_sessions_expiry(expires_at)`.

## 14.3 `login_attempts`

  Column                Meaning
  --------------------- -----------------------------------------
  `ip_hash`             HMAC-derived IP identifier; primary key
  `attempts`            Failure count
  `window_started_at`   Unix timestamp
  `blocked_until`       Unix timestamp, 0 when not blocked

## 14.4 `files`

  Column              Meaning
  ------------------- ---------------------------------------------------
  `id`                Local primary key; currently set to Drive file ID
  `drive_file_id`     Unique Google Drive file ID
  `name`              File/folder name
  `mime_type`         MIME type
  `size_bytes`        File size
  `parent_drive_id`   Parent Drive folder ID
  `is_trashed`        0 or 1
  `created_at`        Unix timestamp
  `modified_at`       Unix timestamp

Indexes: - `idx_files_parent(parent_drive_id, is_trashed)` -
`idx_files_name(name)`

This is an application metadata/index table, not the actual file-content
store.

## 14.5 `upload_sessions`

  -----------------------------------------------------------------------
  Column                              Meaning
  ----------------------------------- -----------------------------------
  `id`                                Random upload ID primary key

  `drive_session_url_enc`             AES-GCM encrypted Google resumable
                                      session URL

  `file_name`                         Original upload name

  `mime_type`                         MIME type

  `size_bytes`                        Declared total size

  `parent_drive_id`                   Upload destination

  `created_at`                        Unix timestamp

  `expires_at`                        Unix timestamp
  -----------------------------------------------------------------------

Session expiration is set to 7 days in upload init. No scheduled cleanup
is visible in the supplied source.

## 14.6 `share_links`

  Column                             Meaning
  ---------------------------------- ----------------------------
  `id`                               Primary key
  `token_hash`                       Unique token hash
  `drive_file_id`                    Target Drive file
  `expires_at`                       Optional expiration
  `allow_download`                   Download flag
  `password_salt`, `password_hash`   Optional password verifier
  `revoked_at`                       Revocation timestamp
  `created_at`                       Creation timestamp

Index: `idx_share_token(token_hash)`.

**Important:** This table exists in migration 0001, but the supplied
backend has no share-link endpoints and the frontend has no share-link
UI. Do not treat sharing as implemented.

## 14.7 `favorites`

Added in migration 0002.

  Column            Meaning
  ----------------- ----------------
  `drive_file_id`   Primary key
  `created_at`      Unix timestamp

## 14.8 `recent_items`

Added in migration 0002.

  Column            Meaning
  ----------------- ----------------
  `drive_file_id`   Primary key
  `opened_at`       Unix timestamp

Index: `idx_recent_opened(opened_at DESC)`.

## 14.9 Relationships and integrity notes

The supplied migrations do not define SQL foreign-key constraints
between favorites/recent/files or upload_sessions/files. The application
manages these relationships in route code.

For example, permanent deletion explicitly removes metadata rows from
`files`, `favorites` and `recent_items`.

------------------------------------------------------------------------

# 15. Owner initialization script

File: `scripts/initialize-owner.mjs`

Purpose: run first-time setup without putting the setup secret in a
command-line argument or source file.

Behavior: 1. Reads `.dev.vars` relative to project root. 2. Extracts
`SETUP_SECRET` using a strict quoted 64-hex pattern. 3. Defaults URL to
`http://127.0.0.1:8787`. 4. Supports `MYVAULT_URL` environment variable
to target another origin. 5. Asks for PIN length (4 or 6; default 6). 6.
Reads PIN and confirmation without echo in an interactive TTY. 7. POSTs
to `/api/auth/setup` with `X-Setup-Secret`. 8. Prints recovery key once.
9. Exits with error if setup fails.

**Production warning:** Do not run `owner:init` against the already
initialized production app. The endpoint rejects repeated setup. It is
not a routine deployment command.

The script reads SETUP_SECRET from the local `.dev.vars` file even when
`MYVAULT_URL` points to production. The owner must ensure the value in
that file is intentionally the production setup secret before using it
for production initialization. This is not needed for normal maintenance
of the already initialized deployment.

------------------------------------------------------------------------

# 16. Vite, TypeScript and package configuration

## 16.1 Vite

`vite.config.ts`: - Uses `@vitejs/plugin-react`. - Alias `@` maps to
`/src/client`. - Dev server port: 5173. - `strictPort: true`. - Proxies
`/api` to `http://127.0.0.1:8787`. - Build target `es2022`. - Source
maps disabled. - Chunk warning limit 700 KB.

## 16.2 TypeScript configs

-   `tsconfig.json`: project references to app and worker configs.
-   `tsconfig.app.json`: frontend TypeScript project.
-   `tsconfig.worker.json`: Worker TypeScript project.

The build command is:

``` text
tsc -b && vite build
```

## 16.3 Dependencies

From supplied `package.json`:

### Runtime dependencies

-   `hono` `^4.10.4`
-   `lucide-react` `^0.468.0`
-   `react` `^19.1.1`
-   `react-dom` `^19.1.1`

### Development dependencies

-   `@cloudflare/workers-types` `5.20261101.1`
-   `@types/react` `^19.1.16`
-   `@types/react-dom` `^19.1.9`
-   `@vitejs/plugin-react` `^5.0.4`
-   `autoprefixer` `^10.4.21`
-   `concurrently` `^9.2.1`
-   `postcss` `^8.5.6`
-   `tailwindcss` `^3.4.18`
-   `typescript` `~5.9.3`
-   `vite` `^7.1.12` in package.json (the owner observed Vite 7.3.7
    installed)
-   `vitest` `4.1.12`
-   `wrangler` `4.156.0`

The lockfile should be treated as the authoritative resolved dependency
tree.

## 16.4 Scripts

  ------------------------------------------------------------------------
  Script                              Definition / purpose
  ----------------------------------- ------------------------------------
  `predev`                            `vite build` (runs automatically
                                      before npm dev due npm lifecycle)

  `dev`                               Starts frontend and Worker using
                                      concurrently

  `dev:frontend`                      Vite host `0.0.0.0`

  `dev:worker`                        `wrangler dev --port 8787`

  `build`                             `tsc -b && vite build`

  `preview`                           `wrangler dev --local`

  `deploy`                            `npm run build && wrangler deploy`
                                      (not environment-safe for current
                                      config; use explicit production
                                      command)

  `typecheck`                         `tsc -b --pretty`

  `db:local`                          Apply migrations to local
                                      `myvault-db`

  `db:remote`                         Apply migrations to remote
                                      `myvault-db` (stale relative to
                                      current production database naming)

  `db:create`                         Create `myvault-db`

  `owner:init`                        Run owner setup script

  `test`                              `vitest run tests`
  ------------------------------------------------------------------------

**Important stale script:** `db:remote` currently targets `myvault-db`,
not the production database name `myvault-production`. For production
migrations, explicitly run:

``` powershell
npx wrangler d1 migrations apply myvault-production --remote --env production
```

Before running any production migration, inspect migration status,
review the SQL, export D1, and confirm the correct environment/database.

------------------------------------------------------------------------

# 17. Local development procedure

## 17.1 Prerequisites

The owner previously reported: - Node `v20.20.2` in an earlier
environment; later project tool context reported Node `26.13.0`. - npm
`10.8.2` earlier; later `11.20.0`. - Wrangler `4.156.0`. - Windows
PowerShell. - Python was installed for unrelated tooling; Python is not
required to run MyVault.

README minimum: Node.js 20.19+ or 22.12+ and npm. Use a currently
supported Node LTS release compatible with Vite/Wrangler.

## 17.2 Install dependencies

``` powershell
cd "C:\Web_Devlopment\Crazy Projects\myvault"
npm install
```

## 17.3 Ensure `.dev.vars` exists

The local file is private and should be restored from the owner's secure
backup if missing. Do not send it to AI or GitHub.

## 17.4 Apply local D1 migrations

``` powershell
npm run db:local
```

This applies migrations to local `myvault-db`, not production.

## 17.5 Start local development

``` powershell
npm run dev
```

Open:

``` text
http://localhost:5173/
```

This command starts both: - Vite frontend on port 5173. - Wrangler local
Worker on port 8787.

The frontend proxies `/api` to `http://127.0.0.1:8787`.

Do not run a second independent `npx wrangler dev` at the same time.

Stop with Ctrl+C in the terminal.

## 17.6 Local Google OAuth

Previously configured local callback:

``` text
http://127.0.0.1:8787/api/drive/callback
```

The exact callback host must match the Google Cloud OAuth client
authorized redirect URI. The owner previously had to update the local
`.dev.vars` Google client secret after rotating the Google OAuth secret
in Cloudflare. If local Drive refresh fails: 1. Verify local client ID
and current client secret pair. 2. Restart `npm run dev` after
`.dev.vars` change. 3. Reconnect Drive from local Settings if the local
refresh token is invalid. 4. Do not reset production D1 or change
production PIN to fix local OAuth.

------------------------------------------------------------------------

# 18. Build, test and deploy procedure

## 18.1 Pre-deployment checks

Run:

``` powershell
npm run typecheck
npm run test
npm run build
```

Current automated tests are limited. A successful build is not a
complete security audit.

## 18.2 Preview the production configuration

``` powershell
npx wrangler deploy --env production --dry-run
```

Expected binding should include: - `env.DB (myvault-production)` -
`env.ASSETS` - production `APP_ORIGIN`

Do not proceed if it shows local `myvault-db` or placeholder database
ID.

## 18.3 Deploy production

``` powershell
npx wrangler deploy --env production
```

This builds/publishes Worker and static assets according to Wrangler.
The owner previously ran this command successfully; Wrangler showed
production D1 binding `myvault-production`.

Normal code deployment does not: - Reset D1. - Reset owner PIN. - Rotate
recovery key. - Run owner initialization. - Delete Google Drive files. -
Apply migrations automatically.

## 18.4 Production smoke test

After deployment: 1. Open production URL in a fresh tab. 2. Sign in with
existing PIN. 3. Confirm Google Drive connection. 4. Confirm
folders/files load. 5. Upload a small disposable file. 6. Preview it. 7.
Download it. 8. Confirm favorites. 9. Move an item to Trash. 10. Restore
it. 11. Only test permanent delete with disposable data.

The owner previously confirmed the core production tests passed after a
security update deployment.

------------------------------------------------------------------------

# 19. Backups and disaster recovery

## 19.1 Known source backup

The owner created a source backup at:

``` text
C:\Users\shaik\OneDrive\Documents\MyVault-Backups\Working-Version-20261101-211535
```

Robocopy reported: - 44 files copied. - 0 failures. - `.dev.vars`
excluded. - `node_modules`, `dist`, `.git`, `.wrangler`, `.venv`,
`TempData` excluded.

## 19.2 Known production D1 export

File:

``` text
C:\Users\shaik\OneDrive\Documents\MyVault-Backups\Working-Version-20261101-211535\myvault-production.sql
```

Reported size: 6,832 bytes.

The owner confirmed the export succeeded using:

``` powershell
npx wrangler d1 export myvault-production --remote --output="$dbBackup"
```

This SQL file is sensitive and must not be committed to GitHub.

## 19.3 What the D1 backup does not contain

D1 export contains application metadata and records, not the actual
Google Drive file contents. Google Drive remains the file-content source
of truth.

The following must be protected separately: - Google account access. -
Google OAuth client configuration. - Production APP_ENCRYPTION_KEY. -
Production APP_PEPPER. - Production SETUP_SECRET. - Owner recovery
key. - D1 export. - Source code backup.

## 19.4 Recovery after D1 loss

If D1 metadata is lost: 1. Stop and assess before initializing anything.
2. Prefer restoring the D1 SQL export to the existing database or a
controlled recovery database. 3. Preserve the same APP_PEPPER and
APP_ENCRYPTION_KEY. 4. If the database cannot be restored, recreate
schema carefully and understand that owner auth state and app metadata
need recovery. 5. Reconnect the same Google account if refresh-token
state is missing/unusable. 6. `ensureRootFolder` can rediscover the
`MyVault Storage` folder by name. 7. Call authenticated
`POST /api/drive/reindex` to rebuild file metadata. 8. Reindex currently
caps at 5,000 items total and depth 20; check `truncated`.

Do not assume restoring D1 alone restores Google OAuth if the encryption
key or refresh token has been lost.

## 19.5 Key rotation caution

Do not casually change APP_ENCRYPTION_KEY. Existing encrypted values
cannot be decrypted with a new key. A key rotation requires a deliberate
decrypt/re-encrypt migration or reconnecting/recreating encrypted
integration state.

Do not casually change APP_PEPPER. Existing PIN/recovery hashes and
IP-derived login attempt keys depend on it.

------------------------------------------------------------------------

# 20. Security model and boundaries

## 20.1 Existing controls in supplied source

-   PIN verifier uses HMAC-SHA-256 with per-PIN salt and server-side
    APP_PEPPER.
-   Login attempts throttled by IP-derived key.
-   Session token is random; only hash stored in D1.
-   Session cookie HttpOnly and SameSite Strict; Secure on HTTPS.
-   Four-hour session expiration.
-   Logout current session and logout all sessions.
-   AES-GCM encryption of Google tokens and upload URLs at rest in D1.
-   OAuth state expires after 10 minutes and is atomically consumed.
-   Google client secret and refresh token stay server-side.
-   Managed-folder ancestry checks before file/folder operations.
-   Upload destination and Content-Range validation.
-   Generic global API error message.
-   Security headers and static asset CSP.
-   HSTS on HTTPS responses.

## 20.2 Security limitations and risks to understand

This is a personal project and has not had a full independent
penetration test.

1.  Four-digit PIN is low entropy. Rate limiting helps but does not make
    it equivalent to a strong password.
2.  PIN verifier uses fast HMAC rather than slow password hashing.
3.  IP-based lockout may affect multiple users behind the same NAT,
    though this is a single-owner app.
4.  Missing Origin headers are permitted by origin middleware; Origin
    checking is not a complete CSRF defense by itself.
5.  Session expiry is checked on requests, but supplied code does not
    show a scheduled cleanup job for expired sessions.
6.  Upload sessions expire after 7 days but supplied code does not show
    scheduled cleanup.
7.  Google OAuth state is one global slot; concurrent OAuth attempts can
    replace one another.
8.  `ensureRootFolder` search by folder name can be ambiguous if
    multiple same-named folders exist in Drive.
9.  `listDriveFiles` caps at 10,000 items per listing.
10. `reindex` caps at 5,000 total indexed items.
11. Share link schema exists without implementation.
12. Browser preview depends on browser/MIME support.
13. Current tests cover only two crypto primitives; route and end-to-end
    tests are not present in supplied `tests/`.
14. API global error handler logs only generic message, making diagnosis
    less detailed; any temporary diagnostic must be removed before
    production.
15. File ancestry validation depends on the D1 metadata index. If
    metadata is stale or incomplete, a valid item may be temporarily
    unavailable until listing/reindex refreshes it.

## 20.3 Data confidentiality model

-   File content is stored in Google Drive and transferred through
    Worker to browser for preview/download.
-   MyVault encrypts Google OAuth tokens and resumable upload session
    URLs in D1.
-   It does not encrypt every file client-side before upload in the
    supplied source.
-   Therefore, do not describe this implementation as end-to-end
    encrypted file storage.

------------------------------------------------------------------------

# 21. Implemented vs reserved vs not implemented

  -----------------------------------------------------------------------
  Feature                 Source status           Notes
  ----------------------- ----------------------- -----------------------
  PIN setup               Implemented             Setup secret required

  PIN login               Implemented             4 or 6 digits

  Session cookie          Implemented             Four-hour expiry

  Logout                  Implemented             Current session

  Logout all              Implemented             Deletes all session
                                                  rows

  Recovery-key rotation   Implemented             Current PIN + existing
                                                  recovery key

  Change PIN              Implemented             Current PIN + recovery
                                                  key; revokes sessions

  Username/password login Not implemented         Schema only

  Google OAuth            Implemented             drive.file scope
                                                  described in README

  Drive token refresh     Implemented             Encrypted token storage

  Dedicated MyVault root  Implemented             `MyVault Storage`

  File/folder listing     Implemented             Pagination up to 10,000
                                                  per listing

  Recursive reindex       Implemented             Maximum 5,000 items,
                                                  depth 20

  Folder creation         Implemented             Name and parent
                                                  validation

  Resumable upload        Implemented             8 MiB chunks, max 15
                                                  GiB declared file size

  File preview            Implemented with        Browser/MIME dependent
                          limitations             

  Download                Implemented             Content endpoint

  Rename                  Implemented             PATCH

  Move to Trash           Implemented             Drive `trashed=true`

  Restore                 Implemented             Vault trash route

  Permanent delete        Implemented             Managed trash item only
                                                  via vault route

  Favorites               Implemented             D1 metadata

  Recent                  Implemented             D1 metadata

  Search                  Implemented in client   Current loaded file
                                                  list

  Sort/filter             Implemented in client   Current loaded file
                                                  list

  Share links             Not implemented         Schema table only

  Public share UI         Not implemented         No routes/UI

  Multi-user accounts     Not implemented         Single owner config

  PWA/offline             Not present in uploaded PWA files removed in
                          source                  local cleanup before
                                                  ZIP

  Clipboard sync          Not implemented         README historical
                                                  future idea

  Notes                   Not implemented         README historical
                                                  future idea

  Bulk ZIP download       Not implemented         README historical
                                                  future idea

  Device/session          Partial                 Session count + logout
  management UI                                   all; no per-device UI
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 22. Known documentation/configuration mismatches

The source archive contains documentation from earlier milestones. A
future AI must prefer actual source code and current `wrangler.jsonc`
over stale README instructions when there is a conflict.

## 22.1 README stale pagination statement

README says reindex only indexes first 100 files per folder and calls
pagination a later improvement. Current `google-drive.ts` paginates up
to 10,000 files per folder listing. Current `drive.ts` reindex still
caps the whole traversal at 5,000 items.

## 22.2 README/deployment script environment mismatch

README and `DEPLOYMENT.md` contain older instructions such as
`npm run deploy` or `npx wrangler deploy` without `--env production`.
Current `wrangler.jsonc` has a default placeholder D1 ID and separate
production D1 environment. For the owner's existing deployment,
explicitly use `--env production`.

## 22.3 `db:remote` script mismatch

`package.json` defines `db:remote` against `myvault-db`, while current
production database is `myvault-production`. Do not use this script for
production migrations.

## 22.4 PWA cleanup state

The uploaded source ZIP includes: - Simplified `index.html` without
manifest/apple touch icon references. - Only `public/favicon.svg`. - No
`public/sw.js`. - No `public/manifest.webmanifest`. - No
`public/offline.html`. - No `public/icons/` directory. - `main.tsx` has
no service worker registration. - `vite.config.ts` has no PWA plugin.

The owner confirmed `npm run typecheck`, `npm run test`, and
`npm run build` passed after the cleanup.

**Production deployment of the PWA cleanup was not confirmed in the
conversation at the time of the source ZIP upload.** Do not assume the
live Worker includes that cleanup unless a deployment output/version is
supplied.

## 22.5 `TESTING.md` is historical

The supplied `TESTING.md` says full tests/build were not completed in
its original build environment. Later, the owner successfully ran: -
`npm run typecheck` - `npm run test` (2/2 crypto tests) -
`npm run build`

The latest owner-reported successful build is newer than the historical
report.

------------------------------------------------------------------------

# 23. Current known operational status

Based on owner-confirmed conversation history:

-   Production MyVault was deployed to Cloudflare.
-   Production Worker used D1 database `myvault-production`.
-   Google OAuth client secret was rotated and updated in Cloudflare
    after an `invalid_client` issue.
-   Local `.dev.vars` also needed the current Google OAuth client secret
    to make local Drive refresh work.
-   Local Drive file listing and storage requests then returned HTTP
    200.
-   Local preview content request returned HTTP 200.
-   Temporary local diagnostic logging was removed from
    `src/worker/index.ts`.
-   A syntax error from leftover lines in `index.ts` was fixed.
-   After fix:
    -   Typecheck passed.
    -   Tests passed 2/2.
    -   Build passed.
-   A security update to backend files was deployed to production. The
    exact changed files in the source ZIP are:
    -   `src/worker/index.ts`
    -   `src/worker/lib/google-drive.ts`
    -   `src/worker/routes/drive.ts`
    -   `src/worker/routes/vault.ts`
-   Production smoke tests after that deployment passed according to
    owner.
-   A source backup and production D1 export were created.
-   PWA cleanup was made locally and tested successfully.
-   Source ZIP supplied for this document reflects the PWA-cleaned
    source.
-   Production deployment of the PWA cleanup remains unverified in this
    documentation snapshot.

Last previously reported production Worker version before later PWA
cleanup deployment:

``` text
3564abc8-48d5-4298-9aa2-127b82b0041d
```

Do not assume it is still the active version.

------------------------------------------------------------------------

# 24. Safe feature-change workflow

A future AI should follow this workflow for every feature change.

## Phase 1 --- Understand current source

1.  Ask for or inspect the newest source ZIP/repository snapshot.
2.  Read this document.
3.  Inspect relevant source files before proposing edits.
4.  Distinguish current implementation from stale README claims.
5.  Identify whether the change touches frontend, API, D1 schema, OAuth
    or secrets.

## Phase 2 --- Protect current working state

1.  Make a source backup.
2.  If a database schema/data change is involved, export production D1
    first.
3.  Do not include `.dev.vars`, secrets, recovery key or production SQL
    in a public source archive.
4.  Do not change production secrets without a specific migration plan.
5.  Do not change PIN or recovery key unless owner explicitly requests
    it.

## Phase 3 --- Implement locally

1.  Edit only relevant files.
2.  Keep frontend types and backend response shapes aligned.
3.  Validate all untrusted request bodies on the backend.
4.  Enforce authentication on protected routes.
5.  For Drive operations, preserve MyVault ancestry checks.
6.  For encrypted fields, preserve key compatibility.
7.  If schema changes are required, add a new numbered migration; do not
    rewrite an already-applied migration.
8.  Update this documentation and README when architecture/behavior
    changes.

## Phase 4 --- Test

Run:

``` powershell
npm run typecheck
npm run test
npm run build
```

Then run `npm run dev` and test the affected feature locally.

For file features, test with disposable files. For auth/security
features, test both successful and failed flows.

## Phase 5 --- Deploy production

1.  Export production D1 if migration/data changes are involved.
2.  Review `npx wrangler deploy --env production --dry-run`.
3.  Confirm binding is `myvault-production`.
4.  Deploy with `npx wrangler deploy --env production`.
5.  Smoke-test production.
6.  Record new Worker version ID and date in this document.

Do not run owner initialization or migrations during ordinary code
deployment.

------------------------------------------------------------------------

# 25. AI handover prompt

The following prompt can be copied into a new AI conversation together
with this document and a current source ZIP.

------------------------------------------------------------------------

## Prompt: Continue development of MyVault

You are helping me maintain and develop my existing personal
cloud-storage application called **MyVault**.

I have attached the file
`MyVault_Complete_Technical_Documentation_AI_Handover.md` and may also
attach a ZIP of the current source code. Treat the technical document as
project context, but always inspect the newest source files before
changing anything.

### Your role

Act as a careful senior full-stack engineer who understands this
existing project. This is a vibe-coded personal project, so explain
technical decisions clearly and guide me step by step. Do not assume I
remember implementation details.

### Core rules

1.  Do not redesign or rewrite the whole application unless I explicitly
    ask.
2.  Preserve the existing working production deployment.
3.  Preserve my existing PIN, recovery key, production data and Google
    Drive connection.
4.  Never ask me to paste `.dev.vars`, Cloudflare secrets, Google OAuth
    client secret, PIN, recovery key or production database exports.
5.  Do not place secrets in source code, GitHub, documentation or public
    archives.
6.  Before changing a file, inspect its current contents.
7.  Before database changes, explain the migration and request a
    production D1 backup.
8.  Never run `owner:init` against the already initialized production
    database.
9.  For production deployment use
    `npx wrangler deploy --env production`, not the unqualified deploy
    script, unless the Wrangler configuration has been deliberately
    revised.
10. Before deployment, run typecheck, tests and build; dry-run
    production and verify D1 binding is `myvault-production`.
11. Keep local development and production databases separate.
12. Do not introduce PWA/offline/installable behavior unless I
    specifically request it.
13. Do not claim a feature is implemented until you verify it in code
    and test it.
14. Distinguish source-code facts from assumptions and planned features.
15. Give me concise PowerShell commands suitable for Windows. Prefer one
    milestone at a time and wait for my output before moving to risky
    next steps.

### Project architecture

-   React + TypeScript + Vite frontend.
-   Cloudflare Worker backend using Hono.
-   Cloudflare D1 for metadata and auth records.
-   Google Drive API v3 for actual file content.
-   OAuth credentials and refresh tokens remain server-side.
-   Google tokens and resumable upload session URLs are encrypted using
    AES-GCM with APP_ENCRYPTION_KEY.
-   PIN verifier uses HMAC-SHA-256 with APP_PEPPER.
-   Session cookie is `mv_session`, HttpOnly, SameSite Strict, Secure on
    HTTPS, 4-hour expiry.
-   Production deployment uses the named `production` Wrangler
    environment and D1 database `myvault-production`.

### Existing features

PIN login, session logout, logout-all, recovery-key rotation, PIN
change, Google OAuth connection, storage quota, MyVault root folder,
file/folder listing, folder creation, resumable uploads, previews,
downloads, rename, Trash, restore, permanent delete, Favorites, Recent,
settings, responsive UI, grid/list views, search, filters, sorting and
dark/light theme.

### Existing production URL

`YOUR-PRODUCTION-WORKER-URL`

### Local development

Project folder:

`C:\Web_Devlopment\Crazy Projects\myvault`

Start:

``` powershell
npm run dev
```

Frontend:

`http://localhost:5173/`

Worker:

`http://127.0.0.1:8787`

### Quality checks

``` powershell
npm run typecheck
npm run test
npm run build
```

The current automated test suite is small (two crypto tests), so also
perform manual feature tests.

### Production deployment

``` powershell
npx wrangler deploy --env production --dry-run
npx wrangler deploy --env production
```

Check that preview shows `env.DB (myvault-production)`.

### First action in a new conversation

1.  Read this handover document.
2.  Inspect the attached current source archive.
3.  Summarize the actual current project state and any differences
    between this document and the code.
4.  Ask what feature/change I want next only after you understand the
    codebase.
5.  Do not make any changes or deployment until I explicitly request the
    next task.

------------------------------------------------------------------------

# 26. Appendix: key endpoint inventory

For quick reference, all application routes found in the supplied Worker
source:

``` text
GET     /api/health

GET     /api/auth/status
POST    /api/auth/setup
POST    /api/auth/login
GET     /api/auth/me
POST    /api/auth/logout
POST    /api/auth/logout-all
POST    /api/auth/rotate-recovery
POST    /api/auth/change-pin

GET     /api/drive/status
GET     /api/drive/connect
GET     /api/drive/callback
GET     /api/drive/storage
GET     /api/drive/files
POST    /api/drive/reindex
POST    /api/drive/folders
POST    /api/drive/upload/init
PUT     /api/drive/upload/:id
GET     /api/drive/files/:id/content
PATCH   /api/drive/files/:id
DELETE  /api/drive/files/:id

GET     /api/vault/favorites
POST    /api/vault/favorites/:id
GET     /api/vault/recent
POST    /api/vault/recent/:id
GET     /api/vault/trash
POST    /api/vault/trash/:id/restore
DELETE  /api/vault/trash/:id
GET     /api/vault/settings
```

All routes except health, auth status/setup/login/logout, and OAuth
callback require a valid session as indicated in the route
implementation. Setup uses the setup-secret header rather than an
existing session.

------------------------------------------------------------------------

# 27. Appendix: migration inventory

## Migration 0001 --- Initial

Creates: - `app_config` - `sessions` - `login_attempts` - `files` -
`upload_sessions` - `share_links`

Indexes: - `idx_sessions_expiry` - `idx_files_parent` -
`idx_files_name` - `idx_share_token`

## Migration 0002 --- Personal features

Creates: - `favorites` - `recent_items`

Index: - `idx_recent_opened`

Never edit a migration that has already been applied in production. Add
a new numbered migration for future schema changes.

------------------------------------------------------------------------

# 28. Final note for future maintainers

This document is a detailed handover, not a substitute for inspecting
the current repository. The source ZIP is a snapshot and may become
stale after future edits. Whenever there is a discrepancy:

1.  Prefer the newest source code for actual implementation.
2.  Prefer the current Cloudflare dashboard/configuration for deployment
    state.
3.  Prefer current D1 migration history for schema state.
4.  Ask the owner before changing production secrets, owner
    authentication, database data or Google Drive connection.
5.  Update this document after significant changes so the next AI
    handover remains useful.


