
ALTER TABLE public.scoring_templates ALTER COLUMN event_id DROP NOT NULL;
DROP FUNCTION IF EXISTS public.auto_lock_templates_on_event_start() CASCADE;
ALTER TABLE public.divisions
  ADD COLUMN IF NOT EXISTS scoring_template_id uuid REFERENCES public.scoring_templates(id) ON DELETE SET NULL;
