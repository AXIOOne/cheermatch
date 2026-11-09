import Papa from 'papaparse';

export const registrationVideoStatusLabels: Record<string, string> = {
  not_started: 'Not started', capture_started: 'Capture started', pending: 'Pending',
  uploaded: 'Uploaded', processing: 'Processing', ready: 'Ready for Review',
  imported: 'Imported', approved: 'Approved', denied: 'Denied',
  assigned: 'Assigned to Judges', complete: 'Scored',
  revision_requested: 'Revision Requested', failed: 'Failed',
};

interface ExportRegistration {
  id: string;
  name: string | null;
  gym_name: string | null;
  division: { name: string } | null;
  level: { name: string } | null;
  athletes_female: number;
  athletes_male: number;
}

export function buildRegistrationsCsv(
  eventName: string,
  teams: ExportRegistration[],
  statusForTeam: (teamId: string) => string,
): string {
  return '\uFEFF' + Papa.unparse({
    fields: ['Event', 'Team Name', 'Gym', 'Division', 'Level', 'Video Status', 'Athletes', 'Female Athletes', 'Male Athletes'],
    data: teams.map(team => {
      const status = statusForTeam(team.id);
      return [eventName, team.name || team.gym_name || '', team.gym_name || '',
        team.division?.name || '', team.level?.name || '',
        registrationVideoStatusLabels[status] ?? status,
        team.athletes_female + team.athletes_male, team.athletes_female, team.athletes_male];
    }),
  }, { newline: '\r\n', escapeFormulae: true });
}

export function downloadRegistrationsCsv(csv: string, eventName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = eventName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'Event';
  link.download = `${safeName} - Registered Teams.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}