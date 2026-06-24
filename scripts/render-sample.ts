import { buildScoresheet } from '../src/lib/build-scoresheet';
import { buildScoresheetPdf } from '../src/lib/scoresheet-pdf';
import { writeFileSync } from 'fs';

const fields = [
  { id: 'f1', name: 'Stunts', max_points: 5, score_type: 'difficulty' as const, section_id: 's1', section_name: 'Building', section_order: 0, field_order: 0 },
  { id: 'f1e', name: 'Stunts', max_points: 5, score_type: 'execution' as const, section_id: 's1', section_name: 'Building', section_order: 0, field_order: 0 },
  { id: 'f2', name: 'Pyramids', max_points: 5, score_type: 'difficulty' as const, section_id: 's1', section_name: 'Building', section_order: 0, field_order: 1 },
  { id: 'f2e', name: 'Pyramids', max_points: 5, score_type: 'execution' as const, section_id: 's1', section_name: 'Building', section_order: 0, field_order: 1 },
  { id: 'f3', name: 'Tumbling', max_points: 10, score_type: 'difficulty' as const, section_id: 's2', section_name: 'Tumbling', section_order: 1, field_order: 0 },
  { id: 'f3e', name: 'Tumbling', max_points: 5, score_type: 'execution' as const, section_id: 's2', section_name: 'Tumbling', section_order: 1, field_order: 0 },
];

const catalog = [
  { id: 'd1', name: 'Athlete Fall', points: 0.15, display_order: 0 },
  { id: 'd2', name: 'Major Athlete Fall', points: 0.25, display_order: 1 },
  { id: 'd3', name: 'Building Bobble', points: 0.25, display_order: 2 },
  { id: 'd4', name: 'Building Fall', points: 0.75, display_order: 3 },
  { id: 'd5', name: 'Major Building Fall', points: 1.25, display_order: 4 },
  { id: 'd6', name: 'Boundary Violation', points: 0.05, display_order: 5 },
  { id: 'd7', name: 'Time Limit Violation', points: 0.05, display_order: 6 },
  { id: 'd8', name: 'Image Policy - USASF Uniform Top Guidelines', points: 0.01, display_order: 7 },
  { id: 'd9', name: 'Image Policy - APS', points: 0.25, display_order: 8 },
  { id: 'd10', name: 'General Rules/Out of Level Tumbling', points: 0.05, display_order: 9 },
  { id: 'd11', name: 'Building Out of Level', points: 0.10, display_order: 10 },
  { id: 'd12', name: 'All Level Rules/Skill Restrictions by Division', points: 0.50, display_order: 11 },
  { id: 'd13', name: 'Division Violation', points: 5.00, display_order: 12 },
];

const data = buildScoresheet({
  team_name: 'Lightning Bolts',
  gym_name: 'Storm Athletics',
  division_name: 'Senior Coed',
  level_name: 'Level 4',
  event_name: 'CheerMatch Championship 2026',
  event_phase: 'Finals',
  hall_name: 'Arena A',
  accuscore_end_at: new Date().toISOString(),
  fields,
  deduction_catalog: catalog,
  show_comments: true,
  submitted_scores: [
    {
      deductions: 0.5,
      details: fields.map(f => ({ field_id: f.id, points: f.max_points * 0.85 })),
      judge_label: 'B1',
      panel_name: 'Building 1',
      panel_abbreviation: 'B1',
      comments: 'Nice transitions, watch the timing on the pyramid release.',
    },
    {
      deductions: 0.4,
      details: fields.map(f => ({ field_id: f.id, points: f.max_points * 0.82 })),
      judge_label: 'B2',
      panel_name: 'Building 2',
      panel_abbreviation: 'B2',
      comments: 'Good energy throughout.',
    },
    {
      deductions: 0.6,
      details: [],
      judge_label: 'SD',
      panel_name: 'Safety & Deductions',
      panel_abbreviation: 'SD',
      comments: 'One athlete fall during the pyramid; minor boundary brush late in the routine. Overall safe performance.',
      deduction_items: [
        { deduction_type_id: 'd1', count: 1, warnings: 0 },
        { deduction_type_id: 'd3', count: 2, warnings: 1 },
        { deduction_type_id: 'd6', count: 0, warnings: 2 },
      ],
    },
  ],
});

buildScoresheetPdf(data).then(bytes => {
  writeFileSync('/tmp/sample-scoresheet.pdf', bytes);
  console.log('wrote /tmp/sample-scoresheet.pdf', bytes.length, 'bytes');
});
