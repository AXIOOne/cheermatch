import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  Square,
  Upload,
  CheckCircle2,
  Plus,
  RotateCw,
  ChevronLeft,
  LogOut,
  Grid3x3,
  Laptop,
  RefreshCw,
  BatteryMedium,
  HardDrive,
  Video,

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { detectDevice, deviceLabel, type DetectedDevice } from "@/lib/device-detect";
import { CaptureOverlay } from "@/components/mobile/CaptureOverlay";
import { AudioMeter } from "@/components/mobile/AudioMeter";
import {
  attemptKey,
  clearAttempts,
  finalizeAttempt,
  listAttempts,
  reserveAttempt,
} from "@/lib/capture-attempts";

type Phase = "ready" | "countdown" | "recording" | "preview" | "choose" | "uploading" | "done";
type Attempt = {
  id: number;
  seq: number;
  blob: Blob | null;
  url: string | null;
  durationSec: number;
  complete: boolean;
};

const DEFAULT_DURATION = 150; // 2:30
const DEFAULT_ATTEMPTS = 2;
const DEVICE_CONFIRM_KEY = "cm.captureDevice";
const OVERLAY_KEY = "cm.captureOverlay";

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type BatteryLike = { level: number; charging: boolean };
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryLike> };

export default function MobileRecord() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();
  const { signOut } = useMobileAuth();
  const storageKey = attemptKey(eventId, teamId);

  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const autoStopRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [previewAttemptId, setPreviewAttemptId] = useState<number | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Capture settings
  const [maxDuration, setMaxDuration] = useState<number>(DEFAULT_DURATION);
  const [maxAttempts, setMaxAttempts] = useState<number>(DEFAULT_ATTEMPTS);
  const [isPortrait, setIsPortrait] = useState<boolean>(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

  // Device gate
  const [device, setDevice] = useState<DetectedDevice>(() => detectDevice());
  const [needsDeviceConfirm, setNeedsDeviceConfirm] = useState<boolean>(false);

  // HUD widgets
  const [overlayOn, setOverlayOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(OVERLAY_KEY) !== "0";
  });
  const [battery, setBattery] = useState<BatteryLike | null>(null);
  const [storageGb, setStorageGb] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // First-launch device confirm
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(DEVICE_CONFIRM_KEY) : null;
    if (!saved && device.kind !== "desktop") setNeedsDeviceConfirm(true);
  }, [device.kind]);

  function confirmDevice(kind: DetectedDevice["kind"]) {
    const next: DetectedDevice = { ...device, kind };
    setDevice(next);
    localStorage.setItem(DEVICE_CONFIRM_KEY, JSON.stringify(next));
    setNeedsDeviceConfirm(false);
  }

  // Orientation tracking + best-effort lock
  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const so = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation;
    so?.lock?.("landscape").catch(() => { /* iOS Safari: not supported */ });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      so?.unlock?.();
    };
  }, []);

  // Load capture settings from the event
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.events();
        if (res.status && Array.isArray(res.data)) {
          const ev = (res.data as Array<Record<string, unknown>>).find((e) => String(e.id) === eventId);
          if (ev) {
            const dur = Number(ev.duration_of_capture);
            const cnt = Number(ev.screen_capture_cnt);
            if (Number.isFinite(dur) && dur > 0) setMaxDuration(dur);
            if (Number.isFinite(cnt) && cnt > 0) setMaxAttempts(cnt);
          }
        }
      } catch {
        /* fall back to defaults */
      }
    })();
  }, [eventId]);

  // Block re-submissions
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.teams(eventId);
        if (res.status && Array.isArray(res.data)) {
          const t = (res.data as Array<Record<string, unknown>>).find(
            (x) => String(x.team_id) === teamId,
          );
          const sub = t?.submission as { id?: string; status?: string } | null | undefined;
          if (sub && sub.id && sub.status !== "revision_requested") {
            toast.error("This team has already submitted a video.");
            navigate(`/m/events/${eventId}/teams/${teamId}`, { replace: true });
          }
        }
      } catch {
        /* allow page to load normally */
      }
    })();
  }, [eventId, teamId, navigate]);

  // Restore previously recorded attempts for this team (survives reload / app restart)
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const stored = await listAttempts(storageKey);
      if (cancelled || stored.length === 0) return;
      const restored: Attempt[] = stored.map((s) => {
        const url = s.blob ? URL.createObjectURL(s.blob) : null;
        if (url) urls.push(url);
        return {
          id: s.id,
          seq: s.seq,
          blob: s.blob,
          url,
          durationSec: s.durationSec,
          complete: Boolean(s.complete && s.blob),
        };
      });
      setAttempts(restored);
      toast.message(
        `${restored.length} attempt${restored.length === 1 ? "" : "s"} already recorded for this team`,
      );
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [storageKey]);



  // Initialize camera (skip on desktop — capture is disallowed)
  useEffect(() => {
    if (device.kind === "desktop") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoLiveRef.current) {
          videoLiveRef.current.srcObject = stream;
          videoLiveRef.current.play().catch(() => {});
        }
        // Auto-stop on track interruption (call comes in, app backgrounded, etc.)
        stream.getTracks().forEach((t) => {
          t.addEventListener("ended", () => {
            if (recorderRef.current?.state === "recording") {
              try { recorderRef.current.stop(); } catch { /* noop */ }
              toast.error("Recording interrupted — please retake.");
            }
          });
        });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [device.kind]);

  // Battery + storage estimates (one-shot)
  useEffect(() => {
    if (device.kind === "desktop") return;
    const nav = navigator as NavigatorWithBattery;
    nav.getBattery?.().then((b) => {
      setBattery({ level: b.level, charging: b.charging });
    }).catch(() => {});
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => {
        const free = (e.quota ?? 0) - (e.usage ?? 0);
        setStorageGb(free / 1e9);
      }).catch(() => {});
    }
  }, [device.kind]);

  // Re-acquire wake lock on visibility change while recording
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === "visible" && phase === "recording" && !wakeLockRef.current) {
        await acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  async function acquireWakeLock() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl?.request) {
        wakeLockRef.current = await wl.request("screen");
      }
    } catch { /* ignored */ }
  }

  async function requestOrientationPermission() {
    type DOEventCtor = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const ctor = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as DOEventCtor | undefined;
    if (ctor?.requestPermission) {
      try { await ctor.requestPermission(); } catch { /* user declined */ }
    }
  }

  // elapsed timer
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function beginCountdown() {
    if (!streamRef.current) { toast.error("Camera not ready"); return; }
    if (attempts.length >= maxAttempts) {
      toast.error(`Maximum ${maxAttempts} attempts reached`);
      return;
    }
    void requestOrientationPermission();
    setCountdown(3);
    setPhase("countdown");
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          void startRecording();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  function cancelCountdown() {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(0);
    setPhase("ready");
  }

  async function startRecording() {
    if (!streamRef.current) { toast.error("Camera not ready"); return; }
    chunksRef.current = [];
    const mimeCandidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=h264", "video/webm"];
    const mimeType = mimeCandidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
    const rec = new MediaRecorder(streamRef.current, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000,
    });

    // Reserve the attempt BEFORE recording starts so any length of recording —
    // even one abandoned by reloading or closing the app — counts permanently.
    const reserved = await reserveAttempt(storageKey);
    setAttempts((prev) => [
      ...prev,
      { id: reserved.id, seq: reserved.seq, blob: null, url: null, durationSec: 0, complete: false },
    ]);

    const startedAt = Date.now();
    rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: rec.mimeType || "video/mp4" });
      const durationSec = Math.min(maxDuration, Math.round((Date.now() - startedAt) / 1000));
      const url = URL.createObjectURL(out);
      void finalizeAttempt(reserved.id, out, durationSec);
      setAttempts((prev) =>
        prev.map((a) =>
          a.id === reserved.id ? { ...a, blob: out, url, durationSec, complete: true } : a,
        ),
      );
      setPreviewAttemptId(reserved.id);
      setPhase("preview");
      if (autoStopRef.current) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
    recorderRef.current = rec;
    setElapsed(0);
    rec.start(1000);
    setPhase("recording");
    void acquireWakeLock();
    autoStopRef.current = window.setTimeout(() => {
      try { rec.state === "recording" && rec.stop(); } catch { /* noop */ }
      toast.message(`Recording auto-stopped at ${fmt(maxDuration)}`);
    }, maxDuration * 1000);
  }

  function stopRecording() {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    recorderRef.current = null;
  }

  function recordAnother() {
    setPreviewAttemptId(null);
    setProgress(0);
    setPhase("ready");
  }

  function goChoose() {
    setPreviewAttemptId(null);
    const playable = attempts.filter((a) => a.complete && a.url);
    setSelectedAttemptId(playable[playable.length - 1]?.id ?? null);
    setPhase("choose");
  }


  function toggleOverlay() {
    setOverlayOn((on) => {
      const next = !on;
      localStorage.setItem(OVERLAY_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Bind preview video
  useEffect(() => {
    if (phase === "preview" && previewAttemptId != null && videoPreviewRef.current) {
      const att = attempts.find((a) => a.id === previewAttemptId);
      if (att) videoPreviewRef.current.src = att.url;
    }
  }, [phase, previewAttemptId, attempts]);

  // Re-attach live stream when returning from preview
  useEffect(() => {
    if (phase === "preview") return;
    const el = videoLiveRef.current;
    const stream = streamRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [phase]);

  async function uploadSelected() {
    const chosen = attempts.find((a) => a.id === selectedAttemptId);
    if (!chosen) { toast.error("Pick an attempt to submit"); return; }
    setPhase("uploading");
    setProgress(2);
    try {
      const ext = chosen.blob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `team-${teamId}-${Date.now()}.${ext}`;
      const initRes = await mobileApi.uploadInit(teamId, eventId, fileName);
      if (!initRes.status) throw new Error(initRes.message);
      const { video_id, signed_url, api_request_url } = initRes.data!;

      await putWithProgress(signed_url, chosen.blob, (p) => setProgress(2 + Math.round(p * 90)));

      setProgress(95);
      const completeRes = await mobileApi.uploadComplete({
        team_id: teamId, event_id: eventId, video_id, api_request_url,
        duration_seconds: chosen.durationSec,
        captured_at: new Date().toISOString(),
        device_info: { user_agent: navigator.userAgent, platform: navigator.platform },
      });
      if (!completeRes.status) throw new Error(completeRes.message);
      setProgress(100);
      attempts.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      await clearAttempts(storageKey);
      setPhase("done");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("choose");
      setProgress(0);
    }
  }

  // ---------- Blocking states ----------

  if (device.kind === "desktop") {
    return (
      <div className="p-6">
        <Card className="p-6 text-center max-w-md mx-auto">
          <Laptop className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <div className="text-lg font-semibold">Video capture isn't available on laptops</div>
          <p className="text-sm text-muted-foreground mt-2">
            Please open this link on an iPhone or iPad to record your team's performance.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate(-1)}>Go back</Button>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">Camera unavailable</div>
          <div className="text-sm text-muted-foreground mt-1">{error}</div>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="px-6 py-12 text-center max-w-md mx-auto space-y-4">
        <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Submitted!</h1>
        <p className="text-muted-foreground">
          Your video is uploading and will appear in the admin portal once ingest completes.
        </p>
        <Button className="w-full h-12" onClick={() => navigate(`/m/events/${eventId}`, { replace: true })}>
          Back to teams
        </Button>
      </div>
    );
  }

  if (phase === "choose" || phase === "uploading") {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background px-4 py-4 space-y-4 max-w-xl mx-auto">
        <div>
          <h1 className="text-xl font-bold">Choose attempt to submit</h1>
          <p className="text-sm text-muted-foreground">
            You recorded {attempts.length} of {maxAttempts} attempts. Only the one you pick will be sent for judging.
          </p>
        </div>
        <div className="space-y-3">
          {attempts.map((a) => {
            const active = selectedAttemptId === a.id;
            const playable = a.complete && a.url;
            return (
              <Card
                key={a.id}
                onClick={() => phase === "choose" && playable && setSelectedAttemptId(a.id)}
                className={`p-3 border-2 transition ${playable ? "cursor-pointer" : "opacity-70"} ${active ? "border-primary" : "border-transparent"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Attempt #{a.seq}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {playable ? fmt(a.durationSec) : "Not saved"}
                  </div>
                </div>
                {playable ? (
                  <video src={a.url!} controls playsInline className="w-full rounded bg-black aspect-video" />
                ) : (
                  <div className="w-full rounded bg-muted aspect-video flex items-center justify-center text-center px-4">
                    <span className="text-xs text-muted-foreground">
                      This attempt was interrupted before it finished saving. It still counts toward your{" "}
                      {maxAttempts}-attempt limit.
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>


        {phase === "uploading" ? (
          <div className="space-y-2">
            <div className="text-sm text-center">Uploading… {progress}%</div>
            <Progress value={progress} className="h-2" />
          </div>
        ) : (
          <div className={`gap-3 sticky bottom-0 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] bg-background ${isPortrait ? "flex flex-col" : "grid grid-cols-2"}`}>
            {attempts.length < maxAttempts ? (
              <Button variant="secondary" onClick={recordAnother} className="h-14 w-full justify-center">
                <Plus className="h-5 w-5 mr-2 shrink-0" /> Record Another Take
              </Button>
            ) : (
              <Button variant="secondary" disabled className="h-14 w-full">Max Attempts Reached</Button>
            )}
            <Button onClick={uploadSelected} disabled={selectedAttemptId == null} className="h-14 w-full justify-center">
              <Upload className="h-5 w-5 mr-2 shrink-0" /> Submit Selected For Scoring
            </Button>
          </div>
        )}
      </div>
    );
  }

  const remaining = Math.max(0, maxDuration - elapsed);
  const isTablet = device.kind === "tablet";

  return (
    <div className="bg-black text-white min-h-[calc(100vh-3.5rem)] flex flex-col relative">
      {/* First-launch device confirmation */}
      {needsDeviceConfirm && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center p-6">
          <Card className="bg-background text-foreground p-5 max-w-sm w-full space-y-4">
            <div>
              <div className="text-lg font-semibold">Detected: {deviceLabel(device)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Is that the device you're using to record? We tune the capture experience for it.
              </p>
            </div>
            <Button className="w-full h-11" onClick={() => confirmDevice(device.kind)}>
              Yes, use {deviceLabel(device)}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-10" onClick={() => confirmDevice("phone")}>
                I'm on a Phone
              </Button>
              <Button variant="secondary" className="h-10" onClick={() => confirmDevice("tablet")}>
                I'm on a Tablet
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Portrait warning */}
      {isPortrait && phase !== "preview" && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-center px-6 space-y-4">
          <RotateCw className="h-16 w-16 text-primary animate-pulse" />
          <h2 className="text-xl font-bold">Please rotate your device</h2>
          <p className="text-sm text-white/80 max-w-xs">
            Routines must be captured in <span className="font-semibold">landscape</span> mode.
            Turn your {deviceLabel(device).toLowerCase()} sideways to continue.
          </p>
        </div>
      )}

      {/* Live / preview viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-black">
        {phase !== "preview" && (
          <>
            <video ref={videoLiveRef} className="w-full h-full object-contain" playsInline muted autoPlay />
            {overlayOn && <CaptureOverlay showLevel />}
          </>
        )}
        {phase === "preview" && (
          <video ref={videoPreviewRef} className="w-full h-full object-contain" playsInline controls />
        )}

        {/* Top HUD strip */}
        {phase !== "preview" && (
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-3">
              {phase === "recording" ? (
                <div className="flex items-center gap-2 bg-destructive/90 px-3 py-1.5 rounded-full text-sm font-mono">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  REC {fmt(elapsed)} / {fmt(maxDuration)}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-mono ${attempts.length > 0 ? "bg-primary/90 text-primary-foreground" : "bg-black/60"}`}>
                    Take {Math.min(attempts.length + 1, maxAttempts)} of {maxAttempts} · Limit {fmt(maxDuration)}
                  </div>
                  {attempts.length > 0 && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: maxAttempts }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-2 w-2 rounded-full ${i < attempts.length ? "bg-primary" : "bg-white/40"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <AudioMeter
                stream={streamRef.current}
                monitorSilence={phase === "ready"}
                onSilent={() => toast.warning("No audio detected — check your mic.")}
              />
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-white/80">
              {storageGb != null && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {storageGb.toFixed(1)} GB
                </span>
              )}
              {battery && (
                <span className="flex items-center gap-1">
                  <BatteryMedium className="h-3.5 w-3.5" />
                  {Math.round(battery.level * 100)}%
                </span>
              )}
              <button
                onClick={toggleOverlay}
                className={`p-1.5 rounded-md ${overlayOn ? "bg-white/20" : "bg-black/40"} hover:bg-white/30`}
                aria-label="Toggle framing overlay"
                title="Toggle framing overlay"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Countdown */}
        {phase === "countdown" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30">
            <div className="text-white font-bold text-[12rem] leading-none drop-shadow-lg">
              {countdown}
            </div>
          </div>
        )}

        {/* Centered floating capture controls */}
        {phase === "ready" && !isPortrait && !needsDeviceConfirm && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 pointer-events-none">
            {attempts.length > 0 && (
              <div className="pointer-events-none rounded-full bg-black/60 px-4 py-1.5 text-sm text-white/90">
                {attempts.length} of {maxAttempts} attempt{attempts.length === 1 ? "" : "s"} recorded
                {attempts.length >= maxAttempts ? " — no takes left" : ` · ${maxAttempts - attempts.length} left`}
              </div>
            )}
            <button
              onClick={beginCountdown}
              disabled={attempts.length >= maxAttempts}
              aria-label="Start Recording"
              className="pointer-events-auto group flex flex-col items-center justify-center h-28 w-28 rounded-full bg-black/40 backdrop-blur-sm border-4 border-white/90 shadow-2xl active:scale-95 transition disabled:opacity-40"
            >
              <span className="h-16 w-16 rounded-full bg-destructive group-hover:bg-destructive/90" />
            </button>
            {attempts.length > 0 && (
              <Button
                variant="secondary"
                onClick={goChoose}
                className="pointer-events-auto h-11 px-5"
              >
                <Video className="h-4 w-4 mr-2" /> Review previous take{attempts.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>

        )}
        {phase === "recording" && (
          <div className="absolute inset-0 z-40 flex items-end justify-center pb-8 pointer-events-none">
            <button
              onClick={stopRecording}
              aria-label={`Stop Recording, ${fmt(remaining)} left`}
              className="pointer-events-auto group flex items-center justify-center h-24 w-24 rounded-full bg-black/40 backdrop-blur-sm border-4 border-white/90 shadow-2xl active:scale-95 transition"
            >
              <span className="h-10 w-10 rounded-md bg-destructive group-hover:bg-destructive/90" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom action area */}
      <div className="p-4 bg-black/80 backdrop-blur space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
        {phase === "countdown" && (
          <Button onClick={cancelCountdown} variant="secondary" className="w-full h-14 text-base">
            Cancel
          </Button>
        )}
        {phase === "recording" && (
          <div className="text-center text-xs text-white/70 font-mono">
            Tap the stop button to end · {fmt(remaining)} left
          </div>
        )}
        {phase === "preview" && (
          <div className="grid grid-cols-2 gap-3">
            {attempts.length < maxAttempts ? (
              <Button onClick={recordAnother} variant="secondary" className="h-14">
                <RefreshCw className="h-4 w-4 mr-2" /> Retake
              </Button>
            ) : (
              <Button variant="secondary" disabled className="h-14">Max Takes</Button>
            )}
            <Button onClick={goChoose} className="h-14">
              Use This Take
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 text-xs text-white/70">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 px-2 py-1 -ml-2 rounded hover:text-white"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => { signOut(); navigate("/m/login", { replace: true }); }}
            className="flex items-center gap-1 px-2 py-1 -mr-2 rounded hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function putWithProgress(url: string, blob: Blob, onProgress: (frac: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.send(blob);
  });
}
