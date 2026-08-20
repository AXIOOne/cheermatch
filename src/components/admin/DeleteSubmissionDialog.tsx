import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export interface DeletableSubmission {
  id: string;
  teamName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: DeletableSubmission[];
  onDeleted?: () => void;
}

export function DeleteSubmissionDialog({ open, onOpenChange, submissions, onDeleted }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [deleteVideo, setDeleteVideo] = useState(false);

  const isBulk = submissions.length > 1;
  const requiredText = isBulk
    ? `DELETE ${submissions.length} SUBMISSIONS`
    : (submissions[0]?.teamName ?? '');

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setDeleteVideo(false);
    }
  }, [open]);

  const canDelete =
    submissions.length > 0 &&
    confirmText.trim().toLowerCase() === requiredText.trim().toLowerCase();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const failures: string[] = [];
      let deleted = 0;
      // One at a time so a single failure doesn't hide the rest.
      for (const s of submissions) {
        const { data, error } = await supabase.functions.invoke('delete-submission', {
          body: { submissionId: s.id, deleteVideo },
        });
        const err = error?.message || (data as any)?.error;
        if (err) failures.push(`${s.teamName}: ${err}`);
        else deleted += 1;
      }
      return { deleted, failures };
    },
    onSuccess: ({ deleted, failures }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      if (deleted > 0) {
        toast({
          title: `${deleted} submission${deleted !== 1 ? 's' : ''} permanently deleted`,
          description: deleteVideo ? 'Hosted videos were removed as well.' : undefined,
        });
      }
      if (failures.length > 0) {
        toast({
          variant: 'destructive',
          title: `${failures.length} could not be deleted`,
          description: failures.slice(0, 3).join(' • '),
        });
      }
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Delete failed', description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Permanently delete {isBulk ? `${submissions.length} submissions` : 'submission'}
          </DialogTitle>
          <DialogDescription>
            This cannot be undone. The following will be removed permanently:
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>The submission record and its history</li>
          <li>All judge scores, deductions, overrides and review links</li>
          <li>{deleteVideo ? 'The video file on the hosting service' : 'The video on the hosting service will be kept'}</li>
        </ul>

        <div className="rounded-md border bg-muted/30 p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {isBulk ? `${submissions.length} teams selected` : 'Team'}
          </p>
          <ul className="text-sm space-y-0.5">
            {submissions.map((s) => (
              <li key={s.id}>{s.teamName}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="delete-video"
            checked={deleteVideo}
            onCheckedChange={(v) => setDeleteVideo(v === true)}
          />
          <Label htmlFor="delete-video" className="text-sm font-normal leading-snug">
            Also delete the video from the hosting service (Brightcove). Leave unchecked to remove only the portal record.
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-text" className="text-sm">
            Type <span className="font-mono font-semibold">{requiredText}</span> to confirm
          </Label>
          <Input
            id="confirm-text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredText}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
