// /webservices/getDropboxSetting.php replacement
import { handleOptions, ok, fail, serviceClient } from "../_shared/legacy.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const sb = serviceClient();
    const { data, error } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "dropbox_settings")
      .maybeSingle();

    if (error) return fail(error.message);
    const v = (data?.value as Record<string, unknown>) || {};
    return ok("Dropbox setting fetched successfully", {
      app_key: String(v.app_key ?? ""),
      app_secret: String(v.app_secret ?? ""),
      access_token: String(v.access_token ?? ""),
      upload_folder: String(v.upload_folder ?? "/submissions"),
      enabled: v.enabled ? "1" : "0",
    });
  } catch (e) {
    return fail((e as Error).message);
  }
});
