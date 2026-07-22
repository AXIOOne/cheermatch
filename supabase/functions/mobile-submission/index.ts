// POST /functions/v1/mobile-submission
// Body: { submission_id }
// Returns a single submission (owned by the authenticated coach) so native apps
// can poll upload/ingest status without re-listing every team.
import { handleOptions, ok, fail, serviceClient, legacyAuth, parseBody, asId, jsonResponse } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Invalid or missing session token", data: null }, 401);
    }

    const body = await parseBody(req);
    const submissionId = String(body.submission_id ?? "");
    if (!submissionId) return jsonResponse({ status: false, message: "submission_id is required", data: null }, 400);

    const sb = serviceClient();
    const { data: sub, error } = await sb
      .from("video_submissions")
      .select(`
        id, event_id, team_id, status, video_url, thumbnail_url,
        brightcove_video_id, duration_seconds, submitted_at, captured_at,
        submitted_via, review_notes, reviewed_at,
        team:teams(id, name, gym_name, coach_user_id, coach_email)
      `)
      .eq("id", submissionId)
      .maybeSingle();

    if (error) return fail(error.message);
    if (!sub) return jsonResponse({ status: false, message: "Submission not found", data: null }, 404);

    const team = sub.team as Record<string, unknown> | null;
    const owns = team && (team.coach_user_id === user.user_id ||
      (typeof team.coach_email === "string" && team.coach_email.toLowerCase() === user.email.toLowerCase()));
    if (!owns) return jsonResponse({ status: false, message: "Submission not found", data: null }, 404);

    return ok("Submission fetched", {
      id: asId(sub.id),
      event_id: asId(sub.event_id),
      team_id: asId(sub.team_id),
      team_name: (team?.name as string) ?? "",
      gym_name: (team?.gym_name as string) ?? "",
      status: (sub.status as string) ?? "",
      video_url: (sub.video_url as string) ?? "",
      thumbnail_url: (sub.thumbnail_url as string) ?? "",
      brightcove_video_id: (sub.brightcove_video_id as string) ?? "",
      duration_seconds: asId(sub.duration_seconds ?? 0),
      submitted_at: (sub.submitted_at as string) ?? "",
      captured_at: (sub.captured_at as string) ?? "",
      submitted_via: (sub.submitted_via as string) ?? "",
      review_notes: (sub.review_notes as string) ?? "",
      reviewed_at: (sub.reviewed_at as string) ?? "",
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
