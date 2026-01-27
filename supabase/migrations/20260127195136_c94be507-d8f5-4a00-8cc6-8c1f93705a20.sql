-- Add is_locked column to scoring_templates
ALTER TABLE public.scoring_templates 
ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.scoring_templates.is_locked IS 'When true, the template cannot be edited. Should be set when an event using this template is in progress.';