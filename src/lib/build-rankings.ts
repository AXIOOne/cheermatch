import { supabase } from '@/integrations/supabase/client';
import { buildScoresheet, type RawField, type ScoreType } from '@/lib/build-scoresheet';

const sb = supabase as any;

export type RankingMode = 'overall' | 'level' | 'division';

export interface RankingRow {
  submission_id: string;
  team_id: string;
  team_name: string;
  gym_name: string | null;
  division_id: string | null;
  division_name: string;
  level_id: string | null;
  level_name: string;
  max: number;
  raw_score: number;
  deductions: number;
  perfection: number;
  rank: number;
}

export interface RankingSection {
  key: string;
  title: string;
  rows: RankingRow[];
}

export interface RankingsData {
  event_name: string;
  start_date?: string | null;
  end_date?: string | null;
  sections: RankingSection[];
}

function applyRanks(rows: RankingRow[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => b.perfection - a.perfection);
  let lastValue: number | null = null;
  let lastRank = 0;
  sorted.forEach((r, i) => {
    const v = Math.round(r.perfection * 10000) / 10000;
    if (lastValue !== null && v === lastValue) {
      r.rank = lastRank;
    } else {
      r.rank = i + 1;
      lastRank = r.rank;
      lastValue = v;
    }
  });
  return sorted;
}

