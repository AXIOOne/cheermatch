import {
  fetchEventScoringData,
  buildRankingRows,
  scoreDetailPoints,
  type EventScoringData,
  type RankingRow,
} from '@/lib/build-rankings';
import type { RawField } from '@/lib/build-scoresheet';

export interface AverageColumn {
  key: string;
  label: string;
  section_order: number;
  field_order: number;
}

export interface AverageCell {
  difficulty: number | null;
  execution: number | null;
  has_difficulty: boolean;
  has_execution: boolean;
}

export interface AverageTeamRow {
  submission_id: string;
  team_name: string;
  gym_name: string | null;
  perfection: number;
  cells: Record<string, AverageCell>;
}

export interface AverageSection {
  key: string;
  title: string;
  columns: AverageColumn[];
  rows: AverageTeamRow[];
}

export interface AveragesData {
  event_name: string;
  start_date?: string | null;
  end_date?: string | null;
  sections: AverageSection[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function colKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Average per field id across the submitted judge scores (overrides applied). */
function fieldAverages(scores: any[], overrides: EventScoringData['overrideLookup']) {
  const buckets = new Map<string, number[]>();
  for (const s of scores) {
    for (const d of scoreDetailPoints(s, overrides)) {
      if (!d.field_id) continue;
      const list = buckets.get(d.field_id) || [];
      list.push(Number(d.points || 0));
      buckets.set(d.field_id, list);
    }
  }
  const out = new Map<string, number>();
  buckets.forEach((vals, fid) => {
    out.set(fid, round2(vals.reduce((a, b) => a + b, 0) / vals.length));
  });
  return out;
}

/** Build the per-division averages report for an event. */
export async function fetchEventAverages(eventId: string): Promise<AverageSection[]> {
  const ctx = await fetchEventScoringData(eventId);
  const ranking = buildRankingRows(ctx);
  const rankBySubmission = new Map<string, RankingRow>(
    ranking.map((r) => [r.submission_id, r])
  );

  // Group submissions by division
  const groups = new Map<string, { title: string; subs: any[] }>();
  for (const sub of ctx.submissions as any[]) {
    if (!rankBySubmission.has(sub.id)) continue;
    const key = sub.team?.division?.id || 'no-division';
    const title = sub.team?.division?.name || 'No Division';
    const g = groups.get(key) || { title, subs: [] };
    g.subs.push(sub);
    groups.set(key, g);
  }

  const sections: AverageSection[] = [];

  groups.forEach((g, key) => {
    // Union of fields across the templates in play for this division
    const fieldMap = new Map<string, RawField>();
    for (const sub of g.subs) {
      const tid = ctx.templateBySubmission.get(sub.id);
      const fields = (tid && ctx.fieldsByTemplate.get(tid)) || [];
      fields.forEach((f) => fieldMap.set(f.id, f));
    }
    const fields = Array.from(fieldMap.values());
    if (!fields.length) return;

    // Columns: one per criterion name; difficulty + execution collapse together
    type ColBuild = AverageColumn & { diffIds: string[]; execIds: string[]; name: string };
    const cols = new Map<string, ColBuild>();
    for (const f of fields) {
      const k = colKey(f.name);
      let c = cols.get(k);
      if (!c) {
        c = {
          key: k,
          label: f.name,
          name: f.name,
          section_order: f.section_order,
          field_order: f.field_order,
          diffIds: [],
          execIds: [],
        };
        cols.set(k, c);
      }
      if (f.score_type === 'execution') c.execIds.push(f.id);
      else c.diffIds.push(f.id);
      c.section_order = Math.min(c.section_order, f.section_order);
      c.field_order = Math.min(c.field_order, f.field_order);
    }

    // Disambiguate: if a criterion pulls the same score type from more than
    // one section, prefix the label with that section's abbreviation.
    cols.forEach((c) => {
      const sectionsForDiff = new Set(
        c.diffIds.map((id) => fieldMap.get(id)?.section_id).filter(Boolean)
      );
      const sectionsForExec = new Set(
        c.execIds.map((id) => fieldMap.get(id)?.section_id).filter(Boolean)
      );
      if (sectionsForDiff.size > 1 || sectionsForExec.size > 1) {
        const abbr = ctx.sectionAbbrByField.get(c.diffIds[0] || c.execIds[0] || '');
        if (abbr) c.label = `${abbr} ${c.name}`;
      }
    });

    const ordered = Array.from(cols.values()).sort(
      (a, b) => a.section_order - b.section_order || a.field_order - b.field_order
    );

    const rows: AverageTeamRow[] = g.subs.map((sub: any) => {
      const scores = ctx.scoresBySubmission.get(sub.id) || [];
      const avgs = fieldAverages(scores, ctx.overrideLookup);
      const tid = ctx.templateBySubmission.get(sub.id);
      const teamFieldIds = new Set(
        ((tid && ctx.fieldsByTemplate.get(tid)) || []).map((f) => f.id)
      );

      const cells: Record<string, AverageCell> = {};
      for (const c of ordered) {
        const pick = (ids: string[]) => {
          const own = ids.filter((id) => teamFieldIds.has(id));
          const use = own.length ? own : ids;
          const vals = use.map((id) => avgs.get(id)).filter((v) => v !== undefined) as number[];
          if (!vals.length) return null;
          return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
        };
        cells[c.key] = {
          difficulty: pick(c.diffIds),
          execution: pick(c.execIds),
          has_difficulty: c.diffIds.length > 0,
          has_execution: c.execIds.length > 0,
        };
      }

      const rank = rankBySubmission.get(sub.id)!;
      return {
        submission_id: sub.id,
        team_name: rank.team_name,
        gym_name: rank.gym_name,
        perfection: rank.perfection,
        cells,
      };
    });

    // First place at the bottom: ascending by score.
    rows.sort((a, b) => a.perfection - b.perfection);

    sections.push({
      key,
      title: g.title,
      columns: ordered.map(({ key: k, label, section_order, field_order }) => ({
        key: k,
        label,
        section_order,
        field_order,
      })),
      rows,
    });
  });

  return sections.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export function formatAverageCell(cell: AverageCell | undefined): string {
  if (!cell) return '--';
  const fmt = (v: number | null, present: boolean) =>
    present && v !== null ? v.toFixed(2) : '--';
  return `${fmt(cell.difficulty, cell.has_difficulty)} | ${fmt(cell.execution, cell.has_execution)}`;
}

export function averagesTeamName(row: AverageTeamRow): string {
  return row.gym_name ? `${row.gym_name}: ${row.team_name}` : row.team_name;
}
