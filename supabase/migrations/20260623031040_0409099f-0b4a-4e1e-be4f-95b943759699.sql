ALTER TABLE public.judge_assignments
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.scoring_sections(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS judge_assignments_event_division_section_uniq
  ON public.judge_assignments (event_id, division_id, section_id)
  WHERE section_id IS NOT NULL;