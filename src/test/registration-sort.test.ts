import { describe, expect, it } from 'vitest';
import { sortRegistrations, type RegistrationSortRow } from '@/lib/registration-sort';
import type { RegistrationVideoStage } from '@/lib/registration-video-progress';

interface Row extends RegistrationSortRow {
  id: string;
  stage?: RegistrationVideoStage;
}

const rows: Row[] = [
  { id: '1', name: 'Zebra', gym_name: 'Zebra Gym', division: { name: 'Youth Cheer' }, stage: 'approved' },
  { id: '2', name: 'Alpha', gym_name: 'Alpha Gym', division: { name: 'Junior High Cheer' }, stage: 'not-started' },
  { id: '3', name: 'Mia', gym_name: 'Mia Gym', division: null, stage: 'awaiting-approval' },
  { id: '4', name: 'Bravo', gym_name: 'Bravo Gym', division: { name: 'Varsity Cheer' }, stage: 'capture-started' },
  { id: '5', name: 'Nina', gym_name: 'Nina Gym', division: { name: 'Junior High Cheer' }, stage: undefined },
];

const stageOf = (row: Row) => row.stage;
const ids = (list: Row[]) => list.map((row) => row.id);

describe('sortRegistrations', () => {
  it('sorts by division A to Z and keeps teams with no division at the bottom', () => {
    expect(ids(sortRegistrations(rows, 'division', 'asc', stageOf))).toEqual(['2', '5', '4', '1', '3']);
  });

  it('reverses division order when sorting Z to A but still keeps no-division teams at the bottom', () => {
    expect(ids(sortRegistrations(rows, 'division', 'desc', stageOf))).toEqual(['1', '4', '2', '5', '3']);
  });

  it('sorts status by video progress, not alphabetically, with unreadable status last', () => {
    expect(ids(sortRegistrations(rows, 'status', 'asc', stageOf))).toEqual(['2', '4', '3', '1', '5']);
  });

  it('reverses the video-progress order when sorting status descending', () => {
    expect(ids(sortRegistrations(rows, 'status', 'desc', stageOf))).toEqual(['1', '3', '4', '2', '5']);
  });

  it('does not mutate the incoming list', () => {
    const before = ids(rows);
    sortRegistrations(rows, 'status', 'desc', stageOf);
    expect(ids(rows)).toEqual(before);
  });
});
