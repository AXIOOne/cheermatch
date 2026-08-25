// Shared Brightcove helpers — Dynamic Ingest API
// https://apis.support.brightcove.com/dynamic-ingest/getting-started/overview-dynamic-ingest-api-dynamic-delivery.html

const ACCOUNT_ID = Deno.env.get("BRIGHTCOVE_ACCOUNT_ID")!;
const CLIENT_ID = Deno.env.get("BRIGHTCOVE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("BRIGHTCOVE_CLIENT_SECRET")!;

let cachedToken: { value: string; expires_at: number } | null = null;

export async function getBrightcoveToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 30_000) return cachedToken.value;

  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch("https://oauth.brightcove.com/v4/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Brightcove auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function bcCreateVideo(name: string, tags: string[] = []): Promise<{ id: string }> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // state: ACTIVE is required for the Brightcove player to actually play the video.
      // Without it, videos default to INACTIVE and the player returns "video not playable".
      body: JSON.stringify({ name, tags, state: "ACTIVE" }),
    },
  );
  if (!res.ok) throw new Error(`Brightcove create video failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function bcActivateVideo(videoId: string): Promise<void> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ state: "ACTIVE" }),
    },
  );
  if (!res.ok) throw new Error(`Brightcove activate video failed: ${res.status} ${await res.text()}`);
}

export async function bcGetUploadUrl(videoId: string, fileName: string): Promise<{ signed_url: string; api_request_url: string }> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://ingest.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}/upload-urls/${encodeURIComponent(fileName)}`,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Brightcove get upload url failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function bcIngestRequest(videoId: string, apiRequestUrl: string, callbackUrl?: string): Promise<{ id: string }> {
  const token = await getBrightcoveToken();
  const body: Record<string, unknown> = { master: { url: apiRequestUrl }, profile: "multi-platform-standard-static" };
  if (callbackUrl) body.callbacks = [callbackUrl];
  const res = await fetch(
    `https://ingest.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}/ingest-requests`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Brightcove ingest failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function bcGetVideo(videoId: string): Promise<Record<string, unknown>> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Brightcove get video failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

// Permanently deletes a video from the Brightcove account. A 404 means it is already gone.
export async function bcDeleteVideo(videoId: string): Promise<void> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Brightcove delete video failed: ${res.status} ${await res.text()}`);
}


// ---- Folders ----
const folderIdCache = new Map<string, string>();

export async function bcListFolders(): Promise<Array<{ id: string; name: string }>> {
  const token = await getBrightcoveToken();
  const out: Array<{ id: string; name: string }> = [];
  // Brightcove returns up to 100 per page; loop a few pages defensively.
  for (let offset = 0; offset < 1000; offset += 100) {
    const res = await fetch(
      `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/folders?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Brightcove list folders failed: ${res.status} ${await res.text()}`);
    const page = await res.json() as Array<{ id: string; name: string }>;
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < 100) break;
  }
  return out;
}

export async function bcCreateFolder(name: string): Promise<{ id: string; name: string }> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/folders`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!res.ok) throw new Error(`Brightcove create folder failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export async function bcAddVideoToFolder(folderId: string, videoId: string): Promise<void> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/folders/${folderId}/videos/${videoId}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Brightcove add video to folder failed: ${res.status} ${await res.text()}`);
}

export async function bcEnsureFolder(name: string): Promise<string> {
  const key = name.trim().toLowerCase();
  const cached = folderIdCache.get(key);
  if (cached) return cached;
  const folders = await bcListFolders();
  const existing = folders.find((f) => (f.name ?? "").trim().toLowerCase() === key);
  if (existing) {
    folderIdCache.set(key, existing.id);
    return existing.id;
  }
  const created = await bcCreateFolder(name.trim());
  folderIdCache.set(key, created.id);
  return created.id;
}

// ---- Sources (renditions) ----
export interface BcSource {
  src?: string;
  container?: string;
  codec?: string;
  encoding_rate?: number;
  size?: number;
  width?: number;
  height?: number;
  type?: string;
}

export async function bcGetVideoSources(videoId: string): Promise<BcSource[]> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}/sources`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Brightcove get sources failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data as BcSource[] : [];
}

// Highest-bitrate progressive MP4 rendition (skips HLS/DASH manifests).
// Dynamic Delivery accounts often omit `container`, so fall back to sniffing
// the src extension / mime type instead of requiring container === "MP4".
export function bcPickMp4Source(sources: BcSource[]): BcSource | null {
  const mp4s = sources.filter((s) => {
    const src = s.src ?? "";
    if (!/^https?:/i.test(src)) return false;
    if (/\.m3u8|\.mpd|\.ism/i.test(src)) return false;
    const container = (s.container ?? "").toUpperCase();
    const type = (s.type ?? "").toLowerCase();
    return container === "MP4" || /\.mp4(\?|$)/i.test(src) || type.includes("mp4");
  });
  if (mp4s.length === 0) return null;
  mp4s.sort((a, b) => (b.encoding_rate ?? b.size ?? 0) - (a.encoding_rate ?? a.size ?? 0));
  return mp4s[0];
}

// Digital master (original uploaded file). Available when the ingest kept the master.
export async function bcGetDigitalMaster(videoId: string): Promise<Record<string, unknown> | null> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://cms.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/videos/${videoId}/digital_master`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return await res.json();
}

export async function bcListIngestProfiles(): Promise<unknown> {
  const token = await getBrightcoveToken();
  const res = await fetch(
    `https://ingestion.api.brightcove.com/v1/accounts/${ACCOUNT_ID}/profiles`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  const data = await res.json() as Array<Record<string, unknown>>;
  return Array.isArray(data)
    ? data.map((p) => ({
        name: p.name,
        id: p.id,
        digital_master: (p as any).digital_master,
        renditions: Array.isArray((p as any).renditions)
          ? (p as any).renditions.map((r: any) => r.package_type ?? r.media_type ?? r.format ?? r.name)
          : (p as any).dynamic_origin?.renditions,
      }))
    : data;
}
