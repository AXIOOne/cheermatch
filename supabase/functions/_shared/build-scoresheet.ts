// Deno copy of src/lib/build-scoresheet.ts. Keep in sync.

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

export interface RawDeductionItem {
  deduction_type_id: string;
  count: number;
  warnings: number;
}

export interface RawSubmittedScore {
  deductions: number;
  details: RawScoreDetail[];
  judge_label?: string | null;
  comments?: string | null;
  panel_abbreviation?: string | null;
  panel_name?: string | null;
  deduction_items?: RawDeductionItem[];
}

export interface DeductionCatalogEntry {
  id: string;
  name: string;
  points: number;
  display_order: number;
}

export interface ScoresheetInput {
  team_name: string;
  gym_name?: string | null;
  division_name?: string | null;
  level_name?: string | null;
  event_name: string;
  event_phase?: string | null;
  hall_name?: string | null;
  accuscore_end_at?: string | null;
  fields: RawField[];
  submitted_scores: RawSubmittedScore[];
  show_comments?: boolean;
  deduction_catalog?: DeductionCatalogEntry[];
}

export interface ScoresheetRow {
  name: string;
  max_value: number;
  difficulty: number | null;
  execution: number | null;
  score: number | null;
}

export interface JudgeComment {
  judge_label: string;
  comments: string;
}

export interface DeductionReportRow {
  name: string;
  value: number;
  occurrences: number;
  warnings: number;
  score: number;
}

export interface DeductionReport {
  rows: DeductionReportRow[];
  total: number;
}

export interface ScoresheetData {
  team_name: string;
  gym_name?: string | null;
  division_name?: string | null;
  level_name?: string | null;
  event_name: string;
  event_phase?: string | null;
  hall_name?: string | null;
  accuscore_end_at?: string | null;
  rows: ScoresheetRow[];
  total_max: number;
  raw_score: number;
  deductions: number;
  perfection: number;
  show_comments: boolean;
  judge_comments: JudgeComment[];
  deduction_report: DeductionReport;
  safety_comments: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function averagePoints(fieldId: string, scores: RawSubmittedScore[]): number | null {
  const values: number[] = [];
  for (const s of scores) for (const d of s.details) {
    if (d.field_id === fieldId) values.push(Number(d.points || 0));
  }
  if (!values.length) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

export function buildScoresheet(input: ScoresheetInput): ScoresheetData {
  const ordered = [...input.fields].sort((a, b) =>
    a.section_order - b.section_order || a.field_order - b.field_order
  );
  type Group = { name: string; section_order: number; field_order: number;
    diff?: RawField; exec?: RawField };
  const groups = new Map<string, Group>();
  for (const f of ordered) {
    // Group by field name (case-insensitive) across the whole template so a
    // difficulty field and an execution field with the same criterion name
    // collapse into a single row with both values side by side.
    const key = f.name.trim().toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { name: f.name, section_order: f.section_order, field_order: f.field_order };
      groups.set(key, g);
    }
    if (f.score_type === 'execution') g.exec = f; else g.diff = f;
    g.field_order = Math.min(g.field_order, f.field_order);
  }
  const rows: ScoresheetRow[] = [];
  let total_max = 0, raw_score = 0;
  const list = Array.from(groups.values()).sort((a, b) =>
    a.section_order - b.section_order || a.field_order - b.field_order
  );
  for (const g of list) {
    const diffAvg = g.diff ? averagePoints(g.diff.id, input.submitted_scores) : null;
    const execAvg = g.exec ? averagePoints(g.exec.id, input.submitted_scores) : null;
    const max_value = round2((g.diff?.max_points || 0) + (g.exec?.max_points || 0));
    const hasAny = diffAvg !== null || execAvg !== null;
    const score = hasAny ? round2((diffAvg ?? 0) + (execAvg ?? 0)) : null;
    rows.push({
      name: g.name, max_value,
      difficulty: g.diff ? diffAvg : null,
      execution: g.exec ? execAvg : null,
      score,
    });
    total_max += max_value;
    raw_score += (diffAvg ?? 0) + (execAvg ?? 0);
  }
  total_max = round2(total_max);
  raw_score = round2(raw_score);
  const isSdPanel = (s: RawSubmittedScore) => {
    const ab = (s.panel_abbreviation ?? '').trim().toLowerCase();
    const nm = (s.panel_name ?? '').trim().toLowerCase();
    return ab === 'sd' || /safety|deduction/.test(nm);
  };
  const sdScore = input.submitted_scores.find(isSdPanel) || input.submitted_scores[0];

  const catalog = (input.deduction_catalog ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  const dedItemsById = new Map<string, RawDeductionItem>();
  (sdScore?.deduction_items ?? []).forEach((it) => dedItemsById.set(it.deduction_type_id, it));

  let dedTotal = 0;
  const reportRows: DeductionReportRow[] = catalog.map((c) => {
    const it = dedItemsById.get(c.id);
    const occurrences = Number(it?.count || 0);
    const warnings = Number(it?.warnings || 0);
    const value = Math.abs(Number(c.points || 0));
    const score = round2(value * occurrences);
    dedTotal += score;
    return { name: c.name, value, occurrences, warnings, score };
  });
  const deduction_report: DeductionReport = { rows: reportRows, total: round2(dedTotal) };
  const safety_comments = (sdScore?.comments ?? '').trim();

  // Total deductions are taken from the designated safety/deduction judge
  // (sum of catalog point value × occurrences), NOT an average across all
  // judges. Deductions are subtracted from the %Perfection (100-pt) score.
  const deductions = deduction_report.total;
  const perfection = total_max > 0 ? round2((raw_score / total_max) * 100 - deductions) : 0;

  const show_comments = input.show_comments !== false;
  const judge_comments: JudgeComment[] = input.submitted_scores
    .map((s, i) => ({
      judge_label: (s.judge_label ?? '').trim() || `Judge ${i + 1}`,
      comments: (s.comments ?? '').trim(),
    }))
    .sort((a, b) => a.judge_label.localeCompare(b.judge_label, undefined, { numeric: true, sensitivity: 'base' }));


  return {
    team_name: input.team_name,
    gym_name: input.gym_name,
    division_name: input.division_name,
    level_name: input.level_name,
    event_name: input.event_name,
    event_phase: input.event_phase ?? null,
    hall_name: input.hall_name ?? null,
    accuscore_end_at: input.accuscore_end_at,
    rows, total_max, raw_score, deductions, perfection,
    show_comments, judge_comments,
    deduction_report, safety_comments,
  };
}
