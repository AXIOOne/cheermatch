import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScoreInput } from '@/components/ui/score-input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { calculateStructuredDeductions, sortByDisplayOrder } from '@/lib/scoring';
import {
  Play, Pause, Volume2, VolumeX, Maximize2,
  Save, Send, Loader2, CheckCircle, AlertCircle,
  SkipBack, SkipForward, User
} from 'lucide-react';

interface JudgePanel {
  id: string;
  name: string;
  abbreviation: string;
  display_order: number;
}

interface FieldScore { field_id: string; points: number; notes: string; }

interface SubmissionScoringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  eventId: string;
  panels: JudgePanel[];
  initialPanelId?: string | null;
}

const sb = supabase as any;

export default function SubmissionScoringDialog({
  open, onOpenChange, submissionId, eventId, panels, initialPanelId,
}: SubmissionScoringDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>({});
  const [deductionCounts, setDeductionCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (open && initialPanelId) setSelectedPanelId(initialPanelId); }, [open, initialPanelId]);
  useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) setSelectedPanelId(initialPanelId || panels[0].id);
  }, [panels, selectedPanelId, initialPanelId]);

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['admin-submission-detail', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`*, team:teams(id, name, gym_name, athlete_count, division:divisions(id, name, scoring_template_id), level:levels(name, level_number)), event:events(id, name)`)
        .eq('id', submissionId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && open,
  });

  const divisionTemplateId: string | null = submission?.team?.division?.scoring_template_id || null;
  const { data: template } = useQuery({
    queryKey: ['division-scoring-template-v2', divisionTemplateId, submissionId],
    queryFn: async () => {
      const baseSelect = `
        *,
        sections:scoring_sections(
          *,
          fields:scoring_fields(*, options:scoring_field_options(*), panel_links:scoring_field_panels(*))
        ),
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
    enabled: !!submission && open,
  });

  const { data: allScores } = useQuery({
    queryKey: ['submission-all-scores', submissionId],
    queryFn: async () => {
      const { data, error } = await sb.from('scores').select(`
        *,
        details:score_details(*),
        deduction_items:score_deductions(*),
        judge:profiles!scores_judge_user_id_fkey(full_name, email)
      `).eq('submission_id', submissionId!);
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && open,
  });

  const { data: judgeAssignments } = useQuery({
    queryKey: ['event-judge-assignments', eventId],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('judge_assignments').select('*').eq('event_id', eventId);
      if (error) throw error;
      const ids = [...new Set(assignments.map((a: any) => a.judge_user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const map = (profiles || []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
      return assignments.map((a: any) => ({ ...a, judge: map[a.judge_user_id] || null }));
    },
    enabled: !!eventId && open,
  });

  // Resolve each score's effective panel. Falls back to the judge's assignment's
  // panel_id when the score row itself is missing one (older rows from before
  // section assignments were panel-linked).
  const judgePanelByUser = useMemo(() => {
    const map: Record<string, string> = {};
    (judgeAssignments || []).forEach((a: any) => {
      if (a.judge_user_id && a.panel_id) map[a.judge_user_id] = a.panel_id;
    });
    return map;
  }, [judgeAssignments]);

  const resolveScorePanelId = (s: any): string | null =>
    s?.panel_id ?? judgePanelByUser[s?.judge_user_id] ?? null;

  const currentPanelScore = allScores?.find((s: any) => resolveScorePanelId(s) === selectedPanelId);
  const assignedJudge = judgeAssignments?.find((ja: any) => ja.panel_id === selectedPanelId);
  const selectedPanelAbbrev = panels.find(p => p.id === selectedPanelId)?.abbreviation || null;

  // Flatten visible fields for this panel, grouped by section
  const visibleSections = useMemo(() => {
    if (!template?.sections) return [] as any[];
    const sections = [...(template.sections as any[])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return sections.map((s: any) => {
      const fields = ((s.fields as any[]) || [])
        .filter((f: any) => {
          const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
          if (abbrs.length === 0) return true; // unassigned visible to all
          return selectedPanelAbbrev ? abbrs.includes(selectedPanelAbbrev.toUpperCase()) : true;
        })
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
      return { ...s, visibleFields: fields };
    }).filter(s => s.visibleFields.length > 0);
  }, [template, selectedPanelAbbrev]);

  useEffect(() => {
    if (!template?.sections) return;
    const panelScore = allScores?.find((s: any) => s.panel_id === selectedPanelId);
    const allVisibleFields = visibleSections.flatMap((s: any) => s.visibleFields);

    if (panelScore?.details) {
      const loaded: Record<string, FieldScore> = {};
      panelScore.details.forEach((d: any) => {
        loaded[d.field_id] = { field_id: d.field_id, points: Number(d.points), notes: d.notes || '' };
      });
      setFieldScores(loaded);
      const loadedDed: Record<string, number> = {};
      panelScore.deduction_items?.forEach((it: any) => { loadedDed[it.deduction_type_id] = it.count || 0; });
      setDeductionCounts(loadedDed);
      setComments(panelScore.comments || '');
      setNeedsReview(Boolean(panelScore.needs_review));
    } else {
      const init: Record<string, FieldScore> = {};
      allVisibleFields.forEach((f: any) => {
        init[f.id] = { field_id: f.id, points: 0, notes: '' };
      });
      setFieldScores(init);
      const initDed: Record<string, number> = {};
      (sortByDisplayOrder((template.deduction_types || []) as any[])).forEach((dt: any) => { initDed[dt.id] = 0; });
      setDeductionCounts(initDed);
      setComments('');
      setNeedsReview(false);
    }
  }, [selectedPanelId, allScores, template, visibleSections]);

  const updateFieldScore = (fieldId: string, points: number) =>
    setFieldScores(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], field_id: fieldId, points, notes: prev[fieldId]?.notes || '' } }));
  const updateFieldNotes = (fieldId: string, notes: string) =>
    setFieldScores(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], field_id: fieldId, points: prev[fieldId]?.points || 0, notes } }));

  const calculateTotalScore = () => {
    const deductionsTotal = calculateStructuredDeductions((template?.deduction_types || []) as any[], deductionCounts);
    let total = 0;
    visibleSections.forEach((s: any) => {
      s.visibleFields.forEach((f: any) => {
        total += Number(fieldScores[f.id]?.points || 0);
      });
    });
    return Math.max(0, total - deductionsTotal);
  };

  // Video controls
  const togglePlay = () => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); } };
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const handleSeek = (v: number[]) => { if (videoRef.current) { videoRef.current.currentTime = v[0]; setCurrentTime(v[0]); } };
  const skipTime = (s: number) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + s)); };
  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  const saveMutation = useMutation({
    mutationFn: async (status: 'in_progress' | 'submitted') => {
      if (!selectedPanelId || !template || !assignedJudge) throw new Error('Missing required data');
      setIsSaving(true);
      const totalScore = calculateTotalScore();
      const deductionsTotal = calculateStructuredDeductions((template.deduction_types || []) as any[], deductionCounts);

      const detailRows = (scoreId: string) =>
        Object.values(fieldScores).map((fs) => ({
          score_id: scoreId, field_id: fs.field_id,
          points: fs.points, notes: fs.notes || null,
        }));

      if (currentPanelScore) {
        const { error } = await sb.from('scores').update({
          total_score: totalScore, deductions: deductionsTotal, comments,
          status, needs_review: needsReview,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
        }).eq('id', currentPanelScore.id);
        if (error) throw error;
        await sb.from('score_details').delete().eq('score_id', currentPanelScore.id);
        const rows = detailRows(currentPanelScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        await sb.from('score_deductions').delete().eq('score_id', currentPanelScore.id);
        const deds = Object.entries(deductionCounts).filter(([, c]) => (c||0)>0)
          .map(([deduction_type_id, count]) => ({ score_id: currentPanelScore.id, deduction_type_id, count }));
        if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
      } else {
        const { data: newScore, error } = await sb.from('scores').insert([{
          submission_id: submissionId, judge_user_id: assignedJudge.judge_user_id,
          template_id: template.id, panel_id: selectedPanelId,
          total_score: totalScore, deductions: deductionsTotal, comments,
          status, needs_review: needsReview,
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
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ title: status === 'submitted' ? 'Score submitted!' : 'Progress saved' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
    onSettled: () => setIsSaving(false),
  });

  const reviewMutation = useMutation({
    mutationFn: async (markReviewed: boolean) => {
      if (!currentPanelScore) throw new Error('No score to review');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await sb.from('scores').update({
        reviewed_at: markReviewed ? new Date().toISOString() : null,
        reviewed_by: markReviewed ? userData.user?.id ?? null : null,
      }).eq('id', currentPanelScore.id);
      if (error) throw error;
    },
    onSuccess: (_, markReviewed) => {
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ title: markReviewed ? 'Marked as reviewed' : 'Review cleared' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const getPanelStatus = (panelId: string) => {
    const s: any = allScores?.find((x: any) => x.panel_id === panelId);
    if (!s) return 'pending';
    if (s.reviewed_at) return 'reviewed';
    if (s.needs_review) return 'needs_review';
    return s.status;
  };
  const isCurrentPanelLocked = currentPanelScore?.status === 'locked';
  const isCurrentPanelReviewed = Boolean(currentPanelScore?.reviewed_at);
  const isCurrentPanelSubmitted = currentPanelScore?.status === 'submitted';

  if (!submissionId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-4">
            <span>Score Submission</span>
            {submission && (
              <Badge variant="outline" className="font-normal">
                {submission.team?.name} • {submission.team?.gym_name}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {submissionLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Video */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="aspect-video bg-black rounded-t-lg relative">
                      {submission?.video_url ? (
                        <video ref={videoRef} src={submission.video_url} className="w-full h-full rounded-t-lg"
                          onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                          <div className="text-center"><Play className="w-16 h-16 mx-auto mb-2" /><p>Video not available</p></div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <Slider value={[currentTime]} min={0} max={duration || 100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" onClick={() => skipTime(-10)}><SkipBack className="w-4 h-4" /></Button>
                          <Button variant="default" size="icon" onClick={togglePlay}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
                          <Button variant="outline" size="icon" onClick={() => skipTime(10)}><SkipForward className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={toggleMute}>{isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</Button>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
                        <Button variant="ghost" size="icon" onClick={() => videoRef.current?.requestFullscreen()}><Maximize2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Panel Scoring Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {panels.map((panel) => {
                        const status = getPanelStatus(panel.id);
                        const colors: Record<string, string> = {
                          pending: 'bg-destructive text-destructive-foreground',
                          in_progress: 'bg-destructive text-destructive-foreground',
                          submitted: 'bg-success text-success-foreground',
                          needs_review: 'bg-warning text-warning-foreground',
                          locked: 'bg-muted text-muted-foreground',
                          reviewed: 'bg-success text-success-foreground',
                        };
                        const score: any = allScores?.find((s: any) => s.panel_id === panel.id);
                        return (
                          <div key={panel.id}
                            className={`px-3 py-2 rounded-lg text-center cursor-pointer transition-all ${selectedPanelId === panel.id ? 'ring-2 ring-primary ring-offset-2' : ''} ${colors[status] || ''}`}
                            onClick={() => setSelectedPanelId(panel.id)}>
                            <p className="font-bold flex items-center justify-center gap-1">
                              {status === 'reviewed' && <CheckCircle className="w-3.5 h-3.5" />}
                              {panel.abbreviation}
                            </p>
                            {score?.total_score !== null && score?.total_score !== undefined && (
                              <p className="text-xs opacity-90">{Number(score.total_score).toFixed(1)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Scoring Form */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-medium mb-1 block">Scoring Panel</label>
                        <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
                          <SelectTrigger><SelectValue placeholder="Select panel" /></SelectTrigger>
                          <SelectContent>
                            {panels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.abbreviation})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {assignedJudge && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Assigned Judge</p>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {assignedJudge.judge?.full_name || assignedJudge.judge?.email || 'Unassigned'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {!template ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scoring template configured for this event.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {visibleSections.length === 0 && (
                        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No scoring fields are assigned to this panel.
                        </CardContent></Card>
                      )}
                      {visibleSections.map((section: any) => (
                        <Card key={section.id}>
                          <CardHeader className="py-3 pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{section.abbreviation}</Badge>
                              {section.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 py-2">
                            {section.visibleFields.map((f: any) => (
                              <div key={f.id} className="space-y-2 pb-2 border-b last:border-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">{f.name}</p>
                                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">max {Number(f.max_points).toFixed(2)}</div>
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
                                      disabled={isCurrentPanelLocked}
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
                                    disabled={isCurrentPanelLocked}
                                  />
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-destructive">Deductions</label>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total Score</p>
                          <p className="text-3xl font-bold text-primary">{calculateTotalScore().toFixed(2)}</p>
                        </div>
                      </div>

                      {template.deduction_types && template.deduction_types.length > 0 ? (
                        <div className="space-y-2">
                          {sortByDisplayOrder(template.deduction_types as any[]).map((dt: any) => (
                            <div key={dt.id} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{dt.name}</p>
                                <p className="text-xs text-muted-foreground">{Number(dt.points).toFixed(2)} each</p>
                              </div>
                              <Input type="number" min={0} step={1}
                                value={deductionCounts[dt.id] || 0}
                                onChange={(e) => setDeductionCounts(prev => ({ ...prev, [dt.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                                className="w-20" disabled={isCurrentPanelLocked} />
                            </div>
                          ))}
                          <div className="pt-2 border-t flex items-center justify-between">
                            <span className="text-sm font-medium text-destructive">Total deductions</span>
                            <span className="text-sm font-bold text-destructive">
                              {calculateStructuredDeductions(template.deduction_types as any[], deductionCounts).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No deduction types configured.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium">Feedback & Comments</label>
                      <Textarea placeholder="Overall feedback for the team..."
                        value={comments} onChange={(e) => setComments(e.target.value)} rows={3}
                        disabled={isCurrentPanelLocked} className="mt-1" />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border bg-warning/5 border-warning/30">
                      <div>
                        <label htmlFor="needs-review-switch" className="text-sm font-medium cursor-pointer">Flag for review</label>
                        <p className="text-xs text-muted-foreground">Mark as needing review.</p>
                      </div>
                      <Switch id="needs-review-switch" checked={needsReview}
                        onCheckedChange={setNeedsReview} disabled={isCurrentPanelLocked} />
                    </div>

                    <div className="flex gap-2 pt-2">
                      {isCurrentPanelLocked ? (
                        <Badge variant="secondary" className="py-2 px-4">
                          <CheckCircle className="w-4 h-4 mr-2" /> Score Locked
                        </Badge>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => saveMutation.mutate('in_progress')}
                            disabled={isSaving || !assignedJudge} className="flex-1">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Draft
                          </Button>
                          <Button onClick={() => saveMutation.mutate('submitted')}
                            disabled={isSaving || !assignedJudge} className="flex-1">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Submit Score
                          </Button>
                        </>
                      )}
                    </div>

                    {isCurrentPanelSubmitted && (
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-success/5 border-success/30">
                        <div>
                          <p className="text-sm font-medium">
                            {isCurrentPanelReviewed ? 'Reviewed by admin' : 'Mark this panel as reviewed'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isCurrentPanelReviewed
                              ? `Reviewed ${new Date(currentPanelScore!.reviewed_at!).toLocaleString()}`
                              : 'Confirms an admin has verified this score.'}
                          </p>
                        </div>
                        <Button
                          variant={isCurrentPanelReviewed ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => reviewMutation.mutate(!isCurrentPanelReviewed)}
                          disabled={reviewMutation.isPending}
                        >
                          {reviewMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          {isCurrentPanelReviewed ? 'Unmark Reviewed' : 'Mark as Reviewed'}
                        </Button>
                      </div>
                    )}
                    {!assignedJudge && (
                      <p className="text-xs text-destructive text-center">No judge assigned to this panel. Assign a judge first.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
