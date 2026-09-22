export type AnyDeductionType = {
  id: string;
  points: number | string;
  display_order?: number | null;
  name?: string;
};

export type AggregationMode = 'average' | 'trimmed_mean' | 'min' | 'max' | 'sum';

export function sortByDisplayOrder<T extends { display_order?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

export function calculateStructuredDeductions(
  deductionTypes: AnyDeductionType[] | undefined,
  counts: Record<string, number>
): number {
  if (!deductionTypes || deductionTypes.length === 0) return 0;
  const sum = deductionTypes.reduce((acc, dt) => {
    const points = Number(dt.points) || 0;
    const count = counts[dt.id] || 0;
    return acc + points * count;
  }, 0);
  return Math.abs(sum);
}

export function aggregateValues(values: number[], mode: AggregationMode): number {
  if (values.length === 0) return 0;
  switch (mode) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'trimmed_mean': {
      if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, -1);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    }
    case 'average':
    default:
      return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

/**
 * Panel abbreviations a scoring field is assigned to (uppercased).
 */
export function fieldPanelAbbrevs(field: any): string[] {
  return ((field?.panel_links || []) as any[])
    .map((p) => String(p?.panel_abbreviation || '').toUpperCase())
    .filter(Boolean);
}

/**
 * A field is scored by a panel when it has no panel restriction, when it is
 * explicitly marked "ALL" (every panel judge scores it, scoresheet averages),
 * or when the panel abbreviation is listed.
 */
export function isFieldForPanel(field: any, panelAbbrev: string | null | undefined): boolean {
  const abbrs = fieldPanelAbbrevs(field);
  if (abbrs.length === 0 || abbrs.includes('ALL')) return true;
  if (!panelAbbrev) return false;
  return abbrs.includes(String(panelAbbrev).toUpperCase());
}

/** True when the field is scored by every panel judge. */
export function isAllPanelsField(field: any): boolean {
  const abbrs = fieldPanelAbbrevs(field);
  return abbrs.length === 0 || abbrs.includes('ALL');
}

export type DivisionDisciplineLink = {
  discipline: string;
  scoring_template_id: string | null;
};

export type DivisionTemplateSource =
  | {
      scoring_template_id?: string | null;
      discipline_links?: DivisionDisciplineLink[] | null;
    }
  | null
  | undefined;

/**
 * Resolve the scoring template for a division within a given discipline.
 * Divisions can be activated for several disciplines, each with its own
 * template; the division's legacy single template stays as a fallback.
 */
export function pickDivisionTemplateId(
  division: DivisionTemplateSource,
  discipline?: string | null
): string | null {
  if (!division) return null;
  const links = division.discipline_links || [];
  if (discipline) {
    const match = links.find((l) => l?.discipline === discipline);
    if (match?.scoring_template_id) return match.scoring_template_id;
  }
  if (links.length === 1 && links[0]?.scoring_template_id) return links[0].scoring_template_id;
  return division.scoring_template_id ?? null;
}

/** PostgREST select fragment for a division plus its per-discipline templates. */
export const DIVISION_TEMPLATE_SELECT =
  'id, name, scoring_template_id, discipline_links:division_disciplines(discipline, scoring_template_id)';
