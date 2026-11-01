import { Hono } from "hono";
import type { Env, AppConfig } from "../types";
import { createPinVerifier, randomToken, safeEqual, verifyPin, hmac } from "../lib/crypto";
import { createSession, destroyCurrentSession, getIpKey, requireAuth } from "../lib/auth";
const auth = new Hono<{
    Bindings: Env;
}>();
const now = () => Math.floor(Date.now() / 1000);
async function recordFailure(env: Env, ipHash: string): Promise<void> {
    const timestamp = now();
    await env.DB.prepare(`INSERT INTO login_attempts (ip_hash, attempts, window_started_at, blocked_until)
        VALUES (?, 1, ?, 0)
        ON CONFLICT(ip_hash) DO UPDATE SET
          attempts = CASE WHEN ? - window_started_at > 900 THEN 1 ELSE attempts + 1 END,
          window_started_at = CASE WHEN ? - window_started_at > 900 THEN ? ELSE window_started_at END,
          blocked_until = CASE WHEN (CASE WHEN ? - window_started_at > 900 THEN 1 ELSE attempts + 1 END) >= 5 THEN ? + 900 ELSE 0 END`)
        .bind(ipHash, timestamp, timestamp, timestamp, timestamp, timestamp, timestamp).run();
}
async function clearFailures(env: Env, ipHash: string): Promise<void> {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash = ?").bind(ipHash).run();
}
auth.get("/status", async (c) => {
    const config = await c.env.DB.prepare("SELECT is_initialized, auth_mode, pin_length FROM app_config WHERE id = 1").first<{
        is_initialized: number;
        auth_mode: string;
        pin_length: number;
    }>();
    return c.json({ initialized: Boolean(config?.is_initialized), authMode: config?.auth_mode || "pin", pinLength: config?.pin_length || 6 });
});
auth.post("/setup", async (c) => {
    if (!c.env.APP_PEPPER || c.env.APP_PEPPER.length < 32)
        return c.json({ error: "Server security configuration is incomplete." }, 503);
    const provided = c.req.header("X-Setup-Secret") || "";
    if (!c.env.SETUP_SECRET || !safeEqual(provided, c.env.SETUP_SECRET))
        return c.json({ error: "Setup authorization failed." }, 403);
    const existing = await c.env.DB.prepare("SELECT is_initialized FROM app_config WHERE id = 1").first<{
        is_initialized: number;
    }>();
    if (existing?.is_initialized)
        return c.json({ error: "MyVault has already been initialized." }, 409);
    const body = await c.req.json<{
        pin?: string;
        pinLength?: number;
    }>();
    const pinLength = body.pinLength === 4 ? 4 : 6;
    if (!body.pin || !new RegExp(`^\\d{${pinLength}}$`).test(body.pin))
        return c.json({ error: `PIN must contain exactly ${pinLength} digits.` }, 400);
    const pin = await createPinVerifier(body.pin, c.env.APP_PEPPER);
    const recoveryKey = randomToken(32);
    const recoverySalt = randomToken(16);
    const recoveryHash = await hmac(`${recoverySalt}:${recoveryKey}`, c.env.APP_PEPPER);
    const timestamp = now();
    await c.env.DB.prepare(`INSERT OR REPLACE INTO app_config
    (id, is_initialized, auth_mode, pin_length, pin_salt, pin_hash, recovery_salt, recovery_hash, created_at, updated_at)
    VALUES (1, 1, 'pin', ?, ?, ?, ?, ?, ?, ?)`)
        .bind(pinLength, pin.salt, pin.hash, recoverySalt, recoveryHash, timestamp, timestamp).run();
    return c.json({ success: true, recoveryKey, message: "Save this recovery key offline. It will not be shown again." });
});
auth.post("/login", async (c) => {
    if (!c.env.APP_PEPPER || c.env.APP_PEPPER.length < 32)
        return c.json({ error: "Server security configuration is incomplete." }, 503);
    const ipHash = await getIpKey(c);
    const timestamp = now();
    const attempt = await c.env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM login_attempts WHERE ip_hash = ?").bind(ipHash).first<{
        attempts: number;
        window_started_at: number;
        blocked_until: number;
    }>();
    if (attempt?.blocked_until && attempt.blocked_until > timestamp)
        return c.json({ error: "Too many attempts. Try again later." }, 429);
    const body = await c.req.json<{
        pin?: string;
    }>();
    const config = await c.env.DB.prepare("SELECT * FROM app_config WHERE id = 1").first<AppConfig>();
    if (!config?.is_initialized || !config.pin_salt || !config.pin_hash)
        return c.json({ error: "MyVault has not been initialized." }, 503);
    const validFormat = typeof body.pin === "string" && new RegExp(`^\\d{${config.pin_length}}$`).test(body.pin);
    const valid = validFormat && await verifyPin(body.pin!, config.pin_salt, config.pin_hash, c.env.APP_PEPPER);
    if (!valid) {
        await recordFailure(c.env, ipHash);
        return c.json({ error: "Incorrect PIN." }, 401);
    }
    await clearFailures(c.env, ipHash);
    await createSession(c);
    return c.json({ success: true });
});
auth.get("/me", requireAuth, (c) => c.json({ authenticated: true }));
auth.post("/logout", async (c) => {
    await destroyCurrentSession(c);
    return c.json({ success: true });
});
auth.post("/logout-all", requireAuth, async (c) => {
    await c.env.DB.prepare("DELETE FROM sessions").run();
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", `mv_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`);
    return c.json({ success: true });
});
auth.post("/rotate-recovery", requireAuth, async (c) => {
        if (!c.env.APP_PEPPER || c.env.APP_PEPPER.length < 32)
        return c.json({ error: "Server security configuration is incomplete." }, 503);
    const body = await c.req.json<{ currentPin?: string; recoveryKey?: string }>();
    const config = await c.env.DB.prepare("SELECT * FROM app_config WHERE id = 1").first<AppConfig>();

    if (!config?.pin_hash || !config.pin_salt || !config.recovery_hash || !config.recovery_salt)
        return c.json({ error: "Security configuration is incomplete." }, 500);

    if (!body.currentPin || !await verifyPin(body.currentPin, config.pin_salt, config.pin_hash, c.env.APP_PEPPER))
        return c.json({ error: "Current PIN is incorrect." }, 403);

    const check = await hmac(`${config.recovery_salt}:${body.recoveryKey || ""}`, c.env.APP_PEPPER);
    if (!safeEqual(check, config.recovery_hash))
        return c.json({ error: "Recovery key verification failed." }, 403);

    const recoveryKey = randomToken(32);
    const recoverySalt = randomToken(16);
    const recoveryHash = await hmac(`${recoverySalt}:${recoveryKey}`, c.env.APP_PEPPER);

    await c.env.DB.prepare(
        "UPDATE app_config SET recovery_salt = ?, recovery_hash = ?, updated_at = ? WHERE id = 1"
    ).bind(recoverySalt, recoveryHash, now()).run();

    return c.json({ success: true, recoveryKey });
});

