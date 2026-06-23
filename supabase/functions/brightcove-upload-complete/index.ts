// POST /functions/v1/brightcove-upload-complete
// Body: { team_id, event_id, video_id, api_request_url, duration_seconds, captured_at, device_info }
import { handleOptions, ok, fail, serviceClient, legacyAuth, parseBody } from "../_shared/legacy.ts";
import { bcIngestRequest } from "../_shared/brightcove.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CALLBACK_SECRET = Deno.env.get("BRIGHTCOVE_INGEST_CALLBACK_SECRET")!;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) return fail("Invalid or missing session token");

    const body = await parseBody(req);
    const teamId = String(body.team_id ?? "");
    const eventId = String(body.event_id ?? "");
    const videoId = String(body.video_id ?? "");
    const apiUrl = String(body.api_request_url ?? "");
    if (!teamId || !eventId || !videoId || !apiUrl) return fail("Missing required fields");

    const duration = Number(body.duration_seconds ?? 0) || null;
    const capturedAt = body.captured_at ? new Date(String(body.captured_at)).toISOString() : new Date().toISOString();
    const deviceInfo = body.device_info ?? null;

    const sb = serviceClient();
    const { data: team } = await sb.from("teams").select("id, coach_user_id").eq("id", teamId).maybeSingle();
    if (!team || team.coach_user_id !== user.user_id) return fail("Team not found");

    // Trigger Brightcove ingest
    const callbackUrl = `${SUPABASE_URL}/functions/v1/brightcove-ingest-callback?secret=${encodeURIComponent(CALLBACK_SECRET)}`;
    await bcIngestRequest(videoId, apiUrl, callbackUrl);

    // Upsert the submission row
    const { data: existing } = await sb
      .from("video_submissions")
      .select("id")
      .eq("team_id", teamId).eq("event_id", eventId).maybeSingle();

    const payload = {
      team_id: teamId,
      event_id: eventId,
      brightcove_video_id: videoId,
      duration_seconds: duration,
      captured_at: capturedAt,
      device_info: deviceInfo,
      submitted_via: "mobile",
      submitted_at: new Date().toISOString(),
      submitted_by: user.user_id,
      status: "uploaded" as const,
    };

    if (existing?.id) {
      const { error } = await sb.from("video_submissions").update(payload).eq("id", existing.id);
      if (error) return fail(error.message);
      return ok("Submission updated", { submission_id: existing.id, video_id: videoId });
    }

    const { data: ins, error } = await sb.from("video_submissions").insert(payload).select("id").single();
    if (error) return fail(error.message);
    return ok("Submission created", { submission_id: ins.id, video_id: videoId });
  } catch (e) {
    return fail((e as Error).message);
  }
});
