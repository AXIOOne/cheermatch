import { useCallback, useEffect, useRef, useState } from "react";

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const doc = () => document as FsDocument;

export function isFullscreenActive() {
  const d = doc();
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export function isFullscreenSupported() {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

/**
 * Full-viewport capture support: puts the given element into browser fullscreen
 * so the phone's address/title bar cannot obstruct the camera field of view.
 * Fullscreen requests must come from a user gesture, so this exposes an
 * `enter` action to hook up to taps rather than firing on mount.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(isFullscreenActive());

  useEffect(() => {
    const sync = () => setActive(isFullscreenActive());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const enter = useCallback(async () => {
    const el = (ref.current ?? document.documentElement) as FsElement;
    if (isFullscreenActive()) return true;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else return false;
      // Best effort: keep the capture in landscape once we own the viewport.
      const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
      try { await orientation?.lock?.("landscape"); } catch { /* unsupported */ }
      return true;
    } catch {
      return false;
    }
  }, []);

  const exit = useCallback(async () => {
    const d = doc();
    try {
      const orientation = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
      try { orientation?.unlock?.(); } catch { /* unsupported */ }
      if (d.exitFullscreen && d.fullscreenElement) await d.exitFullscreen();
      else if (d.webkitExitFullscreen && d.webkitFullscreenElement) await d.webkitExitFullscreen();
    } catch { /* already exited */ }
  }, []);

  // Always leave fullscreen behind when the screen unmounts.
  useEffect(() => () => { void exit(); }, [exit]);

  return { ref, active, enter, exit, supported: isFullscreenSupported() };
}
