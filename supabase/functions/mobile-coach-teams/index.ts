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
        id, name, gym_name, athlete_count,
        division:divisions(id, name),
        level:levels(id, name),
        video_submissions(id, event_id, status, video_url, thumbnail_url, brightcove_video_id, submitted_at, captured_at, submitted_via, duration_seconds)
      `)
      .eq("event_id", eventId)
      .or(`coach_user_id.eq.${user.user_id},coach_email.eq.${user.email}`);

    if (error) return fail(error.message);

    const list = (teams ?? []).map((t: Record<string, unknown>) => {
      const sub = Array.isArray(t.video_submissions) ? (t.video_submissions as Record<string, unknown>[])[0] : null;
      const div = t.division as Record<string, unknown> | null;
      const lvl = t.level as Record<string, unknown> | null;
      return {
        team_id: asId(t.id),
        team_name: (t.name as string) ?? "",
        gym_name: (t.gym_name as string) ?? "",
        athlete_count: asId(t.athlete_count ?? 0),
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
        } : null,
      };
    });

    return ok("Teams fetched successfully", list);
  } catch (e) {
    return fail((e as Error).message);
  }
});
