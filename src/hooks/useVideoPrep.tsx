import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { isSubmissionVideoDownloadable } from '@/lib/download-submission-video';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'cm.videoPrep.v1';
const POLL_MS = 20000;
const MAX_AGE_MS = 30 * 60 * 1000;

export type PrepState = 'preparing' | 'ready';

type Store = Record<string, { state: PrepState; startedAt: number }>;

type Ctx = {
  getState: (submissionId: string) => PrepState | undefined;
  markPreparing: (submissionId: string) => void;
  clear: (submissionId: string) => void;
};

const VideoPrepContext = createContext<Ctx | null>(null);

const read = (): Store => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Store;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v && now - v.startedAt < MAX_AGE_MS),
    );
  } catch {
    return {};
  }
};

export function VideoPrepProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(read);
  const { toast } = useToast();
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const pending = Object.entries(storeRef.current).filter(([, v]) => v.state === 'preparing');
      for (const [id] of pending) {
        const ready = await isSubmissionVideoDownloadable(id);
        if (cancelled) return;
        if (ready) {
          setStore((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], state: 'ready' } } : prev));
          toast({
            title: 'Download ready',
            description: 'The downloadable copy has finished processing on the host.',
          });
        }
      }
    };
    const t = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [toast]);

  const getState = useCallback((id: string) => store[id]?.state, [store]);
  const markPreparing = useCallback(
    (id: string) => setStore((prev) => ({ ...prev, [id]: { state: 'preparing', startedAt: Date.now() } })),
    [],
  );
  const clear = useCallback(
    (id: string) =>
      setStore((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    [],
  );

  return (
    <VideoPrepContext.Provider value={{ getState, markPreparing, clear }}>
      {children}
    </VideoPrepContext.Provider>
  );
}

export function useVideoPrep(): Ctx {
  const ctx = useContext(VideoPrepContext);
  return (
    ctx ?? {
      getState: () => undefined,
      markPreparing: () => {},
      clear: () => {},
    }
  );
}
