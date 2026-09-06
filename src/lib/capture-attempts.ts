/**
 * Persistent record of capture attempts for a (event, team) pair.
 *
 * Attempts are reserved the moment recording STARTS, so any length of recording
 * — including one abandoned by reloading, backgrounding, or killing the app —
 * permanently counts against the event's allowed attempt count. Blobs are kept
 * in IndexedDB so previous takes can be reviewed after returning to the screen.
 */

const DB_NAME = "cm-capture";
const STORE = "attempts";
const DB_VERSION = 1;
const VIDEO_CACHE = "cm-capture-videos";

export type StoredAttempt = {
  id: number;
  key: string;
  seq: number;
  startedAt: number;
  blob: Blob | null;
  durationSec: number;
  complete: boolean;
};

export function attemptKey(eventId: string, teamId: string) {
  return `${eventId}::${teamId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("key", "key", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

function videoRequest(id: number): Request {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://local.cheermatch.invalid";
  return new Request(`${origin}/__capture-video/${id}`);
}

async function readCachedVideo(id: number): Promise<Blob | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(VIDEO_CACHE);
    const response = await cache.match(videoRequest(id));
    return response ? await response.blob() : null;
  } catch {
    return null;
  }
}

async function deleteCachedVideo(id: number): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(VIDEO_CACHE);
    await cache.delete(videoRequest(id));
  } catch {
    /* ignore cache cleanup failure */
  }
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function listAttempts(key: string): Promise<StoredAttempt[]> {
  try {
    const all = await tx<StoredAttempt[]>("readonly", (s) =>
      s.index("key").getAll(key) as IDBRequest<StoredAttempt[]>,
    );
    const hydrated = await Promise.all(
      (all ?? []).map(async (attempt) => {
        if (attempt.blob) return attempt;
        const blob = await readCachedVideo(attempt.id);
        return blob ? { ...attempt, blob, complete: true } : attempt;
      }),
    );
    return hydrated.sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

export async function reserveAttempt(key: string, seq?: number): Promise<StoredAttempt> {
  const existing = await listAttempts(key);
  const record: StoredAttempt = {
    id: Date.now(),
    key,
    seq: seq ?? (existing[existing.length - 1]?.seq ?? 0) + 1,
    startedAt: Date.now(),
    blob: null,
    durationSec: 0,
    complete: false,
  };
  try {
    await tx("readwrite", (s) => s.put(record));
  } catch {
    /* attempt still tracked in memory for this session */
  }
  return record;
}

export async function finalizeAttempt(id: number, blob: Blob, durationSec: number): Promise<boolean> {
  try {
    const current = await tx<StoredAttempt | undefined>("readonly", (s) => s.get(id));
    if (!current) return false;

    // Cache Storage handles large mobile video blobs more reliably than putting
    // the entire recording inside an IndexedDB row (notably in iOS browsers).
    if (typeof caches !== "undefined") {
      try {
        const cache = await caches.open(VIDEO_CACHE);
        await cache.put(videoRequest(id), new Response(blob, {
          headers: { "Content-Type": blob.type || "video/mp4" },
        }));
        await tx("readwrite", (s) => s.put({ ...current, blob: null, durationSec, complete: true }));
        return true;
      } catch {
        /* fall through to IndexedDB blob storage */
      }
    }

    await tx("readwrite", (s) => s.put({ ...current, blob, durationSec, complete: true }));
    return true;
  } catch {
    return false;
  }
}

export async function clearAttempts(key: string): Promise<void> {
  try {
    const all = await listAttempts(key);
    for (const a of all) {
      await tx("readwrite", (s) => s.delete(a.id));
      await deleteCachedVideo(a.id);
    }
  } catch {
    /* ignore */
  }
}

/** Remove device records that are no longer active in the portal ledger. */
export async function reconcileAttempts(key: string, activeSeqs: number[]): Promise<void> {
  try {
    const active = new Set(activeSeqs);
    const all = await listAttempts(key);
    for (const attempt of all) {
      if (!active.has(attempt.seq)) {
        await tx("readwrite", (store) => store.delete(attempt.id));
        await deleteCachedVideo(attempt.id);
      }
    }
  } catch {
    /* ignore local persistence failure; the portal count remains authoritative */
  }
}
