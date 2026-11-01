export interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    APP_PEPPER: string;
    SETUP_SECRET: string;
    APP_ENCRYPTION_KEY: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APP_ORIGIN?: string;
}
export interface AppConfig {
    id: number;
    is_initialized: number;
    auth_mode: "pin" | "username_password";
    pin_length: number;
    pin_salt: string | null;
    pin_hash: string | null;
    recovery_salt: string | null;
    recovery_hash: string | null;
    username: string | null;
    password_salt: string | null;
    password_hash: string | null;
    google_refresh_token_enc: string | null;
    google_access_token_enc: string | null;
    google_access_token_expires_at: number | null;
    google_root_folder_id: string | null;
    google_oauth_state: string | null;
    google_oauth_state_created_at: number | null;
    created_at: number;
    updated_at: number;
}
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    parents?: string[];
    createdTime?: string;
    modifiedTime?: string;
    webViewLink?: string;
    trashed?: boolean;
}
