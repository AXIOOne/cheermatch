import type { RegistrationVideoStage } from '@/lib/registration-video-progress';

export type RegistrationSortKey = 'division' | 'status';
export type RegistrationSortDir = 'asc' | 'desc';

/** Order the video pipeline follows, so "status" sorts by progress rather than alphabetically. */
const STAGE_RANK: Record<RegistrationVideoStage, number> = {
  'not-started': 0,
  'capture-started': 1,
  'awaiting-approval': 2,
  'approved': 3,
};

export interface RegistrationSortRow {
  id: string;
  name?: string | null;
  gym_name?: string | null;
  division?: { name?: string | null } | null;
}

function teamLabel(row: RegistrationSortRow): string {
  return (row.name || row.gym_name || '').toLowerCase();
}

/**
 * Sorts registered teams by division name or by video status.
 * Rows with no division (or no readable status) always stay at the bottom,
 * whichever direction is active; ties fall back to team name.
 */
export function sortRegistrations<T extends RegistrationSortRow>(
  rows: T[],
  key: RegistrationSortKey,
  dir: RegistrationSortDir,
  stageOf: (row: T) => RegistrationVideoStage | undefined,
): T[] {
  const multiplier = dir === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (key === 'division') {
      const aName = a.division?.name?.trim() ?? '';
      const bName = b.division?.name?.trim() ?? '';
      if (!aName && !bName) return teamLabel(a).localeCompare(teamLabel(b));
      if (!aName) return 1;
      if (!bName) return -1;
      const cmp = aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp * multiplier;
      return teamLabel(a).localeCompare(teamLabel(b));
    }

    const aStage = stageOf(a);
    const bStage = stageOf(b);
    const aRank = aStage ? STAGE_RANK[aStage] : null;
    const bRank = bStage ? STAGE_RANK[bStage] : null;
    if (aRank === null && bRank === null) return teamLabel(a).localeCompare(teamLabel(b));
    if (aRank === null) return 1;
    if (bRank === null) return -1;
    if (aRank !== bRank) return (aRank - bRank) * multiplier;
    return teamLabel(a).localeCompare(teamLabel(b));
  });
}
