// POST /functions/v1/brightcove-refresh-status  { submission_id: "uuid" }
// Polls Brightcove for the submission's video and flips the submission out of the
// "processing" state once the host reports the video as complete/ACTIVE.
// Used as a fallback when the ingest callback never arrives (or arrives with an
// action name we don't recognise).
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";
import { bcGetVideo, bcGetVideoSources } from "../_shared/brightcove.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const submissionId = String(body.submission_id ?? "").trim();
    if (!UUID_RE.test(submissionId)) return fail("A valid submission_id is required");

    const sb = serviceClient();
    const { data: sub, error } = await sb
      .from("video_submissions")
      .select("id, status, brightcove_video_id, video_url, thumbnail_url")
      .eq("id", submissionId)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!sub) return fail("Submission not found");
    if (!sub.brightcove_video_id) return fail("This submission has no video hosted on Brightcove");

    const videoId = sub.brightcove_video_id as string;
    const v = await bcGetVideo(videoId);
    const images = v.images as Record<string, { src?: string }> | undefined;
    const thumbnail = images?.thumbnail?.src ?? images?.poster?.src ?? "";
    const duration = typeof v.duration === "number" ? Math.round((v.duration as number) / 1000) : null;
    const state = String(v.state ?? "").toUpperCase();

    let ready = v.complete === true && state === "ACTIVE";
    if (!ready && state === "ACTIVE") {
      // Some Dynamic Delivery accounts leave `complete` false; renditions existing is enough.
      const sources = await bcGetVideoSources(videoId).catch(() => []);
      ready = sources.some((s) => typeof s.src === "string" && /^https?:/i.test(s.src));
    }

    const update: Record<string, unknown> = {};
    const acct = Deno.env.get("BRIGHTCOVE_ACCOUNT_ID");
    if (!sub.video_url && acct) {
      update.video_url = `https://players.brightcove.net/${acct}/default_default/index.html?videoId=${videoId}`;
    }
    if (thumbnail && !sub.thumbnail_url) update.thumbnail_url = thumbnail;
    if (duration && duration > 0) update.duration_seconds = duration;
    if (ready && (sub.status === "uploaded" || sub.status === "imported" || sub.status === "processing")) {
      update.status = "approved";
    }
    if (Object.keys(update).length > 0) {
      await sb.from("video_submissions").update(update).eq("id", submissionId);
    }

    return ok(ready ? "Video is ready" : "Video is still processing", {
      ready,
      status: (update.status as string) ?? sub.status,
      video_url: (update.video_url as string) ?? sub.video_url,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
