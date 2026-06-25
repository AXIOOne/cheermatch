ALTER TYPE public.scoring_field_type ADD VALUE IF NOT EXISTS 'execution_driver';
ALTER TABLE public.scoring_fields ADD COLUMN IF NOT EXISTS start_value numeric;