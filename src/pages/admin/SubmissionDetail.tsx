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
import { ArrowLeft, Loader2, Users, Calendar, Award, Check, X, Pencil, RotateCcw, Video, Archive, ArchiveRestore, Trash2, Download, Upload, Clapperboard } from 'lucide-react';
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
  const { isAdmin, user } = useAuth();
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState('');

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

  // Capture attempts recorded in the portal (authoritative, not device-local)
  const teamId = (submission as any)?.team?.id as string | undefined;
  const eventId = (submission as any)?.event_id as string | undefined;
  const { data: captureInfo } = useQuery({
    queryKey: ['submission-capture-attempts', eventId, teamId],
    queryFn: async () => {
      const [{ data: rows, error }, { data: ev }] = await Promise.all([
        sb.from('capture_attempts')
          .select('id, attempt_number, started_at, outcome, duration_seconds, submission_id, voided_at, void_reason')
          .eq('event_id', eventId!).eq('team_id', teamId!)
          .order('attempt_number', { ascending: true }),
        sb.from('events').select('screen_capture_cnt').eq('id', eventId!).maybeSingle(),
      ]);
      if (error) throw error;
      return {
        attempts: (rows ?? []) as Array<{
          id: string; attempt_number: number; started_at: string;
          outcome: string; duration_seconds: number | null; submission_id: string | null;
          voided_at: string | null; void_reason: string | null;
        }>,
        maxAttempts: (ev?.screen_capture_cnt as number | undefined) ?? 2,
      };
    },
    enabled: !!eventId && !!teamId,
  });

  const overrideAttemptsMutation = useMutation({
    mutationFn: async ({ ids, void: doVoid, reason }: { ids: string[]; void: boolean; reason?: string }) => {
      const { error } = await sb
        .from('capture_attempts')
        .update(
          doVoid
            ? { voided_at: new Date().toISOString(), voided_by: user?.id ?? null, void_reason: reason || 'Admin override' }
            : { voided_at: null, voided_by: null, void_reason: null },
        )
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['submission-capture-attempts', eventId, teamId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      toast({ title: vars.void ? 'Attempts overridden' : 'Attempt restored' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const allAttempts = captureInfo?.attempts ?? [];
  const activeAttempts = allAttempts.filter((a) => !a.voided_at);
  const voidedAttempts = allAttempts.filter((a) => a.voided_at);

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
          <CardTitle className="flex items-center gap-2 text-base">
            <Clapperboard className="w-4 h-4" /> Capture Attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{activeAttempts.length}</span>
            <span className="text-sm text-muted-foreground">
              of {captureInfo?.maxAttempts ?? 2} allowed attempt{(captureInfo?.maxAttempts ?? 2) === 1 ? '' : 's'} used by this team
              {voidedAttempts.length > 0 && ` · ${voidedAttempts.length} overridden`}
            </span>
            {isAdmin && activeAttempts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto gap-1"
                onClick={() => { setResetReason(''); setResetOpen(true); }}
                disabled={overrideAttemptsMutation.isPending}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset attempts
              </Button>
            )}
          </div>
          {captureInfo && captureInfo.attempts.length > 0 ? (
            <div className="divide-y rounded-md border">
              {captureInfo.attempts.map((a) => (
                <div key={a.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${a.voided_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${a.voided_at ? 'line-through' : ''}`}>Take #{a.attempt_number}</span>
                    <Badge variant={a.voided_at ? 'secondary' : a.submission_id ? 'default' : 'outline'} className="capitalize">
                      {a.voided_at ? 'overridden' : a.submission_id ? 'uploaded' : a.outcome?.replace(/_/g, ' ') || 'recorded'}
                    </Badge>
                    {a.voided_at && a.void_reason && (
                      <span className="text-xs text-muted-foreground">{a.void_reason}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {format(new Date(a.started_at), 'MMM d, yyyy p')}
                      {a.duration_seconds ? ` · ${a.duration_seconds}s` : ''}
                    </span>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={overrideAttemptsMutation.isPending}
                        onClick={() => overrideAttemptsMutation.mutate({ ids: [a.id], void: !a.voided_at, reason: 'Admin override' })}
                      >
                        {a.voided_at ? 'Restore' : "Don't count"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No capture attempts recorded in the portal for this team. Videos uploaded before attempt tracking, or imported by an admin, will not have attempt records.
            </p>
          )}
        </CardContent>
      </Card>

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
