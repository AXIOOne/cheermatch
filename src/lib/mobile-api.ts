// Lightweight API client for the mobile coach app — talks to the legacy edge functions.
// Stores the session token in localStorage (and in Capacitor Preferences when running native).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const TOKEN_KEY = "cm.mobile.session";
const USER_KEY = "cm.mobile.user";

export type MobileUser = {
  id: string;
  email: string;
  full_name: string;
  organization_name: string;
  phone: string;
  role: string;
  token: string;
  token_expires: string;
};

export const mobileSession = {
  get token(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  get user(): MobileUser | null {
    try { const v = localStorage.getItem(USER_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  save(user: MobileUser) {
    localStorage.setItem(TOKEN_KEY, user.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

type Envelope<T = unknown> = { status: boolean; message: string; data: T };

async function call<T = unknown>(name: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST"): Promise<Envelope<T>> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  const token = mobileSession.token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  // Use the legacy session token in the body so it isn't mistaken for a Supabase JWT
  const payload: Record<string, unknown> = { ...(body ?? {}) };
  if (token) payload.token = token;

  if (method === "GET") {
    Object.entries(payload).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(payload),
  });
  return await res.json() as Envelope<T>;
}

export const mobileApi = {
  login: (email: string, password: string) => call<MobileUser>("login", { email, password }),
  forgotPassword: (email: string) => call("forgotPassword", { email }),
  createPassword: (email: string, code: string, password: string) =>
    call("create_password", { email, code, password }),
  events: () => call<Array<Record<string, string>>>("mobile-coach-events", {}, "POST"),
  teams: (event_id: string) => call<Array<Record<string, unknown>>>("mobile-coach-teams", { event_id }),
  listAttempts: (event_id: string, team_id?: string) =>
    call<Array<{ id: string; team_id: string; attempt_number: number; started_at: string; outcome: string; duration_seconds: number | null }>>(
      "capture-attempts", { action: "list", event_id, team_id },
    ),
  reserveAttempt: (event_id: string, team_id: string, device_info?: Record<string, unknown>) =>
    call<{ id: string; attempt_number: number }>("capture-attempts", {
      action: "reserve", event_id, team_id, device_info,
    }),
  finalizeAttempt: (attempt_id: string, duration_seconds: number, outcome = "saved") =>
    call("capture-attempts", { action: "finalize", attempt_id, duration_seconds, outcome }),
  uploadInit: (team_id: string, event_id: string, file_name: string) =>
    call<{ video_id: string; signed_url: string; api_request_url: string; callback_url: string }>(
      "brightcove-upload-init", { team_id, event_id, file_name },
    ),
  uploadComplete: (input: {
    team_id: string; event_id: string; video_id: string; api_request_url: string;
    duration_seconds?: number; captured_at?: string; device_info?: Record<string, unknown>;
  }) => call<{ submission_id: string; video_id: string }>("brightcove-upload-complete", input),
};
