import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Users, Calendar, Award, Check, X, Pencil, RotateCcw, Video, Archive, ArchiveRestore, Trash2, Download, Upload } from 'lucide-react';
import { downloadSubmissionVideo, VideoPreparingError } from '@/lib/download-submission-video';
import { useVideoPrep } from '@/hooks/useVideoPrep';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { EditTeamDialog } from '@/components/admin/EditTeamDialog';
import { RequestRevisionDialog } from '@/components/admin/RequestRevisionDialog';
import { DeleteSubmissionDialog } from '@/components/admin/DeleteSubmissionDialog';
import VideoPlayer from '@/components/video/VideoPlayer';
import { ReplaceVideoDialog } from '@/components/admin/ReplaceVideoDialog';
import type { Database } from '@/integrations/supabase/types';

type SubmissionStatus = Database['public']['Enums']['submission_status'];

const sb = supabase as any;

export default function SubmissionDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: SubmissionStatus) => {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', submissionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      toast({ title: 'Status updated' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const { data: submission, isLoading } = useQuery({
    queryKey: ['admin-submission-detail', submissionId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('video_submissions')
        .select(`
          id, video_url, thumbnail_url, brightcove_video_id, status, submitted_at, created_at, duration_seconds,
          review_notes, reviewed_at, archived_at, status_before_archive,
          event_id,
          team:teams!inner(id, name, gym_name, athletes_female, athletes_male, division_id,
            division:divisions!inner(id, name), level:levels!inner(name, level_number)),
          event:events!inner(id, name, start_date, end_date)
        `)
        .eq('id', submissionId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const isArchived = !!(submission as any)?.archived_at;

  const videoPrep = useVideoPrep();
  const prepState = submissionId ? videoPrep.getState(submissionId) : undefined;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSubmissionVideo(submissionId!, (submission as any)?.video_url);
      videoPrep.clear(submissionId!);
    } catch (e: any) {
      if (e instanceof VideoPreparingError) {
        videoPrep.markPreparing(submissionId!);
        toast({ title: 'Preparing download', description: e.message });
      } else {
        toast({ variant: 'destructive', title: 'Download unavailable', description: e.message });
      }
    } finally {
      setDownloading(false);
    }
  };

  const archiveMutation = useMutation({
    mutationFn: async (archive: boolean) => {
      const payload = archive
        ? {
            archived_at: new Date().toISOString(),
            archived_by: (await supabase.auth.getUser()).data.user?.id ?? null,
            status_before_archive: submission?.status ?? null,
          }
        : {
            archived_at: null,
            archived_by: null,
            status_before_archive: null,
            status: (submission as any)?.status_before_archive ?? submission?.status,
          };
      const { error } = await sb.from('video_submissions').update(payload).eq('id', submissionId!);
      if (error) throw error;
      return archive;
    },
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      toast({ title: archived ? 'Submission archived' : 'Submission restored' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!submission) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Submission not found.</p>
        <Button variant="ghost" onClick={() => navigate('/admin/submissions')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Submissions
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/submissions')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Submissions
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading || (!(submission as any).brightcove_video_id && !submission.video_url)}
            title={(submission as any).brightcove_video_id || submission.video_url ? 'Download video' : 'No video available'}
          >
            {downloading || prepState === 'preparing'
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Download className={`w-4 h-4 mr-2 ${prepState === 'ready' ? 'text-primary' : ''}`} />}
            {prepState === 'preparing' ? 'Preparing download…' : prepState === 'ready' ? 'Download ready' : 'Download video'}
          </Button>
          {!isArchived && (
            <Button size="sm" variant="outline" onClick={() => setReplaceOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Replace video
            </Button>
          )}
          {!isArchived && (submission.status === 'uploaded' || submission.status === 'imported' || submission.status === 'denied') && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate('approved')}
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" /> Approve
            </Button>
          )}
          {!isArchived && (submission.status === 'uploaded' || submission.status === 'imported' || submission.status === 'approved') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => updateStatusMutation.mutate('denied')}
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" /> Deny
            </Button>
          )}
          {!isArchived && submission.status !== 'revision_requested' && submission.status !== 'complete' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevisionOpen(true)}
              disabled={updateStatusMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Request Revision
            </Button>
          )}
          {!isArchived ? (
            <Button size="sm" variant="outline" onClick={() => setArchiveConfirmOpen(true)} disabled={archiveMutation.isPending}>
              <Archive className="w-4 h-4 mr-2" /> Archive
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setRestoreConfirmOpen(true)} disabled={archiveMutation.isPending}>
                <ArchiveRestore className="w-4 h-4 mr-2" /> Restore
              </Button>
              {isAdmin && (
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete permanently
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {(submission as any).review_notes && (
        <div className="mb-6 border border-amber-300 bg-amber-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reviewer notes
          </p>
          <p className="text-sm text-amber-900/90 mt-1 whitespace-pre-wrap">{(submission as any).review_notes}</p>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{submission.team?.name}</h1>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setEditTeamOpen(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit Team
                </Button>
              )}
            </div>
            <p className="text-lg text-muted-foreground mt-1">{submission.team?.gym_name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary" className="gap-1">{submission.event?.name}</Badge>
          <Badge variant="outline" className="gap-1"><Award className="w-3 h-3" /> {submission.team?.division?.name}</Badge>
          <Badge variant="outline" className="gap-1"><Award className="w-3 h-3" /> {submission.team?.level?.name}</Badge>
          <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {(submission.team?.athletes_female ?? 0) + (submission.team?.athletes_male ?? 0)} athletes ({submission.team?.athletes_female ?? 0}F / {submission.team?.athletes_male ?? 0}M)</Badge>
          {submission.submitted_at && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="w-3 h-3" /> Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
            </Badge>
          )}
          <Badge className="capitalize">{submission.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Video className="w-4 h-4" /> Performance Video</CardTitle>
        </CardHeader>
        <CardContent>
          <VideoPlayer
            url={submission.video_url}
            thumbnailUrl={submission.thumbnail_url}
            status={submission.status}
            title={`${submission.team?.name || 'Team'} performance video`}
          />
        </CardContent>
      </Card>

      {submission.team && (
        <EditTeamDialog
          open={editTeamOpen}
          onOpenChange={setEditTeamOpen}
          team={{
            id: submission.team.id,
            name: submission.team.name,
            athletes_female: submission.team.athletes_female,
            athletes_male: submission.team.athletes_male,
            division_id: submission.team.division_id,
          }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] })}
        />
      )}

      <RequestRevisionDialog
        open={revisionOpen}
        onOpenChange={setRevisionOpen}
        submissionId={submissionId!}
        teamName={submission.team?.name || ''}
      />

      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the active list, judging queues and results, but its scores and
              video are kept. You can restore it at any time from the Archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate(true)}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this submission?</AlertDialogTitle>
            <AlertDialogDescription>
              It will return to the Current tab with the status it had before being archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate(false)}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteSubmissionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        submissions={[{ id: submissionId!, teamName: submission.team?.name || 'this submission' }]}
        onDeleted={() => navigate('/admin/submissions')}
      />

      <ReplaceVideoDialog
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        submissionId={submissionId!}
        teamName={submission.team?.name}
        onReplaced={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
          queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
        }}
      />

    </div>
  );
}
