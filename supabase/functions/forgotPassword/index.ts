// POST /functions/v1/forgotPassword
// Body: { email } → emails a 6-digit reset code
import { resetCodeEmailHtml, resetCodeEmailSubject, resolveEmailSubject, EMAIL_SUBJECTS_SETTINGS_KEY } from "../_shared/email-layouts.ts";
import { handleOptions, ok, fail, serviceClient, parseBody } from "../_shared/legacy.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Cheermatch <noreply@cheermatch.com>";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = await parseBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) return fail("email is required");

    const sb = serviceClient();
    const { data: profile } = await sb
      .from("profiles").select("user_id, email, full_name").ilike("email", email).maybeSingle();

    // Always return success to avoid account enumeration
    if (!profile) return ok("If that email exists, a reset code has been sent");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await sb.from("password_reset_codes").insert({
      email: profile.email,
      code,
      user_id: profile.user_id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    if (RESEND_API_KEY) {
      const { data: subjRow } = await sb
        .from("platform_settings").select("value").eq("key", EMAIL_SUBJECTS_SETTINGS_KEY).maybeSingle();
      const subject = resolveEmailSubject(
        (subjRow?.value ?? null) as Record<string, string> | null,
        "reset",
        resetCodeEmailSubject,
        { fullName: profile.full_name },
      );
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM,
          to: [profile.email],
          subject,
          html: resetCodeEmailHtml({ fullName: profile.full_name, code }),
        }),
      }).catch(() => {});
    }

    return ok("If that email exists, a reset code has been sent");
  } catch (e) {
    return fail((e as Error).message);
  }
});
