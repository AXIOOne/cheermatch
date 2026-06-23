import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Square, Upload, CheckCircle2, Plus, RotateCw, ChevronLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";
import { useMobileAuth } from "@/hooks/useMobileAuth";

type Phase = "ready" | "recording" | "preview" | "choose" | "uploading" | "done";
type Attempt = { id: number; blob: Blob; url: string; durationSec: number };

const DEFAULT_DURATION = 150; // 2:30
const DEFAULT_ATTEMPTS = 2;

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function MobileRecord() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();
  const { signOut } = useMobileAuth();

  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const autoStopRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [previewAttemptId, setPreviewAttemptId] = useState<number | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Event-driven capture settings
  const [maxDuration, setMaxDuration] = useState<number>(DEFAULT_DURATION);
  const [maxAttempts, setMaxAttempts] = useState<number>(DEFAULT_ATTEMPTS);
  const [isPortrait, setIsPortrait] = useState<boolean>(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

  // Track orientation and try to lock to landscape where supported
  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    // Best-effort lock (works in some Android browsers / installed PWAs)
    const so = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } }).orientation;
    so?.lock?.("landscape").catch(() => { /* unsupported (iOS Safari) — we show a hint instead */ });
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

  // Block access if a submission already exists for this team+event.
  // Coaches get a single capture session with N attempts — no re-submissions.
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.teams(eventId);
        if (res.status && Array.isArray(res.data)) {
          const t = (res.data as Array<Record<string, unknown>>).find(
            (x) => String(x.team_id) === teamId,
          );
          const sub = t?.submission as { id?: string } | null | undefined;
          if (sub && sub.id) {
            toast.error("This team has already submitted a video.");
            navigate(`/m/events/${eventId}/teams/${teamId}`, { replace: true });
          }
        }
      } catch {
        /* if the check fails, allow the page to load normally */
      }
    })();
  }, [eventId, teamId, navigate]);

  // Initialize camera on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoLiveRef.current) {
          videoLiveRef.current.srcObject = stream;
          videoLiveRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    };
  }, []);

  // elapsed timer
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function startRecording() {
    if (!streamRef.current) { toast.error("Camera not ready"); return; }
    if (attempts.length >= maxAttempts) {
      toast.error(`Maximum ${maxAttempts} attempts reached`);
      return;
    }
    chunksRef.current = [];
    const mimeCandidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=h264", "video/webm"];
    const mimeType = mimeCandidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
    const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    const startedAt = Date.now();
    rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: rec.mimeType || "video/mp4" });
      const durationSec = Math.min(maxDuration, Math.round((Date.now() - startedAt) / 1000));
      const id = Date.now();
      const url = URL.createObjectURL(out);
      const next: Attempt = { id, blob: out, url, durationSec };
      setAttempts((prev) => [...prev, next]);
      setPreviewAttemptId(id);
      setPhase("preview");
      if (autoStopRef.current) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    };
    recorderRef.current = rec;
    setElapsed(0);
    rec.start(1000);
    setPhase("recording");
    // Auto-stop at event's configured duration
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
    setSelectedAttemptId(attempts[attempts.length - 1]?.id ?? null);
    setPhase("choose");
  }

  // Bind preview video to current attempt
  useEffect(() => {
    if (phase === "preview" && previewAttemptId != null && videoPreviewRef.current) {
      const att = attempts.find((a) => a.id === previewAttemptId);
      if (att) videoPreviewRef.current.src = att.url;
    }
  }, [phase, previewAttemptId, attempts]);

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
      // Free remaining preview URLs
      attempts.forEach((a) => URL.revokeObjectURL(a.url));
      setPhase("done");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("choose");
      setProgress(0);
    }
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

  // Choose-attempt screen
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
          {attempts.map((a, idx) => {
            const active = selectedAttemptId === a.id;
            return (
              <Card
                key={a.id}
                onClick={() => phase === "choose" && setSelectedAttemptId(a.id)}
                className={`p-3 cursor-pointer border-2 transition ${active ? "border-primary" : "border-transparent"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Attempt {idx + 1}</div>
                  <div className="text-xs text-muted-foreground font-mono">{fmt(a.durationSec)}</div>
                </div>
                <video src={a.url} controls playsInline className="w-full rounded bg-black aspect-video" />
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
          <div className="grid grid-cols-2 gap-3 sticky bottom-0 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] bg-background">
            {attempts.length < maxAttempts ? (
              <Button variant="secondary" onClick={recordAnother} className="h-12">
                <Plus className="h-4 w-4 mr-2" /> Record again
              </Button>
            ) : (
              <Button variant="secondary" disabled className="h-12">Max attempts reached</Button>
            )}
            <Button onClick={uploadSelected} disabled={selectedAttemptId == null} className="h-12">
              <Upload className="h-4 w-4 mr-2" /> Submit selected
            </Button>
          </div>
        )}
      </div>
    );
  }

  const remaining = Math.max(0, maxDuration - elapsed);

  return (
    <div className="bg-black text-white min-h-[calc(100vh-3.5rem)] flex flex-col relative">
      {isPortrait && phase !== "preview" && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-center px-6 space-y-4">
          <RotateCw className="h-16 w-16 text-primary animate-pulse" />
          <h2 className="text-xl font-bold">Please rotate your device</h2>
          <p className="text-sm text-white/80 max-w-xs">
            Routines must be captured in <span className="font-semibold">landscape</span> mode.
            Turn your phone sideways to continue.
          </p>
        </div>
      )}
      <div className="relative flex-1 flex items-center justify-center bg-black">
        {phase !== "preview" && (
          <video ref={videoLiveRef} className="w-full h-full object-contain" playsInline muted autoPlay />
        )}
        {phase === "preview" && (
          <video ref={videoPreviewRef} className="w-full h-full object-contain" playsInline controls />
        )}
        {phase === "recording" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-destructive/90 px-3 py-1.5 rounded-full text-sm font-mono">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            REC {fmt(elapsed)} / {fmt(maxDuration)}
          </div>
        )}
        {phase === "ready" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1.5 rounded-full text-xs">
            Attempt {attempts.length + 1} of {maxAttempts} · Limit {fmt(maxDuration)}
          </div>
        )}
      </div>

      <div className="p-4 bg-black/80 backdrop-blur space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
        {phase === "ready" && (
          <Button onClick={startRecording} className="w-full h-14 text-base bg-destructive hover:bg-destructive/90">
            <Camera className="h-5 w-5 mr-2" /> Start recording
          </Button>
        )}
        {phase === "recording" && (
          <Button onClick={stopRecording} className="w-full h-14 text-base bg-destructive hover:bg-destructive/90">
            <Square className="h-5 w-5 mr-2 fill-white" /> Stop · {fmt(remaining)} left
          </Button>
        )}
        {phase === "preview" && (
          <Button onClick={goChoose} className="w-full h-14">
            {attempts.length < maxAttempts ? "Keep & continue" : "Choose submission"}
          </Button>
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
            <LogOut className="h-4 w-4" /> Sign out
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
