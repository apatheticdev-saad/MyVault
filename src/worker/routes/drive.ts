import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../lib/auth";
import { decryptText, encryptText, randomToken } from "../lib/crypto";
import { driveRequest, ensureRootFolder, getConfig, getDriveAccessToken, listDriveFiles } from "../lib/google-drive";
const drive = new Hono<{
    Bindings: Env;
}>();
const SCOPES = "https://www.googleapis.com/auth/drive.file";
async function isManagedFolder(env: Env, folderId: string, rootId: string): Promise<boolean> {
    let currentId = folderId;
    for (let depth = 0; depth < 12 && currentId !== rootId; depth += 1) {
        const row = await env.DB.prepare("SELECT parent_drive_id, mime_type, is_trashed FROM files WHERE drive_file_id = ?")
            .bind(currentId).first<{ parent_drive_id: string | null; mime_type: string; is_trashed: number }>();
        if (!row || row.mime_type !== "application/vnd.google-apps.folder" || row.is_trashed || !row.parent_drive_id)
            return false;
        currentId = row.parent_drive_id;
    }
    return currentId === rootId;
}
async function isManagedItem(env: Env, fileId: string, rootId: string): Promise<boolean> {
    const row = await env.DB.prepare("SELECT parent_drive_id, is_trashed FROM files WHERE drive_file_id = ?")
        .bind(fileId).first<{ parent_drive_id: string | null; is_trashed: number }>();
    return Boolean(row && !row.is_trashed && row.parent_drive_id && await isManagedFolder(env, row.parent_drive_id, rootId));
}
drive.get("/status", requireAuth, async (c) => {
    const config = await getConfig(c.env);
    return c.json({ connected: Boolean(config?.google_refresh_token_enc), rootFolderReady: Boolean(config?.google_root_folder_id) });
});
drive.get("/connect", requireAuth, async (c) => {
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)
        return c.json({ error: "Google OAuth secrets are not configured." }, 503);
    const state = randomToken(24);
    const timestamp = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare("UPDATE app_config SET google_oauth_state = ?, google_oauth_state_created_at = ? WHERE id = 1").bind(state, timestamp).run();
    const redirectUri = `${new URL(c.req.url).origin}/api/drive/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", state }).toString();
    return c.json({ url: url.toString() });
});
drive.get("/callback", async (c) => {
    const appOrigin = c.env.APP_ORIGIN || new URL(c.req.url).origin;
    const code = c.req.query("code");
    const state = c.req.query("state");
    const config = await getConfig(c.env);
    const timestamp = Math.floor(Date.now() / 1000);
    if (!code || code.length > 4096 || !state || state.length > 256 || !config?.google_oauth_state || !config.google_oauth_state_created_at || timestamp - config.google_oauth_state_created_at > 600 || timestamp < config.google_oauth_state_created_at) {
        return c.redirect(`${appOrigin}/?drive=state-error`, 302);
    }
    // Atomically consume the state before exchanging the authorization code.
    // A second callback (including a replay) cannot pass this conditional update.
    const consumed = await c.env.DB.prepare(`UPDATE app_config
        SET google_oauth_state = NULL, google_oauth_state_created_at = NULL
        WHERE id = 1 AND google_oauth_state = ? AND google_oauth_state_created_at = ?
          AND google_oauth_state_created_at >= ?`)
        .bind(state, config.google_oauth_state_created_at, timestamp - 600).run();
    if (!consumed.meta.changes)
        return c.redirect(`${appOrigin}/?drive=state-error`, 302);
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)
        return c.redirect(`${appOrigin}/?drive=not-configured`, 302);
    const redirectUri = `${new URL(c.req.url).origin}/api/drive/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tokenResponse.ok) {
        console.error("Google OAuth token exchange failed", { status: tokenResponse.status });
        return c.redirect(`${appOrigin}/?drive=token-error`, 302);
    }
    const tokenData = await tokenResponse.json() as { access_token?: string; expires_in?: number; refresh_token?: string };
    if (!tokenData.access_token)
        return c.redirect(`${appOrigin}/?drive=token-error`, 302);
    if (tokenData.refresh_token) {
        const encryptedRefresh = await encryptText(tokenData.refresh_token, c.env.APP_ENCRYPTION_KEY);
        const encryptedAccess = await encryptText(tokenData.access_token, c.env.APP_ENCRYPTION_KEY);
        await c.env.DB.prepare("UPDATE app_config SET google_refresh_token_enc = ?, google_access_token_enc = ?, google_access_token_expires_at = ?, updated_at = ? WHERE id = 1")
            .bind(encryptedRefresh, encryptedAccess, timestamp + (tokenData.expires_in || 3600), timestamp).run();
    } else if (!config.google_refresh_token_enc) {
        return c.redirect(`${appOrigin}/?drive=missing-refresh-token`, 302);
    } else {
        const encryptedAccess = await encryptText(tokenData.access_token, c.env.APP_ENCRYPTION_KEY);
        await c.env.DB.prepare("UPDATE app_config SET google_access_token_enc = ?, google_access_token_expires_at = ?, updated_at = ? WHERE id = 1")
            .bind(encryptedAccess, timestamp + (tokenData.expires_in || 3600), timestamp).run();
    }
    try {
        await ensureRootFolder(c.env);
    } catch {
        return c.redirect(`${appOrigin}/?drive=folder-error`, 302);
    }
    return c.redirect(`${appOrigin}/?drive=connected`, 302);
});
drive.get("/storage", requireAuth, async (c) => {
    const data = await driveRequest<{
        storageQuota?: {
            limit?: string;
            usage?: string;
            usageInDrive?: string;
        };
    }>(c.env, "/about?fields=storageQuota");
    return c.json({ limit: Number(data.storageQuota?.limit || 0), usage: Number(data.storageQuota?.usage || 0), usageInDrive: Number(data.storageQuota?.usageInDrive || 0) });
});
drive.get("/files", requireAuth, async (c) => {
    const config = await getConfig(c.env);
    if (!config?.google_refresh_token_enc)
        return c.json({ error: "Connect your storage first." }, 409);
    const rootId = await ensureRootFolder(c.env);
    const parentId = c.req.query("folder") || rootId;
    if (!await isManagedFolder(c.env, parentId, rootId))
        return c.json({ error: "Folder is outside MyVault storage." }, 403);
    const trashed = c.req.query("trashed") === "true";
    const files = await listDriveFiles(c.env, parentId, trashed);
    const result = files.map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size || 0), parentId: file.parents?.[0] || parentId, createdTime: file.createdTime, modifiedTime: file.modifiedTime, isFolder: file.mimeType === "application/vnd.google-apps.folder", trashed: Boolean(file.trashed) }));
    if (files.length) {
        const statements = files.map((file) => c.env.DB.prepare(`INSERT INTO files (id, drive_file_id, name, mime_type, size_bytes, parent_drive_id, is_trashed, created_at, modified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(drive_file_id) DO UPDATE SET name = excluded.name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, parent_drive_id = excluded.parent_drive_id, is_trashed = excluded.is_trashed, modified_at = excluded.modified_at`)
            .bind(file.id, file.id, file.name, file.mimeType, Number(file.size || 0), file.parents?.[0] || parentId, file.trashed ? 1 : 0, Math.floor(new Date(file.createdTime || Date.now()).getTime() / 1000), Math.floor(new Date(file.modifiedTime || Date.now()).getTime() / 1000)));
        await c.env.DB.batch(statements);
    }
    return c.json({ files: result, currentFolderId: parentId, rootFolderId: rootId });
});
drive.post("/reindex", requireAuth, async (c) => {
    const rootId = await ensureRootFolder(c.env);
    const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
    let indexed = 0;
    const maxFiles = 5000;
    while (queue.length && indexed < maxFiles) {
        const current = queue.shift()!;
        if (current.depth > 20) continue;
        const items = await listDriveFiles(c.env, current.id, false);
        const statements = items.slice(0, maxFiles - indexed).map((file) => c.env.DB.prepare(`INSERT INTO files (id, drive_file_id, name, mime_type, size_bytes, parent_drive_id, is_trashed, created_at, modified_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(drive_file_id) DO UPDATE SET name = excluded.name, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, parent_drive_id = excluded.parent_drive_id, is_trashed = 0, modified_at = excluded.modified_at`)
            .bind(file.id, file.id, file.name, file.mimeType, Number(file.size || 0), current.id, Math.floor(new Date(file.createdTime || Date.now()).getTime() / 1000), Math.floor(new Date(file.modifiedTime || Date.now()).getTime() / 1000)));
        for (let offset = 0; offset < statements.length; offset += 100) {
            await c.env.DB.batch(statements.slice(offset, offset + 100));
        }
        indexed += statements.length;
        for (const item of items) {
            if (item.mimeType === "application/vnd.google-apps.folder" && indexed + queue.length < maxFiles) queue.push({ id: item.id, depth: current.depth + 1 });
        }
    }
    return c.json({ success: true, indexed, truncated: queue.length > 0 || indexed >= maxFiles });
});

