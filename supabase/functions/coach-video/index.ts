// GET /functions/v1/coach-video?s={submissionId}&t={signature}
// Public, signature-protected link from the "Video approved" email. Resolves a fresh
// download URL for the submission's video and redirects the coach to it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { bcGetVideoSources, bcPickMp4Source, bcGetDigitalMaster, bcRetranscodeFromMaster } from "../_shared/brightcove.ts";
import { verifyVideoToken } from "../_shared/video-link.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const page = (title: string, msg: string, status = 200) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Roboto,Arial,sans-serif;background:#f4f6f8;margin:0;padding:48px 16px;color:#1f2937;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1><p style="margin:0;line-height:1.5;">${msg}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const s = u.searchParams.get("s") ?? "";
    const t = u.searchParams.get("t") ?? "";
    if (!UUID_RE.test(s) || !t || !(await verifyVideoToken(s, t))) {
      return page("Link not valid", "This video link is not valid. Please contact support@cheermatch.com.", 403);
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sub } = await sb.from("video_submissions").select("brightcove_video_id, video_url").eq("id", s).maybeSingle();
    if (!sub) return page("Video not available", "This video is no longer available.", 404);

    const videoId = (sub as any).brightcove_video_id as string | null;
    let url = "";
    if (videoId) {
      url = bcPickMp4Source(await bcGetVideoSources(videoId))?.src ?? "";
      if (!url) {
        const master = await bcGetDigitalMaster(videoId);
        const masterUrl = (master?.url ?? (master as any)?.src) as string | undefined;
        if (masterUrl && /^https?:/i.test(masterUrl)) url = masterUrl;
        else if (master?.id) {
          await bcRetranscodeFromMaster(videoId);
          return page("Preparing your video", "We're preparing a downloadable copy of your video. Please try this link again in a few minutes.");
        }
      }
    }
    if (!url && /^https?:/i.test(String((sub as any).video_url ?? ""))) url = (sub as any).video_url;
    if (!url) return page("Preparing your video", "Your video is still processing. Please try this link again in a few minutes.");

    return new Response(null, { status: 302, headers: { Location: url } });
  } catch (e) {
    console.error("coach-video error:", e);
    return page("Something went wrong", "We couldn't load your video. Please try again later.", 500);
  }
});
