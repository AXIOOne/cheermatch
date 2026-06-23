// POST /functions/v1/brightcove-ingest-callback?secret=...
// Brightcove notifies us when transcoding completes; flip submission to ready, fill in playback URL + thumbnail.
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";
import { bcGetVideo, bcActivateVideo } from "../_shared/brightcove.ts";

const CALLBACK_SECRET = Deno.env.get("BRIGHTCOVE_INGEST_CALLBACK_SECRET")!;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== CALLBACK_SECRET) return fail("Forbidden");

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return fail("Invalid body");
    const videoId = String(body.entity ?? body.video ?? body.video_id ?? "");
    const action = String(body.action ?? "");
    const status = String(body.status ?? "");
    if (!videoId) return fail("Missing video id in callback");

    const sb = serviceClient();
    const { data: sub } = await sb
      .from("video_submissions").select("id").eq("brightcove_video_id", videoId).maybeSingle();
    if (!sub) {
      // Acknowledge so Brightcove stops retrying
      return ok("No matching submission", { video_id: videoId });
    }

    // Fetch the latest video metadata
    let playback = "";
    let thumbnail = "";
    let duration: number | null = null;
    try {
      const v = await bcGetVideo(videoId);
      const images = v.images as Record<string, { src?: string }> | undefined;
      thumbnail = images?.thumbnail?.src ?? images?.poster?.src ?? "";
      duration = typeof v.duration === "number" ? Math.round((v.duration as number) / 1000) : null;
      // Master playback URL via playback API would require Policy Key; store the Brightcove player URL pattern.
      const acct = Deno.env.get("BRIGHTCOVE_ACCOUNT_ID");
      playback = `https://players.brightcove.net/${acct}/default_default/index.html?videoId=${videoId}`;
    } catch (_) { /* ignore */ }

    const update: Record<string, unknown> = {};
    if (playback) update.video_url = playback;
    if (thumbnail) update.thumbnail_url = thumbnail;
    if (duration && duration > 0) update.duration_seconds = duration;
    // Only flip to ready when the dynamic ingest job is done
    if (action === "dynamic-ingest" && status === "FINISHED") {
      update.status = "approved";
    }
    if (Object.keys(update).length > 0) {
      await sb.from("video_submissions").update(update).eq("id", sub.id);
    }
    return ok("Callback processed", { video_id: videoId, action, status });
  } catch (e) {
    return fail((e as Error).message);
  }
});
