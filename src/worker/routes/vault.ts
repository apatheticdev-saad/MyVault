import { Hono } from "hono";
import type { Env } from "../types";
import { requireAuth } from "../lib/auth";
import { driveRequest, ensureRootFolder } from "../lib/google-drive";
const vault = new Hono<{ Bindings: Env }>();
const now = () => Math.floor(Date.now() / 1000);
async function managed(env: Env, id: string) {
  const root = await ensureRootFolder(env);
  const row = await env.DB.prepare("SELECT parent_drive_id FROM files WHERE drive_file_id = ?").bind(id).first<{parent_drive_id:string|null}>();
  if (!row?.parent_drive_id) return false;
  let parent = row.parent_drive_id;
  for (let i=0; i<20 && parent !== root; i++) {
    const p = await env.DB.prepare("SELECT parent_drive_id,mime_type,is_trashed FROM files WHERE drive_file_id = ?").bind(parent).first<{parent_drive_id:string|null;mime_type:string;is_trashed:number}>();
    if (!p || p.mime_type !== "application/vnd.google-apps.folder" || p.is_trashed || !p.parent_drive_id) return false;
    parent = p.parent_drive_id;
  }
  return parent === root;
}
vault.get("/favorites", requireAuth, async c => {
  const rows = await c.env.DB.prepare("SELECT f.drive_file_id AS id, f.name, f.mime_type AS mimeType, f.size_bytes AS size, f.parent_drive_id AS parentId, f.created_at AS createdAt, f.modified_at AS modifiedAt FROM favorites v JOIN files f ON f.drive_file_id=v.drive_file_id WHERE f.is_trashed=0 ORDER BY v.created_at DESC LIMIT 500").all();
  return c.json({files:(rows.results || []).map((r:any)=>({...r,isFolder:r.mimeType === "application/vnd.google-apps.folder"}))});
});
vault.post("/favorites/:id", requireAuth, async c => {
  const id=c.req.param("id");
  if (!await managed(c.env,id)) return c.json({error:"Item is not part of MyVault."},404);
  const exists=await c.env.DB.prepare("SELECT drive_file_id FROM favorites WHERE drive_file_id=?").bind(id).first();
  if (exists) await c.env.DB.prepare("DELETE FROM favorites WHERE drive_file_id=?").bind(id).run();
  else await c.env.DB.prepare("INSERT INTO favorites(drive_file_id,created_at) VALUES(?,?)").bind(id,now()).run();
  return c.json({favorite:!exists});
});
vault.get("/recent", requireAuth, async c => {
  const rows=await c.env.DB.prepare("SELECT f.drive_file_id AS id,f.name,f.mime_type AS mimeType,f.size_bytes AS size,f.parent_drive_id AS parentId,f.created_at AS createdAt,f.modified_at AS modifiedAt,r.opened_at AS openedAt FROM recent_items r JOIN files f ON f.drive_file_id=r.drive_file_id WHERE f.is_trashed=0 ORDER BY r.opened_at DESC LIMIT 100").all();
  return c.json({files:(rows.results||[]).map((r:any)=>({...r,isFolder:r.mimeType === "application/vnd.google-apps.folder"}))});
});
vault.post("/recent/:id", requireAuth, async c => {
  const id=c.req.param("id");
  if (!await managed(c.env,id)) return c.json({error:"Item is not part of MyVault."},404);
  await c.env.DB.prepare("INSERT INTO recent_items(drive_file_id,opened_at) VALUES(?,?) ON CONFLICT(drive_file_id) DO UPDATE SET opened_at=excluded.opened_at").bind(id,now()).run();
  return c.json({success:true});
});
vault.get("/trash", requireAuth, async c => {
  const rows=await c.env.DB.prepare("SELECT drive_file_id AS id,name,mime_type AS mimeType,size_bytes AS size,parent_drive_id AS parentId,created_at AS createdAt,modified_at AS modifiedAt FROM files WHERE is_trashed=1 ORDER BY modified_at DESC LIMIT 500").all();
  return c.json({files:(rows.results||[]).map((r:any)=>({...r,isFolder:r.mimeType === "application/vnd.google-apps.folder",trashed:true}))});
});
vault.post("/trash/:id/restore", requireAuth, async c => {
  const id=c.req.param("id");
  const row=await c.env.DB.prepare("SELECT parent_drive_id FROM files WHERE drive_file_id=? AND is_trashed=1").bind(id).first<{parent_drive_id:string|null}>();
  if (!row || !row.parent_drive_id || !await managed(c.env,id)) return c.json({error:"Trashed item not found in MyVault."},404);
  await driveRequest(c.env,`/files/${encodeURIComponent(id)}?fields=id`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:false})});
  await c.env.DB.prepare("UPDATE files SET is_trashed=0,modified_at=? WHERE drive_file_id=?").bind(now(),id).run();
  return c.json({success:true});
});
vault.delete("/trash/:id", requireAuth, async c => {
  const id=c.req.param("id");
  const row=await c.env.DB.prepare("SELECT drive_file_id FROM files WHERE drive_file_id=? AND is_trashed=1").bind(id).first();
  if (!row || !await managed(c.env,id)) return c.json({error:"Trashed item not found in MyVault."},404);
  await driveRequest(c.env,`/files/${encodeURIComponent(id)}`,{method:"DELETE"});
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM files WHERE drive_file_id=?").bind(id),c.env.DB.prepare("DELETE FROM favorites WHERE drive_file_id=?").bind(id),c.env.DB.prepare("DELETE FROM recent_items WHERE drive_file_id=?").bind(id)]);
  return c.json({success:true});
});
vault.get("/settings", requireAuth, async c => {
  const config=await c.env.DB.prepare("SELECT auth_mode,pin_length,google_refresh_token_enc FROM app_config WHERE id=1").first<{auth_mode:string;pin_length:number;google_refresh_token_enc:string|null}>();
  const sessions=await c.env.DB.prepare("SELECT COUNT(*) AS count FROM sessions").first<{count:number}>();
  return c.json({authMode:config?.auth_mode||"pin",pinLength:config?.pin_length||6,driveConnected:Boolean(config?.google_refresh_token_enc),activeSessions:sessions?.count||0});
});
export default vault;
