// POST /functions/v1/brightcove-upload-init
// Body: { team_id, event_id, file_name }
// Returns: { video_id, signed_url, api_request_url, callback_url }
import { handleOptions, ok, fail, serviceClient, legacyAuth, parseBody } from "../_shared/legacy.ts";
import { bcCreateVideo, bcGetUploadUrl, bcEnsureFolder, bcAddVideoToFolder } from "../_shared/brightcove.ts";

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
    const fileName = String(body.file_name ?? `team-${teamId}.mp4`);
    if (!teamId || !eventId) return fail("team_id and event_id are required");

    const sb = serviceClient();
    // Verify ownership
    const { data: team } = await sb
      .from("teams")
      .select("id, name, gym_name, coach_user_id")
      .eq("id", teamId).maybeSingle();
    if (!team || team.coach_user_id !== user.user_id) return fail("Team not found");

    // Look up event name for Brightcove folder
    const { data: event } = await sb
      .from("events")
      .select("name")
      .eq("id", eventId).maybeSingle();
    const folderName = (event?.name ?? "").trim() || `Event ${eventId}`;

    // Create Brightcove video shell
    const created = await bcCreateVideo(`${team.gym_name} - ${team.name}`, ["cheermatch", "mobile-upload"]);

    // Place into folder named after the event (non-fatal on failure)
    try {
      const folderId = await bcEnsureFolder(folderName);
      await bcAddVideoToFolder(folderId, created.id);
    } catch (folderErr) {
      console.error("Brightcove folder assignment failed:", (folderErr as Error).message);
    }

    const { signed_url, api_request_url } = await bcGetUploadUrl(created.id, fileName);

    const callbackUrl = `${SUPABASE_URL}/functions/v1/brightcove-ingest-callback?secret=${encodeURIComponent(CALLBACK_SECRET)}`;

    return ok("Upload initialized", {
      video_id: created.id,
      signed_url,
      api_request_url,
      callback_url: callbackUrl,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
