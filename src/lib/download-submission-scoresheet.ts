import { supabase } from '@/integrations/supabase/client';
import { buildScoresheet, type RawField, type ScoreType } from '@/lib/build-scoresheet';
import { buildScoresheetPdf, downloadPdf } from '@/lib/scoresheet-pdf';

const sb = supabase as any;

export async function downloadSubmissionScoresheet(submissionId: string) {
  const { data: submission, error: subErr } = await sb
    .from('video_submissions')
    .select(`
      id, event_id,
      team:teams!inner(id, name, gym_name, division:divisions!inner(id, name)),
      event:events!inner(id, name, accuscore_end_at)
    `)
    .eq('id', submissionId)
    .maybeSingle();
  if (subErr) throw subErr;
  if (!submission) throw new Error('Submission not found');

  const { data: scores, error: scoresErr } = await sb
    .from('scores')
    .select(`
      id, deductions, status,
      details:score_details(
        points,
        field:scoring_fields(id, name, max_points, section_id, score_type, display_order,
          section:scoring_sections(id, name, display_order))
      )
    `)
    .eq('submission_id', submissionId);
  if (scoresErr) throw scoresErr;

  const submitted = (scores || []).filter((s: any) => s.status === 'submitted');
  const fieldMap = new Map<string, RawField>();
  submitted.forEach((s: any) => {
    (s.details || []).forEach((d: any) => {
      const f = Array.isArray(d.field) ? d.field[0] : d.field;
      if (!f || fieldMap.has(f.id)) return;
      const section = Array.isArray(f.section) ? f.section[0] : f.section;
      fieldMap.set(f.id, {
        id: f.id,
        name: f.name,
        max_points: Number(f.max_points || 0),
        score_type: ((f.score_type as ScoreType) || 'difficulty'),
        section_id: f.section_id,
        section_name: section?.name || '',
        section_order: section?.display_order ?? 0,
        field_order: f.display_order ?? 0,
      });
    });
  });

  const data = buildScoresheet({
    team_name: submission.team?.name || 'Team',
    gym_name: submission.team?.gym_name,
    division_name: submission.team?.division?.name,
    event_name: submission.event?.name || 'Event',
    accuscore_end_at: submission.event?.accuscore_end_at || null,
    fields: Array.from(fieldMap.values()),
    submitted_scores: submitted.map((s: any) => ({
      deductions: Number(s.deductions || 0),
      details: (s.details || []).map((d: any) => ({
        field_id: (Array.isArray(d.field) ? d.field[0] : d.field)?.id,
        points: Number(d.points || 0),
      })),
    })),
  });

  const bytes = await buildScoresheetPdf(data);
  const safeName = `${data.team_name} - ${data.event_name}`.replace(/[^\w\s-]/g, '').trim();
  downloadPdf(bytes, `${safeName || 'scoresheet'}.pdf`);
}
