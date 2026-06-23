import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Square, Upload, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";

type Phase = "ready" | "recording" | "preview" | "uploading" | "done";

export default function MobileRecord() {
  const { eventId = "", teamId = "" } = useParams();
  const navigate = useNavigate();

  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    chunksRef.current = [];
    const mimeCandidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=h264", "video/webm"];
    const mimeType = mimeCandidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
    const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const out = new Blob(chunksRef.current, { type: rec.mimeType || "video/mp4" });
      setBlob(out);
      setPhase("preview");
    };
    recorderRef.current = rec;
    setElapsed(0);
    rec.start(1000);
    setPhase("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function retake() {
    setBlob(null);
    setProgress(0);
    setPhase("ready");
  }

  useEffect(() => {
    if (phase === "preview" && blob && videoPreviewRef.current) {
      videoPreviewRef.current.src = URL.createObjectURL(blob);
    }
  }, [phase, blob]);

  async function uploadToBrightcove() {
    if (!blob) return;
    setPhase("uploading");
    setProgress(2);
    try {
      // 1. Init
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `team-${teamId}-${Date.now()}.${ext}`;
      const initRes = await mobileApi.uploadInit(teamId, eventId, fileName);
      if (!initRes.status) throw new Error(initRes.message);
      const { video_id, signed_url, api_request_url } = initRes.data!;

      // 2. PUT bytes to Brightcove's signed S3 URL with progress
      await putWithProgress(signed_url, blob, (p) => setProgress(2 + Math.round(p * 90)));

      // 3. Tell our backend the upload is done → triggers Brightcove ingest + writes submission
      setProgress(95);
      const duration = videoPreviewRef.current?.duration && Number.isFinite(videoPreviewRef.current.duration)
        ? Math.round(videoPreviewRef.current.duration) : null;
      const completeRes = await mobileApi.uploadComplete({
        team_id: teamId, event_id: eventId, video_id, api_request_url,
        duration_seconds: duration ?? 0,
        captured_at: new Date().toISOString(),
        device_info: { user_agent: navigator.userAgent, platform: navigator.platform },
      });
      if (!completeRes.status) throw new Error(completeRes.message);
      setProgress(100);
      setPhase("done");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("preview");
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
          Your video is uploading to Brightcove and will appear in the admin portal once ingest completes.
        </p>
        <Button className="w-full h-12" onClick={() => navigate(`/m/events/${eventId}`, { replace: true })}>
          Back to teams
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-[calc(100vh-3.5rem)] flex flex-col">
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
            REC {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
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
            <Square className="h-5 w-5 mr-2 fill-white" /> Stop recording
          </Button>
        )}
        {phase === "preview" && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={retake} className="h-14">
              <RotateCcw className="h-5 w-5 mr-2" /> Retake
            </Button>
            <Button onClick={uploadToBrightcove} className="h-14">
              <Upload className="h-5 w-5 mr-2" /> Submit
            </Button>
          </div>
        )}
        {phase === "uploading" && (
          <div className="space-y-2">
            <div className="text-sm text-white/80 text-center">Uploading… {progress}%</div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
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
