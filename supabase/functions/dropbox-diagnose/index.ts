// POST /functions/v1/dropbox-diagnose { logs, context? }  (admin only)
// Sends admin-supplied Dropbox export errors/logs to the AI Gateway and returns likely causes + next steps.
import { handleOptions, jsonResponse, serviceClient } from "../_shared/legacy.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway";

const SYSTEM = `You diagnose Dropbox video export failures for CheerMatch, a cheer competition scoring portal.
How exports work: an admin clicks Export in the Scoring Control Panel. A server function asks Dropbox's files/save_url API to download each team's video directly from a temporary Brightcove MP4 URL (cloud-to-cloud). The portal then polls save_url/check_job_status. Statuses: queued, transferring, completed, failed. Brightcove URLs expire after a while, so a long-queued job can fail with "download_failed". Dropbox tokens are refreshed with a stored refresh token; Dropbox Business team tokens need a selected member. Existing files with the same name can cause path conflicts. Admins can: Retry failed, reconnect Dropbox in Admin → Settings, change the base folder, download a video manually and replace it, or wait and re-check.
Given logs or error text, identify the most likely causes ranked by likelihood, and give concrete next steps an admin can take inside the portal. Be plain-spoken and brief. Never ask for or repeat secrets or tokens.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "causes", "next_steps"],
  properties: {
    summary: { type: "string" },
    causes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cause", "likelihood", "evidence"],
        properties: {
          cause: { type: "string" },
          likelihood: { type: "string", enum: ["high", "medium", "low"] },
          evidence: { type: "string" },
        },
      },
    },
    next_steps: { type: "array", items: { type: "string" } },
  },
};

const out = (body: unknown, status = 200) => jsonResponse(body, status);

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return out({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return out({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await serviceClient().rpc("has_role", { _user_id: who.user.id, _role: "admin" });
    if (!isAdmin) return out({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const logs = typeof body.logs === "string" ? body.logs.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim().slice(0, 4000) : "";
    if (!logs) return out({ error: "Paste an error message or log first." }, 400);
    if (logs.length > 30000) return out({ error: "Log is too long (30,000 characters max)." }, 400);

    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: SYSTEM,
      input: `${context ? `Export context:\n${context}\n\n` : ""}Admin-provided logs/errors:\n${logs}`,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "diagnosis", strict: true, schema: SCHEMA } },
    } as any);

    // deno-lint-ignore no-explicit-any
    const r = res as any;
    let text: string = r.output_text ?? "";
    if (!text) {
      for (const item of r.output ?? []) {
        for (const c of item.content ?? []) if (c.type === "output_text") text += c.text;
      }
    }
    let diagnosis;
    try { diagnosis = JSON.parse(text); } catch { return out({ error: "The AI returned an unreadable answer. Try again." }, 502); }
    return out({ diagnosis });
  } catch (e) {
    if (e instanceof GatewayError) {
      const status = (e as any).httpStatus;
      const msg = status === 429 ? "AI is busy right now — wait a minute and try again."
        : status === 402 ? "AI credits are used up. Add credits in workspace settings."
        : "The AI couldn't analyze this right now.";
      console.error("gateway error", (e as any).code, status);
      return out({ error: msg }, status === 429 || status === 402 ? status : 502);
    }
    console.error(e);
    return out({ error: "Something went wrong analyzing the log." }, 500);
  }
});
