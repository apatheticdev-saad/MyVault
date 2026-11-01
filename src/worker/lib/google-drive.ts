import type { AppConfig, DriveFile, Env } from "../types";
import { decryptText, encryptText } from "./crypto";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ROOT_NAME = "MyVault Storage";
export async function getConfig(env: Env): Promise<AppConfig | null> {
    return env.DB.prepare("SELECT * FROM app_config WHERE id = 1").first<AppConfig>();
}
export async function getDriveAccessToken(env: Env): Promise<string> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
        throw new Error("Google OAuth is not configured.");
    const config = await getConfig(env);
    if (!config?.google_refresh_token_enc)
        throw new Error("Google Drive is not connected.");
    const now = Math.floor(Date.now() / 1000);
    if (config.google_access_token_enc && config.google_access_token_expires_at && config.google_access_token_expires_at > now + 60)
        return decryptText(config.google_access_token_enc, env.APP_ENCRYPTION_KEY);
    const refreshToken = await decryptText(config.google_refresh_token_enc, env.APP_ENCRYPTION_KEY);
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!response.ok)
        throw new Error("Google authorization could not be refreshed. Reconnect storage in Settings.");
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token)
        throw new Error("Google authorization returned an invalid access token.");
    const encrypted = await encryptText(data.access_token, env.APP_ENCRYPTION_KEY);
    await env.DB.prepare("UPDATE app_config SET google_access_token_enc = ?, google_access_token_expires_at = ?, updated_at = ? WHERE id = 1")
        .bind(encrypted, now + (data.expires_in || 3600), now).run();
    return data.access_token;
}
export async function driveRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
        throw new Error("Invalid Google Drive API path.");
    const token = await getDriveAccessToken(env);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${DRIVE_API}${path}`, { ...init, headers });
    if (!response.ok) {
        // Do not include provider response bodies: they may contain account or resource details.
        throw new Error(`Google Drive request failed (${response.status}).`);
    }
    if (response.status === 204)
        return undefined as T;
    return await response.json() as T;
}
export async function ensureRootFolder(env: Env): Promise<string> {
    const config = await getConfig(env);
    if (config?.google_root_folder_id) {
        try {
            const saved = await driveRequest<DriveFile & { trashed?: boolean }>(env,
                `/files/${encodeURIComponent(config.google_root_folder_id)}?fields=id,name,mimeType,trashed`);
            if (saved.id === config.google_root_folder_id && saved.name === ROOT_NAME && saved.mimeType === "application/vnd.google-apps.folder" && !saved.trashed)
                return saved.id;
        } catch {
            // A missing or invalid saved root is recovered below.
        }
        await env.DB.prepare("UPDATE app_config SET google_root_folder_id = NULL, updated_at = ? WHERE id = 1 AND google_root_folder_id = ?")
            .bind(Math.floor(Date.now() / 1000), config.google_root_folder_id).run();
    }
    const query = new URLSearchParams({
        q: `name = '${ROOT_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        pageSize: "1",
        fields: "files(id,name,mimeType,trashed)",
    });
    const existing = await driveRequest<{ files?: DriveFile[] }>(env, `/files?${query.toString()}`);
    const folder = existing.files?.find((item) => item.name === ROOT_NAME && item.mimeType === "application/vnd.google-apps.folder" && !item.trashed)
        || await driveRequest<DriveFile>(env, "/files?fields=id,name,mimeType", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: ROOT_NAME, mimeType: "application/vnd.google-apps.folder" }),
        });
    await env.DB.prepare("UPDATE app_config SET google_root_folder_id = ?, updated_at = ? WHERE id = 1 AND google_root_folder_id IS NULL")
        .bind(folder.id, Math.floor(Date.now() / 1000)).run();
    const finalConfig = await getConfig(env);
    return finalConfig?.google_root_folder_id || folder.id;
}
export async function listDriveFiles(env: Env, parentId: string, trashed = false): Promise<DriveFile[]> {
    const q = `'${parentId.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' in parents and trashed = ${trashed ? "true" : "false"}`;
    const params = new URLSearchParams({ q, pageSize: "100", orderBy: "folder,name", fields: "files(id,name,mimeType,size,parents,createdTime,modifiedTime,webViewLink,trashed),nextPageToken" });
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    // Bound one listing to protect Worker execution time and memory.
    do {
        if (pageToken) params.set("pageToken", pageToken);
        const data = await driveRequest<{ files?: DriveFile[]; nextPageToken?: string }>(env, `/files?${params.toString()}`);
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
    } while (pageToken && files.length < 10000);
    return files;
}
