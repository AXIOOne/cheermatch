// Signed, non-expiring coach video links: /functions/v1/coach-video?s={submissionId}&t={hmac}
// The signature is computed server-side only, so links can't be forged for other submissions.
async function key() {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`coach-video:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function signVideoToken(submissionId: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(submissionId));
  return Array.from(new Uint8Array(sig)).slice(0, 20).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyVideoToken(submissionId: string, token: string): Promise<boolean> {
  const expected = await signVideoToken(submissionId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function coachVideoUrl(submissionId: string): Promise<string> {
  const base = Deno.env.get("SUPABASE_URL")!;
  return `${base}/functions/v1/coach-video?s=${submissionId}&t=${await signVideoToken(submissionId)}`;
}
