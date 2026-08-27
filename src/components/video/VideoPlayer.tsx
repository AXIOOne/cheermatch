import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface VideoPlayerProps {
  url: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
  status?: string | null | undefined;
  title?: string;
  /** When provided, the player asks the host for the real processing state. */
  submissionId?: string | null;
}

export default function VideoPlayer({
  url,
  thumbnailUrl,
  status,
  title = "Performance Video",
  submissionId,
}: VideoPlayerProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [forcePlay, setForcePlay] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hostReady, setHostReady] = useState(false);

  const isBrightcove = !!url && /players\.brightcove\.net/.test(url);
  const isEmbed = !!url && /players\.brightcove\.net|player\.vimeo\.com|youtube\.com\/embed|youtu\.be/.test(url);
  const isProcessing =
    isBrightcove && (status === "uploaded" || status === "imported" || status === "processing");

  // The stored status can lag behind Brightcove (missed ingest callback), so verify
  // with the host before showing a "still rendering" screen.
  useEffect(() => {
    let cancelled = false;
    if (!isProcessing || !submissionId) return;
    setChecking(true);
    supabase.functions
      .invoke("brightcove-refresh-status", { body: { submission_id: submissionId } })
      .then(({ data }) => {
        if (!cancelled && (data as { data?: { ready?: boolean } })?.data?.ready) setHostReady(true);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [isProcessing, submissionId, retryKey]);

  if (!url) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center p-6 text-center">
        <Video className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">Video not available</p>
      </div>
    );
  }

  if (isProcessing && !forcePlay && !hostReady) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-semibold mb-2">Video is still rendering</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          This performance video has been uploaded to Brightcove and is currently being processed on the host server. Playback will be available shortly.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={checking} onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} /> Check again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setForcePlay(true)}>
            Try playback anyway
          </Button>
        </div>
      </div>
    );
  }

  if (isEmbed) {
    return (
      <div key={retryKey} className="aspect-video bg-black rounded-lg overflow-hidden">
        <iframe
          src={url}
          title={title}
          className="w-full h-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      <video
        src={url}
        controls
        playsInline
        poster={thumbnailUrl || undefined}
        className="w-full h-full"
      />
    </div>
  );
}
