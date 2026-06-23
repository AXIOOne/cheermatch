// Shared data shaping for the PDF scoresheet.
// Duplicated in supabase/functions/_shared/build-scoresheet.ts because
// Deno edge functions cannot import from src/.

export type ScoreType = 'difficulty' | 'execution';

export interface RawField {
  id: string;
  name: string;
  max_points: number;
  score_type: ScoreType;
  section_id: string;
  section_name: string;
  section_order: number;
  field_order: number;
}

export interface RawScoreDetail {
  field_id: string;
  points: number;
}

export interface RawSubmittedScore {
  deductions: number;
  details: RawScoreDetail[];
}

export interface ScoresheetInput {
  team_name: string;
  gym_name?: string | null;
  division_name?: string | null;
  event_name: string;
  accuscore_end_at?: string | null;
  fields: RawField[];
  submitted_scores: RawSubmittedScore[];
}

export interface ScoresheetRow {
  name: string;
  max_value: number;
  difficulty: number | null;
  execution: number | null;
  score: number;
}

export interface ScoresheetData {
  team_name: string;
  gym_name?: string | null;
  division_name?: string | null;
  event_name: string;
  accuscore_end_at?: string | null;
  rows: ScoresheetRow[];
  total_max: number;
  raw_score: number;
  deductions: number;
  perfection: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function averagePoints(fieldId: string, scores: RawSubmittedScore[]): number | null {
  const values: number[] = [];
  for (const s of scores) {
    for (const d of s.details) {
      if (d.field_id === fieldId) values.push(Number(d.points || 0));
    }
  }
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return round2(avg);
}

export function buildScoresheet(input: ScoresheetInput): ScoresheetData {
  // Order fields by section then field display_order
  const ordered = [...input.fields].sort((a, b) =>
    a.section_order - b.section_order || a.field_order - b.field_order
  );

  // Group by `${section_id}::${name}` so same-titled difficulty + execution merge
  type Group = { name: string; section_order: number; field_order: number;
    diff?: RawField; exec?: RawField };
  const groups = new Map<string, Group>();
  for (const f of ordered) {
    const key = `${f.section_id}::${f.name.trim().toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { name: f.name, section_order: f.section_order, field_order: f.field_order };
      groups.set(key, g);
    }
    if (f.score_type === 'execution') g.exec = f;
    else g.diff = f;
    // earliest field_order wins for ordering
    g.field_order = Math.min(g.field_order, f.field_order);
  }

  const rows: ScoresheetRow[] = [];
  let total_max = 0;
  let raw_score = 0;

  const list = Array.from(groups.values()).sort((a, b) =>
    a.section_order - b.section_order || a.field_order - b.field_order
  );

  for (const g of list) {
    const diffAvg = g.diff ? averagePoints(g.diff.id, input.submitted_scores) : null;
    const execAvg = g.exec ? averagePoints(g.exec.id, input.submitted_scores) : null;
    const max_value = round2((g.diff?.max_points || 0) + (g.exec?.max_points || 0));
    const score = round2((diffAvg || 0) + (execAvg || 0));
    rows.push({
      name: g.name,
      max_value,
      difficulty: g.diff ? (diffAvg ?? 0) : null,
      execution: g.exec ? (execAvg ?? 0) : null,
      score,
    });
    total_max += max_value;
    raw_score += score;
  }

  total_max = round2(total_max);
  raw_score = round2(raw_score);

  // Average deductions across submitted panels (same convention used elsewhere)
  const deductions = input.submitted_scores.length
    ? round2(input.submitted_scores.reduce((s, x) => s + Number(x.deductions || 0), 0) /
        input.submitted_scores.length)
    : 0;

  const perfection = total_max > 0
    ? round2((raw_score / total_max) * 100 - deductions)
    : 0;

  return {
    team_name: input.team_name,
    gym_name: input.gym_name,
    division_name: input.division_name,
    event_name: input.event_name,
    accuscore_end_at: input.accuscore_end_at,
    rows,
    total_max,
    raw_score,
    deductions,
    perfection,
  };
}
