// POST /functions/v1/login
// Body: { email, password }
import { handleOptions, ok, fail, serviceClient, parseBody } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = await parseBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return fail("email and password are required");

    const sb = serviceClient();

    const { data: profile } = await sb
      .from("profiles")
      .select("user_id, email, full_name, organization_name, password_hash, phone")
      .ilike("email", email)
      .maybeSingle();

    if (!profile || !profile.password_hash) return fail("Invalid email or password");

    const { data: check } = await sb.rpc("verify_password", {
      _password: password,
      _hash: profile.password_hash,
    });
    if (!check) return fail("Invalid email or password");

    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", profile.user_id);
    const roleNames = (roles ?? []).map((r: { role: string }) => r.role);
    const role = roleNames.includes("gym_coach")
      ? "gym_coach"
      : roleNames.includes("content_contributor")
      ? "content_contributor"
      : null;
    if (!role) return fail("This account is not enabled for the mobile app");

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await sb.from("mobile_sessions").insert({
      token, user_id: profile.user_id, expires_at: expiresAt,
    });
    if (insErr) return fail(insErr.message);

    return ok("Login successful", {
      id: profile.user_id,
      email: profile.email,
      full_name: profile.full_name ?? "",
      organization_name: profile.organization_name ?? "",
      phone: profile.phone ?? "",
      role,
      token,
      token_expires: expiresAt,
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
