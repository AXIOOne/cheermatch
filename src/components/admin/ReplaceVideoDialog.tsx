import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ReplaceVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Replace mode: the submission whose video is being swapped. */
  submissionId?: string | null;
  teamName?: string;
  /** Manual mode: upload on behalf of a team that never submitted. */
  mode?: 'replace' | 'manual';
  /** Pre-selected event for manual mode. */
  defaultEventId?: string | null;
  /** Pre-selected team for manual mode. */
  defaultTeamId?: string | null;
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

export function ReplaceVideoDialog({
  open,
  onOpenChange,
  submissionId,
  teamName,
  mode = 'replace',
  defaultEventId,
  defaultTeamId,
  onReplaced,
}: ReplaceVideoDialogProps) {
  const isManual = mode === 'manual';
  const [file, setFile] = useState<File | null>(null);
  const [deleteOld, setDeleteOld] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: events } = useQuery({
    queryKey: ['manual-upload-events'],
    enabled: open && isManual,
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('id, name').order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: teams } = useQuery({
    queryKey: ['manual-upload-teams', eventId],
    enabled: open && isManual && !!eventId,
    queryFn: async () => {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, gym_name, division:divisions(name), level:levels(name)')
        .eq('event_id', eventId)
        .order('name');
      if (teamsError) throw teamsError;

      const { data: submissions, error: subError } = await supabase
        .from('video_submissions')
        .select('team_id')
        .eq('event_id', eventId)
        .is('archived_at', null);
      if (subError) throw subError;

      const submittedTeamIds = new Set(submissions?.map((s) => s.team_id) ?? []);
      return teams?.filter((t) => !submittedTeamIds.has(t.id)) ?? [];
    },
  });

  const reset = () => {
    setFile(null);
    setDeleteOld(true);
    setProgress(0);
    setStage('');
    setBusy(false);
    setEventId(defaultEventId ?? '');
    setTeamId(defaultTeamId ?? '');
    if (inputRef.current) inputRef.current.value = '';
  };

  // Clear any previously picked file whenever the dialog opens or targets another submission
  useEffect(() => {
    if (!busy) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, submissionId, defaultEventId, defaultTeamId]);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-replace-video', { body });
    if (error) throw new Error(error.message);
    const payload = data as Fn;
    if (!payload?.status) throw new Error(payload?.message || 'Request failed');
    return payload.data;
  };

  const canSubmit = !!file && (isManual ? !!eventId && !!teamId : !!submissionId);

  const handleUpload = async () => {
    if (!file || !canSubmit) return;
    setBusy(true);
    try {
      setStage('Preparing upload…');
      const init = await call(
        isManual
          ? { action: 'init', event_id: eventId, team_id: teamId, file_name: file.name }
          : { action: 'init', submission_id: submissionId, file_name: file.name },
      );

      const targetSubmissionId = init.submission_id ?? submissionId;

      setStage('Uploading video…');
      await putWithProgress(init.signed_url, file, setProgress);

      setStage('Sending to the video host…');
      const duration = await readDuration(file);
      await call({
        action: 'complete',
        submission_id: targetSubmissionId,
        video_id: init.video_id,
        api_request_url: init.api_request_url,
        duration_seconds: duration,
        delete_old: isManual ? false : deleteOld,
      });

      toast({
        title: isManual ? 'Video uploaded' : 'Replacement uploaded',
        description: 'The video is processing on the host and will be playable shortly.',
      });
      onReplaced?.();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
      setBusy(false);
      setStage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isManual ? 'Upload video for a team' : 'Replace performance video'}</DialogTitle>
          <DialogDescription>
            {isManual
              ? 'Manually upload a performance video for a team that could not capture and submit through the app. The submission is created for you and processes on the host for a few minutes before it can be played.'
              : `Upload a new video file${teamName ? ` for ${teamName}` : ''}. The submission keeps its scores and history — only the video is swapped. The new file will process on the host for a few minutes before it can be played.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isManual && (
            <>
              <div className="space-y-2">
                <Label>Event</Label>
                <Select value={eventId} onValueChange={(v) => { setEventId(v); setTeamId(''); }} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
                  <SelectContent>
                    {events?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={setTeamId} disabled={busy || !eventId}>
                  <SelectTrigger><SelectValue placeholder={eventId ? 'Select a team' : 'Select an event first'} /></SelectTrigger>
                  <SelectContent>
                    {teams?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — {t.gym_name}
                        {t.division?.name ? ` (${t.division.name}${t.level?.name ? ` / ${t.level.name}` : ''})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

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

          {!isManual && (
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
          )}

          {busy && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{stage} {progress > 0 && progress < 100 ? `${progress}%` : ''}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} disabled={busy}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!canSubmit || busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {isManual ? 'Upload video' : 'Upload replacement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
