import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Play, Trophy, Users, Calendar, Award, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function SubmissionScoresheet() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();

  const { data: submission, isLoading } = useQuery({
    queryKey: ['admin-submission-scoresheet', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`
          id,
          video_url,
          thumbnail_url,
          status,
          submitted_at,
          created_at,
          duration_seconds,
          team:teams!inner(
            id, name, gym_name, athlete_count,
            division:divisions!inner(name),
            level:levels!inner(name, level_number)
          ),
          event:events!inner(id, name, start_date, end_date)
        `)
        .eq('id', submissionId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const { data: scores } = useQuery({
    queryKey: ['admin-submission-scores', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          id,
          total_score,
          deductions,
          comments,
          status,
          submitted_at,
          panel:judge_panels(id, name, abbreviation),
          details:score_details(
            points,
            notes,
            category:scoring_categories(id, name, max_points, weight, display_order)
          ),
          deduction_items:score_deductions(
            count,
            notes,
            deduction_type:deduction_types(name, points)
          )
        `)
        .eq('submission_id', submissionId!)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const { data: judgeProfiles } = useQuery({
    queryKey: ['scores-judge-profiles', submissionId, scores?.length],
    queryFn: async () => {
      const { data: scoresData } = await supabase
        .from('scores')
        .select('judge_user_id')
        .eq('submission_id', submissionId!);
      const ids = [...new Set((scoresData || []).map((s) => s.judge_user_id))];
      if (ids.length === 0) return {} as Record<string, { full_name: string | null; email: string }>;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      return (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string }>);
    },
    enabled: !!submissionId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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

  const submittedScores = (scores || []).filter((s) => s.status === 'submitted');
  const avgScore = submittedScores.length
    ? submittedScores.reduce((sum, s) => sum + (Number(s.total_score) || 0), 0) / submittedScores.length
    : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/submissions')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Submissions
      </Button>

      {/* Context Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{submission.team?.name}</h1>
            <p className="text-lg text-muted-foreground mt-1">{submission.team?.gym_name}</p>
          </div>
          {avgScore !== null && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Average Score</p>
              <p className="text-4xl font-bold text-primary">{avgScore.toFixed(2)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary" className="gap-1">
            <Trophy className="w-3 h-3" /> {submission.event?.name}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Award className="w-3 h-3" /> {submission.team?.division?.name}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Award className="w-3 h-3" /> {submission.team?.level?.name}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" /> {submission.team?.athlete_count} athletes
          </Badge>
          {submission.submitted_at && (
            <Badge variant="outline" className="gap-1">
              <Calendar className="w-3 h-3" />
              Submitted {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
            </Badge>
          )}
          <Badge className="capitalize">{submission.status}</Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Video */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Play className="w-4 h-4" /> Performance Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submission.video_url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={submission.video_url}
                  controls
                  className="w-full h-full"
                  poster={submission.thumbnail_url || undefined}
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video not available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" /> Scoresheet Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores && scores.length > 0 ? (
              scores.map((s) => {
                const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{panel?.name || 'Judge'}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {s.total_score !== null ? Number(s.total_score).toFixed(2) : '—'}
                      </p>
                      {Number(s.deductions) > 0 && (
                        <p className="text-xs text-destructive">-{Number(s.deductions)} deductions</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No scores recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Panel Breakdown */}
      {scores && scores.length > 0 && (
        <div className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold">Score Breakdown by Panel</h2>
          {scores.map((s) => {
            const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
            const sortedDetails = [...(s.details || [])].sort((a: any, b: any) => {
              const ao = (Array.isArray(a.category) ? a.category[0] : a.category)?.display_order ?? 0;
              const bo = (Array.isArray(b.category) ? b.category[0] : b.category)?.display_order ?? 0;
              return ao - bo;
            });
            return (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {panel?.name || 'Judge Panel'}
                      {panel?.abbreviation && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({panel.abbreviation})
                        </span>
                      )}
                    </CardTitle>
                    <Badge variant={s.status === 'submitted' ? 'default' : 'secondary'} className="capitalize">
                      {s.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sortedDetails.length > 0 && (
                    <div className="space-y-2">
                      {sortedDetails.map((d: any, idx: number) => {
                        const cat = Array.isArray(d.category) ? d.category[0] : d.category;
                        return (
                          <div
                            key={idx}
                            className="flex items-start justify-between py-2 border-b last:border-0"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">{cat?.name || 'Category'}</p>
                              {d.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>
                              )}
                            </div>
                            <p className="text-sm font-mono">
                              {Number(d.points).toFixed(2)} / {Number(cat?.max_points || 0).toFixed(2)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {s.deduction_items && s.deduction_items.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">Deductions</p>
                        <div className="space-y-1">
                          {s.deduction_items.map((di: any, idx: number) => {
                            const dt = Array.isArray(di.deduction_type)
                              ? di.deduction_type[0]
                              : di.deduction_type;
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span>
                                  {dt?.name} × {di.count}
                                </span>
                                <span className="text-destructive font-mono">
                                  -{(Number(dt?.points || 0) * Number(di.count || 0)).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {s.comments && (
                    <>
                      <Separator />
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs font-medium mb-1">Judge Comments</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {s.comments}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-medium">Total Score</span>
                    <span className="text-2xl font-bold text-primary">
                      {s.total_score !== null ? Number(s.total_score).toFixed(2) : '—'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
