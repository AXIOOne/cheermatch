// /webservices/uniqueTeamName.php replacement
// Checks whether a team name is available. Requires a valid mobile session.
import { handleOptions, ok, fail, serviceClient, legacyAuth, parseBody } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await legacyAuth(req);
    if (!user) return fail("Invalid or missing session token");

    const body = await parseBody(req);
    const rawName = (body.team_name ?? body.name ?? "") as string;
    const name = String(rawName).trim();
    if (!name) return fail("team_name is required");

    const eventId = (body.event_id ?? body.competition_id) as string | undefined;

    const sb = serviceClient();
    let q = sb.from("teams").select("id", { count: "exact", head: true }).ilike("name", name);
    if (eventId) {
      // teams are linked to events via video_submissions; treat as a global uniqueness check otherwise
      const { data: subs } = await sb.from("video_submissions").select("team_id").eq("event_id", eventId);
      const ids = (subs ?? []).map((s: any) => s.team_id);
      if (ids.length) q = q.in("id", ids);
    }

    const { count, error } = await q;
    if (error) return fail(error.message);

    const isUnique = (count ?? 0) === 0;
    return ok(
      isUnique ? "Team name is available" : "Team name is already taken",
      { is_unique: isUnique ? "1" : "0" },
    );
  } catch (e) {
    return fail((e as Error).message);
  }
});
