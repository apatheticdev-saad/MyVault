import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { hmac, randomToken, sha256 } from "./crypto";
const COOKIE_NAME = "mv_session";
const SESSION_SECONDS = 4 * 60 * 60;
export function setSessionCookie(c: Context<{
    Bindings: Env;
}>, token: string): void {
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? "; Secure" : ""}`);
}
export function clearSessionCookie(c: Context<{
    Bindings: Env;
}>): void {
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`);
}
function readCookie(header: string | undefined, name: string): string | null {
    if (!header)
        return null;
    for (const item of header.split(";")) {
        const [key, ...rest] = item.trim().split("=");
        if (key === name)
            return rest.join("=") || null;
    }
    return null;
}
export const requireAuth: MiddlewareHandler<{
    Bindings: Env;
}> = async (c, next) => {
    const token = readCookie(c.req.header("Cookie"), COOKIE_NAME);
    if (!token)
        return c.json({ error: "Authentication required." }, 401);
    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);
    const session = await c.env.DB.prepare("SELECT id FROM sessions WHERE token_hash = ? AND expires_at > ?")
        .bind(tokenHash, now).first<{
        id: string;
    }>();
    if (!session)
        return c.json({ error: "Session expired. Please unlock MyVault again." }, 401);
    await c.env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, session.id).run();
    await next();
};
export async function createSession(c: Context<{
    Bindings: Env;
}>): Promise<void> {
    const token = randomToken(32);
    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare("INSERT INTO sessions (id, token_hash, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), tokenHash, now, now + SESSION_SECONDS, now).run();
    setSessionCookie(c, token);
}
export async function destroyCurrentSession(c: Context<{
    Bindings: Env;
}>): Promise<void> {
    const token = readCookie(c.req.header("Cookie"), COOKIE_NAME);
    if (token)
        await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    clearSessionCookie(c);
}
export async function getIpKey(c: Context<{
    Bindings: Env;
}>): Promise<string> {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    return hmac(ip, c.env.APP_PEPPER);
}
