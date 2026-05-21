-- Create rubrics table
CREATE TABLE public.scoring_rubrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  season TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  division_id UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
  level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scoring_rubrics_event ON public.scoring_rubrics(event_id);
CREATE INDEX idx_scoring_rubrics_division ON public.scoring_rubrics(division_id);
CREATE INDEX idx_scoring_rubrics_level ON public.scoring_rubrics(level_id);
CREATE INDEX idx_scoring_rubrics_season ON public.scoring_rubrics(season);

ALTER TABLE public.scoring_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scoring rubrics"
ON public.scoring_rubrics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges and admins can view scoring rubrics"
ON public.scoring_rubrics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'judge'::app_role));

CREATE TRIGGER update_scoring_rubrics_updated_at
BEFORE UPDATE ON public.scoring_rubrics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rubrics', 'rubrics', false);

-- Storage policies
CREATE POLICY "Admins can upload rubric files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rubrics' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rubric files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'rubrics' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rubric files"
ON storage.objects FOR DELETE
USING (bucket_id = 'rubrics' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges and admins can view rubric files"
ON storage.objects FOR SELECT
USING (bucket_id = 'rubrics' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'judge'::app_role)));