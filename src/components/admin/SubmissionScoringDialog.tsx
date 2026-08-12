import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormattedCommentField } from '@/components/ui/formatted-comment-field';
import { ScoreInput } from '@/components/ui/score-input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { calculateStructuredDeductions, sortByDisplayOrder } from '@/lib/scoring';
import {
  Play, Pause, Volume2, VolumeX, Maximize2,
  Save, Send, Loader2, CheckCircle, AlertCircle,
  SkipBack, SkipForward, User, Ban, RotateCcw, Info
} from 'lucide-react';
import ScoreFieldOverrideDialog from '@/components/admin/ScoreFieldOverrideDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  const [skillSelections, setSkillSelections] = useState<Record<string, string>>({});
  const [deductionCounts, setDeductionCounts] = useState<Record<string, number>>({});
  const [deductionWarnings, setDeductionWarnings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);

  useEffect(() => { if (open && initialPanelId) setSelectedPanelId(initialPanelId); }, [open, initialPanelId]);
  useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) setSelectedPanelId(initialPanelId || panels[0].id);
  }, [panels, selectedPanelId, initialPanelId]);

  const { data: submission, isLoading: submissionLoading } = useQuery({
    queryKey: ['admin-submission-detail', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_submissions')
        .select(`*, team:teams(id, name, gym_name, athletes_female, athletes_male, division:divisions(id, name, scoring_template_id), level:levels(name, level_number)), event:events(id, name)`)
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
          fields:scoring_fields(*, options:scoring_field_options(*), panel_links:scoring_field_panels(*),
            skills:scoring_field_skills(*, options:scoring_field_skill_options(*))
          )
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
        skill_selections:score_skill_selections(*)
      `).eq('submission_id', submissionId!);
      if (error) throw error;
      const judgeIds = [...new Set((data || []).map((s: any) => s.judge_user_id).filter(Boolean))];
      let judgeMap: Record<string, any> = {};
      if (judgeIds.length) {
        const { data: profs } = await sb.from('profiles')
          .select('user_id, full_name, email').in('user_id', judgeIds);
        judgeMap = (profs || []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
      }
      return (data || []).map((s: any) => ({ ...s, judge: judgeMap[s.judge_user_id] || null }));
    },
    enabled: !!submissionId && open,
  });

  const scoreIds = useMemo(() => (allScores || []).map((s: any) => s.id), [allScores]);
  const { data: overrides } = useQuery({
    queryKey: ['submission-score-overrides', submissionId, scoreIds.join(',')],
    queryFn: async () => {
      if (!scoreIds.length) return [];
      const { data, error } = await sb.from('score_field_overrides')
        .select('*').in('score_id', scoreIds);
      if (error) throw error;
      const adminIds = [...new Set((data || []).map((o: any) => o.overridden_by).filter(Boolean))];
      let adminMap: Record<string, any> = {};
      if (adminIds.length) {
        const { data: profs } = await sb.from('profiles')
          .select('user_id, full_name, email').in('user_id', adminIds);
        adminMap = (profs || []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
      }
      return (data || []).map((o: any) => ({ ...o, admin: adminMap[o.overridden_by] || null }));
    },
    enabled: !!submissionId && open && scoreIds.length > 0,
  });

  // Lookup: score_id -> field_id -> override row
  const overrideMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {};
    (overrides || []).forEach((o: any) => {
      if (!map[o.score_id]) map[o.score_id] = {};
      map[o.score_id][o.field_id] = o;
    });
    return map;
  }, [overrides]);

  const [overrideTarget, setOverrideTarget] = useState<{ field: any; currentPoints: number } | null>(null);


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
  const isSdPanel = (selectedPanelAbbrev || '').toUpperCase() === 'SD';

  // Flatten visible fields for this panel, grouped by section
  const visibleSections = useMemo(() => {
    if (!template?.sections) return [] as any[];
    // SD (Deductions) panel only enters deductions — no scoring criteria rows.
    if (isSdPanel) return [] as any[];
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
  }, [template, selectedPanelAbbrev, isSdPanel]);

  useEffect(() => {
    if (!template?.sections) return;
    const panelScore = allScores?.find((s: any) => resolveScorePanelId(s) === selectedPanelId);
    const allVisibleFields = visibleSections.flatMap((s: any) => s.visibleFields);

    if (panelScore?.details) {
      const loaded: Record<string, FieldScore> = {};
      panelScore.details.forEach((d: any) => {
        loaded[d.field_id] = { field_id: d.field_id, points: Number(d.points), notes: d.notes || '' };
      });
      setFieldScores(loaded);
      const sel: Record<string, string> = {};
      (panelScore.skill_selections || []).forEach((s: any) => {
        sel[s.skill_id] = s.option_id;
      });
      setSkillSelections(sel);
      const loadedDed: Record<string, number> = {};
      const loadedWarn: Record<string, number> = {};
      panelScore.deduction_items?.forEach((it: any) => {
        loadedDed[it.deduction_type_id] = it.count || 0;
        loadedWarn[it.deduction_type_id] = it.warnings || 0;
      });
      setDeductionCounts(loadedDed);
      setDeductionWarnings(loadedWarn);
      setComments(panelScore.comments || '');
      setNeedsReview(Boolean(panelScore.needs_review));
    } else {
      const init: Record<string, FieldScore> = {};
      allVisibleFields.forEach((f: any) => {
        init[f.id] = { field_id: f.id, points: 0, notes: '' };
      });
      setFieldScores(init);
      setSkillSelections({});
      const initDed: Record<string, number> = {};
      const initWarn: Record<string, number> = {};
      (sortByDisplayOrder((template.deduction_types || []) as any[])).forEach((dt: any) => {
        initDed[dt.id] = 0; initWarn[dt.id] = 0;
      });
      setDeductionCounts(initDed);
      setDeductionWarnings(initWarn);
      setComments('');
      setNeedsReview(false);
    }
  }, [selectedPanelId, allScores, template, visibleSections]);

  // Derive driver field points (difficulty_driver / execution_driver) from selected radio options
  const driverFieldsById = useMemo(() => {
    const map: Record<string, any> = {};
    visibleSections.forEach((s: any) => s.visibleFields.forEach((f: any) => {
      if (f.field_type === 'difficulty_driver' || f.field_type === 'execution_driver') map[f.id] = f;
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
      if (f.field_type === 'execution_driver') {
        const start = Number(f.start_value ?? 0);
        updates[f.id] = Math.max(0, start - sum);
      } else {
        updates[f.id] = sum;
      }
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

  // Auto-generate a comments block from execution_driver selections.
  const autoCommentsRef = useRef('');
  useEffect(() => {
    const execFields = Object.values(driverFieldsById).filter(
      (f: any) => f.field_type === 'execution_driver'
    );
    const blocks: string[] = [];
    execFields.forEach((f: any) => {
      const lines: string[] = [];
      (f.skills || [])
        .slice()
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .forEach((sk: any) => {
          const optId = skillSelections[sk.id];
          if (!optId) return;
          const opt = (sk.options || []).find((o: any) => o.id === optId);
          if (!opt) return;
          const val = Number(opt.value);
          if (!val) return;
          lines.push(`**${sk.name}: -${val}**`);
        });
      if (lines.length > 0) {
        blocks.push(`**__${f.name}__**\n${lines.join('\n')}`);
      }
    });
    const newAuto = blocks.length > 0 ? blocks.join('\n\n') : '';
    setComments(prev => {
      const prevAuto = autoCommentsRef.current;
      let userPart = prev;
      if (prevAuto && prev.endsWith(prevAuto)) {
        userPart = prev.slice(0, prev.length - prevAuto.length).replace(/\n+$/, '');
      }
      const next = newAuto
        ? (userPart ? `${userPart}\n\n${newAuto}` : newAuto)
        : userPart;
      autoCommentsRef.current = newAuto;
      return next === prev ? prev : next;
    });
  }, [skillSelections, driverFieldsById]);

  const updateFieldScore = (fieldId: string, points: number) =>
    setFieldScores(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], field_id: fieldId, points, notes: prev[fieldId]?.notes || '' } }));
  const updateFieldNotes = (fieldId: string, notes: string) =>
    setFieldScores(prev => ({ ...prev, [fieldId]: { ...prev[fieldId], field_id: fieldId, points: prev[fieldId]?.points || 0, notes } }));

  const calculateRawScore = () => {
    let total = 0;
    visibleSections.forEach((s: any) => {
      s.visibleFields.forEach((f: any) => {
        total += Number(fieldScores[f.id]?.points || 0);
      });
    });
    return total;
  };
  const calculateTotalMax = () => {
    let total = 0;
    visibleSections.forEach((s: any) => {
      s.visibleFields.forEach((f: any) => {
        total += Number(f.max_points || 0);
      });
    });
    return total;
  };
  const calculateTotalScore = () => {
    const deductionsTotal = isSdPanel
      ? calculateStructuredDeductions((template?.deduction_types || []) as any[], deductionCounts)
      : 0;
    const raw = calculateRawScore();
    const max = calculateTotalMax();
    const perfection = max > 0 ? (raw / max) * 100 - deductionsTotal : 0;
    return Math.max(0, perfection);
  };

  // Video controls
  const togglePlay = () => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); } };
  const toggleMute = () => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } };
  const handleSeek = (v: number[]) => { if (videoRef.current) { videoRef.current.currentTime = v[0]; setCurrentTime(v[0]); } };
  const skipTime = (s: number) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + s)); };
  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  const saveMutation = useMutation({
    mutationFn: async (args: { markReviewed: boolean }) => {
      if (!selectedPanelId || !template) throw new Error('Missing required data');
      setIsSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const adminUserId = userData.user?.id ?? null;
      const totalScore = calculateTotalScore();
      const deductionsTotal = isSdPanel
        ? calculateStructuredDeductions((template.deduction_types || []) as any[], deductionCounts)
        : 0;

      const detailRows = (scoreId: string) =>
        Object.values(fieldScores).map((fs) => ({
          score_id: scoreId, field_id: fs.field_id,
          points: fs.points, notes: fs.notes || null,
        }));

      const skillRowsFor = (scoreId: string) =>
        Object.entries(skillSelections)
          .filter(([, optId]) => !!optId)
          .map(([skill_id, option_id]) => ({ score_id: scoreId, skill_id, option_id }));

      const reviewFields = args.markReviewed
        ? { reviewed_at: new Date().toISOString(), reviewed_by: adminUserId }
        : {};

      if (currentPanelScore) {
        const { error } = await sb.from('scores').update({
          total_score: totalScore, deductions: deductionsTotal, comments,
          status: 'submitted', needs_review: needsReview,
          submitted_at: new Date().toISOString(),
          ...reviewFields,
        }).eq('id', currentPanelScore.id);
        if (error) throw error;
        await sb.from('score_details').delete().eq('score_id', currentPanelScore.id);
        const rows = detailRows(currentPanelScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        await sb.from('score_deductions').delete().eq('score_id', currentPanelScore.id);
        if (isSdPanel) {
          const allDedIds = new Set<string>([
            ...Object.keys(deductionCounts),
            ...Object.keys(deductionWarnings),
          ]);
          const deds = Array.from(allDedIds)
            .map((deduction_type_id) => ({
              score_id: currentPanelScore.id,
              deduction_type_id,
              count: deductionCounts[deduction_type_id] || 0,
              warnings: deductionWarnings[deduction_type_id] || 0,
            }))
            .filter((d) => (d.count || 0) > 0 || (d.warnings || 0) > 0);
          if (deds.length) { const { error: ee } = await sb.from('score_deductions').insert(deds); if (ee) throw ee; }
        }
        await sb.from('score_skill_selections').delete().eq('score_id', currentPanelScore.id);
        const skSel = skillRowsFor(currentPanelScore.id);
        if (skSel.length) {
          const { error: sErr } = await sb.from('score_skill_selections').insert(skSel);
          if (sErr) throw sErr;
        }
      } else {
        const judgeUserId = assignedJudge?.judge_user_id ?? adminUserId;
        if (!judgeUserId) throw new Error('Could not determine score author');
        const { data: newScore, error } = await sb.from('scores').insert([{
          submission_id: submissionId, judge_user_id: judgeUserId,
          template_id: template.id, panel_id: selectedPanelId,
          total_score: totalScore, deductions: deductionsTotal, comments,
          status: 'submitted', needs_review: needsReview,
          submitted_at: new Date().toISOString(),
          ...reviewFields,
        }]).select().single();
        if (error) throw error;
        const rows = detailRows(newScore.id);
        if (rows.length) {
          const { error: dErr } = await sb.from('score_details').insert(rows);
          if (dErr) throw dErr;
        }
        if (isSdPanel) {
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
        const skSel = skillRowsFor(newScore.id);
        if (skSel.length) {
          const { error: sErr } = await sb.from('score_skill_selections').insert(skSel);
          if (sErr) throw sErr;
        }
      }

      // Re-apply any admin overrides on top of the freshly saved score.
      const targetScoreId = currentPanelScore?.id;
      if (targetScoreId) {
        const { data: ovs } = await sb.from('score_field_overrides')
          .select('field_id, new_points, original_points').eq('score_id', targetScoreId);
        if (ovs && ovs.length) {
          // Zero out detail rows for overridden fields and recompute total
          for (const o of ovs) {
            await sb.from('score_details').update({ points: Number(o.new_points || 0) })
              .eq('score_id', targetScoreId).eq('field_id', o.field_id);
          }
          // Recompute total_score from current detail rows
          const tplFields: any[] = (template?.sections || []).flatMap((s: any) => s.fields || []);
          const panelAbbr = (panels.find(p => p.id === selectedPanelId)?.abbreviation || '').toUpperCase();
          const visible = tplFields.filter((f: any) => {
            const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
            if (abbrs.length === 0) return true;
            return abbrs.includes(panelAbbr);
          });
          const maxTotal = visible.reduce((s: number, f: any) => s + Number(f.max_points || 0), 0);
          const { data: freshDetails } = await sb.from('score_details')
            .select('field_id, points').eq('score_id', targetScoreId);
          const raw = (freshDetails || [])
            .filter((d: any) => visible.some((f: any) => f.id === d.field_id))
            .reduce((s: number, d: any) => s + Number(d.points || 0), 0);
          const perfection = maxTotal > 0 ? Math.max(0, (raw / maxTotal) * 100 - deductionsTotal) : 0;
          await sb.from('scores').update({ total_score: perfection }).eq('id', targetScoreId);
        }
      }
    },
    onSuccess: (_, args) => {
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ title: args.markReviewed ? 'Score saved & marked reviewed' : 'Score saved' });
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

  // Re-open a submitted/locked panel score so the assigned judge can edit and resubmit
  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!currentPanelScore) throw new Error('No score to re-open');
      const { error } = await sb.from('scores').update({
        status: 'in_progress',
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        needs_review: false,
        review_reason: null,
      }).eq('id', currentPanelScore.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      setReopenConfirmOpen(false);
      toast({ title: 'Re-opened for scoring', description: 'The assigned judge can now edit and resubmit this panel.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Re-open failed', description: e.message }),
  });


  // Recompute and persist a score's total after an override is added/removed.
  const recomputeScoreTotal = async (scoreId: string) => {
    const score: any = allScores?.find((s: any) => s.id === scoreId);
    if (!score) return;
    // Re-fetch latest overrides for this score
    const { data: ovs } = await sb.from('score_field_overrides')
      .select('field_id, new_points').eq('score_id', scoreId);
    const ovMap: Record<string, number> = {};
    (ovs || []).forEach((o: any) => { ovMap[o.field_id] = Number(o.new_points || 0); });
    // Sum effective points for the visible template fields (use this panel's visible fields).
    const tplFields: any[] = (template?.sections || []).flatMap((s: any) => s.fields || []);
    const panelAbbr = (panels.find(p => p.id === resolveScorePanelId(score))?.abbreviation || '').toUpperCase();
    const visibleForPanel = tplFields.filter((f: any) => {
      const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
      if (abbrs.length === 0) return true;
      return abbrs.includes(panelAbbr);
    });
    let max = 0;
    let raw = 0;
    visibleForPanel.forEach((f: any) => {
      max += Number(f.max_points || 0);
      const detail = (score.details || []).find((d: any) => d.field_id === f.id);
      const original = Number(detail?.points || 0);
      const effective = f.id in ovMap ? ovMap[f.id] : original;
      raw += effective;
    });
    const ded = Number(score.deductions || 0);
    const perfection = max > 0 ? Math.max(0, (raw / max) * 100 - ded) : 0;
    await sb.from('scores').update({ total_score: perfection }).eq('id', scoreId);
  };

  const applyOverrideMutation = useMutation({
    mutationFn: async ({ scoreId, field, currentPoints, reason }: { scoreId: string; field: any; currentPoints: number; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;
      if (!adminId) throw new Error('Not authenticated');
      const { error } = await sb.from('score_field_overrides').upsert({
        score_id: scoreId,
        field_id: field.id,
        original_points: currentPoints,
        new_points: 0,
        reason,
        overridden_by: adminId,
      }, { onConflict: 'score_id,field_id' });
      if (error) throw error;
      await recomputeScoreTotal(scoreId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-score-overrides', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ title: 'Score overridden to 0' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Override failed', description: e.message }),
  });

  const removeOverrideMutation = useMutation({
    mutationFn: async ({ scoreId, fieldId }: { scoreId: string; fieldId: string }) => {
      const { error } = await sb.from('score_field_overrides').delete()
        .eq('score_id', scoreId).eq('field_id', fieldId);
      if (error) throw error;
      await recomputeScoreTotal(scoreId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission-score-overrides', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-all-scores', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['event-submissions-scoring', eventId] });
      toast({ title: 'Override removed' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Remove failed', description: e.message }),
  });

  const getPanelStatus = (panelId: string) => {
    const s: any = allScores?.find((x: any) => resolveScorePanelId(x) === panelId);
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
          <DialogTitle className="flex items-center gap-4 flex-wrap pr-8">
            <span>Score Submission</span>
            {submission && (
              <Badge variant="outline" className="font-normal">
                {submission.team?.name} • {submission.team?.gym_name}
              </Badge>
            )}
            {selectedPanelId && (
              <Badge variant="secondary" className="font-normal gap-1">
                <User className="w-3 h-3" />
                {panels.find(p => p.id === selectedPanelId)?.abbreviation || 'Panel'}:{' '}
                {assignedJudge?.judge?.full_name || assignedJudge?.judge?.email || 'Unassigned'}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              {isCurrentPanelSubmitted ? (
                isCurrentPanelReviewed ? (
                  <>
                    <span className="text-xs text-muted-foreground font-normal">
                      Reviewed {new Date(currentPanelScore!.reviewed_at!).toLocaleString()}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => reviewMutation.mutate(false)}
                      disabled={reviewMutation.isPending}
                    >
                      {reviewMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Unmark Reviewed
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => reviewMutation.mutate(true)}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Mark as Reviewed
                  </Button>
                )
              ) : (
                <span className="text-xs text-muted-foreground font-normal">
                  Submit this panel's score before it can be reviewed.
                </span>
              )}
              {(isCurrentPanelSubmitted || isCurrentPanelLocked) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-warning text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => setReopenConfirmOpen(true)}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Re-open for Scoring
                </Button>
              )}
            </div>
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
                    {(() => {
                      const url = submission?.video_url || '';
                      const isEmbed = /players\.brightcove\.net|player\.vimeo\.com|youtube\.com\/embed|youtu\.be/.test(url);
                      if (!url) {
                        return (
                          <div className="aspect-video bg-black rounded-t-lg flex items-center justify-center text-white/50">
                            <div className="text-center"><Play className="w-16 h-16 mx-auto mb-2" /><p>Video not available</p></div>
                          </div>
                        );
                      }
                      if (isEmbed) {
                        return (
                          <div className="aspect-video bg-black rounded-t-lg overflow-hidden">
                            <iframe
                              src={url}
                              className="w-full h-full"
                              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="aspect-video bg-black rounded-t-lg relative">
                            <video ref={videoRef} src={url} className="w-full h-full rounded-t-lg"
                              onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
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
                        </>
                      );
                    })()}
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
                          in_progress: 'bg-primary text-primary-foreground',
                          submitted: 'bg-success text-success-foreground',
                          needs_review: 'bg-warning text-warning-foreground',
                          locked: 'bg-muted text-muted-foreground',
                          reviewed: 'bg-success text-success-foreground',
                        };
                        const score: any = allScores?.find((s: any) => resolveScorePanelId(s) === panel.id);
                        const panelAbbr = (panel.abbreviation || '').toUpperCase();
                        const panelMax = (template?.sections || []).reduce((sum: number, sec: any) => {
                          const fields = (sec.fields || []).filter((f: any) => {
                            const abbrs = (f.panel_links || []).map((p: any) => p.panel_abbreviation?.toUpperCase());
                            if (abbrs.length === 0) return true;
                            return abbrs.includes(panelAbbr);
                          });
                          return sum + fields.reduce((a: number, f: any) => a + Number(f.max_points || 0), 0);
                        }, 0);
                        const panelRaw = (score?.details || []).reduce((a: number, d: any) => a + Number(d.points || 0), 0);
                        return (
                          <div key={panel.id}
                            className={`px-3 py-2 rounded-lg text-center cursor-pointer transition-all ${selectedPanelId === panel.id ? 'ring-2 ring-primary ring-offset-2' : ''} ${colors[status] || ''}`}
                            onClick={() => setSelectedPanelId(panel.id)}>
                            <p className="font-bold flex items-center justify-center gap-1">
                              {status === 'reviewed' && <CheckCircle className="w-3.5 h-3.5" />}
                              {panel.abbreviation}
                            </p>
                            {score && (
                              <p className="text-xs opacity-90">{panelRaw.toFixed(2)} / {panelMax.toFixed(2)}</p>
                            )}
                            {status === 'in_progress' && (
                              <p className="text-[10px] font-medium uppercase tracking-wide opacity-90">Draft</p>
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

                {currentPanelScore?.status === 'in_progress' && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
                    <p className="text-sm font-medium text-primary">
                      Draft preview — this judge saved their work but has not submitted the score.
                    </p>
                    {currentPanelScore?.updated_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last saved {new Date(currentPanelScore.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}


                {!template ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scoring template configured for this event.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {currentPanelScore?.needs_review && !currentPanelScore?.reviewed_at && (
                      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-warning shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-warning">Flagged by judge for review</p>
                          {currentPanelScore?.review_reason ? (
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{currentPanelScore.review_reason}</p>
                          ) : (
                            <p className="text-muted-foreground mt-1">No reason provided.</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {visibleSections.length === 0 && !isSdPanel && (
                        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No scoring fields are assigned to this panel.
                        </CardContent></Card>
                      )}
                      {isSdPanel && (
                        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
                          This is the Deductions panel — enter deductions in the panel on the right.
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
                            {section.visibleFields.map((f: any) => {
                              const ov = currentPanelScore ? overrideMap[currentPanelScore.id]?.[f.id] : null;
                              return (
                              <div key={f.id} className={`space-y-2 pb-2 border-b last:border-0 ${ov ? 'bg-destructive/5 -mx-2 px-2 rounded' : ''}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{f.name}</p>
                                    {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                                    {f.field_type === 'execution_driver' && (
                                      <p className="text-xs text-muted-foreground">
                                        Start: {Number(f.start_value ?? 0).toFixed(2)}
                                      </p>
                                    )}
                                    {ov && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <p className="text-[11px] font-semibold text-destructive mt-1 inline-flex items-center gap-1 cursor-help">
                                              <Ban className="w-3 h-3" />
                                              Overridden to 0 (was {Number(ov.original_points).toFixed(2)})
                                              <Info className="w-3 h-3" />
                                            </p>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <p className="text-xs"><strong>Reason:</strong> {ov.reason}</p>
                                            {ov.admin && <p className="text-xs mt-1 text-muted-foreground">By {ov.admin.full_name || ov.admin.email}</p>}
                                            <p className="text-xs text-muted-foreground">{new Date(ov.overridden_at || ov.created_at).toLocaleString()}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right text-xs text-muted-foreground">
                                      {(f.field_type === 'difficulty_driver' || f.field_type === 'execution_driver') && (
                                        <span className={`text-sm font-semibold mr-2 ${ov ? 'text-destructive line-through' : 'text-foreground'}`}>{Number(fieldScores[f.id]?.points || 0).toFixed(2)}</span>
                                      )}
                                      max {Number(f.max_points).toFixed(2)}
                                    </div>
                                    {currentPanelScore && (
                                      ov ? (
                                        <Button
                                          variant="ghost" size="sm"
                                          className="h-7 px-2 text-xs"
                                          onClick={() => removeOverrideMutation.mutate({ scoreId: currentPanelScore.id, fieldId: f.id })}
                                          disabled={removeOverrideMutation.isPending}
                                        >
                                          <RotateCcw className="w-3 h-3 mr-1" /> Undo
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost" size="sm"
                                          className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => setOverrideTarget({ field: f, currentPoints: Number(fieldScores[f.id]?.points || 0) })}
                                        >
                                          <Ban className="w-3 h-3 mr-1" /> Override → 0
                                        </Button>
                                      )
                                    )}
                                  </div>
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
                                })() : (f.field_type === 'difficulty_driver' || f.field_type === 'execution_driver') ? (
                                  <div className="space-y-2">
                                    {(f.skills || [])
                                      .slice()
                                      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
                                      .map((sk: any) => {
                                        const opts = (sk.options || [])
                                          .slice()
                                          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
                                        const selected = skillSelections[sk.id];
                                        const isExec = f.field_type === 'execution_driver';
                                        return (
                                          <div key={sk.id} className="rounded-md border p-2">
                                            <p className="text-xs font-medium mb-2">{sk.name}</p>
                                            <RadioGroup
                                              value={selected || '__none__'}
                                              onValueChange={(val) => setSkillSelections(prev => {
                                                const next = { ...prev };
                                                if (val === '__none__') delete next[sk.id];
                                                else next[sk.id] = val;
                                                return next;
                                              })}
                                              disabled={isCurrentPanelLocked}
                                              className="flex flex-wrap gap-3"
                                            >
                                              {isExec && (
                                                <label
                                                  htmlFor={`adm-sk-${sk.id}-none`}
                                                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                                                >
                                                  <RadioGroupItem id={`adm-sk-${sk.id}-none`} value="__none__" />
                                                  <span>None</span>
                                                </label>
                                              )}
                                              {opts.map((opt: any) => (
                                                <label
                                                  key={opt.id}
                                                  htmlFor={`adm-sk-${sk.id}-${opt.id}`}
                                                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                                                >
                                                  <RadioGroupItem id={`adm-sk-${sk.id}-${opt.id}`} value={opt.id} />
                                                  <span>{opt.label}</span>
                                                  <span className="text-muted-foreground">
                                                    ({isExec ? '−' : ''}{Number(opt.value)})
                                                  </span>
                                                </label>
                                              ))}
                                            </RadioGroup>
                                          </div>
                                        );
                                      })}
                                  </div>
                                ) : (
                                  <ScoreInput
                                    value={fieldScores[f.id]?.points || 0}
                                    onChange={(v) => updateFieldScore(f.id, v)}
                                    max={Number(f.max_value)}
                                    step={Number(f.step) || 0.25}
                                    disabled={isCurrentPanelLocked}
                                  />
                                )}
                              </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Separator />

                    {isSdPanel ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-destructive">Deductions</label>
                          <div className="text-right space-y-0.5">
                            <p className="text-sm text-muted-foreground">Total Points</p>
                            <p className="text-3xl font-bold text-primary">{calculateRawScore().toFixed(2)} / {calculateTotalMax().toFixed(2)}</p>
                          </div>
                        </div>


                        {template.deduction_types && template.deduction_types.length > 0 ? (
                          <div className="space-y-2">
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
                                      className="w-16" disabled={isCurrentPanelLocked} />
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[10px] uppercase text-muted-foreground">Warnings</span>
                                    <Input type="number" min={0} step={1}
                                      value={deductionWarnings[dt.id] || 0}
                                      onChange={(e) => setDeductionWarnings(prev => ({ ...prev, [dt.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                                      className="w-16" disabled={isCurrentPanelLocked} />
                                  </div>
                                </div>
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
                    ) : (
                      <div className="flex items-center justify-end">
                        <div className="text-right space-y-0.5">
                          <p className="text-sm text-muted-foreground">Total Points</p>
                          <p className="text-3xl font-bold text-primary">{calculateRawScore().toFixed(2)} / {calculateTotalMax().toFixed(2)}</p>
                        </div>
                      </div>

                    )}

                    <div>
                      <label className="text-sm font-medium">Feedback & Comments</label>
                      <FormattedCommentField placeholder="Overall feedback for the team..."
                        value={comments} onChange={setComments} rows={3}
                        disabled={isCurrentPanelLocked} className="mt-1" toolbarClassName="mt-1" />
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
                          <Button variant="outline" onClick={() => saveMutation.mutate({ markReviewed: false })}
                            disabled={isSaving} className="flex-1">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Score
                          </Button>
                          <Button onClick={() => saveMutation.mutate({ markReviewed: true })}
                            disabled={isSaving} className="flex-1">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Save & Mark as Reviewed
                          </Button>
                        </>
                      )}
                    </div>

                    {!assignedJudge && (
                      <p className="text-xs text-muted-foreground text-center">
                        No judge assigned to this panel — saving will record the score under your admin account.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      <ScoreFieldOverrideDialog
        open={!!overrideTarget}
        onOpenChange={(o) => { if (!o) setOverrideTarget(null); }}
        fieldName={overrideTarget?.field?.name || ''}
        currentPoints={overrideTarget?.currentPoints || 0}
        maxPoints={Number(overrideTarget?.field?.max_points || 0)}
        onConfirm={async (reason) => {
          if (!overrideTarget || !currentPanelScore) return;
          await applyOverrideMutation.mutateAsync({
            scoreId: currentPanelScore.id,
            field: overrideTarget.field,
            currentPoints: overrideTarget.currentPoints,
            reason,
          });
          setOverrideTarget(null);
        }}
      />
    </Dialog>
  );
}
