import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { dropboxCall, useDropboxStatus } from './DropboxSetting';
import { dropboxFileName, dropboxFolder } from '../../../supabase/functions/_shared/dropbox-naming';

type Sub = { id: string; team: { name: string | null; gym_name: string | null; division: { name: string } | null } | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DropboxExportDialog({ open, onOpenChange, eventId, eventName, submissions }: {
  open: boolean; onOpenChange: (o: boolean) => void; eventId: string; eventName: string; submissions: Sub[];
}) {
  const { data: st } = useDropboxStatus();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const stop = useRef(false);

  const { data: rows } = useQuery({
    queryKey: ['dropbox-exports', eventId],
    enabled: open,
    refetchInterval: running ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from('dropbox_exports').select('*').eq('event_id', eventId);
      if (error) throw error;
      return data;
    },
  });
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.submission_id, r])), [rows]);

  const sorted = useMemo(() => [...submissions].sort((a, b) =>
    (a.team?.division?.name ?? '').localeCompare(b.team?.division?.name ?? '') ||
    (a.team?.gym_name ?? '').localeCompare(b.team?.gym_name ?? '')), [submissions]);

  const nameFor = (s: Sub) => dropboxFileName({ event: eventName, gym: s.team?.gym_name, team: s.team?.name, division: s.team?.division?.name });
  const done = sorted.filter((s) => byId.get(s.id)?.status === 'completed').length;

  const exportAll = async (onlyIds?: string[]) => {
    setRunning(true); stop.current = false;
    const todo = sorted.filter((s) => (onlyIds ? onlyIds.includes(s.id) : byId.get(s.id)?.status !== 'completed'));
    // Start transfers a few at a time; Dropbox then copies each one in the background.
    const pending: string[] = [];
    for (let i = 0; i < todo.length && !stop.current; i += 3) {
      await Promise.all(todo.slice(i, i + 3).map(async (s) => {
        try {
          const r = await dropboxCall({ action: 'start', submission_id: s.id });
          if (r?.status === 'transferring') pending.push(s.id);
        } catch { /* recorded on the row */ }
      }));
      qc.invalidateQueries({ queryKey: ['dropbox-exports', eventId] });
    }
    let left = [...pending];
    while (left.length && !stop.current) {
      await sleep(4000);
      const next: string[] = [];
      for (const id of left) {
        try {
          const r = await dropboxCall({ action: 'check', submission_id: id });
          if (r?.status === 'transferring') next.push(id);
        } catch { next.push(id); }
      }
      left = next;
      qc.invalidateQueries({ queryKey: ['dropbox-exports', eventId] });
    }
    setRunning(false);
    qc.invalidateQueries({ queryKey: ['dropbox-exports', eventId] });
  };

  const failedIds = sorted.filter((s) => byId.get(s.id)?.status === 'failed').map((s) => s.id);

  const badge = (status?: string) => {
    if (status === 'completed') return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">In Dropbox</Badge>;
    if (status === 'transferring') return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Transferring</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="outline">Not sent</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) stop.current = true; onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Videos to Dropbox</DialogTitle>
          <DialogDescription>
            Files are named <span className="font-medium">Event - Gym - Team - Division</span>.
          </DialogDescription>
        </DialogHeader>

        {!st ? <Loader2 className="w-4 h-4 animate-spin" /> : !st.connected ? (
          <p className="text-sm text-muted-foreground">
            Dropbox isn't connected yet. Connect it in <Link to="/admin/settings" className="text-primary underline">Settings</Link>.
          </p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              Folder: <span className="font-mono text-foreground">{dropboxFolder(st.base_folder, eventName)}</span>
              {st.account_email && <> · {st.account_email}</>}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>{done} of {sorted.length} in Dropbox</span></div>
              <Progress value={sorted.length ? (done / sorted.length) * 100 : 0} />
            </div>
            <div className="flex-1 overflow-y-auto border rounded-md divide-y">
              {sorted.map((s) => {
                const r = byId.get(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{nameFor(s)}</div>
                      {r?.status === 'failed' && r.error && <div className="text-xs text-destructive">{r.error}</div>}
                    </div>
                    {badge(r?.status)}
                  </div>
                );
              })}
              {!sorted.length && <div className="p-4 text-sm text-muted-foreground">No videos in this event.</div>}
            </div>
            <div className="flex justify-end gap-2">
              {failedIds.length > 0 && (
                <Button variant="outline" disabled={running} onClick={() => exportAll(failedIds)}>
                  Retry failed ({failedIds.length})
                </Button>
              )}
              <Button disabled={running || done === sorted.length} onClick={() => exportAll()}>
                {running && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {running ? 'Exporting…' : done ? 'Export remaining' : 'Export all videos'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
