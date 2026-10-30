import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

/** Admin view: plays the judge's recorded verbal critique for a score, and lets admins delete it. */
export default function VerbalCritiquePlayer({ scoreId }: { scoreId?: string | null }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ['verbal-critique', scoreId],
    enabled: !!scoreId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('verbal_critiques').select('id, storage_path').eq('score_id', scoreId).maybeSingle();
      if (!data) return null;
      const { data: s } = await supabase.storage.from('verbal-critiques').createSignedUrl(data.storage_path, 3600);
      return { id: data.id as string, path: data.storage_path as string, url: s?.signedUrl ?? null };
    },
  });
  if (!data?.url) return null;

  const remove = async () => {
    setBusy(true);
    const { error } = await (supabase as any).from('verbal_critiques').delete().eq('id', data.id);
    if (error) { setBusy(false); toast.error('Could not delete critique: ' + error.message); return; }
    await supabase.storage.from('verbal-critiques').remove([data.path]);
    setBusy(false); setConfirm(false);
    qc.invalidateQueries({ queryKey: ['verbal-critique', scoreId] });
    toast.success('Verbal critique deleted');
  };

  return (
    <div>
      <label className="text-sm font-medium flex items-center gap-1"><Mic className="w-4 h-4" /> Verbal Critique</label>
      <div className="mt-1 flex items-center gap-2">
        <audio controls src={data.url} className="h-10 w-full max-w-md" />
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm(true)}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete verbal critique?</AlertDialogTitle>
            <AlertDialogDescription>The coach will no longer be able to hear this recording. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); remove(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
