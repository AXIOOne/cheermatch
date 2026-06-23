import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Play, Trophy, Users, Calendar, Award, FileText, Download, Check, X, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { aggregateValues, AggregationMode } from '@/lib/scoring';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { buildScoresheet, type RawField, type ScoreType } from '@/lib/build-scoresheet';
import { buildScoresheetPdf, downloadPdf } from '@/lib/scoresheet-pdf';
import { EditTeamDialog } from '@/components/admin/EditTeamDialog';
import type { Database } from '@/integrations/supabase/types';

type SubmissionStatus = Database['public']['Enums']['submission_status'];


const sb = supabase as any;

export default function SubmissionScoresheet() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (status: SubmissionStatus) => {
      const { error } = await supabase
        .from('video_submissions')
        .update({ status })
        .eq('id', submissionId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submission-scoresheet', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      toast({ title: 'Status updated' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });


  const { data: submission, isLoading } = useQuery({
    queryKey: ['admin-submission-scoresheet', submissionId],
    queryFn: async () => {
      const { data, error } = await sb
        .from('video_submissions')
        .select(`
          id, video_url, thumbnail_url, status, submitted_at, created_at, duration_seconds,
          event_id,
          team:teams!inner(id, name, gym_name, athlete_count, division_id,
            division:divisions!inner(id, name, scoring_template_id), level:levels!inner(name, level_number)),
          event:events!inner(id, name, start_date, end_date, accuscore_end_at)
        `)
        .eq('id', submissionId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });


  const { data: scores } = useQuery({
    queryKey: ['admin-submission-scores', submissionId],
    queryFn: async () => {
      const { data, error } = await sb.from('scores').select(`
        id, total_score, deductions, comments, status, submitted_at,
        panel:judge_panels(id, name, abbreviation),
        details:score_details(
          points, notes,
          field:scoring_fields(id, name, max_points, section_id, score_type, display_order,
            section:scoring_sections(id, name, abbreviation, display_order),
            panel_links:scoring_field_panels(panel_abbreviation))
        ),
        deduction_items:score_deductions(count, notes, deduction_type:deduction_types(name, points))
      `).eq('submission_id', submissionId!).order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const handleDownloadPdf = async () => {
    try {
      if (!submission) return;
      const submitted = (scores || []).filter((s: any) => s.status === 'submitted');
      const fieldMap = new Map<string, RawField>();
      submitted.forEach((s: any) => {
        (s.details || []).forEach((d: any) => {
          const f = Array.isArray(d.field) ? d.field[0] : d.field;
          if (!f || fieldMap.has(f.id)) return;
          const section = Array.isArray(f.section) ? f.section[0] : f.section;
          fieldMap.set(f.id, {
            id: f.id,
            name: f.name,
            max_points: Number(f.max_points || 0),
            score_type: ((f.score_type as ScoreType) || 'difficulty'),
            section_id: f.section_id,
            section_name: section?.name || '',
            section_order: section?.display_order ?? 0,
            field_order: f.display_order ?? 0,
          });
        });
      });
      const data = buildScoresheet({
        team_name: submission.team?.name || 'Team',
        gym_name: submission.team?.gym_name,
        division_name: submission.team?.division?.name,
        event_name: submission.event?.name || 'Event',
        accuscore_end_at: submission.event?.accuscore_end_at || null,
        fields: Array.from(fieldMap.values()),
        submitted_scores: submitted.map((s: any) => ({
          deductions: Number(s.deductions || 0),
          details: (s.details || []).map((d: any) => ({
            field_id: (Array.isArray(d.field) ? d.field[0] : d.field)?.id,
            points: Number(d.points || 0),
          })),
        })),
      });
      const bytes = await buildScoresheetPdf(data);
      const safeName = `${data.team_name} - ${data.event_name}`.replace(/[^\w\s-]/g, '').trim();
      downloadPdf(bytes, `${safeName || 'scoresheet'}.pdf`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'PDF failed', description: err.message });
    }
  };


  // Build aggregated view per field across all submitted panel scores
  type AggField = {
    field_id: string; field_name: string; max_points: number;
    section_name: string; section_abbr: string; section_order: number;
    aggregation: AggregationMode; values: number[]; aggregated: number;
  };
  const submittedScores = (scores || []).filter((s: any) => s.status === 'submitted');
  const aggregatedFieldsBySection = new Map<string, AggField[]>();
  submittedScores.forEach((s: any) => {
    (s.details || []).forEach((d: any) => {
      const field = Array.isArray(d.field) ? d.field[0] : d.field;
      if (!field) return;
      const section = Array.isArray(field.section) ? field.section[0] : field.section;
      const key = section?.id || 'unknown';
      const list = aggregatedFieldsBySection.get(key) || [];
      let entry = list.find(e => e.field_id === field.id);
      if (!entry) {
        entry = {
          field_id: field.id, field_name: field.name,
          max_points: Number(field.max_points),
          section_name: section?.name || 'Section',
          section_abbr: section?.abbreviation || '',
          section_order: section?.display_order ?? 0,
          aggregation: (field.aggregation as AggregationMode) || 'average',
          values: [], aggregated: 0,
        };
        list.push(entry);
      }
      entry.values.push(Number(d.points || 0));
      aggregatedFieldsBySection.set(key, list);
    });
  });
  aggregatedFieldsBySection.forEach((list) => list.forEach((e) => {
    e.aggregated = aggregateValues(e.values, e.aggregation);
  }));

  // Compute final = sum of aggregated field values - avg deductions across panels
  const aggregatedScore = (() => {
    let total = 0;
    aggregatedFieldsBySection.forEach((list) => list.forEach((e) => total += e.aggregated));
    const dedAvg = submittedScores.length
      ? submittedScores.reduce((sum: number, s: any) => sum + Number(s.deductions || 0), 0) / submittedScores.length
      : 0;
    return Math.max(0, total - dedAvg);
  })();

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/submissions')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Submissions
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {(submission.status === 'imported' || submission.status === 'denied') && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate('approved')}
              disabled={updateStatusMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" /> Approve
            </Button>
          )}
          {(submission.status === 'imported' || submission.status === 'approved') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => updateStatusMutation.mutate('denied')}
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" /> Deny
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={submittedScores.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </Button>
        </div>
      </div>




      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{submission.team?.name}</h1>
            <p className="text-lg text-muted-foreground mt-1">{submission.team?.gym_name}</p>
          </div>
          {submittedScores.length > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Aggregated Score</p>
              <p className="text-4xl font-bold text-primary">{aggregatedScore.toFixed(2)}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary" className="gap-1"><Trophy className="w-3 h-3" /> {submission.event?.name}</Badge>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Play className="w-4 h-4" /> Performance Video</CardTitle>
          </CardHeader>
          <CardContent>
            {submission.video_url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video src={submission.video_url} controls className="w-full h-full" poster={submission.thumbnail_url || undefined} />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Video not available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" /> Per-Panel Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores && scores.length > 0 ? scores.map((s: any) => {
              const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{panel?.name || 'Judge'}{panel?.abbreviation ? ` (${panel.abbreviation})` : ''}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{s.total_score !== null ? Number(s.total_score).toFixed(2) : '—'}</p>
                    {Number(s.deductions) > 0 && <p className="text-xs text-destructive">-{Number(s.deductions)} deductions</p>}
                  </div>
                </div>
              );
            }) : <p className="text-sm text-muted-foreground text-center py-6">No scores recorded yet.</p>}
          </CardContent>
        </Card>
      </div>

      {aggregatedFieldsBySection.size > 0 && (
        <div className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold">Aggregated Scoresheet</h2>
          {Array.from(aggregatedFieldsBySection.values())
            .sort((a, b) => (a[0]?.section_order ?? 0) - (b[0]?.section_order ?? 0))
            .map((fields, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="outline">{fields[0].section_abbr}</Badge>
                    {fields[0].section_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Field</th>
                        <th className="text-left py-2">Judges</th>
                        <th className="text-left py-2">Aggregation</th>
                        <th className="text-right py-2">Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(f => (
                        <tr key={f.field_id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{f.field_name}</td>
                          <td className="py-2 text-muted-foreground">
                            {f.values.map((v, i) => <span key={i} className="mr-2">{v.toFixed(2)}</span>)}
                          </td>
                          <td className="py-2 text-xs uppercase text-muted-foreground">{f.aggregation}</td>
                          <td className="py-2 text-right font-mono">{f.aggregated.toFixed(2)} <span className="text-xs text-muted-foreground">/ {f.max_points.toFixed(2)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {scores && scores.length > 0 && (
        <div className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold">Per-Panel Detail</h2>
          {scores.map((s: any) => {
            const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
            return (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {panel?.name || 'Judge Panel'}{panel?.abbreviation && <span className="ml-2 text-sm text-muted-foreground">({panel.abbreviation})</span>}
                    </CardTitle>
                    <Badge variant={s.status === 'submitted' ? 'default' : 'secondary'} className="capitalize">{s.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(s.details || []).length > 0 && (
                    <div className="space-y-2">
                      {(s.details || []).map((d: any, idx: number) => {
                        const field = Array.isArray(d.field) ? d.field[0] : d.field;
                        return (
                          <div key={idx} className="flex items-start justify-between py-2 border-b last:border-0">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{field?.name || 'Field'}</p>
                              {d.notes && <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>}
                            </div>
                            <p className="text-sm font-mono">
                              {Number(d.points).toFixed(2)} / {Number(field?.max_points || 0).toFixed(2)}
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
                            const dt = Array.isArray(di.deduction_type) ? di.deduction_type[0] : di.deduction_type;
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span>{dt?.name} × {di.count}</span>
                                <span className="text-destructive font-mono">-{(Number(dt?.points || 0) * Number(di.count || 0)).toFixed(2)}</span>
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
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.comments}</p>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-medium">Panel Total</span>
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
