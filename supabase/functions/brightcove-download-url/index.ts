// POST /functions/v1/brightcove-download-url  { submission_id: "uuid" }
// Admin-only: resolves a direct MP4 rendition URL for a submission's Brightcove video
// so the portal can offer a download link.
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";
import { bcGetVideoSources, bcPickMp4Source, bcGetDigitalMaster, bcRetranscodeFromMaster } from "../_shared/brightcove.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeName = (s: string) => s.replace(/[^\w\-. ]+/g, "").trim().slice(0, 120) || "performance";

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
    const submissionId = String(body.submission_id ?? "").trim();
    const probe = body.probe === true; // status check only: never kick off a re-transcode
    if (!UUID_RE.test(submissionId)) return fail("A valid submission_id is required");

    const { data: sub, error } = await sb
      .from("video_submissions")
      .select("id, brightcove_video_id, video_url, team:teams(name, division:divisions(name))")
      .eq("id", submissionId)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!sub) return fail("Submission not found");

    const videoId = (sub as any).brightcove_video_id as string | null;
    if (!videoId) return fail("This submission has no video hosted on Brightcove");

    const sources = await bcGetVideoSources(videoId);
    const mp4 = bcPickMp4Source(sources);


    let url = mp4?.src ?? "";
    let ext = "mp4";

    if (!url) {
      // Dynamic Delivery only produced streaming manifests (HLS/DASH). If the original
      // master is archived on the host, kick off a re-package with an MP4 profile so a
      // downloadable rendition exists from now on.
      const master = await bcGetDigitalMaster(videoId);
      const masterUrl = (master?.url ?? (master as any)?.src) as string | undefined;
      if (masterUrl && /^https?:/i.test(masterUrl)) {
        url = masterUrl;
        ext = (masterUrl.split("?")[0].split(".").pop() ?? "mp4").slice(0, 4);
      } else if (master?.id) {
        if (probe) return fail("Still preparing a downloadable copy", { preparing: true });
        const started = await bcRetranscodeFromMaster(videoId);
        return fail(
          started
            ? "This video was published in streaming-only format. We've asked the host to build a downloadable copy — this usually takes 1-2 minutes. We'll flag the download icon green as soon as it's ready."
            : "No downloadable copy exists for this video and the host declined to create one. Please re-upload the performance video.",
          { preparing: started },
        );
      }
    }

    if (!url) {
      return fail("The video is still processing on the host server. Try again in a few minutes.", { preparing: true });
    }



    const team = (sub as any).team?.name ?? "Team";
    const division = (sub as any).team?.division?.name ?? "";
    const filename = `${safeName(division ? `${team} - ${division}` : team)}.${ext}`;

    return ok("Download link ready", { url, filename });

  } catch (e) {
    return fail((e as Error).message);
  }
});
