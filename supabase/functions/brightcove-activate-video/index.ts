// POST /functions/v1/brightcove-activate-video  { brightcove_video_id: "..." }
// Admin-only helper: flips a Brightcove video to ACTIVE so the player can play it.
// Use this to retroactively fix any video that was ingested before activation was
// part of the upload flow.
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";
import { bcActivateVideo } from "../_shared/brightcove.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return fail("Unauthorized");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return fail("Unauthorized");

    const sb = serviceClient();
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: who.user.id, _role: "admin" });
    if (!isAdmin) return fail("Forbidden");

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const videoId = String(body.brightcove_video_id ?? "").trim();
    if (!videoId) return fail("brightcove_video_id is required");

    await bcActivateVideo(videoId);
    return ok("Brightcove video activated", { brightcove_video_id: videoId });
  } catch (e) {
    return fail((e as Error).message);
  }
});
