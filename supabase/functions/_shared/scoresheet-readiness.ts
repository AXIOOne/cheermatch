import { scoresheetReviewed } from './scoresheet-delivery.ts';

// Match the control panel's division-specific relevant panels, fail closed if data is missing.
export async function assertScoresheetsReviewed(db: any, submissionId: string, bulkEventId?: string) {
  const { data: target, error: targetError } = await db.from('video_submissions')
    .select('event_id').eq('id', submissionId).single();
  if (targetError || !target) throw new Error('Submission not found');
  if (bulkEventId && target.event_id !== bulkEventId) throw new Error('Submission does not belong to this event');
  const eventId = target.event_id;
  const [{ data: event, error: eventError }, { data: panels, error: panelError }, { data: assignments, error: assignmentError }] = await Promise.all([
    db.from('events').select('discipline').eq('id', eventId).single(),
    db.from('judge_panels').select('id, abbreviation').eq('event_id', eventId),
    db.from('judge_assignments').select('judge_user_id, panel_id, division_id, level_id').eq('event_id', eventId),
  ]);
  if (eventError || panelError || assignmentError || !panels?.length) throw new Error('Cannot verify panel reviews');
  let query = db.from('video_submissions').select(`id, team:teams(id, division_id, level_id,
    division:divisions(scoring_template_id, discipline_links:division_disciplines(discipline, scoring_template_id))),
    scores:scores(status, panel_id, judge_user_id, reviewed_at, needs_review)`)
    .eq('event_id', eventId).is('archived_at', null).not('team_id', 'is', null);
  if (!bulkEventId) query = query.eq('id', submissionId);
  const { data: submissions, error } = await query;
  if (error || !submissions?.length) throw new Error('Cannot verify scoresheet reviews');
  const templates = new Map<string, any>();
  for (const submission of submissions) {
    const team = Array.isArray(submission.team) ? submission.team[0] : submission.team;
    if (!team) continue;
    const division = Array.isArray(team.division) ? team.division[0] : team.division;
    const links = division?.discipline_links || [];
    const templateId = links.find((l: any) => l.discipline === event.discipline)?.scoring_template_id
      || (links.length === 1 ? links[0].scoring_template_id : null) || division?.scoring_template_id;
    let relevant = panels;
    if (templateId) {
      if (!templates.has(templateId)) {
        const { data: template, error: templateError } = await db.from('scoring_templates')
          .select('id, sections:scoring_sections(fields:scoring_fields(panel_links:scoring_field_panels(panel_abbreviation)))')
          .eq('id', templateId).single();
        if (templateError || !template) throw new Error('Cannot verify scoresheet template');
        templates.set(templateId, template);
      }
      const fields = templates.get(templateId).sections.flatMap((section: any) => section.fields || []);
      relevant = panels.filter((panel: any) => {
        const abbreviation = (panel.abbreviation || '').toUpperCase();
        return !abbreviation || abbreviation === 'SD' || fields.some((field: any) => {
          const tags = (field.panel_links || []).map((link: any) => (link.panel_abbreviation || '').toUpperCase());
          return !tags.length || tags.includes('ALL') || tags.includes(abbreviation);
        });
      });
    }
    const resolve = (score: any) => score.panel_id || assignments?.find((a: any) =>
      a.judge_user_id === score.judge_user_id && a.panel_id
      && (!a.division_id || a.division_id === team.division_id)
      && (!a.level_id || a.level_id === team.level_id))?.panel_id || null;
    if (!scoresheetReviewed(submission.scores || [], relevant.map((p: any) => p.id), resolve)) {
      throw new Error(bulkEventId ? 'All scoresheets must be submitted and reviewed before bulk sending.' : 'All panels must be submitted and reviewed before sending this scoresheet.');
    }
  }
}