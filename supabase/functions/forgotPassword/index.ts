// POST /functions/v1/forgotPassword
// Body: { email } → emails a 6-digit reset code
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
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM,
          to: [profile.email],
          subject: "Your Cheermatch password reset code",
          html: `<p>Hi ${profile.full_name ?? ""},</p>
                 <p>Your password reset code is:</p>
                 <h2 style="letter-spacing:6px">${code}</h2>
                 <p>This code expires in 1 hour. If you didn't request this, ignore this email.</p>`,
        }),
      }).catch(() => {});
    }

    return ok("If that email exists, a reset code has been sent");
  } catch (e) {
    return fail((e as Error).message);
  }
});
