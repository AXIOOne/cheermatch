export type AnyCategory = {
  id: string;
  display_order?: number | null;
  parent_category_id?: string | null;
  max_points?: number | string | null;
  weight?: number | string | null;
};

export type AnyDeductionType = {
  id: string;
  points: number | string;
  display_order?: number | null;
  name?: string;
};

export function getLeafCategories<T extends AnyCategory>(categories: T[]): T[] {
  const parentIds = new Set(
    categories
      .map((c) => c.parent_category_id)
      .filter((id): id is string => Boolean(id))
  );
  return categories.filter((c) => !parentIds.has(c.id));
}

export function sortByDisplayOrder<T extends { display_order?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

export function calculateStructuredDeductions(
  deductionTypes: AnyDeductionType[] | undefined,
  counts: Record<string, number>
): number {
  if (!deductionTypes || deductionTypes.length === 0) return 0;

  const sum = deductionTypes.reduce((acc, dt) => {
    const points = Number(dt.points) || 0; // points are stored negative
    const count = counts[dt.id] || 0;
    return acc + points * count;
  }, 0);

  return Math.abs(sum);
}
