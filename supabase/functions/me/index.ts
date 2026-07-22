// POST /functions/v1/me
// Validates the mobile session token and returns the current coach profile.
import { handleOptions, ok, fail, serviceClient, legacyAuth, jsonResponse } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const user = await legacyAuth(req);
    if (!user) {
      return jsonResponse({ status: false, message: "Invalid or expired session token", data: null }, 401);
    }
    const sb = serviceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("user_id, email, full_name, organization_name, phone")
      .eq("user_id", user.user_id)
      .maybeSingle();
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.user_id);
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const role = roleNames.includes("gym_coach")
      ? "gym_coach"
      : roleNames.includes("content_contributor")
      ? "content_contributor"
      : null;

    return ok("Session valid", {
      id: user.user_id,
      email: profile?.email ?? user.email,
      full_name: profile?.full_name ?? user.full_name ?? "",
      organization_name: profile?.organization_name ?? user.organization_name ?? "",
      phone: profile?.phone ?? "",
      role,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
