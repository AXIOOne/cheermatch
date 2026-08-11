// /webservices/competitionList.php replacement
// Returns the events list in the legacy JSON shape.

import {
  handleOptions,
  ok,
  fail,
  serviceClient,
  asId,
  asBool01,
  asBoolYN,
  asMoney,
  formatDate,
  formatTime,
} from "../_shared/legacy.ts";

const mapStatus = (s: string): string => {
  switch (s) {
    case "completed":
    case "archived":
      return "CLOSED";
    case "registration_open":
    case "upcoming":
    case "scheduled":
    case "draft":
      return "UPCOMING";
    case "open_for_capture":
    case "open_for_scoring":
    case "in_progress":
    case "open":
    case "active":
      return "OPEN";
    default:
      return String(s || "").toUpperCase();
  }
};

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const sb = serviceClient();
    const { data, error } = await sb
      .from("events")
      .select(`
        id, name, description, long_description,
        start_date, start_time, end_date, end_time,
        broadcast_deadline_date, broadcast_deadline_time, broadcast_channel,
        status, sub_deadline, reg_cost, sanctioned_event,
        release_score_leaderboard, per_show_registrations,
        hide_from_leaderboard, season_id, screen_capture_cnt,
        duration_of_capture, current_match, scoresheet_template_name,
        hide_from_website, show_teams_and_divisions, dont_show_scoresheet,
        list_on_special_events_page, hide_video_from_team_gym_division,
        event_uuid,
        scoring_templates:scoring_templates!scoring_templates_event_id_fkey(name, is_default)
      `)
      .eq("hide_from_website", false)
      .order("start_date", { ascending: false });

    if (error) return fail(error.message);

    const list = (data ?? []).map((e: any) => {
      const tmpl = (e.scoresheet_template_name as string | null) ||
        (Array.isArray(e.scoring_templates) && e.scoring_templates.length > 0
          ? e.scoring_templates.find((t: any) => t.is_default)?.name || e.scoring_templates[0].name
          : "");
      return {
        id: asId(e.id),
        description: e.name ?? "",
        long_description: e.long_description ?? e.description ?? e.name ?? "",
        start_date: formatDate(e.start_date),
        start_time: formatTime(e.start_time),
        end_date: formatDate(e.end_date),
        end_time: formatTime(e.end_time),
        broadcast_deadline_date: formatDate(e.broadcast_deadline_date || e.end_date),
        broadcast_deadline_time: formatTime(e.broadcast_deadline_time),
        competition_status: mapStatus(e.status),
        broadcast_channel: e.broadcast_channel ?? "VTV",
        sub_deadline: formatDate(e.sub_deadline || e.end_date),
        reg_cost: asMoney(e.reg_cost),
        sanctioned_event: asBoolYN(e.sanctioned_event),
        release_score_leaderboard: asBool01(e.release_score_leaderboard),
        per_show_registrations: asId(e.per_show_registrations ?? 0),
        hide_from_leaderboard: asBool01(e.hide_from_leaderboard),
        season_id: asId(e.season_id ?? 1),
        screen_capture_cnt: asId(e.screen_capture_cnt ?? 2),
        duration_of_capture: asId(e.duration_of_capture ?? 180),
        current_match: e.current_match ?? null,
        scoresheet_template: tmpl ?? "",
        hide_from_website: asBool01(e.hide_from_website),
        show_teams_and_divisions: asBool01(e.show_teams_and_divisions),
        dont_show_scoresheet: asBool01(e.dont_show_scoresheet),
        list_on_special_events_page: asBool01(e.list_on_special_events_page),
        hide_video_from_team_gym_division: asBool01(e.hide_video_from_team_gym_division),
        event_uuid: e.event_uuid ?? "",
      };
    });

    return ok("Competition list find successfully", list);
  } catch (e) {
    return fail((e as Error).message);
  }
});
