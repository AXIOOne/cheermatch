import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';
import { pickDivisionTemplateId, isFieldForPanel } from '@/lib/scoring';
import { cn } from '@/lib/utils';

const sb = supabase as any;
const single = (v: any) => (Array.isArray(v) ? v[0] : v);

interface Props {
  eventId: string;
  discipline?: string | null;
  panelId: string | null;
  currentSubmissionId: string;
  /** Rendered inside the side drawer: no card chrome, compact header. */
  embedded?: boolean;
  /** Embedded only: shows a collapse control in the header row. */
  onClose?: () => void;
}

/**
 * Judge-only view of their own scores across every team assigned to them in
 * this event, grouped by division, with one column per field in their panel.
 * Submitted = success color, draft = warning color.
 */
export function ScoreTrackingTable({ eventId, discipline, panelId, currentSubmissionId, embedded = false, onClose }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['score-tracking', eventId, user?.id, panelId],
    enabled: !!user?.id && !!eventId,
    queryFn: async () => {
      let aq = sb.from('judge_assignments')
        .select('panel_id, section_id, division_id, level_id, panel:judge_panels(abbreviation), section:scoring_sections(id, abbreviation, default_panel_abbreviation)')
        .eq('event_id', eventId).eq('judge_user_id', user!.id);
      const { data: assignmentsRaw, error: aErr } = await aq;
      if (aErr) throw aErr;
      const assignments = ((assignmentsRaw || []) as any[]).filter((a) => !panelId || a.panel_id === panelId || (!a.panel_id && !a.section_id));

      const { data: subs, error: sErr } = await sb.from('video_submissions')
        .select(`id, status, team:teams(id, name, gym_name, division_id, level_id,
          division:divisions(id, name, scoring_template_id, discipline_links:division_disciplines(discipline, scoring_template_id)))`)
        .eq('event_id', eventId)
        .in('status', ['approved', 'assigned', 'complete'])
        .is('archived_at', null)
        .not('team_id', 'is', null);
      if (sErr) throw sErr;

      const visible = ((subs || []) as any[]).filter((s) => {
        const t = s.team;
        if (!t) return false;
        return assignments.some((a) => (!a.division_id || a.division_id === t.division_id) && (!a.level_id || a.level_id === t.level_id));
      });

      const templateIds = [...new Set(visible.map((s) => pickDivisionTemplateId(s.team?.division, discipline)).filter(Boolean))] as string[];
      let templates: any[] = [];
      if (templateIds.length) {
        const { data: tpl, error: tErr } = await sb.from('scoring_templates')
          .select('id, sections:scoring_sections(id, display_order, fields:scoring_fields(id, name, display_order, section_id, panel_links:scoring_field_panels(panel_abbreviation)))')
          .in('id', templateIds);
        if (tErr) throw tErr;
        templates = tpl || [];
      }

      let scores: any[] = [];
      if (visible.length) {
        let q = sb.from('scores')
          .select('id, submission_id, panel_id, status, total_score, details:score_details(field_id, points)')
          .eq('judge_user_id', user!.id)
          .in('submission_id', visible.map((s) => s.id));
        if (panelId) q = q.eq('panel_id', panelId);
        const { data: sc, error: scErr } = await q;
        if (scErr) throw scErr;
        scores = sc || [];
      }
      return { assignments, visible, templates, scores };
    },
  });

  const sdOnly = useMemo(() => {
    if (!data) return false;
    const { assignments } = data;
    if (!assignments.length) return false;
    const allPanels = assignments.some((a: any) => !a.panel_id && !a.section_id);
    if (allPanels) return false;
    const panelAbbrevs = new Set(assignments.map((a: any) => single(a.panel)?.abbreviation?.toUpperCase()).filter(Boolean));
    const sectionIds = new Set(assignments.map((a: any) => a.section_id).filter(Boolean));
    // Pure deductions (SD) panel assignment: no score tracking table.
    return panelAbbrevs.size === 1 && panelAbbrevs.has('SD') && sectionIds.size === 0;
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const { assignments, visible, templates, scores } = data;
    const allPanels = assignments.some((a: any) => !a.panel_id && !a.section_id);
    const panelAbbrevs = new Set(assignments.map((a: any) => single(a.panel)?.abbreviation?.toUpperCase()).filter(Boolean));
    const sectionIds = new Set(assignments.map((a: any) => a.section_id).filter(Boolean));
    const isSd = panelAbbrevs.has('SD') && !allPanels;
    const tplMap = new Map(templates.map((t: any) => [t.id, t]));

    const columnsFor = (templateId: string | null) => {
      const tpl: any = templateId ? tplMap.get(templateId) : null;
      if (!tpl || isSd) return [] as { name: string; fieldIds: string[] }[];
      const cols = new Map<string, string[]>();
      [...(tpl.sections || [])].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)).forEach((sec: any) => {
        [...(sec.fields || [])].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)).forEach((f: any) => {
          const ok = allPanels || sectionIds.has(sec.id) || [...panelAbbrevs].some((p) => isFieldForPanel(f, p as string));
          if (!ok) return;
          const key = String(f.name || '').trim();
          cols.set(key, [...(cols.get(key) || []), f.id]);
        });
      });
      return [...cols.entries()].map(([name, fieldIds]) => ({ name, fieldIds }));
    };

    const byDivision = new Map<string, any>();
    visible.forEach((s: any) => {
      const div = s.team?.division;
      const key = div?.id || 'none';
      const templateId = pickDivisionTemplateId(div, discipline);
      if (!byDivision.has(key)) byDivision.set(key, { id: key, name: div?.name || 'No division', columns: columnsFor(templateId), rows: [] });
      const score = scores.find((sc: any) => sc.submission_id === s.id);
      byDivision.get(key).rows.push({
        submissionId: s.id,
        teamName: s.team?.name?.trim() || s.team?.gym_name || 'Unnamed team',
        gymName: s.team?.name?.trim() ? s.team?.gym_name : null,
        score,
      });
    });
    return [...byDivision.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ ...g, rows: g.rows.sort((a: any, b: any) => a.teamName.localeCompare(b.teamName)) }));
  }, [data, discipline]);

  const cellValue = (score: any, fieldIds: string[]) => {
    if (!score) return null;
    const pts = (score.details || []).filter((d: any) => fieldIds.includes(d.field_id));
    if (!pts.length) return null;
    return pts.reduce((sum: number, d: any) => sum + Number(d.points || 0), 0);
  };

  const fmt = (n: number | null | undefined) => (n == null ? '–' : Number(n).toFixed(2).replace(/\.?0+$/, ''));

  if (sdOnly) return null;

  const toggleGroup = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const legend = (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="tabular-nums font-semibold text-success">9.75</span> Submitted</span>
      <span className="flex items-center gap-1"><span className="tabular-nums font-semibold text-warning">9.50</span> Draft</span>
    </div>
  );

  const body = (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assigned teams in this event yet.</p>
      ) : groups.map((g) => {
          const isOpen = expanded.has(g.id);
          const scoredCount = g.rows.filter((r: any) => r.score).length;
          return (
            <div key={g.id} className="rounded-md border">
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold hover:bg-muted/50 rounded-md"
              >
                <span className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  {g.name}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{scoredCount}/{g.rows.length} scored</span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-xs table-fixed">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left font-medium px-2 py-1.5 sticky left-0 bg-muted/50 w-[160px]">Team</th>
                        {g.columns.map((c: any) => (
                          <th key={c.name} className="text-center font-medium px-2 py-1.5 w-[110px] whitespace-normal break-words">{c.name}</th>
                        ))}
                        <th className="text-center font-semibold px-2 py-1.5 w-[72px]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r: any) => {
                        const st = r.score?.status;
                        const tone = st === 'submitted' || st === 'locked' ? 'text-success' : st === 'in_progress' ? 'text-warning' : '';
                        const isCurrent = r.submissionId === currentSubmissionId;
                        return (
                          <tr key={r.submissionId} className={cn('border-t', isCurrent && 'ring-2 ring-inset ring-primary')}>
                            <td className="px-2 py-1.5 sticky left-0 bg-card w-[160px]">
                              <div className="font-medium truncate">{r.teamName}</div>
                              {r.gymName && <div className="text-muted-foreground truncate">{r.gymName}</div>}
                            </td>
                            {g.columns.map((c: any) => {
                              const v = cellValue(r.score, c.fieldIds);
                              return <td key={c.name} className={cn('text-center px-2 py-1.5 tabular-nums w-[110px]', v != null && tone)}>{fmt(v)}</td>;
                            })}
                            <td className={cn('text-center px-2 py-1.5 font-semibold tabular-nums w-[72px]', r.score && tone)}>
                              {r.score ? fmt(r.score.total_score) : '–'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-heading font-semibold">Score Tracking</p>
          {legend}
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-heading">Score Tracking</CardTitle>
        {legend}
      </CardHeader>
      <CardContent className="space-y-2">{body}</CardContent>
    </Card>
  );
}
