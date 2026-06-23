// Shared helpers for legacy /webservices/*.php compatible edge functions.
// Every endpoint returns: { status: boolean, message: string, data?: any }

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export { corsHeaders };

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const ok = (message: string, data: unknown = null) =>
  jsonResponse({ status: true, message, data });

export const fail = (message: string, data: unknown = null) =>
  jsonResponse({ status: false, message, data });

export const handleOptions = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;

// --- value formatting helpers ---------------------------------------------

export const asId = (v: unknown): string => (v == null ? "" : String(v));

export const asBool01 = (v: unknown): string => (v ? "1" : "0");
export const asBoolYN = (v: unknown): string => (v ? "Y" : "N");

export const asMoney = (v: unknown): string => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export const formatDate = (v: unknown): string => {
  if (!v) return "";
  const d = typeof v === "string" ? v : new Date(v as string).toISOString();
  return d.slice(0, 10);
};

export const formatTime = (v: unknown, fallback = "00:00:00"): string => {
  if (!v) return fallback;
  const s = String(v);
  // accept "HH:MM" or "HH:MM:SS" or ISO strings
  const m = s.match(/(\d{2}:\d{2}(:\d{2})?)/);
  if (!m) return fallback;
  return m[1].length === 5 ? `${m[1]}:00` : m[1];
};

// --- supabase clients ------------------------------------------------------

export const serviceClient = (): SupabaseClient =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

// --- legacy session auth ---------------------------------------------------

export type LegacyUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  organization_name: string | null;
};

export const extractToken = async (req: Request): Promise<string | null> => {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token") || url.searchParams.get("session_token");
  if (fromQuery) return fromQuery;

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    // Skip the Supabase anon JWT that the mobile app may also send
    if (t.split(".").length !== 3) return t;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const clone = req.clone();
      const ct = clone.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await clone.json().catch(() => null);
        if (body && typeof body === "object") {
          const t = (body as Record<string, unknown>).token ?? (body as Record<string, unknown>).session_token;
          if (typeof t === "string") return t;
        }
      } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const fd = await clone.formData().catch(() => null);
        if (fd) {
          const t = (fd.get("token") || fd.get("session_token")) as string | null;
          if (t) return t;
        }
      }
    } catch {
      // ignore body parse errors
    }
  }
  return null;
};

export const legacyAuth = async (req: Request): Promise<LegacyUser | null> => {
  const token = await extractToken(req);
  if (!token) return null;
  const sb = serviceClient();
  const { data, error } = await sb.rpc("legacy_session_lookup", { _token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  // refresh last_seen_at (best effort, ignore errors)
  await sb.from("mobile_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token", token);
  return row as LegacyUser;
};

// --- request body parsing --------------------------------------------------

export const parseBody = async (req: Request): Promise<Record<string, unknown>> => {
  if (req.method === "GET" || req.method === "HEAD") {
    const out: Record<string, unknown> = {};
    new URL(req.url).searchParams.forEach((v, k) => (out[k] = v));
    return out;
  }
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return (await req.json()) ?? {};
    if (ct.includes("form")) {
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : v;
      return out;
    }
    const text = await req.text();
    if (text.trim().startsWith("{")) return JSON.parse(text);
  } catch {
    // ignore
  }
  return {};
};
