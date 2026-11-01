# MyVault — Personal Cloud File Manager

A private, single-owner personal cloud file manager built with React, Cloudflare Workers and Google Drive.

MyVault provides a clean interface to organize, upload, preview, download and manage personal files while using Google Drive as the underlying file storage provider.

The application backend runs on Cloudflare Workers, while Cloudflare D1 stores application metadata and authentication information.

> **Project status:** Functional personal cloud application. Core authentication, Google Drive integration, file management and personal organization features are implemented. Development and security improvements are ongoing.

---

## Features

### Authentication and Security
- Owner setup with PIN authentication.
- Secure login and logout.
- Session validation and logout from all sessions.
- Recovery-key-based account recovery operations.
- Login attempt throttling.
- Encrypted storage of sensitive Google Drive credentials.

### File Management
- Upload files using Google Drive resumable uploads.
- Upload large files using 8 MiB chunks.
- Create and organize folders.
- Browse Google Drive files and folders.
- Preview and download supported file types.
- Rename files.
- Move files to Trash.
- Restore deleted files.
- Permanently delete files.

### Personal Organization
- Favorites.
- Recently accessed files.
- Search files.
- Sorting and filtering.
- Grid and list views.
- Trash management.

### User Interface
- Responsive interface for desktop and mobile.
- Dark and light themes.
- Settings overview.
- Google Drive connection status.
- Storage information.

---

## Screenshots

Screenshots will be added here.

*Use screenshots containing only sample data. Never publish personal files, email addresses, access tokens or private account information.*

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript |
| Build tool | Vite |
| Styling | CSS |
| Backend | Hono |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 |
| File storage | Google Drive API v3 |
| Authentication | PIN-based authentication |
| Encryption | AES-256-GCM |
| Testing | Vitest |
| CI/CD | GitHub Actions |

---

## Architecture

```text
                 User Browser
                      |
                      v
             React + TypeScript
                      |
                      v
              Cloudflare Worker
                 (Hono API)
                      |
              +-------+-------+
              |               |
              v               v
        Cloudflare D1      Google OAuth
        Metadata DB             |
                                v
                         Google Drive API
                                |
                                v
                         File Contents
```

### How it works

1. The user accesses the React frontend.
2. Cloudflare Workers handles authentication and API requests.
3. Cloudflare D1 stores user authentication records, file metadata, favorites and recent activity.
4. Google OAuth authorizes access to Google Drive.
5. File contents are stored in Google Drive.
6. MyVault manages file operations through its backend.

**Important:** MyVault is not an independent storage provider. Google Drive provides the underlying file storage.

---

## Project Structure

```text
MyVault/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── docs/
│   ├── OWNERS_GUIDE.md
│   └── TECHNICAL_DOCUMENTATION.md
│
├── migrations/
├── public/
├── scripts/
├── src/
│   ├── client/
│   └── worker/
│
├── tests/
├── .dev.vars.example
├── .gitignore
├── DEPLOYMENT.md
├── SECURITY.md
├── TESTING.md
├── package.json
├── vite.config.ts
└── wrangler.jsonc
```

---

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Cloudflare account
- Google account
- Google Cloud project with Google Drive API enabled

---

## Local Installation

### 1. Clone the repository

```bash
git clone YOUR_REPOSITORY_URL
cd myvault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure local environment variables

Copy the example configuration:

**Windows PowerShell:**

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Generate separate random 32-byte values for:

- `APP_PEPPER`
- `SETUP_SECRET`
- `APP_ENCRYPTION_KEY`

PowerShell command:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Run it separately for each secret.

Configure the required Google OAuth client credentials in `.dev.vars`.

Never commit `.dev.vars`.

### 4. Configure Google Drive OAuth

1. Create or select a Google Cloud project.
2. Enable Google Drive API.
3. Configure the OAuth consent screen.
4. Create an OAuth client of type Web application.
5. Add the following local authorized redirect URI:

```text
http://127.0.0.1:8787/api/drive/callback
```

6. Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.dev.vars`.

MyVault uses the Google Drive `drive.file` OAuth scope.

### 5. Initialize the local database

```bash
npm run db:local
```

### 6. Start the development environment

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The development frontend proxies API requests to the local Cloudflare Worker.

### 7. Initialize the owner account

```bash
npm run owner:init
```

Follow the interactive setup instructions.

Save the generated recovery key securely offline. It is displayed only once.

---

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local frontend and Worker |
| `npm run build` | Build the production frontend |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Run automated tests |
| `npm run preview` | Run local Wrangler preview |
| `npm run db:local` | Apply local D1 migrations |
| `npm run owner:init` | Initialize an uninitialized owner account |

For production deployment, follow the instructions in [DEPLOYMENT.md](DEPLOYMENT.md). Do not use the default deployment command without explicitly selecting the intended Wrangler environment.

---

## Documentation

| Document | Description |
|---|---|
| [Owner's Guide](docs/OWNERS_GUIDE.md) | Application usage and owner guidance |
| [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) | Detailed architecture, APIs, database and implementation |
| [Deployment Guide](DEPLOYMENT.md) | Cloudflare production deployment and maintenance |
| [Security Policy](SECURITY.md) | Authentication, encryption and security limitations |
| [Testing Report](TESTING.md) | Automated and manual verification |

---

## Security Considerations

- PIN authentication is handled by the backend.
- Session cookies use HttpOnly and SameSite Strict settings, with Secure enabled on HTTPS.
- Login attempts are throttled.
- Sensitive stored credentials are encrypted using AES-GCM.
- Google OAuth credentials remain server-side.
- The application uses a restricted `drive.file` scope.
- Production secrets must be stored securely.

### Important limitations

- MyVault currently supports a single owner.
- Files are not end-to-end encrypted by MyVault.
- Google Drive remains responsible for storing actual file contents.
- PIN verification currently uses HMAC-SHA256 rather than a dedicated memory-hard password hashing algorithm.
- The automated test suite currently contains only two cryptographic tests.
- The project has not undergone an independent penetration test or security certification.

Read [SECURITY.md](SECURITY.md) before deploying your own instance.

---

## Future Improvements

Potential areas for further development include:

- Expanded automated integration and security tests.
- Improved upload recovery and error handling.
- More file preview formats.
- Enhanced session and device management.
- Additional backup and recovery tooling.
- Improved accessibility and user experience.

---

## License

License information will be added when the project license is selected.

---

**MyVault** — Your personal files, organized in one place.