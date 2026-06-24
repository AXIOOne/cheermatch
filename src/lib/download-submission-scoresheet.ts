import { supabase } from '@/integrations/supabase/client';
import { buildScoresheet, type RawField, type ScoreType } from '@/lib/build-scoresheet';
import { buildScoresheetPdf, downloadPdf } from '@/lib/scoresheet-pdf';

const sb = supabase as any;

export async function generateSubmissionScoresheetBytes(
  submissionId: string,
  options: { includeAllScores?: boolean } = {}
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const { data: submission, error: subErr } = await sb
    .from('video_submissions')
    .select(`
      id, event_id,
      team:teams!inner(id, name, gym_name,
        division:divisions!inner(id, name, scoring_template_id),
        level:levels(id, name)),
      event:events!inner(id, name, accuscore_end_at)
    `)
    .eq('id', submissionId)
    .maybeSingle();
  if (subErr) throw subErr;
  if (!submission) throw new Error('Submission not found');


  const { data: scores, error: scoresErr } = await sb
    .from('scores')
    .select(`
      id, deductions, status, comments, template_id,
      panel:judge_panels(name, abbreviation),
      details:score_details(
        points,
        field:scoring_fields(id, name, max_points, section_id, score_type, display_order,
          section:scoring_sections(id, name, display_order))
      ),
      deduction_items:score_deductions(deduction_type_id, count, warnings)
    `)
    .eq('submission_id', submissionId);
  if (scoresErr) throw scoresErr;

  const usable = (scores || []).filter((s: any) =>
    options.includeAllScores ? true : s.status === 'submitted'
  );

  let show_comments = false;
  let deduction_catalog: Array<{ id: string; name: string; points: number; display_order: number }> = [];
  let templateId: string | null = usable[0]?.template_id ?? null;

  // If no submitted scores yet, resolve the template from the event so the
  // sheet still shows every criterion row (blank) with correct max totals.
  if (!templateId) {
    const { data: tpls } = await sb
      .from('scoring_templates')
      .select('id, is_default')
      .eq('event_id', submission.event_id)
      .order('is_default', { ascending: false })
      .limit(1);
    templateId = tpls?.[0]?.id ?? null;
  }

  const fieldMap = new Map<string, RawField>();
  if (templateId) {
    const { data: tpl } = await sb
      .from('scoring_templates')
      .select('show_comments_on_scoresheet')
      .eq('id', templateId)
      .maybeSingle();
    show_comments = !!tpl?.show_comments_on_scoresheet;

    const { data: dts } = await sb
      .from('deduction_types')
      .select('id, name, points, display_order')
      .eq('template_id', templateId);
    deduction_catalog = (dts || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      points: Number(d.points || 0),
      display_order: Number(d.display_order ?? 0),
    }));

    // Load ALL template fields so unscored criteria still render as blank rows.
    const { data: tplFields } = await sb
      .from('scoring_fields')
      .select(`id, name, max_points, section_id, score_type, display_order,
               section:scoring_sections!inner(id, name, display_order, template_id)`)
      .eq('section.template_id', templateId);
    (tplFields || []).forEach((f: any) => {
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
  }

  // Safety net: include any field referenced by an existing score detail that
  // isn't in the template lookup (e.g. a legacy field that was deleted).
  usable.forEach((s: any) => {
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

  const team = submission.team;
  const data = buildScoresheet({
    team_name: team?.name || 'Team',
    gym_name: team?.gym_name,
    division_name: team?.division?.name,
    level_name: team?.level?.name,
    event_name: submission.event?.name || 'Event',
    accuscore_end_at: submission.event?.accuscore_end_at || null,
    fields: Array.from(fieldMap.values()),
    show_comments,
    deduction_catalog,
    submitted_scores: usable.map((s: any) => {
      const panel = Array.isArray(s.panel) ? s.panel[0] : s.panel;
      return {
        deductions: Number(s.deductions || 0),
        comments: s.comments || null,
        judge_label: panel?.name || panel?.abbreviation || null,
        panel_name: panel?.name || null,
        panel_abbreviation: panel?.abbreviation || null,
        deduction_items: (s.deduction_items || []).map((it: any) => ({
          deduction_type_id: it.deduction_type_id,
          count: Number(it.count || 0),
          warnings: Number(it.warnings || 0),
        })),
        details: (s.details || []).map((d: any) => ({
          field_id: (Array.isArray(d.field) ? d.field[0] : d.field)?.id,
          points: Number(d.points || 0),
        })),
      };
    }),
  });

  const bytes = await buildScoresheetPdf(data);
  const safeName = `${data.team_name} - ${data.event_name}`.replace(/[^\w\s-]/g, '').trim();
  return { bytes, fileName: `${safeName || 'scoresheet'}.pdf` };
}


export async function downloadSubmissionScoresheet(submissionId: string) {
  const { bytes, fileName } = await generateSubmissionScoresheetBytes(submissionId);
  downloadPdf(bytes, fileName);
}
