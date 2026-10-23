// POST /functions/v1/dropbox-export  { action, ... }   (admin only)
// actions: status | auth_url | connect | disconnect | set_folder | start | check
// Videos go cloud-to-cloud via Dropbox files/save_url, so large files never pass through the portal.
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";
import { bcGetVideoSources, bcPickMp4Source, bcGetDigitalMaster } from "../_shared/brightcove.ts";
import { dropboxFileName, dropboxFolder } from "../_shared/dropbox-naming.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_KEY = Deno.env.get("DROPBOX_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("DROPBOX_APP_SECRET") ?? "";

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${APP_KEY}:${APP_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dropbox sign-in failed [${res.status}]: ${text}`);
  return JSON.parse(text);
}

async function dbx(token: string, path: string, body: unknown, member?: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  // Team-wide (Dropbox Business) tokens must say which member's Dropbox to act on.
  if (member) headers["Dropbox-API-Select-User"] = member;
  const res = await fetch(`https://api.dropboxapi.com/2/${path}`, {
    method: "POST",
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { ok: res.ok, status: res.status, json, text };
}

// Returns the signed-in admin's team member id when the token belongs to a whole Dropbox Business team, else null.
async function teamAdmin(token: string): Promise<{ id: string; email: string | null } | null> {
  const r = await dbx(token, "team/token/get_authenticated_admin", null);
  const p = r.ok ? r.json?.admin_profile : null;
  return p?.team_member_id ? { id: p.team_member_id, email: p.email ?? null } : null;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return fail("Unauthorized");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return fail("Unauthorized");
    const sb = serviceClient();
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: who.user.id, _role: "admin" });
    if (!isAdmin) return fail("Forbidden");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const configured = !!(APP_KEY && APP_SECRET);

    const { data: conn } = await sb.from("dropbox_connection").select("*").maybeSingle();

    if (action === "status") {
      return ok("ok", {
        configured,
        connected: !!conn,
        account_email: conn?.account_email ?? null,
        base_folder: conn?.base_folder ?? "/CheerMatch Videos",
      });
    }

    if (!configured) return fail("Dropbox app keys are not set up yet.");

    const redirectUri = String(body.redirect_uri ?? "");
    if (action === "auth_url") {
      if (!/^https?:\/\//.test(redirectUri)) return fail("Invalid redirect");
      const u = new URL("https://www.dropbox.com/oauth2/authorize");
      u.searchParams.set("client_id", APP_KEY);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("token_access_type", "offline");
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("state", "dropbox");
      // Asking only for personal scopes gives a single-person token even when the app also has team scopes.
      u.searchParams.set("scope", "account_info.read files.content.write");
      return ok("ok", { url: u.toString() });
    }

    if (action === "connect") {
      const code = String(body.code ?? "");
      if (!code || !redirectUri) return fail("Missing code");
      const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
      if (!tok.refresh_token) return fail("Dropbox did not return a long-lived token.");
      const admin = await teamAdmin(tok.access_token);
      const acct = await dbx(tok.access_token, "users/get_current_account", null, admin?.id);
      if (!acct.ok && !admin) {
        console.error("dropbox connect: account lookup failed", acct.status, acct.text.slice(0, 500));
        return fail(`Dropbox would not share the account details [${acct.status}]: ${acct.text.slice(0, 200)}`);
      }
      await sb.from("dropbox_connection").upsert({
        id: true,
        refresh_token: tok.refresh_token,
        account_email: acct.json?.email ?? admin?.email ?? null,
        base_folder: conn?.base_folder ?? "/CheerMatch Videos",
        connected_at: new Date().toISOString(),
      });
      return ok("Connected", { account_email: acct.json?.email ?? admin?.email ?? null });
    }

    if (action === "disconnect") {
      await sb.from("dropbox_connection").delete().eq("id", true);
      return ok("Disconnected");
    }

    if (!conn) return fail("Dropbox is not connected. Connect it under Settings first.");

    if (action === "set_folder") {
      const folder = String(body.base_folder ?? "").trim().slice(0, 200);
      if (!folder) return fail("Folder is required");
      await sb.from("dropbox_connection").update({ base_folder: folder.startsWith("/") ? folder : "/" + folder }).eq("id", true);
      return ok("Saved");
    }

    const submissionId = String(body.submission_id ?? "");
    if (!UUID_RE.test(submissionId)) return fail("A valid submission_id is required");
    const { access_token } = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
    const member = (await teamAdmin(access_token))?.id ?? null;

    const save = async (row: Record<string, unknown>) => {
      await sb.from("dropbox_exports").upsert({ submission_id: submissionId, updated_at: new Date().toISOString(), ...row });
    };

    if (action === "start") {
      const { data: sub } = await sb
        .from("video_submissions")
        .select("id, event_id, brightcove_video_id, video_url, event:events(name), team:teams(name, gym_name, division:divisions(name))")
        .eq("id", submissionId)
        .maybeSingle();
      if (!sub) return fail("Submission not found");
      const s = sub as any;

      let url = "";
      let ext = "mp4";
      if (s.brightcove_video_id) {
        const mp4 = bcPickMp4Source(await bcGetVideoSources(s.brightcove_video_id));
        url = mp4?.src ?? "";
        if (!url) {
          const master = await bcGetDigitalMaster(s.brightcove_video_id);
          const m = (master?.url ?? (master as any)?.src) as string | undefined;
          if (m && /^https?:/i.test(m)) {
            url = m;
            ext = (m.split("?")[0].split(".").pop() ?? "mp4").slice(0, 4);
          }
        }
      } else if (s.video_url && !/players\.brightcove\.net/.test(s.video_url)) {
        url = s.video_url;
      }
      if (!url) {
        await save({ event_id: s.event_id, status: "failed", error: "No downloadable copy of this video yet — try the video download button first, then retry." });
        return fail("No downloadable video");
      }

      const eventName = s.event?.name ?? "Event";
      const path = `${dropboxFolder(conn.base_folder, eventName)}/${dropboxFileName({
        event: eventName, gym: s.team?.gym_name, team: s.team?.name, division: s.team?.division?.name, ext,
      })}`;
      const r = await dbx(access_token, "files/save_url", { path, url }, member);
      if (!r.ok) {
        const msg = r.text.includes("conflict") ? "A file with this name already exists in Dropbox."
          : r.text.includes("entire Dropbox Business team") ? "Dropbox sees this as a whole Business team sign-in. Add the team_info.read permission to the Dropbox app, then Disconnect and Connect Dropbox again in Settings."
          : `Dropbox error [${r.status}]: ${r.text.slice(0, 300)}`;
        await save({ event_id: s.event_id, dropbox_path: path, status: "failed", error: msg, job_id: null });
        return fail(msg);
      }
      const done = r.json?.[".tag"] === "complete";
      await save({ event_id: s.event_id, dropbox_path: path, status: done ? "completed" : "transferring", job_id: r.json?.async_job_id ?? null, error: null });
      return ok("Started", { status: done ? "completed" : "transferring" });
    }

    if (action === "check") {
      const { data: row } = await sb.from("dropbox_exports").select("*").eq("submission_id", submissionId).maybeSingle();
      if (!row?.job_id || row.status !== "transferring") return ok("ok", { status: row?.status ?? "queued" });
      const r = await dbx(access_token, "files/save_url/check_job_status", { async_job_id: row.job_id }, member);
      const tag = r.json?.[".tag"];
      if (tag === "complete") { await save({ status: "completed", error: null }); return ok("ok", { status: "completed" }); }
      if (tag === "failed" || !r.ok) {
        const err = `Transfer failed: ${JSON.stringify(r.json?.failed ?? r.text).slice(0, 300)}`;
        await save({ status: "failed", error: err });
        return ok("ok", { status: "failed", error: err });
      }
      return ok("ok", { status: "transferring" });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message);
  }
});
