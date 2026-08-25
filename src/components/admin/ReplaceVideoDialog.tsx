import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReplaceVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  teamName?: string;
  onReplaced?: () => void;
}

type Fn = { status?: boolean; message?: string; data?: any };

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

async function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? Math.round(el.duration) : null;
      URL.revokeObjectURL(el.src);
      resolve(d);
    };
    el.onerror = () => resolve(null);
    el.src = URL.createObjectURL(file);
  });
}

export function ReplaceVideoDialog({ open, onOpenChange, submissionId, teamName, onReplaced }: ReplaceVideoDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [deleteOld, setDeleteOld] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setProgress(0); setStage(''); setBusy(false); };

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-replace-video', { body });
    if (error) throw new Error(error.message);
    const payload = data as Fn;
    if (!payload?.status) throw new Error(payload?.message || 'Request failed');
    return payload.data;
  };

  const handleUpload = async () => {
    if (!file || !submissionId) return;
    setBusy(true);
    try {
      setStage('Preparing upload…');
      const init = await call({ action: 'init', submission_id: submissionId, file_name: file.name });

      setStage('Uploading video…');
      await putWithProgress(init.signed_url, file, setProgress);

      setStage('Sending to the video host…');
      const duration = await readDuration(file);
      await call({
        action: 'complete',
        submission_id: submissionId,
        video_id: init.video_id,
        api_request_url: init.api_request_url,
        duration_seconds: duration,
        delete_old: deleteOld,
      });

      toast({
        title: 'Replacement uploaded',
        description: 'The new video is processing on the host and will be playable shortly.',
      });
      onReplaced?.();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Replacement failed', description: e.message });
      setBusy(false);
      setStage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace performance video</DialogTitle>
          <DialogDescription>
            Upload a new video file{teamName ? ` for ${teamName}` : ''}. The submission keeps its scores and history —
            only the video is swapped. The new file will process on the host for a few minutes before it can be played.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="replacement-video">Video file</Label>
            <Input
              id="replacement-video"
              ref={inputRef}
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="delete-old"
              checked={deleteOld}
              disabled={busy}
              onCheckedChange={(v) => setDeleteOld(v === true)}
            />
            <Label htmlFor="delete-old" className="text-sm font-normal">
              Delete the previous video from the host
            </Label>
          </div>

          {busy && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{stage} {progress > 0 && progress < 100 ? `${progress}%` : ''}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload replacement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
