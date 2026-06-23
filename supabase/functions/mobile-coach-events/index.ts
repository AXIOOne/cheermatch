// GET /functions/v1/mobile-coach-events
// Auth: legacy mobile session token
// Returns the events that have at least one team owned by this coach.
import { handleOptions, ok, fail, serviceClient, legacyAuth, asId, asMoney, formatDate } from "../_shared/legacy.ts";

const mapStatus = (s: string): string => {
  switch (s) {
    case "completed": case "archived": return "CLOSED";
    case "in_progress": case "open": case "active": return "OPEN";
    case "draft": case "upcoming": case "scheduled": return "UPCOMING";
    default: return String(s || "").toUpperCase();
  }
};

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) return fail("Invalid or missing session token");

    const sb = serviceClient();

    // Get distinct event_ids via teams owned by this coach
    const { data: teams, error: tErr } = await sb
      .from("teams")
      .select("id, event_id:video_submissions(event_id)")
      .eq("coach_user_id", user.user_id);
    if (tErr) return fail(tErr.message);

    // teams.event_id isn't a direct column — fetch through video_submissions OR via a separate query.
    // Simpler: get all submissions for this coach's teams.
    const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
    let eventIds: string[] = [];
    if (teamIds.length > 0) {
      const { data: subs } = await sb
        .from("video_submissions")
        .select("event_id")
        .in("team_id", teamIds);
      eventIds = Array.from(new Set((subs ?? []).map((s: { event_id: string }) => s.event_id)));
    }
    if (eventIds.length === 0) return ok("No events found", []);

    const { data: events, error: eErr } = await sb
      .from("events")
      .select("id, name, description, start_date, end_date, status, sub_deadline, reg_cost, event_uuid, screen_capture_cnt, duration_of_capture, broadcast_channel")
      .in("id", eventIds)
      .order("start_date", { ascending: false });
    if (eErr) return fail(eErr.message);

    const list = (events ?? []).map((e: Record<string, unknown>) => ({
      id: asId(e.id),
      description: (e.name as string) ?? "",
      long_description: (e.description as string) ?? "",
      start_date: formatDate(e.start_date),
      end_date: formatDate(e.end_date),
      sub_deadline: formatDate(e.sub_deadline ?? e.end_date),
      competition_status: mapStatus(e.status as string),
      reg_cost: asMoney(e.reg_cost),
      event_uuid: (e.event_uuid as string) ?? "",
      screen_capture_cnt: asId(e.screen_capture_cnt ?? 2),
      duration_of_capture: asId(e.duration_of_capture ?? 180),
      broadcast_channel: (e.broadcast_channel as string) ?? "VTV",
    }));

    return ok("Events fetched successfully", list);
  } catch (e) {
    return fail((e as Error).message);
  }
});
