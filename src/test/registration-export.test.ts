import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { buildRegistrationsCsv } from '@/lib/registration-export';

const team = { id: 'one', name: 'Team', gym_name: 'Gym', division: { name: 'Division' }, level: null, athletes_female: 12, athletes_male: 3 };
const parse = (csv: string) => Papa.parse<Record<string, string>>(csv, { header: true }).data;

describe('registered teams CSV', () => {
  it.each([
    ['not_started', 'Not started'], ['capture_started', 'Capture started'],
    ['ready', 'Ready for Review'], ['approved', 'Approved'],
    ['assigned', 'Assigned to Judges'], ['complete', 'Scored'],
  ])('exports the current video status %s', (status, label) => {
    expect(parse(buildRegistrationsCsv('Event', [team], () => status))[0]['Video Status']).toBe(label);
  });
  it('preserves the provided rows and order, with event, division, optional level and athlete counts', () => {
    const rows = parse(buildRegistrationsCsv('UCA November Virtual', [{ ...team, id: 'two', name: '' }, team], () => 'approved'));
    expect(rows.map(row => row['Team Name'])).toEqual(['Gym', 'Team']);
    expect(rows[0]).toMatchObject({ Event: 'UCA November Virtual', Division: 'Division', Level: '', Athletes: '15', 'Female Athletes': '12', 'Male Athletes': '3' });
  });
  it('round-trips commas, quotes and line breaks and neutralizes spreadsheet formulas', () => {
    const row = parse(buildRegistrationsCsv('Event', [{ ...team, name: 'Team, "A"\nB', gym_name: '=1+1' }], () => 'ready'))[0];
    expect(row['Team Name']).toBe('Team, "A"\nB');
    expect(row.Gym).toBe("'=1+1");
  });
});