/** Fetch every scored team at an event and compute its standings row. */
export async function fetchEventRankingRows(eventId: string): Promise<RankingRow[]> {
  const { data: submissions, error: subErr } = await sb
    .from('video_submissions')
    .select(`
      id,
      team:teams!inner(id, name, gym_name,
        division:divisions(id, name, scoring_template_id),
        level:levels(id, name))
    `)
    .eq('event_id', eventId);
  if (subErr) throw subErr;
  if (!submissions?.length) return [];

  const submissionIds = submissions.map((s: any) => s.id);

  const { data: scores, error: scoresErr } = await sb
    .from('scores')
    .select(`
      id, submission_id, deductions, status, template_id,
      panel:judge_panels(name, abbreviation),
      details:score_details(points, field:scoring_fields(id)),
      deduction_items:score_deductions(deduction_type_id, count, warnings)
    `)
    .in('submission_id', submissionIds)
    .eq('status', 'submitted');
  if (scoresErr) throw scoresErr;

  const scoresBySubmission = new Map<string, any[]>();
  (scores || []).forEach((s: any) => {
    const list = scoresBySubmission.get(s.submission_id) || [];
    list.push(s);
    scoresBySubmission.set(s.submission_id, list);
  });

  // Admin overrides
  const scoreIds = (scores || []).map((s: any) => s.id);
  const overrideLookup: Record<string, Record<string, number>> = {};
  if (scoreIds.length) {
    const { data: ovs } = await sb
      .from('score_field_overrides')
      .select('score_id, field_id, new_points')
      .in('score_id', scoreIds);
    (ovs || []).forEach((o: any) => {
      if (!overrideLookup[o.score_id]) overrideLookup[o.score_id] = {};
      overrideLookup[o.score_id][o.field_id] = Number(o.new_points || 0);
    });
  }

  // Resolve the template per submission (score template -> division template -> event default -> global default)
  let eventTemplateId: string | null = null;
  {
    const { data: tpls } = await sb
      .from('scoring_templates')
      .select('id, is_default')
      .eq('event_id', eventId)
      .order('is_default', { ascending: false })
      .limit(1);
    eventTemplateId = tpls?.[0]?.id ?? null;
  }
  let globalTemplateId: string | null = null;
  if (!eventTemplateId) {
    const { data: tpls } = await sb
      .from('scoring_templates')
      .select('id')
      .eq('is_default', true)
      .order('created_at')
      .limit(1);
    globalTemplateId = tpls?.[0]?.id ?? null;
  }

  const templateBySubmission = new Map<string, string | null>();
  submissions.forEach((sub: any) => {
    const subScores = scoresBySubmission.get(sub.id) || [];
    const tid =
      subScores[0]?.template_id ??
      sub.team?.division?.scoring_template_id ??
      eventTemplateId ??
      globalTemplateId ??
      null;
    templateBySubmission.set(sub.id, tid);
  });

  const templateIds = Array.from(
    new Set(Array.from(templateBySubmission.values()).filter(Boolean) as string[])
  );

  // Bulk load fields + deduction catalogs for all templates in play
  const fieldsByTemplate = new Map<string, RawField[]>();
  const catalogByTemplate = new Map<string, Array<{ id: string; name: string; points: number; display_order: number }>>();
  if (templateIds.length) {
    const { data: tplFields } = await sb
      .from('scoring_fields')
      .select(`id, name, max_points, section_id, score_type, display_order,
               section:scoring_sections!inner(id, name, display_order, template_id)`)
      .in('section.template_id', templateIds);
    (tplFields || []).forEach((f: any) => {
      const section = Array.isArray(f.section) ? f.section[0] : f.section;
      const tid = section?.template_id;
      if (!tid) return;
      const list = fieldsByTemplate.get(tid) || [];
      list.push({
        id: f.id,
        name: f.name,
        max_points: Number(f.max_points || 0),
        score_type: ((f.score_type as ScoreType) || 'difficulty'),
        section_id: f.section_id,
        section_name: section?.name || '',
        section_order: section?.display_order ?? 0,
        field_order: f.display_order ?? 0,
      });
      fieldsByTemplate.set(tid, list);
    });

    const { data: dts } = await sb
      .from('deduction_types')
      .select('id, name, points, display_order, template_id')
      .in('template_id', templateIds);
    (dts || []).forEach((d: any) => {
      const list = catalogByTemplate.get(d.template_id) || [];
      list.push({
        id: d.id,
        name: d.name,
        points: Number(d.points || 0),
        display_order: Number(d.display_order ?? 0),
      });
      catalogByTemplate.set(d.template_id, list);
    });
  }

  const rows: RankingRow[] = [];
  for (const sub of submissions as any[]) {
    const subScores = scoresBySubmission.get(sub.id) || [];
    if (!subScores.length) continue;
    const tid = templateBySubmission.get(sub.id);
    const fields = (tid && fieldsByTemplate.get(tid)) || [];
    if (!fields.length) continue;

    const data = buildScoresheet({
      team_name: sub.team?.name || 'Team',
      gym_name: sub.team?.gym_name,
      division_name: sub.team?.division?.name,
      level_name: sub.team?.level?.name,
      event_name: '',
      fields,
      deduction_catalog: (tid && catalogByTemplate.get(tid)) || [],
      submitted_scores: subScores.map((s: any) => {
        const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
        return {
          deductions: Number(s.deductions || 0),
          panel_name: panel?.name || null,
          panel_abbreviation: panel?.abbreviation || null,
          deduction_items: (s.deduction_items || []).map((it: any) => ({
            deduction_type_id: it.deduction_type_id,
            count: Number(it.count || 0),
            warnings: Number(it.warnings || 0),
          })),
          details: (s.details || []).map((d: any) => {
            const fid = (Array.isArray(d.field) ? d.field[0] : d.field)?.id;
            const ov = overrideLookup[s.id]?.[fid];
            return { field_id: fid, points: ov !== undefined ? ov : Number(d.points || 0) };
          }),
        };
      }),
    });

    rows.push({
      submission_id: sub.id,
      team_id: sub.team?.id,
      team_name: sub.team?.name || 'Team',
      gym_name: sub.team?.gym_name ?? null,
      division_id: sub.team?.division?.id ?? null,
      division_name: sub.team?.division?.name || 'No Division',
      level_id: sub.team?.level?.id ?? null,
      level_name: sub.team?.level?.name || 'No Level',
      max: data.total_max,
      raw_score: data.raw_score,
      deductions: data.deductions,
      perfection: data.perfection,
      rank: 0,
    });
  }

  return rows;
}

export function displayTeamName(row: RankingRow): string {
  return row.gym_name ? `${row.gym_name}: ${row.team_name}` : row.team_name;
}

/** Group ranked rows into report sections. */
export function buildRankingSections(rows: RankingRow[], mode: RankingMode): RankingSection[] {
  if (mode === 'overall') {
    return [{ key: 'overall', title: 'Overall Standings', rows: applyRanks(rows) }];
  }

  const groups = new Map<string, { title: string; rows: RankingRow[] }>();
  for (const r of rows) {
    const key = (mode === 'level' ? r.level_id : r.division_id) || `none-${mode}`;
    const title = mode === 'level' ? r.level_name : r.division_name;
    const g = groups.get(key) || { title, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }

  return Array.from(groups.entries())
    .map(([key, g]) => ({ key, title: g.title, rows: applyRanks(g.rows) }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
}
