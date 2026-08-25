// POST /functions/v1/capture-attempts
// Server-side ledger of capture attempts (source of truth, not the device).
// actions:
//   list     -> { event_id, team_id? }  attempts for the team (or all coach teams)
//   reserve  -> { event_id, team_id, device_info? } burns an attempt, returns attempt_number
//   finalize -> { attempt_id, duration_seconds?, outcome? }
import { handleOptions, ok, fail, serviceClient, legacyAuth, parseBody } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) return fail("Invalid or missing session token");

    const body = await parseBody(req);
    const action = String(body.action ?? "list");
    const sb = serviceClient();

    if (action === "list") {
      const eventId = String(body.event_id ?? "");
      if (!eventId) return fail("event_id is required");
      let q = sb
        .from("capture_attempts")
        .select("id, team_id, attempt_number, started_at, outcome, duration_seconds")
        .eq("event_id", eventId)
        .is("voided_at", null)
        .order("attempt_number", { ascending: true });
      if (body.team_id) q = q.eq("team_id", String(body.team_id));
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok("Attempts fetched", data ?? []);
    }

    if (action === "reserve") {
      const eventId = String(body.event_id ?? "");
      const teamId = String(body.team_id ?? "");
      if (!eventId || !teamId) return fail("event_id and team_id are required");

      // Verify the coach owns the team
      const { data: team } = await sb
        .from("teams")
        .select("id, coach_user_id, coach_email")
        .eq("id", teamId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (!team) return fail("Team not found for this event");
      const owns =
        team.coach_user_id === user.user_id ||
        String(team.coach_email ?? "").toLowerCase() === String(user.email ?? "").toLowerCase();
      if (!owns) return fail("You are not assigned to this team");

      const { data: existing } = await sb
        .from("capture_attempts")
        .select("attempt_number")
        .eq("event_id", eventId)
        .eq("team_id", teamId)
        .order("attempt_number", { ascending: false })
        .limit(1);
      const next = ((existing?.[0]?.attempt_number as number | undefined) ?? 0) + 1;

      const { data, error } = await sb
        .from("capture_attempts")
        .insert({
          event_id: eventId,
          team_id: teamId,
          user_id: user.user_id,
          attempt_number: next,
          device_info: (body.device_info as Record<string, unknown>) ?? null,
          outcome: "recording",
        })
        .select("id, attempt_number")
        .single();
      if (error) return fail(error.message);
      return ok("Attempt reserved", data);
    }

    if (action === "finalize") {
      const attemptId = String(body.attempt_id ?? "");
      if (!attemptId) return fail("attempt_id is required");
      const patch: Record<string, unknown> = {
        outcome: String(body.outcome ?? "saved"),
      };
      if (body.duration_seconds != null) patch.duration_seconds = Number(body.duration_seconds);
      if (body.submission_id) patch.submission_id = String(body.submission_id);
      const { error } = await sb.from("capture_attempts").update(patch).eq("id", attemptId);
      if (error) return fail(error.message);
      return ok("Attempt updated", null);
    }

    return fail(`Unknown action "${action}"`);
  } catch (e) {
    return fail((e as Error).message);
  }
});
