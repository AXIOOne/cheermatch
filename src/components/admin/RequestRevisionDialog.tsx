import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface RequestRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  teamName?: string;
}

export function RequestRevisionDialog({ open, onOpenChange, submissionId, teamName }: RequestRevisionDialogProps) {
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      const trimmed = notes.trim();
      if (!trimmed) throw new Error('Please enter notes for the coach.');
      const { data: userData } = await supabase.auth.getUser();
      const { error: updateErr } = await supabase
        .from('video_submissions')
        .update({
          status: 'revision_requested',
          review_notes: trimmed,
          reviewed_at: new Date().toISOString(),
          reviewed_by: userData.user?.id,
        } as any)
        .eq('id', submissionId);
      if (updateErr) throw updateErr;
      const { error: emailErr } = await supabase.functions.invoke('send-revision-request', {
        body: { submissionId, notes: trimmed },
      });
      if (emailErr) {
        // Don't fail the dialog; the status is set. Surface a warning instead.
        toast({ title: 'Status saved', description: 'Email failed: ' + emailErr.message });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-scoresheet', submissionId] });
      toast({ title: 'Revision requested' });
      setNotes('');
      onOpenChange(false);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request revision{teamName ? ` — ${teamName}` : ''}</DialogTitle>
          <DialogDescription>
            Send notes to the coach. The submission will be returned for a new capture.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="revision-notes">Reviewer notes</Label>
          <Textarea
            id="revision-notes"
            rows={6}
            placeholder="What needs to change?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !notes.trim()}>
            {submitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Send & request revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
