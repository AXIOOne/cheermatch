import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScoreInput } from '@/components/ui/score-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Send, Loader2, Play, RotateCcw } from 'lucide-react';
import { calculateStructuredDeductions, sortByDisplayOrder } from '@/lib/scoring';
import { RubricReferenceSheet } from '@/components/judge/RubricReferenceSheet';

interface FieldScore { field_id: string; points: number; notes: string; }
const sb = supabase as any;

export default function ScorePerformance() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>({});
  const [deductionCounts, setDeductionCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('video_submissions').select(`
        *, team:teams(id, name, gym_name, athlete_count, division_id, level_id,
          division:divisions(id, name, scoring_template_id), level:levels(name, level_number)),
        event:events(id, name, status)
      `).eq('id', submissionId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const OPEN_STATUSES = new Set(['open_for_scoring', 'in_progress']);
  const eventOpenForScoring = OPEN_STATUSES.has((submission as any)?.event?.status);

  // The judge's panel assignment for this event determines which fields they see
  const { data: judgePanel } = useQuery({
    queryKey: ['judge-panel-for-event', submission?.event_id, user?.id],
    enabled: !!submission?.event_id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select('panel_id, panel:judge_panels(id, abbreviation, name)')
        .eq('event_id', submission!.event_id!)
        .eq('judge_user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      const panel = Array.isArray((data as any)?.panel) ? (data as any).panel[0] : (data as any)?.panel;
      return panel || null;
    },
  });

  const divisionTemplateId: string | null = (submission as any)?.team?.division?.scoring_template_id || null;
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['scoring-template-v2', divisionTemplateId, submission?.id],
    queryFn: async () => {
      const baseSelect = `
        *,
        sections:scoring_sections(*,
          fields:scoring_fields(*, options:scoring_field_options(*), panel_links:scoring_field_panels(*))),
        deduction_types:deduction_types(*)
      `;
      if (divisionTemplateId) {
        const { data, error } = await sb.from('scoring_templates').select(baseSelect).eq('id', divisionTemplateId).maybeSingle();
        if (error) throw error;
        if (data) return data;
      }
      const { data, error } = await sb.from('scoring_templates').select(baseSelect)
        .eq('is_default', true).order('created_at').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submission,
  });

  const { data: existingScore } = useQuery({
    queryKey: ['existing-score', submissionId, user?.id, judgePanel?.id],
    queryFn: async () => {
      let q = sb.from('scores').select(`*, details:score_details(*), deduction_items:score_deductions(*)`)
        .eq('submission_id', submissionId!).eq('judge_user_id', user!.id);
      if (judgePanel?.id) q = q.eq('panel_id', judgePanel.id);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && !!user,
  });

  const panelAbbrev = judgePanel?.abbreviation?.toUpperCase() || null;
  const visibleSections = useMemo(() => {
    if (!template?.sections) return [] as any[];
    return [...(template.sections as any[])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((s: any) => {
        const fields = ((s.fields as any[]) || [])
          .filter((f: any) => {
            const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
            if (abbrs.length === 0) return true;
            return panelAbbrev ? abbrs.includes(panelAbbrev) : true;
          })
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
        return { ...s, visibleFields: fields };
      }).filter((s: any) => s.visibleFields.length > 0);
  }, [template, panelAbbrev]);

  useEffect(() => {
    if (!template) return;
    const allFields = visibleSections.flatMap((s: any) => s.visibleFields);
    if (existingScore) {
      const loaded: Record<string, FieldScore> = {};
      (existingScore.details || []).forEach((d: any) => {
        loaded[d.field_id] = { field_id: d.field_id, points: Number(d.points), notes: d.notes || '' };
      });
      setFieldScores(loaded);
      const dc: Record<string, number> = {};
      (existingScore.deduction_items || []).forEach((it: any) => { dc[it.deduction_type_id] = it.count || 0; });
      setDeductionCounts(dc);
      setComments(existingScore.comments || '');
    } else {
      const init: Record<string, FieldScore> = {};
      allFields.forEach((f: any) => { init[f.id] = { field_id: f.id, points: 0, notes: '' }; });
      setFieldScores(init);
      const dc: Record<string, number> = {};
      (sortByDisplayOrder((template.deduction_types || []) as any[])).forEach((dt: any) => { dc[dt.id] = 0; });
      setDeductionCounts(dc);
    }
  }, [template, existingScore, visibleSections]);

  const updateFieldScore = (id: string, points: number) =>
    setFieldScores(prev => ({ ...prev, [id]: { ...prev[id], field_id: id, points, notes: prev[id]?.notes || '' } }));
  const updateFieldNotes = (id: string, notes: string) =>
    setFieldScores(prev => ({ ...prev, [id]: { ...prev[id], field_id: id, points: prev[id]?.points || 0, notes } }));

  const calculateTotalScore = () => {
    const dedTotal = calculateStructuredDeductions((template?.deduction_types || []) as any[], deductionCounts);
    let total = 0;
    visibleSections.forEach((s: any) => s.visibleFields.forEach((f: any) => {
      total += Number(fieldScores[f.id]?.points || 0);
    }));
    return Math.max(0, total - dedTotal);
  };

  const saveMutation = useMutation({
    mutationFn: async (status: 'in_progress' | 'submitted') => {
      if (!eventOpenForScoring) {
        throw new Error('This event is not open for scoring yet. The admin must release it before scores can be saved.');
      }
      setIsSaving(true);
      const totalScore = calculateTotalScore();
      const dedTotal = calculateStructuredDeductions((template?.deduction_types || []) as any[], deductionCounts);
      const detailRows = (scoreId: string) =>
        Object.values(fieldScores).map(fs => ({
          score_id: scoreId, field_id: fs.field_id,
          points: fs.points, notes: fs.notes || null,
        }));

      if (existingScore) {
        const { error } = await sb.from('scores').update({
          total_score: totalScore, deductions: dedTotal, comments, status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        }).eq('id', existingScore.id);
        if (error) throw error;
        await sb.from('score_details').delete().eq('score_id', existingScore.id);
        const rows = detailRows(existingScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        await sb.from('score_deductions').delete().eq('score_id', existingScore.id);
        const deds = Object.entries(deductionCounts).filter(([, c]) => (c||0)>0)
          .map(([deduction_type_id, count]) => ({ score_id: existingScore.id, deduction_type_id, count }));
        if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
      } else {
        const { data: newScore, error } = await sb.from('scores').insert([{
          submission_id: submissionId, judge_user_id: user!.id, template_id: template!.id,
          panel_id: judgePanel?.id || null,
          total_score: totalScore, deductions: dedTotal, comments, status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        }]).select().single();
        if (error) throw error;
        const rows = detailRows(newScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        const deds = Object.entries(deductionCounts).filter(([, c]) => (c||0)>0)
          .map(([deduction_type_id, count]) => ({ score_id: newScore.id, deduction_type_id, count }));
        if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['existing-score'] });
      queryClient.invalidateQueries({ queryKey: ['judge-scores'] });
      queryClient.invalidateQueries({ queryKey: ['judge-existing-scores'] });
      if (status === 'submitted') { toast({ title: 'Score submitted!' }); navigate('/judge/queue'); }
      else toast({ title: 'Progress saved' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
    onSettled: () => setIsSaving(false),
  });

  const isLoading = submissionLoading || templateLoading;
  const isLocked = existingScore?.status === 'locked' || !eventOpenForScoring;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!submission) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Submission not found</h1>
        <Button className="mt-4" onClick={() => navigate('/judge/queue')}>Back to Queue</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/judge/queue')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">{submission.team?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {submission.team?.gym_name} • {submission.team?.division?.name} • Level {submission.team?.level?.level_number}
              </p>
            </div>
            {judgePanel && (
              <Badge variant="outline" className="ml-2">Panel: {judgePanel.abbreviation}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <RubricReferenceSheet eventId={submission.event_id}
              divisionId={(submission.team as any)?.division_id}
              levelId={(submission.team as any)?.level_id} />
            {!isLocked && (
              <>
                <Button variant="outline" onClick={() => saveMutation.mutate('in_progress')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Draft
                </Button>
                <Button onClick={() => saveMutation.mutate('submitted')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Score
                </Button>
              </>
            )}
            {existingScore?.status === 'locked' && <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">Score Locked</span>}
            {!eventOpenForScoring && existingScore?.status !== 'locked' && (
              <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-sm font-medium">Event not open for scoring</span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black rounded-t-lg flex items-center justify-center">
                  {submission.video_url ? (
                    <video src={submission.video_url} controls className="w-full h-full rounded-t-lg" />
                  ) : (
                    <div className="text-white/50 text-center">
                      <Play className="w-16 h-16 mx-auto mb-2" /><p>Video not available</p>
                    </div>
                  )}
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {submission.duration_seconds
                      ? `${Math.floor(submission.duration_seconds / 60)}:${(submission.duration_seconds % 60).toString().padStart(2, '0')}`
                      : 'Duration unknown'}
                  </div>
                  <Button variant="outline" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Replay</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Team Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Event</span><p className="font-medium">{submission.event?.name}</p></div>
                <div><span className="text-muted-foreground">Division</span><p className="font-medium">{submission.team?.division?.name}</p></div>
                <div><span className="text-muted-foreground">Level</span><p className="font-medium">Level {submission.team?.level?.level_number}</p></div>
                <div><span className="text-muted-foreground">Athletes</span><p className="font-medium">{submission.team?.athlete_count}</p></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {visibleSections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p>No scoring fields available for your panel.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {visibleSections.map((section: any) => (
                  <Card key={section.id}>
                    <CardHeader className="py-3 pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline">{section.abbreviation}</Badge>
                        {section.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {section.visibleFields.map((f: any) => (
                        <div key={f.id} className="space-y-2 border-b last:border-0 pb-3 last:pb-0">
                          <div className="flex justify-between items-baseline">
                            <div>
                              <p className="font-medium text-sm">{f.name}</p>
                              {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground">max {Number(f.max_points).toFixed(2)}</span>
                          </div>
                          {f.field_type === 'dropdown' ? (() => {
                            const resolvePoints = (o: any) => {
                              const v = Number(o.value);
                              if (v) return v;
                              const lbl = parseFloat(String(o.label));
                              return Number.isFinite(lbl) ? lbl : 0;
                            };
                            const opts = (f.options || [])
                              .slice()
                              .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
                            const currentPoints = fieldScores[f.id]?.points;
                            const selectedOpt = opts.find((o: any) => resolvePoints(o) === Number(currentPoints));
                            return (
                              <Select
                                value={selectedOpt?.id ?? undefined}
                                onValueChange={(optId) => {
                                  const picked = opts.find((o: any) => o.id === optId);
                                  if (picked) updateFieldScore(f.id, resolvePoints(picked));
                                }}
                                disabled={isLocked}
                              >
                                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                                <SelectContent>
                                  {opts.map((opt: any) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                      {opt.label} ({resolvePoints(opt)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })() : (
                            <ScoreInput
                              value={fieldScores[f.id]?.points || 0}
                              onChange={(v) => updateFieldScore(f.id, v)}
                              max={Number(f.max_value)}
                              step={Number(f.step) || 0.25}
                              disabled={isLocked}
                            />
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                {template?.deduction_types && template.deduction_types.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">Deductions</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {sortByDisplayOrder(template.deduction_types as any[]).map((dt: any) => (
                        <div key={dt.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{dt.name}</p>
                            <p className="text-xs text-muted-foreground">{Number(dt.points).toFixed(2)} each</p>
                          </div>
                          <Input type="number" min={0} step={1}
                            value={deductionCounts[dt.id] || 0}
                            onChange={(e) => setDeductionCounts(prev => ({ ...prev, [dt.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                            className="w-20" disabled={isLocked} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Comments</Label>
                  <Textarea placeholder="Overall feedback..." value={comments}
                    onChange={(e) => setComments(e.target.value)} rows={3} disabled={isLocked} />
                </div>

                <Card className="border-2 border-primary">
                  <CardContent className="py-4 flex items-center justify-between">
                    <span className="font-semibold text-lg">Final Score</span>
                    <span className="text-3xl font-bold text-primary">{calculateTotalScore().toFixed(2)}</span>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
