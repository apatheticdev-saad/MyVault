# MyVault — Production Deployment & Maintenance

## 1. Production Environment

MyVault is deployed using Cloudflare Workers, Static Assets and Cloudflare D1.

| Setting | Production value |
|---|---|
| Worker | `myvault-personal-cloud` |
| Wrangler environment | `production` |
| Website | `https://YOUR-PRODUCTION-WORKER.workers.dev` |
| D1 database | `myvault-production` |
| Worker entry point | `src/worker/index.ts` |
| Static assets | `dist/` |
| Database migrations | `migrations/` |

The production environment has a separate D1 database binding and production-specific configuration in `wrangler.jsonc`.

## 2. Important Security Rules

- Never commit `.dev.vars`, `.env`, OAuth credentials, recovery keys or production secrets.
- Never publish database exports, private logs or backups.
- Never regenerate or replace production secrets as part of an ordinary deployment.
- Keep `APP_PEPPER` and `APP_ENCRYPTION_KEY` stable. Changing them can make existing authentication records or encrypted Google Drive credentials unusable.
- Keep the production recovery key stored securely offline.
- Never run the owner initialization script against the already initialized production database.
- Do not modify or reset the production D1 database during routine deployments.

## 3. Cloudflare Authentication

From the project root in PowerShell:

```powershell
npx wrangler login
npx wrangler whoami
```

Confirm that Wrangler is authenticated to the intended Cloudflare account.

## 4. Local Verification Before Deployment

Run the following checks:

```powershell
npm run typecheck
npm run test
npm run build
```

Resolve any errors before deploying.

## 5. Deploy to Production

**Always specify the production environment.**

```powershell
npx wrangler deploy --env production
```

Do not use the unqualified command:

```powershell
npx wrangler deploy
```

The unqualified command targets the default Wrangler environment, which has a placeholder D1 database ID in the current configuration.

Also avoid `npm run deploy` until its package script is updated to explicitly target production.

After deployment, confirm that the Worker deployment succeeds and open the production website.

## 6. Google Drive OAuth

Production uses the Google OAuth Web application configured for MyVault.

The authorized redirect URI is:

```text
https://YOUR-PRODUCTION-WORKER.workers.dev/api/drive/callback
```

The redirect URI must match the deployed hostname exactly.

Keep the Google OAuth scope restricted to `drive.file` unless a specific feature requires a reviewed change.

If the OAuth application remains in Testing mode, ensure the intended Google account is listed as a test user.

Do not replace OAuth credentials during routine deployments.

## 7. Production Smoke Tests

After a deployment, verify the following:

1. Open the production website over HTTPS.
2. Sign in using the existing production PIN.
3. Confirm the Google Drive connection is working.
4. Confirm storage quota and file listing load correctly.
5. Create a test folder.
6. Upload a small disposable file.
7. Preview and download the file.
8. Rename the file and test folder operations.
9. Test Trash and restore using a disposable file.
10. Check Favorites and Recent.
11. Confirm logout and subsequent login work.

Do not test PIN changes, recovery-key rotation or logout-all unless specifically required.

## 8. Database and Data Protection

Cloudflare D1 stores MyVault application metadata, authentication records and file indexes.

Google Drive stores the actual file contents.

Before significant backend or database changes:

- Create a private project backup.
- Create a private production D1 backup.
- Review the migration before applying it.
- Keep the production encryption key securely backed up.
- Verify the Google Drive connection after the change.

Do not run fresh database initialization or owner setup on an already initialized production account.

## 9. Rollback and Recovery

If a deployment causes unexpected problems:

1. Stop making further changes.
2. Preserve the production D1 database.
3. Preserve the Google Drive files and application folder.
4. Review the Cloudflare Worker deployment history.
5. Roll back to a previously working Worker version when appropriate.
6. Investigate the issue before attempting another deployment.

Never delete the production database or Google Drive application folder as a troubleshooting shortcut.

## 10. Important Limitations

- The automated test suite is small and does not constitute a complete security audit.
- A successful build does not guarantee production reliability.
- Google Drive remains the underlying file-content storage provider.
- MyVault is a single-owner application, not a multi-user cloud storage service.
- Keep production access restricted to the intended owner.
