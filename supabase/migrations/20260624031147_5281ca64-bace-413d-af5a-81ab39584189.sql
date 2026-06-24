-- Add difficulty_driver value to scoring_field_type enum
ALTER TYPE public.scoring_field_type ADD VALUE IF NOT EXISTS 'difficulty_driver';