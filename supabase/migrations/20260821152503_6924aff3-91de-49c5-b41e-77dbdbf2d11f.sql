CREATE TABLE public.scoring_template_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  abbreviation text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_template_panels TO authenticated;
GRANT ALL ON public.scoring_template_panels TO service_role;

ALTER TABLE public.scoring_template_panels ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX scoring_template_panels_template_abbrev_key
  ON public.scoring_template_panels (template_id, upper(abbreviation));
CREATE INDEX scoring_template_panels_template_idx
  ON public.scoring_template_panels (template_id, display_order);

CREATE POLICY "Authenticated users can view template panels"
  ON public.scoring_template_panels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage template panels"
  ON public.scoring_template_panels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_scoring_template_panels_updated_at
  BEFORE UPDATE ON public.scoring_template_panels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.scoring_template_panels (template_id, name, abbreviation, display_order)
SELECT t.template_id, t.abbrev, t.abbrev,
       (row_number() OVER (PARTITION BY t.template_id ORDER BY t.abbrev))::int - 1
FROM (
  SELECT DISTINCT sf.template_id, upper(sfp.panel_abbreviation) AS abbrev
  FROM public.scoring_field_panels sfp
  JOIN public.scoring_fields sf ON sf.id = sfp.field_id
  WHERE sfp.panel_abbreviation IS NOT NULL
    AND trim(sfp.panel_abbreviation) <> ''
    AND upper(sfp.panel_abbreviation) <> 'ALL'
) t;