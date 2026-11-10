CREATE OR REPLACE FUNCTION public.prevent_scored_template_structure_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.scores WHERE template_id = OLD.template_id) THEN
    RAISE EXCEPTION 'This scoring template already has judge scores. Editing its sections, fields or deductions would erase those scores. Duplicate the template and edit the copy instead.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS protect_scored_sections ON public.scoring_sections;
CREATE TRIGGER protect_scored_sections BEFORE DELETE ON public.scoring_sections
FOR EACH ROW EXECUTE FUNCTION public.prevent_scored_template_structure_delete();

DROP TRIGGER IF EXISTS protect_scored_deductions ON public.deduction_types;
CREATE TRIGGER protect_scored_deductions BEFORE DELETE ON public.deduction_types
FOR EACH ROW EXECUTE FUNCTION public.prevent_scored_template_structure_delete();