// /webservices/getMobileAppVersion.php replacement
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const sb = serviceClient();
    const { data, error } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "mobile_app_version")
      .maybeSingle();

    if (error) return fail(error.message);
    const v = (data?.value as Record<string, unknown>) || {};
    return ok("Mobile app version fetched successfully", {
      min_version: String(v.min_version ?? "1.0.0"),
      latest_version: String(v.latest_version ?? "1.0.0"),
      force_update: v.force_update ? "1" : "0",
      update_url: String(v.update_url ?? ""),
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
