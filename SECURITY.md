# MyVault — Security Policy

## 1. Security Overview

MyVault is a private, single-owner personal file manager built with React, Cloudflare Workers, Cloudflare D1 and Google Drive.

Google Drive stores the actual file contents. Cloudflare D1 stores application metadata, authentication records and file indexes.

MyVault uses server-side authentication, protected API routes, encrypted credential storage and security-related HTTP headers.

## 2. Authentication and Sessions

- Owner authentication uses a PIN.
- PIN verification uses HMAC-SHA256 with a per-PIN salt and the server-side `APP_PEPPER`.
- Failed login attempts are throttled: five failures within a 15-minute window trigger a 15-minute block.
- Sessions use randomly generated tokens.
- Only SHA-256 hashes of session tokens are stored in D1.
- The session cookie is HttpOnly, SameSite Strict and Secure on HTTPS.
- Sessions expire after four hours.
- The application supports logout and logout-all operations.

**Important:** The current PIN verification uses a fast HMAC-based construction, not a dedicated password hashing algorithm such as Argon2 or scrypt. A four-digit PIN has limited entropy. Keep the application private and use the strongest supported PIN length.

## 3. Encryption and Credential Protection

MyVault uses AES-256-GCM for encrypting sensitive stored values, including Google OAuth credentials and resumable upload-session URLs.

The encryption key is provided through `APP_ENCRYPTION_KEY`.

Important rules:

- Never expose `APP_ENCRYPTION_KEY`.
- Never casually rotate or replace it.
- Keep a secure backup of production secrets.
- Losing or changing the encryption key can make previously encrypted values unusable.

**File encryption limitation:** MyVault does not currently implement client-side end-to-end encryption. Files are stored in Google Drive and are protected by the security controls of that storage provider.

## 4. Secret Management

Never commit or publicly share:

- `.dev.vars` or `.env` files.
- `GOOGLE_CLIENT_SECRET` or OAuth tokens.
- `APP_PEPPER`.
- `APP_ENCRYPTION_KEY`.
- `SETUP_SECRET`.
- Owner PIN or recovery key.
- Production database exports.
- Private logs or backups.

Use Cloudflare Worker secrets for production credentials and local `.dev.vars` for local development.

Never place secret values in source code, GitHub issues, screenshots or public documentation.

## 5. Google Drive Security

- Google OAuth is handled by the backend.
- OAuth credentials are not intended to be exposed to the browser.
- The application uses the restricted Google Drive `drive.file` scope.
- Stored sensitive OAuth data is encrypted at rest in D1.
- Keep the Google OAuth application restricted to the intended owner.

Google Drive remains the underlying file-content storage provider.

## 6. API and Browser Security

The application implements security-related HTTP headers, including:

- Content Security Policy (CSP).
- Strict-Transport-Security on HTTPS.
- X-Content-Type-Options: nosniff.
- X-Frame-Options: DENY.
- Referrer-Policy: no-referrer.
- Permissions-Policy.
- Cache-Control: no-store for application responses.

The backend also checks request origins and returns generic errors for unexpected server-side failures.

## 7. Production Data Protection

- Keep production D1 separate from local development data.
- Back up production D1 before significant changes.
- Preserve the production encryption key.
- Keep the recovery key offline and secure.
- Do not run owner initialization again on an already initialized production database.
- Do not delete the production D1 database or Google Drive application folder during troubleshooting.

## 8. Known Security Limitations

- PIN verification does not currently use a dedicated memory-hard password hashing algorithm.
- The application is designed for a single owner, not multiple independent users.
- Files are not end-to-end encrypted by MyVault.
- The automated test suite is limited and is not a penetration test.
- Security headers and authentication controls do not guarantee immunity from vulnerabilities.
- The application does not claim to provide a complete security audit or certification.

## 9. Reporting a Vulnerability

Do not publish passwords, PINs, recovery keys, access tokens, private logs or working exploits in public GitHub issues.

For a private personal deployment, restrict access to the affected application, preserve relevant evidence securely and rotate compromised credentials when appropriate.

Report security issues privately rather than disclosing sensitive details publicly.