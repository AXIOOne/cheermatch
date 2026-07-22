// POST /functions/v1/logout
// Invalidates the caller's mobile session token.
import { handleOptions, ok, fail, serviceClient, extractToken } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const token = await extractToken(req);
    if (!token) return fail("Missing session token");
    const sb = serviceClient();
    await sb.from("mobile_sessions").delete().eq("token", token);
    return ok("Logged out");
  } catch (e) {
    return fail((e as Error).message);
  }
});
