// Admin-only replacement of a submission's performance video.
//
// POST /functions/v1/admin-replace-video
//   { action: "init",     submission_id, file_name }
//     -> { video_id, signed_url, api_request_url }
//   { action: "complete", submission_id, video_id, api_request_url,
//     duration_seconds?, delete_old? }
//     -> { submission_id, video_id }
import { handleOptions, ok, fail, serviceClient, parseBody } from "../_shared/legacy.ts";
import {
  bcCreateVideo,
  bcGetUploadUrl,
  bcEnsureFolder,
  bcAddVideoToFolder,
  bcIngestRequest,
  bcDeleteVideo,
} from "../_shared/brightcove.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CALLBACK_SECRET = Deno.env.get("BRIGHTCOVE_INGEST_CALLBACK_SECRET")!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return fail("Unauthorized");

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return fail("Unauthorized");

    const sb = serviceClient();
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: who.user.id, _role: "admin" });
    if (!isAdmin) return fail("Forbidden");

    const body = await parseBody(req);
    const action = String(body.action ?? "");
    let submissionId = String(body.submission_id ?? "").trim();
    const eventId = String(body.event_id ?? "").trim();
    const teamId = String(body.team_id ?? "").trim();

    // Manual upload path: no submission yet — find or create one for this team + event.
    if (!UUID_RE.test(submissionId) && action === "init" && UUID_RE.test(eventId) && UUID_RE.test(teamId)) {
      const { data: existing } = await sb
        .from("video_submissions")
        .select("id")
        .eq("event_id", eventId)
        .eq("team_id", teamId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        submissionId = existing.id;
      } else {
        const { data: created, error: createErr } = await sb
          .from("video_submissions")
          .insert({
            event_id: eventId,
            team_id: teamId,
            status: "pending",
            submitted_via: "admin",
            submitted_by: who.user.id,
          })
          .select("id")
          .single();
        if (createErr) return fail(createErr.message);
        submissionId = created.id;
      }
    }

    if (!UUID_RE.test(submissionId)) return fail("A valid submission_id is required");

    const { data: sub } = await sb
      .from("video_submissions")
      .select("id, event_id, brightcove_video_id, team:teams(name, gym_name), event:events(name)")
      .eq("id", submissionId)
      .maybeSingle();
    if (!sub) return fail("Submission not found");

    const teamName = (sub as any).team?.name ?? "Team";
    const gymName = (sub as any).team?.gym_name ?? "";
    const eventName = ((sub as any).event?.name ?? "").trim() || `Event ${(sub as any).event_id}`;


    if (action === "init") {
      const fileName = String(body.file_name ?? "replacement.mp4").replace(/[^\w\-. ]+/g, "") || "replacement.mp4";
      const created = await bcCreateVideo(
        gymName ? `${gymName} - ${teamName}` : teamName,
        ["cheermatch", "admin-replacement"],
      );
      try {
        const folderId = await bcEnsureFolder(eventName);
        await bcAddVideoToFolder(folderId, created.id);
      } catch (folderErr) {
        console.error("Brightcove folder assignment failed:", (folderErr as Error).message);
      }
      const { signed_url, api_request_url } = await bcGetUploadUrl(created.id, fileName);
      return ok("Upload initialized", { submission_id: submissionId, video_id: created.id, signed_url, api_request_url });
    }

    if (action === "complete") {
      const videoId = String(body.video_id ?? "");
      const apiUrl = String(body.api_request_url ?? "");
      if (!videoId || !apiUrl) return fail("video_id and api_request_url are required");

      const callbackUrl = `${SUPABASE_URL}/functions/v1/brightcove-ingest-callback?secret=${encodeURIComponent(CALLBACK_SECRET)}`;
      await bcIngestRequest(videoId, apiUrl, callbackUrl);

      const oldVideoId = (sub as any).brightcove_video_id as string | null;
      const duration = Number(body.duration_seconds ?? 0) || null;

      const { error } = await sb.from("video_submissions").update({
        brightcove_video_id: videoId,
        video_url: null,
        thumbnail_url: null,
        duration_seconds: duration,
        status: "uploaded",
        submitted_at: new Date().toISOString(),
        submitted_by: who.user.id,
        submitted_via: "admin",
        reviewed_at: null,
        reviewed_by: null,
      }).eq("id", submissionId);
      if (error) return fail(error.message);

      if (body.delete_old && oldVideoId && oldVideoId !== videoId) {
        try { await bcDeleteVideo(oldVideoId); } catch (e) {
          console.error("Failed to delete previous Brightcove video:", (e as Error).message);
        }
      }

      return ok("Replacement video uploaded", { submission_id: submissionId, video_id: videoId });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message);
  }
});
