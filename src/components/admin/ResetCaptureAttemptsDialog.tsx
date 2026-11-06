import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ResetCaptureTarget {
  eventId: string;
  teamId: string;
  teamName: string;
  count?: number;
}

/** Voids a team's active capture attempts for an event that has no uploaded video yet. */
export function ResetCaptureAttemptsDialog({ target, onClose }: { target: ResetCaptureTarget | null; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  useEffect(() => { if (target) setReason(''); }, [target]);

  const mutation = useMutation({
    mutationFn: async (t: ResetCaptureTarget) => {
      const { data, error } = await supabase
        .from('capture_attempts')
        .update({
          voided_at: new Date().toISOString(),
          voided_by: user?.id ?? null,
          void_reason: reason.trim() || 'Admin reset before upload',
        })
        .eq('event_id', t.eventId)
        .eq('team_id', t.teamId)
        .is('voided_at', null)
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (n, t) => {
      queryClient.invalidateQueries({ queryKey: ['capture-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['event-registration-capture-attempts', t.eventId] });
      queryClient.invalidateQueries({ queryKey: ['submission-capture-attempts'] });
      toast({ title: 'Attempts reset', description: `${n} take${n === 1 ? '' : 's'} cleared. ${t.teamName} can record again.` });
      onClose();
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Could not reset attempts', description: e.message }),
  });

  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset capture attempts?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.count ? `${target.count} recorded take${target.count === 1 ? '' : 's'} for ` : 'All recorded takes for '}
            <strong>{target?.teamName}</strong> will be cleared, and the coach can start recording again with a full set of attempts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reset-capture-reason">Reason (optional)</Label>
          <Textarea id="reset-capture-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Phone ran out of storage during recording" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => { e.preventDefault(); if (target) mutation.mutate(target); }}
          >
            Reset attempts
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
