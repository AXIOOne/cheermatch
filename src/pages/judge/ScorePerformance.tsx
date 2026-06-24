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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, Send, Loader2, Play, RotateCcw, Flag } from 'lucide-react';
import { calculateStructuredDeductions, sortByDisplayOrder } from '@/lib/scoring';
import { RubricReferenceSheet } from '@/components/judge/RubricReferenceSheet';

interface FieldScore { field_id: string; points: number; notes: string; }
const sb = supabase as any;

const single = (value: any) => Array.isArray(value) ? value[0] : value;

const getAssignmentPanelAbbrev = (assignment: any): string | null => {
  const panel = single(assignment?.panel);
  const section = single(assignment?.section);
  const abbreviation = panel?.abbreviation || section?.default_panel_abbreviation || section?.abbreviation;
  return abbreviation ? String(abbreviation).toUpperCase() : null;
};

const getAssignmentPanelLabel = (assignment: any): string | null => {
  const panel = single(assignment?.panel);
  const section = single(assignment?.section);
  return panel?.name || section?.name || null;
};

const isAllPanelsAssignment = (assignment: any): boolean => !assignment?.panel_id && !assignment?.section_id;

export default function ScorePerformance() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>({});
  const [skillSelections, setSkillSelections] = useState<Record<string, string>>({}); // skill_id -> option_id
  const [deductionCounts, setDeductionCounts] = useState<Record<string, number>>({});
  const [deductionWarnings, setDeductionWarnings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('video_submissions').select(`
        *, team:teams(id, name, gym_name, athletes_female, athletes_male, division_id, level_id,
          division:divisions(id, name, scoring_template_id), level:levels(name, level_number)),
        event:events(id, name, status, scoring_open_at, scoring_close_at)
      `).eq('id', submissionId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId,
  });

  const OPEN_STATUSES = new Set(['open_for_scoring', 'in_progress']);
  const eventRow: any = (submission as any)?.event;
  const now = Date.now();
  const openAt = eventRow?.scoring_open_at ? new Date(eventRow.scoring_open_at).getTime() : null;
  const closeAt = eventRow?.scoring_close_at ? new Date(eventRow.scoring_close_at).getTime() : null;
  const withinWindow = (openAt == null || now >= openAt) && (closeAt == null || now <= closeAt);
  const eventOpenForScoring = OPEN_STATUSES.has(eventRow?.status) && withinWindow;

  // The judge's assignment for this submission determines which fields they see.
  const { data: judgeAssignments } = useQuery({
    queryKey: ['judge-assignments-for-submission', submission?.event_id, submission?.team_id, user?.id],
    enabled: !!submission?.event_id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('judge_assignments')
        .select(`
          panel_id,
          section_id,
          division_id,
          level_id,
          panel:judge_panels(id, abbreviation, name),
          section:scoring_sections(id, name, abbreviation, default_panel_abbreviation)
        `)
        .eq('event_id', submission!.event_id!)
        .eq('judge_user_id', user!.id);
      if (error) throw error;

      const team = (submission as any)?.team;
      return (data || []).filter((assignment: any) =>
        (!assignment.division_id || assignment.division_id === team?.division_id)
        && (!assignment.level_id || assignment.level_id === team?.level_id)
      );
    },
  });

  const assignedPanelId = useMemo(() => {
    const ids = [...new Set((judgeAssignments || []).map((assignment: any) => assignment.panel_id).filter(Boolean))];
    return ids.length === 1 ? ids[0] : null;
  }, [judgeAssignments]);

  const assignedPanelBadges = useMemo(() => {
    return [...new Map(
      (judgeAssignments || [])
        .map((assignment: any) => {
          if (isAllPanelsAssignment(assignment)) return ['all', 'All panels'];
          const abbreviation = getAssignmentPanelAbbrev(assignment);
          if (!abbreviation) return null;
          const label = getAssignmentPanelLabel(assignment);
          return [abbreviation, label ? `${abbreviation} · ${label}` : abbreviation];
        })
        .filter(Boolean) as [string, string][]
    ).values()];
  }, [judgeAssignments]);

  const divisionTemplateId: string | null = (submission as any)?.team?.division?.scoring_template_id || null;
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['scoring-template-v2', divisionTemplateId, submission?.id],
    queryFn: async () => {
      const baseSelect = `
        *,
        sections:scoring_sections(*,
          fields:scoring_fields(*, options:scoring_field_options(*), panel_links:scoring_field_panels(*),
            skills:scoring_field_skills(*, options:scoring_field_skill_options(*))
          )),
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
    queryKey: ['existing-score', submissionId, user?.id, assignedPanelId],
    queryFn: async () => {
      let q = sb.from('scores').select(`*, details:score_details(*), deduction_items:score_deductions(*), skill_selections:score_skill_selections(*)`)
        .eq('submission_id', submissionId!).eq('judge_user_id', user!.id);
      if (assignedPanelId) q = q.eq('panel_id', assignedPanelId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!submissionId && !!user,
  });

  const assignedPanelAbbrevs = useMemo(() => {
    return new Set(
      (judgeAssignments || [])
        .filter((assignment: any) => !assignment.section_id)
        .map((assignment: any) => getAssignmentPanelAbbrev(assignment))
        .filter(Boolean) as string[]
    );
  }, [judgeAssignments]);

  const assignedSectionIds = useMemo(() => {
    return new Set(
      (judgeAssignments || [])
        .map((assignment: any) => assignment.section_id)
        .filter(Boolean) as string[]
    );
  }, [judgeAssignments]);

  const hasAllPanelsAssignment = useMemo(
    () => (judgeAssignments || []).some((assignment: any) => isAllPanelsAssignment(assignment)),
    [judgeAssignments]
  );

  const visibleSections = useMemo(() => {
    if (!template?.sections) return [] as any[];
    return [...(template.sections as any[])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((s: any) => {
        const fields = ((s.fields as any[]) || [])
          .filter((f: any) => {
            if (hasAllPanelsAssignment) return true;
            if (assignedSectionIds.has(s.id)) return true;
            const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
            if (abbrs.length === 0) return assignedPanelAbbrevs.size > 0;
            if (assignedPanelAbbrevs.size === 0) return false;
            return abbrs.some((abbrev: string) => assignedPanelAbbrevs.has(abbrev));
          })
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
        return { ...s, visibleFields: fields };
      }).filter((s: any) => s.visibleFields.length > 0);
  }, [template, assignedPanelAbbrevs, assignedSectionIds, hasAllPanelsAssignment]);

  useEffect(() => {
    if (!template) return;
    const allFields = visibleSections.flatMap((s: any) => s.visibleFields);
    if (existingScore) {
      const loaded: Record<string, FieldScore> = {};
      (existingScore.details || []).forEach((d: any) => {
        loaded[d.field_id] = { field_id: d.field_id, points: Number(d.points), notes: d.notes || '' };
      });
      setFieldScores(loaded);
      const sel: Record<string, string> = {};
      (existingScore.skill_selections || []).forEach((s: any) => {
        sel[s.skill_id] = s.option_id;
      });
      setSkillSelections(sel);
      const dc: Record<string, number> = {};
      const dw: Record<string, number> = {};
      (existingScore.deduction_items || []).forEach((it: any) => {
        dc[it.deduction_type_id] = it.count || 0;
        dw[it.deduction_type_id] = it.warnings || 0;
      });
      setDeductionCounts(dc);
      setDeductionWarnings(dw);
      setComments(existingScore.comments || '');
    } else {
      const init: Record<string, FieldScore> = {};
      allFields.forEach((f: any) => { init[f.id] = { field_id: f.id, points: 0, notes: '' }; });
      setFieldScores(init);
      setSkillSelections({});
      const dc: Record<string, number> = {};
      const dw: Record<string, number> = {};
      (sortByDisplayOrder((template.deduction_types || []) as any[])).forEach((dt: any) => {
        dc[dt.id] = 0; dw[dt.id] = 0;
      });
      setDeductionCounts(dc);
      setDeductionWarnings(dw);
    }
  }, [template, existingScore, visibleSections]);

  // For difficulty_driver fields, derive field points from selected radio options
  const driverFieldsById = useMemo(() => {
    const map: Record<string, any> = {};
    visibleSections.forEach((s: any) => s.visibleFields.forEach((f: any) => {
      if (f.field_type === 'difficulty_driver') map[f.id] = f;
    }));
    return map;
  }, [visibleSections]);

  useEffect(() => {
    const updates: Record<string, number> = {};
    Object.values(driverFieldsById).forEach((f: any) => {
      const sum = (f.skills || []).reduce((acc: number, sk: any) => {
        const optId = skillSelections[sk.id];
        if (!optId) return acc;
        const opt = (sk.options || []).find((o: any) => o.id === optId);
        return acc + (opt ? Number(opt.value) : 0);
      }, 0);
      updates[f.id] = sum;
    });
    if (Object.keys(updates).length === 0) return;
    setFieldScores(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [fid, pts] of Object.entries(updates)) {
        const cur = prev[fid];
        if (!cur || Number(cur.points) !== pts) {
          next[fid] = { field_id: fid, points: pts, notes: cur?.notes || '' };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [skillSelections, driverFieldsById]);

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
    mutationFn: async (args: { status: 'in_progress' | 'submitted'; needsReview?: boolean; reviewReason?: string | null }) => {
      const { status, needsReview = false, reviewReason = null } = args;
      if (!eventOpenForScoring) {
        throw new Error('This event is not open for scoring yet. The admin must release it before scores can be saved.');
      }
      setIsSaving(true);
      const totalScore = calculateTotalScore();
      const dedTotal = calculateStructuredDeductions((template?.deduction_types || []) as any[], deductionCounts);
      const detailRows = (scoreId: string) =>
        visibleSections.flatMap((s: any) => s.visibleFields)
          .map((field: any) => fieldScores[field.id])
          .filter(Boolean)
          .map(fs => ({
          score_id: scoreId, field_id: fs.field_id,
          points: fs.points, notes: fs.notes || null,
        }));

      const skillRowsFor = (scoreId: string) =>
        Object.entries(skillSelections)
          .filter(([, optId]) => !!optId)
          .map(([skill_id, option_id]) => ({ score_id: scoreId, skill_id, option_id }));

      const reviewFields = status === 'submitted'
        ? { needs_review: needsReview, review_reason: needsReview ? reviewReason : null, reviewed_at: null, reviewed_by: null }
        : {};

      if (existingScore) {
        const { error } = await sb.from('scores').update({
          total_score: totalScore, deductions: dedTotal, comments, status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
          ...reviewFields,
        }).eq('id', existingScore.id);
        if (error) throw error;
        await sb.from('score_details').delete().eq('score_id', existingScore.id);
        const rows = detailRows(existingScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        await sb.from('score_deductions').delete().eq('score_id', existingScore.id);
        const allDedIds = new Set<string>([
          ...Object.keys(deductionCounts),
          ...Object.keys(deductionWarnings),
        ]);
        const deds = Array.from(allDedIds)
          .map((deduction_type_id) => ({
            score_id: existingScore.id,
            deduction_type_id,
            count: deductionCounts[deduction_type_id] || 0,
            warnings: deductionWarnings[deduction_type_id] || 0,
          }))
          .filter((d) => (d.count || 0) > 0 || (d.warnings || 0) > 0);
        if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
      } else {
        const { data: newScore, error } = await sb.from('scores').insert([{
          submission_id: submissionId, judge_user_id: user!.id, template_id: template!.id,
          panel_id: assignedPanelId || null,
          total_score: totalScore, deductions: dedTotal, comments, status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
          ...reviewFields,
        }]).select().single();
        if (error) throw error;
        const rows = detailRows(newScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        const allDedIds = new Set<string>([
          ...Object.keys(deductionCounts),
          ...Object.keys(deductionWarnings),
        ]);
        const deds = Array.from(allDedIds)
          .map((deduction_type_id) => ({
            score_id: newScore.id,
            deduction_type_id,
            count: deductionCounts[deduction_type_id] || 0,
            warnings: deductionWarnings[deduction_type_id] || 0,
          }))
          .filter((d) => (d.count || 0) > 0 || (d.warnings || 0) > 0);
        if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
      }
    },
    onSuccess: (_, args) => {
      queryClient.invalidateQueries({ queryKey: ['existing-score'] });
      queryClient.invalidateQueries({ queryKey: ['judge-scores'] });
      queryClient.invalidateQueries({ queryKey: ['judge-existing-scores'] });
      if (args.status === 'submitted') {
        toast({ title: args.needsReview ? 'Score submitted & flagged for review' : 'Score submitted!' });
        navigate('/judge/queue');
      } else toast({ title: 'Progress saved' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
    onSettled: () => setIsSaving(false),
  });

  const isLoading = submissionLoading || templateLoading;
  const isLocked = existingScore?.status === 'locked' || existingScore?.status === 'submitted' || !eventOpenForScoring;

  useEffect(() => {
    if (existingScore && (existingScore.status === 'submitted' || existingScore.status === 'locked')) {
      toast({
        title: 'Score already submitted',
        description: 'This score has already been submitted. Contact an admin to make changes.',
      });
      navigate('/judge/queue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingScore?.status]);

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
            {assignedPanelBadges.map((panel) => (
              <Badge key={panel} variant="outline" className="ml-2">Panel: {panel}</Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <RubricReferenceSheet eventId={submission.event_id}
              divisionId={(submission.team as any)?.division_id}
              levelId={(submission.team as any)?.level_id} />
            {!isLocked && (
              <>
                <Button variant="outline" onClick={() => saveMutation.mutate({ status: 'in_progress' })} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Draft
                </Button>
                <Button onClick={() => saveMutation.mutate({ status: 'submitted' })} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Score
                </Button>
                <Button
                  variant="outline"
                  className="border-warning text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => { setFlagReason(''); setFlagDialogOpen(true); }}
                  disabled={isSaving}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Submit & Flag
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

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Top row: large video + stacked team info */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
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

          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-lg">Team Information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Team</span><p className="font-medium">{submission.team?.name}</p></div>
              <div><span className="text-muted-foreground">Gym</span><p className="font-medium">{submission.team?.gym_name}</p></div>
              <div><span className="text-muted-foreground">Event</span><p className="font-medium">{submission.event?.name}</p></div>
              <div><span className="text-muted-foreground">Division</span><p className="font-medium">{submission.team?.division?.name}</p></div>
              <div><span className="text-muted-foreground">Level</span><p className="font-medium">Level {submission.team?.level?.level_number}</p></div>
              <div><span className="text-muted-foreground">Athletes</span><p className="font-medium">{(submission.team?.athletes_female ?? 0) + (submission.team?.athletes_male ?? 0)} <span className="text-muted-foreground font-normal">({submission.team?.athletes_female ?? 0}F / {submission.team?.athletes_male ?? 0}M)</span></p></div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom row: scoring fields + comments side panel */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">

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
                        <div key={dt.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{dt.name}</p>
                            <p className="text-xs text-muted-foreground">{Number(dt.points).toFixed(2)} each</p>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] uppercase text-muted-foreground">Count</span>
                              <Input type="number" min={0} step={1}
                                value={deductionCounts[dt.id] || 0}
                                onChange={(e) => setDeductionCounts(prev => ({ ...prev, [dt.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                                className="w-16" disabled={isLocked} />
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] uppercase text-muted-foreground">Warnings</span>
                              <Input type="number" min={0} step={1}
                                value={deductionWarnings[dt.id] || 0}
                                onChange={(e) => setDeductionWarnings(prev => ({ ...prev, [dt.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                                className="w-16" disabled={isLocked} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card className="border-2 border-primary">
                  <CardContent className="py-4 flex items-center justify-between">
                    <span className="font-semibold text-lg">Final Score</span>
                    <span className="text-3xl font-bold text-primary">{calculateTotalScore().toFixed(2)}</span>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Comments side panel */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-24">
              <CardHeader className="pb-2"><CardTitle className="text-base">Judge Comments</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Overall feedback..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={14}
                  disabled={isLocked}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="w-4 h-4 text-warning" /> Flag score for review</DialogTitle>
            <DialogDescription>
              Submit this score and flag it for admin review. Please explain why this score needs a second look.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="flag-reason">Reason for flag</Label>
            <Textarea
              id="flag-reason"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. Unclear performance, possible deduction, scoring uncertainty..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button
              onClick={() => {
                if (!flagReason.trim()) {
                  toast({ variant: 'destructive', title: 'Reason required', description: 'Please describe why this score needs review.' });
                  return;
                }
                setFlagDialogOpen(false);
                saveMutation.mutate({ status: 'submitted', needsReview: true, reviewReason: flagReason.trim() });
              }}
              disabled={isSaving || !flagReason.trim()}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
              Submit & Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}
