interface Assignment {
  panel_id: string | null;
  division_id: string | null;
  level_id: string | null;
  section_id?: string | null;
  judge_user_id: string;
}

// Null scopes apply event-wide; populated scopes must match this registration.
export function assignmentsForTeam<T extends Assignment>(
  assignments: T[], team: { division_id?: string | null; level_id?: string | null } | null | undefined,
): T[] {
  if (!team) return [];
  return assignments.filter(a =>
    (!a.division_id || a.division_id === team.division_id) &&
    (!a.level_id || a.level_id === team.level_id),
  ).sort((a, b) =>
    (Number(Boolean(b.division_id)) + Number(Boolean(b.level_id))) -
    (Number(Boolean(a.division_id)) + Number(Boolean(a.level_id))),
  );
}

export function panelAssignmentTitle(
  panel: { id: string; name: string; abbreviation: string },
  assignments: Assignment[],
  sections: { id: string; name: string; abbreviation?: string; default_panel_abbreviation?: string | null }[],
  templatePanels: { name: string; abbreviation: string }[],
): string {
  const ids = new Set(assignments.filter(a => a.panel_id === panel.id).map(a => a.section_id).filter(Boolean));
  const assignedSections = sections.filter(s => ids.has(s.id));
  const matchingSections = assignedSections.length ? assignedSections : sections.filter(s =>
    (s.default_panel_abbreviation || s.abbreviation || '').toUpperCase() === panel.abbreviation.toUpperCase(),
  );
  return [...new Set(matchingSections.map(s => s.name))].join(' / ') ||
    templatePanels.find(p => p.abbreviation.toUpperCase() === panel.abbreviation.toUpperCase())?.name || panel.name;
}