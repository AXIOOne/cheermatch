import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Users, Calendar, Award, Check, X, Pencil, RotateCcw, Video } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { EditTeamDialog } from '@/components/admin/EditTeamDialog';
import { RequestRevisionDialog } from '@/components/admin/RequestRevisionDialog';
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
          id, video_url, thumbnail_url, status, submitted_at, created_at, duration_seconds,
          review_notes, reviewed_at,
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
          {(submission.status === 'uploaded' || submission.status === 'imported' || submission.status === 'denied') && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate('approved')}
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" /> Approve
            </Button>
          )}
          {(submission.status === 'uploaded' || submission.status === 'imported' || submission.status === 'approved') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => updateStatusMutation.mutate('denied')}
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" /> Deny
            </Button>
          )}
          {submission.status !== 'revision_requested' && submission.status !== 'complete' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevisionOpen(true)}
              disabled={updateStatusMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Request Revision
            </Button>
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
          <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {submission.team?.athlete_count} athletes</Badge>
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
          {submission.video_url ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {/players\.brightcove\.net|player\.vimeo\.com|youtube\.com\/embed|youtu\.be/.test(submission.video_url) ? (
                <iframe
                  src={submission.video_url}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={submission.video_url} controls className="w-full h-full" poster={submission.thumbnail_url || undefined} />
              )}
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Video not available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {submission.team && (
        <EditTeamDialog
          open={editTeamOpen}
          onOpenChange={setEditTeamOpen}
          team={{
            id: submission.team.id,
            name: submission.team.name,
            athlete_count: submission.team.athlete_count,
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
    </div>
  );
}
