DROP INDEX IF EXISTS public.idx_unique_judge_panel;

CREATE UNIQUE INDEX idx_unique_judge_panel
ON public.judge_assignments (
  event_id,
  division_id,
  panel_id,
  COALESCE(section_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE panel_id IS NOT NULL;