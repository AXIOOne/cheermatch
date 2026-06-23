// POST /functions/v1/create_password
// Body: { email, code, password }
import { handleOptions, ok, fail, serviceClient, parseBody } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = await parseBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();
    const password = String(body.password ?? "");
    if (!email || !code || !password) return fail("email, code, and password are required");
    if (password.length < 8) return fail("Password must be at least 8 characters");

    const sb = serviceClient();
    const { data: rc } = await sb
      .from("password_reset_codes")
      .select("id, user_id, email, consumed_at, expires_at")
      .eq("code", code)
      .ilike("email", email)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rc || !rc.user_id) return fail("Invalid or expired code");

    const { data: hash } = await sb.rpc("hash_password", { _password: password });
    if (!hash) return fail("Could not hash password");

    const { error: upErr } = await sb
      .from("profiles").update({ password_hash: hash }).eq("user_id", rc.user_id);
    if (upErr) return fail(upErr.message);

    await sb.from("password_reset_codes").update({ consumed_at: new Date().toISOString() }).eq("id", rc.id);

    return ok("Password updated successfully");
  } catch (e) {
    return fail((e as Error).message);
  }
});
