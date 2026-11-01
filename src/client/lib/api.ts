export interface VaultFile {
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
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api${path}`, {
        ...init,
        credentials: "same-origin",
        headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
    const data = await response.json().catch(() => ({})) as T & {
        error?: string;
    };
    if (!response.ok)
        throw new Error(data.error || `Request failed (${response.status})`);
    return data;
}
export const api = {
    authStatus: () => request<{
        initialized: boolean;
        authMode: string;
        pinLength: number;
    }>("/auth/status"),
    me: () => request<{
        authenticated: boolean;
    }>("/auth/me"),
    login: (pin: string) => request<{
        success: boolean;
    }>("/auth/login", { method: "POST", body: JSON.stringify({ pin }) }),
    logout: () => request<{
        success: boolean;
    }>("/auth/logout", { method: "POST" }),
    driveStatus: () => request<{
        connected: boolean;
        rootFolderReady: boolean;
    }>("/drive/status"),
    driveConnect: () => request<{
        url: string;
    }>("/drive/connect"),
    storage: () => request<{
        limit: number;
        usage: number;
        usageInDrive: number;
    }>("/drive/storage"),
    files: (folder?: string, trashed = false) => request<{
        files: VaultFile[];
        currentFolderId: string;
        rootFolderId: string;
    }>(`/drive/files?${new URLSearchParams({ ...(folder ? { folder } : {}), ...(trashed ? { trashed: "true" } : {}) })}`),
    createFolder: (name: string, parentId?: string) => request<{
        id: string;
        name: string;
    }>("/drive/folders", { method: "POST", body: JSON.stringify({ name, parentId }) }),
    initUpload: (file: File, parentId?: string) => request<{
        uploadId: string;
        chunkSize: number;
    }>("/drive/upload/init", { method: "POST", body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, parentId }) }),
    uploadChunk: (id: string, chunk: Blob, start: number, end: number, total: number) => request<{
        complete: boolean;
        range?: string;
        file?: unknown;
    }>(`/drive/upload/${id}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${start}-${end - 1}/${total}` }, body: chunk }),
    rename: (id: string, name: string) => request<{
        id: string;
        name: string;
    }>(`/drive/files/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    trash: (id: string) => request<{ id: string; name: string }>(`/drive/files/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }),
    favorites: () => request<{ files: VaultFile[] }>("/vault/favorites"),
    toggleFavorite: (id: string) => request<{ favorite: boolean }>(`/vault/favorites/${encodeURIComponent(id)}`, { method: "POST" }),
    recent: () => request<{ files: VaultFile[] }>("/vault/recent"),
    trackRecent: (id: string) => request<{ success: boolean }>(`/vault/recent/${encodeURIComponent(id)}`, { method: "POST" }),
    trashList: () => request<{ files: VaultFile[] }>("/vault/trash"),
    restore: (id: string) => request<{ success: boolean }>(`/vault/trash/${encodeURIComponent(id)}/restore`, { method: "POST" }),
    permanentlyDelete: (id: string) => request<{ success: boolean }>(`/vault/trash/${encodeURIComponent(id)}`, { method: "DELETE" }),
    settings: () => request<{ authMode: string; pinLength: number; driveConnected: boolean; activeSessions: number }>("/vault/settings"),
    logoutAll: () => request<{ success: boolean }>("/auth/logout-all", { method: "POST" }),
        rotateRecovery: (currentPin: string, recoveryKey: string) =>
        request<{ success: boolean; recoveryKey: string }>("/auth/rotate-recovery", {
            method: "POST",
            body: JSON.stringify({ currentPin, recoveryKey })
        }),
    changePin: (currentPin: string, recoveryKey: string, newPin: string, pinLength: 4 | 6) => request<{ success: boolean; message: string }>("/auth/change-pin", { method: "POST", body: JSON.stringify({ currentPin, recoveryKey, newPin, pinLength }) }),
};
export function contentUrl(file: VaultFile, download = false): string {
    return `/api/drive/files/${encodeURIComponent(file.id)}/content?${new URLSearchParams({ download: download ? "1" : "0", name: file.name })}`;
}
