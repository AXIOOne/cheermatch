
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS level_id uuid REFERENCES public.levels(id);

UPDATE public.divisions d
SET level_id = l.id
FROM public.levels l
WHERE d.level_id IS NULL AND d.level IS NOT NULL AND lower(trim(d.level)) = lower(trim(l.name));

CREATE TABLE public.division_disciplines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  discipline text NOT NULL,
  scoring_template_id uuid REFERENCES public.scoring_templates(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (division_id, discipline)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.division_disciplines TO authenticated;
GRANT ALL ON public.division_disciplines TO service_role;

ALTER TABLE public.division_disciplines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view division disciplines"
ON public.division_disciplines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage division disciplines"
ON public.division_disciplines FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_division_disciplines_updated_at
BEFORE UPDATE ON public.division_disciplines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.division_disciplines (division_id, discipline, scoring_template_id)
SELECT d.id, COALESCE(d.discipline, 'allstar_cheer'), d.scoring_template_id
FROM public.divisions d
ON CONFLICT (division_id, discipline) DO NOTHING;

CREATE INDEX idx_division_disciplines_discipline ON public.division_disciplines (discipline);
