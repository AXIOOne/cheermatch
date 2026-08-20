// GET /functions/v1/mobile-coach-teams?event_id=<uuid>
import { handleOptions, ok, fail, serviceClient, legacyAuth, asId, parseBody } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) return fail("Invalid or missing session token");

    const body = await parseBody(req);
    const eventId = String(body.event_id ?? "");
    if (!eventId) return fail("event_id is required");

    const sb = serviceClient();

    const { data: teams, error } = await sb
      .from("teams")
      .select(`
        id, name, gym_name, athletes_female, athletes_male,
        division:divisions(id, name),
        level:levels(id, name),
        video_submissions(id, event_id, status, video_url, thumbnail_url, brightcove_video_id, submitted_at, captured_at, submitted_via, duration_seconds, review_notes, reviewed_at)
      `)
      .eq("event_id", eventId)
      .or(`coach_user_id.eq.${user.user_id},coach_email.eq.${user.email}`);

    if (error) return fail(error.message);

    const list = (teams ?? []).map((t: Record<string, unknown>) => {
      const subs = Array.isArray(t.video_submissions)
        ? (t.video_submissions as Record<string, unknown>[]).filter((s) => !s.archived_at)
        : [];
      const sub = subs[0] ?? null;
      const div = t.division as Record<string, unknown> | null;
      const lvl = t.level as Record<string, unknown> | null;
      return {
        team_id: asId(t.id),
        team_name: (t.name as string) ?? "",
        gym_name: (t.gym_name as string) ?? "",
        athletes_female: asId(t.athletes_female ?? 0), athletes_male: asId(t.athletes_male ?? 0),
        division_id: asId(div?.id),
        division_name: (div?.name as string) ?? "",
        level_id: asId(lvl?.id),
        level_name: (lvl?.name as string) ?? "",
        submission: sub ? {
          id: asId(sub.id),
          status: (sub.status as string) ?? "",
          video_url: (sub.video_url as string) ?? "",
          thumbnail_url: (sub.thumbnail_url as string) ?? "",
          brightcove_video_id: (sub.brightcove_video_id as string) ?? "",
          duration_seconds: asId(sub.duration_seconds ?? 0),
          submitted_at: (sub.submitted_at as string) ?? "",
          captured_at: (sub.captured_at as string) ?? "",
          submitted_via: (sub.submitted_via as string) ?? "web",
          review_notes: (sub.review_notes as string) ?? "",
          reviewed_at: (sub.reviewed_at as string) ?? "",
        } : null,
      };
    });

    return ok("Teams fetched successfully", list);
  } catch (e) {
    return fail((e as Error).message);
  }
});
