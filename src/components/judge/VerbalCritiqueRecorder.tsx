import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';

export interface VerbalCritiqueHandle {
  /** Uploads a newly recorded take (or removes a discarded one) for the saved score. */
  persist: (scoreId: string, submissionId: string) => Promise<void>;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const VerbalCritiqueRecorder = forwardRef<VerbalCritiqueHandle, { scoreId: string | null; disabled?: boolean }>(
  ({ scoreId, disabled }, ref) => {
    const { user } = useAuth();
    const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
    const [seconds, setSeconds] = useState(0);
    const [blob, setBlob] = useState<Blob | null>(null);
    const [localUrl, setLocalUrl] = useState<string | null>(null);
    const [saved, setSaved] = useState<{ path: string; url: string; duration: number | null } | null>(null);
    const [removeSaved, setRemoveSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recRef = useRef<MediaRecorder | null>(null);
    const chunks = useRef<Blob[]>([]);
    const timer = useRef<number | null>(null);
    const secsRef = useRef(0);

    useEffect(() => {
      if (!scoreId) return;
      (async () => {
        const { data } = await (supabase as any).from('verbal_critiques').select('storage_path, duration_seconds').eq('score_id', scoreId).maybeSingle();
        if (!data) return;
        const { data: signed } = await supabase.storage.from('verbal-critiques').createSignedUrl(data.storage_path, 3600);
        if (signed?.signedUrl) setSaved({ path: data.storage_path, url: signed.signedUrl, duration: data.duration_seconds });
      })();
    }, [scoreId]);

    useEffect(() => () => { if (timer.current) clearInterval(timer.current); recRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

    const tick = () => { timer.current = window.setInterval(() => { secsRef.current += 1; setSeconds(secsRef.current); }, 1000); };
    const stopTick = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

    const start = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 64000 } : undefined);
        chunks.current = [];
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const b = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
          setBlob(b);
          setLocalUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
        };
        rec.start(1000);
        recRef.current = rec;
        secsRef.current = 0; setSeconds(0);
        tick();
        setState('recording');
      } catch {
        setError('Microphone access was blocked. Allow the microphone in your browser and try again.');
      }
    };
    const pause = () => { recRef.current?.pause(); stopTick(); setState('paused'); };
    const resume = () => { recRef.current?.resume(); tick(); setState('recording'); };
    const stop = () => { recRef.current?.stop(); stopTick(); setState('idle'); };
    const discard = () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
      setBlob(null); setLocalUrl(null); secsRef.current = 0; setSeconds(0);
    };

    useImperativeHandle(ref, () => ({
      persist: async (sid, submissionId) => {
        if (recRef.current && recRef.current.state !== 'inactive') throw new Error('Stop the audio recording before saving.');
        if (blob && user) {
          const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
          const path = `${user.id}/${sid}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('verbal-critiques').upload(path, blob, { contentType: blob.type });
          if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);
          const { error: dbErr } = await (supabase as any).from('verbal_critiques').upsert({
            score_id: sid, submission_id: submissionId, judge_user_id: user.id,
            storage_path: path, duration_seconds: secsRef.current, mime_type: blob.type,
          }, { onConflict: 'score_id' });
          if (dbErr) throw dbErr;
          if (saved) await supabase.storage.from('verbal-critiques').remove([saved.path]);
          setSaved({ path, url: localUrl!, duration: secsRef.current });
          setBlob(null);
        } else if (removeSaved && saved) {
          await (supabase as any).from('verbal_critiques').delete().eq('score_id', sid);
          await supabase.storage.from('verbal-critiques').remove([saved.path]);
          setSaved(null); setRemoveSaved(false);
        }
      },
    }));

    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Mic className="w-4 h-4" /> Verbal Critique</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Record spoken feedback for this team. It is saved with your score and the coach can listen from their scoresheet link.</p>
          {saved && !blob && !removeSaved && (
            <div className="flex items-center gap-3 flex-wrap">
              <audio controls src={saved.url} className="h-10" />
              <span className="text-xs text-muted-foreground">Saved{saved.duration ? ` · ${fmt(saved.duration)}` : ''}</span>
              {!disabled && <Button size="sm" variant="ghost" onClick={() => setRemoveSaved(true)}><Trash2 className="w-4 h-4 mr-1" />Remove</Button>}
            </div>
          )}
          {removeSaved && <p className="text-sm text-destructive">The saved critique will be removed when you save. <button className="underline" onClick={() => setRemoveSaved(false)}>Undo</button></p>}
          {blob && localUrl && state === 'idle' && (
            <div className="flex items-center gap-3 flex-wrap">
              <audio controls src={localUrl} className="h-10" />
              <span className="text-xs text-muted-foreground">New take · {fmt(seconds)} · saves with your score</span>
              <Button size="sm" variant="ghost" onClick={discard}><Trash2 className="w-4 h-4 mr-1" />Discard</Button>
            </div>
          )}
          {!disabled && (
            <div className="flex items-center gap-2">
              {state === 'idle' && (
                <Button size="sm" variant="outline" onClick={start}><Mic className="w-4 h-4 mr-1" />{blob || saved ? 'Re-record' : 'Record'}</Button>
              )}
              {state !== 'idle' && (
                <>
                  <span className={`inline-block w-2.5 h-2.5 rounded-full bg-destructive ${state === 'recording' ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className="font-mono text-sm w-12">{fmt(seconds)}</span>
                  {state === 'recording'
                    ? <Button size="sm" variant="outline" onClick={pause}><Pause className="w-4 h-4 mr-1" />Pause</Button>
                    : <Button size="sm" variant="outline" onClick={resume}><Play className="w-4 h-4 mr-1" />Resume</Button>}
                  <Button size="sm" onClick={stop}><Square className="w-4 h-4 mr-1" />Stop</Button>
                </>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  },
);
VerbalCritiqueRecorder.displayName = 'VerbalCritiqueRecorder';
export default VerbalCritiqueRecorder;