auth.post("/change-pin", requireAuth, async (c) => {
    const body = await c.req.json<{
        currentPin?: string;
        recoveryKey?: string;
        newPin?: string;
        pinLength?: number;
    }>();
    const config = await c.env.DB.prepare("SELECT * FROM app_config WHERE id = 1").first<AppConfig>();
    if (!config?.pin_hash || !config.pin_salt || !config.recovery_hash || !config.recovery_salt)
        return c.json({ error: "Security configuration is incomplete." }, 500);
    const newLength = body.pinLength === 4 ? 4 : 6;
    if (!body.currentPin || !await verifyPin(body.currentPin, config.pin_salt, config.pin_hash, c.env.APP_PEPPER))
        return c.json({ error: "Current PIN is incorrect." }, 403);
    const recoveryCheck = await hmac(`${config.recovery_salt}:${body.recoveryKey || ""}`, c.env.APP_PEPPER);
    if (!safeEqual(recoveryCheck, config.recovery_hash))
        return c.json({ error: "Recovery key verification failed." }, 403);
    if (!body.newPin || !new RegExp(`^\\d{${newLength}}$`).test(body.newPin))
        return c.json({ error: `New PIN must contain exactly ${newLength} digits.` }, 400);
    const next = await createPinVerifier(body.newPin, c.env.APP_PEPPER);
    await c.env.DB.prepare("UPDATE app_config SET pin_length = ?, pin_salt = ?, pin_hash = ?, updated_at = ? WHERE id = 1")
        .bind(newLength, next.salt, next.hash, now()).run();
    await c.env.DB.prepare("DELETE FROM sessions").run();
    return c.json({ success: true, message: "PIN updated. Please log in again." });
});
export default auth;