drive.post("/folders", requireAuth, async (c) => {
    let body: { name?: string; parentId?: string };
    try { body = await c.req.json<{ name?: string; parentId?: string }>(); }
    catch { return c.json({ error: "Invalid JSON request body." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
        return c.json({ error: "Invalid request body." }, 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name))
        return c.json({ error: "Folder name must be between 1 and 120 characters." }, 400);
    const rootId = await ensureRootFolder(c.env);
    const parentId = body.parentId || rootId;
    if (!await isManagedFolder(c.env, parentId, rootId))
        return c.json({ error: "Parent folder is outside MyVault storage." }, 403);
    const folder = await driveRequest<{
        id: string;
        name: string;
    }>(c.env, "/files?fields=id,name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }) });
    return c.json({ id: folder.id, name: folder.name }, 201);
});
drive.post("/upload/init", requireAuth, async (c) => {
    let body: { name?: string; mimeType?: string; size?: number; parentId?: string };
    try { body = await c.req.json<{ name?: string; mimeType?: string; size?: number; parentId?: string }>(); }
    catch { return c.json({ error: "Invalid JSON request body." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
        return c.json({ error: "Invalid request body." }, 400);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const size = body.size;
    if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name) || typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0 || size > 15 * 1024 * 1024 * 1024)
        return c.json({ error: "Invalid file name or file size." }, 400);
    if (body.parentId !== undefined && (typeof body.parentId !== "string" || !body.parentId.trim()))
        return c.json({ error: "Invalid destination folder." }, 400);
    if (body.mimeType !== undefined && (typeof body.mimeType !== "string" || body.mimeType.length > 255 || /[\r\n]/.test(body.mimeType)))
        return c.json({ error: "Invalid file type." }, 400);
    const rootId = await ensureRootFolder(c.env);
    const parentId = body.parentId || rootId;
    if (!await isManagedFolder(c.env, parentId, rootId))
        return c.json({ error: "Parent folder is outside MyVault storage." }, 403);
    const mimeType = body.mimeType?.trim() || "application/octet-stream";
    const token = await getDriveAccessToken(c.env);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,createdTime,modifiedTime", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mimeType, "X-Upload-Content-Length": String(size) },
        body: JSON.stringify({ name, mimeType, parents: [parentId] }),
    });
    if (!response.ok)
        return c.json({ error: "Could not start Google Drive upload." }, 502);
    const sessionUrl = response.headers.get("Location");
    if (!sessionUrl || !sessionUrl.startsWith("https://www.googleapis.com/upload/drive/v3/"))
        return c.json({ error: "Google Drive returned an invalid upload session." }, 502);
    const uploadId = randomToken(18);
    const encrypted = await encryptText(sessionUrl, c.env.APP_ENCRYPTION_KEY);
    const timestamp = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare("INSERT INTO upload_sessions (id, drive_session_url_enc, file_name, mime_type, size_bytes, parent_drive_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(uploadId, encrypted, name, mimeType, size, parentId, timestamp, timestamp + 7 * 24 * 60 * 60).run();
    return c.json({ uploadId, chunkSize: 8 * 1024 * 1024 });
});
drive.put("/upload/:id", requireAuth, async (c) => {
    const id = c.req.param("id");
    const session = await c.env.DB.prepare("SELECT * FROM upload_sessions WHERE id = ? AND expires_at > ?").bind(id, Math.floor(Date.now() / 1000)).first<{
        drive_session_url_enc: string;
        size_bytes: number;
        parent_drive_id: string;
    }>();
    if (!session)
        return c.json({ error: "Upload session not found or expired." }, 404);
    const rootId = await ensureRootFolder(c.env);
    if (!await isManagedFolder(c.env, session.parent_drive_id, rootId)) {
        await c.env.DB.prepare("DELETE FROM upload_sessions WHERE id = ?").bind(id).run();
        return c.json({ error: "Upload destination is no longer part of MyVault." }, 403);
    }
    const contentRange = c.req.header("Content-Range");
    const contentLength = Number(c.req.header("Content-Length") || "0");
    if (!contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange) || !contentLength || contentLength > 9 * 1024 * 1024)
        return c.json({ error: "Invalid upload chunk." }, 400);
    const match = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const rangeStart = match ? Number(match[1]) : NaN;
    const rangeEnd = match ? Number(match[2]) : NaN;
    const rangeTotal = match ? Number(match[3]) : NaN;
    if (!match || !Number.isSafeInteger(rangeStart) || !Number.isSafeInteger(rangeEnd) || !Number.isSafeInteger(rangeTotal) || rangeStart < 0 || rangeEnd < rangeStart || rangeEnd >= session.size_bytes || rangeTotal !== session.size_bytes || rangeEnd - rangeStart + 1 !== contentLength || contentLength > 8 * 1024 * 1024)
        return c.json({ error: "Upload range does not match the declared file size." }, 400);
    const sessionUrl = await decryptText(session.drive_session_url_enc, c.env.APP_ENCRYPTION_KEY);
    const parsedSessionUrl = new URL(sessionUrl);
    if (parsedSessionUrl.protocol !== "https:" || parsedSessionUrl.hostname !== "www.googleapis.com" || !parsedSessionUrl.pathname.startsWith("/upload/drive/v3/"))
        return c.json({ error: "Stored upload session is invalid." }, 500);
    const response = await fetch(sessionUrl, { method: "PUT", headers: { "Content-Length": String(contentLength), "Content-Range": contentRange }, body: c.req.raw.body });
    const text = await response.text();
    if (response.status === 200 || response.status === 201) {
        await c.env.DB.prepare("DELETE FROM upload_sessions WHERE id = ?").bind(id).run();
        let file: {
            id: string;
            name: string;
            mimeType: string;
            size?: string;
        } = { id: "", name: "", mimeType: "" };
        try {
            file = JSON.parse(text) as typeof file;
        }
        catch { /* Google may return an empty response; refresh list afterwards. */ }
        return c.json({ complete: true, file });
    }
    if (response.status === 308)
        return c.json({ complete: false, range: response.headers.get("Range") });
    return c.json({ error: `Google Drive upload failed (${response.status}).` }, 502);
});
drive.get("/files/:id/content", requireAuth, async (c) => {
    const id = c.req.param("id");
    const rootId = await ensureRootFolder(c.env);
    if (!await isManagedItem(c.env, id, rootId))
        return c.json({ error: "File is not part of MyVault storage." }, 404);
    const token = await getDriveAccessToken(c.env);
    const requestHeaders = new Headers({ Authorization: `Bearer ${token}` });
    const range = c.req.header("Range");
    if (range)
        requestHeaders.set("Range", range);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: requestHeaders });
    if (!response.ok && response.status !== 206)
        return c.json({ error: "File could not be downloaded." }, 502);
    const disposition = c.req.query("download") === "1" ? "attachment" : "inline";
    const headers = new Headers({ "Cache-Control": "private, no-store", "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(c.req.query("name") || "download")}`, "Accept-Ranges": "bytes" });
    for (const header of ["Content-Type", "Content-Length", "Content-Range"]) {
        const value = response.headers.get(header);
        if (value)
            headers.set(header, value);
    }
    return new Response(response.body, { status: response.status, headers });
});
drive.patch("/files/:id", requireAuth, async (c) => {
    const id = c.req.param("id");
    const rootId = await ensureRootFolder(c.env);
    if (!await isManagedItem(c.env, id, rootId))
        return c.json({ error: "File is not part of MyVault storage." }, 404);
    let body: { name?: string; trashed?: boolean };
    try { body = await c.req.json<{ name?: string; trashed?: boolean }>(); }
    catch { return c.json({ error: "Invalid JSON request body." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
        return c.json({ error: "Invalid request body." }, 400);
    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 255 || /[\u0000-\u001f\u007f]/.test(body.name)))
        return c.json({ error: "Invalid file name." }, 400);
    if (body.trashed !== undefined && typeof body.trashed !== "boolean")
        return c.json({ error: "Invalid trash status." }, 400);
    if (body.name === undefined && body.trashed === undefined)
        return c.json({ error: "No supported file changes were supplied." }, 400);
    const result = await driveRequest<{
        id: string;
        name: string;
    }>(c.env, `/files/${encodeURIComponent(id)}?fields=id,name`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.trashed !== undefined ? { trashed: body.trashed } : {}) }) });
    if (body.trashed !== undefined)
        await c.env.DB.prepare("UPDATE files SET is_trashed = ?, modified_at = ? WHERE drive_file_id = ?").bind(body.trashed ? 1 : 0, Math.floor(Date.now() / 1000), id).run();
    if (body.name !== undefined)
        await c.env.DB.prepare("UPDATE files SET name = ?, modified_at = ? WHERE drive_file_id = ?").bind(result.name, Math.floor(Date.now() / 1000), id).run();
    return c.json(result);
});
drive.delete("/files/:id", requireAuth, async (c) => {
    const id = c.req.param("id");
    const rootId = await ensureRootFolder(c.env);
    if (!await isManagedItem(c.env, id, rootId))
        return c.json({ error: "File is not part of MyVault storage." }, 404);
    await driveRequest<void>(c.env, `/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    await c.env.DB.batch([
        c.env.DB.prepare("DELETE FROM files WHERE drive_file_id = ?").bind(id),
        c.env.DB.prepare("DELETE FROM favorites WHERE drive_file_id = ?").bind(id),
        c.env.DB.prepare("DELETE FROM recent_items WHERE drive_file_id = ?").bind(id),
    ]);
    return c.json({ success: true });
});
export default drive;
