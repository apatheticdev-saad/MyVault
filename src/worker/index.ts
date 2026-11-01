import { Hono } from "hono";
import type { Env } from "./types";
import authRoutes from "./routes/auth";
import driveRoutes from "./routes/drive";
import vaultRoutes from "./routes/vault";
const app = new Hono<{
    Bindings: Env;
}>();
app.use("/api/*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header("Cache-Control", "no-store");
    if (new URL(c.req.url).protocol === "https:")
        c.header("Strict-Transport-Security", "max-age=31536000");
    await next();
});
app.use("/api/*", async (c, next) => {
    const origin = c.req.header("Origin");
    const expected = c.env.APP_ORIGIN || new URL(c.req.url).origin;
    if (origin && origin !== expected)
        return c.json({ error: "Cross-origin request blocked." }, 403);
    await next();
});
app.get("/api/health", (c) => c.json({ status: "ok", service: "myvault-api", version: "0.1.0" }));
app.route("/api/auth", authRoutes);
app.route("/api/drive", driveRoutes);
app.route("/api/vault", vaultRoutes);
app.notFound((c) => c.json({ error: "API route not found." }, 404));
app.onError((_error, c) => {
    console.error("MyVault API request failed.");
   
    return c.json({ error: "An unexpected server error occurred." }, 500);
});
export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/"))
            return app.fetch(request, env, ctx);
        return env.ASSETS.fetch(request).then((response) => {
            const headers = new Headers(response.headers);
            headers.set("X-Content-Type-Options", "nosniff");
            headers.set("X-Frame-Options", "DENY");
            headers.set("Referrer-Policy", "no-referrer");
            headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
            if (new URL(request.url).protocol === "https:")
                headers.set("Strict-Transport-Security", "max-age=31536000");
            headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        });
    },
};
