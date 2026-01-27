-- =====================================================
-- COMPREHENSIVE SCORING TEMPLATE SYSTEM UPDATE
-- Implements United Scoring System with judge sections,
-- hierarchical categories, and structured deductions
-- =====================================================

-- 1. Create category_type enum
CREATE TYPE public.category_type AS ENUM ('main', 'difficulty', 'execution', 'driver');

-- 2. Create deduction_category enum  
CREATE TYPE public.deduction_category AS ENUM ('athlete', 'building', 'rule_violation', 'legality');

-- 3. Create scoring_sections table (groups categories by judge type)
CREATE TABLE public.scoring_sections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    description TEXT,
    max_points NUMERIC NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create deduction_types table (predefined deduction categories per template)
CREATE TABLE public.deduction_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    points NUMERIC NOT NULL,
    description TEXT,
    category deduction_category NOT NULL DEFAULT 'athlete',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create score_deductions table (track deduction instances per score)
CREATE TABLE public.score_deductions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    deduction_type_id UUID NOT NULL REFERENCES public.deduction_types(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Add new columns to scoring_categories
ALTER TABLE public.scoring_categories 
    ADD COLUMN section_id UUID REFERENCES public.scoring_sections(id) ON DELETE SET NULL,
    ADD COLUMN parent_category_id UUID REFERENCES public.scoring_categories(id) ON DELETE CASCADE,
    ADD COLUMN category_type category_type NOT NULL DEFAULT 'main';

-- 7. Create indexes for performance
CREATE INDEX idx_scoring_sections_template ON public.scoring_sections(template_id);
CREATE INDEX idx_deduction_types_template ON public.deduction_types(template_id);
CREATE INDEX idx_score_deductions_score ON public.score_deductions(score_id);
CREATE INDEX idx_scoring_categories_section ON public.scoring_categories(section_id);
CREATE INDEX idx_scoring_categories_parent ON public.scoring_categories(parent_category_id);

-- 8. Enable RLS on new tables
ALTER TABLE public.scoring_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_deductions ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for scoring_sections
CREATE POLICY "Admins can manage scoring sections"
ON public.scoring_sections FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges and admins can view scoring sections"
ON public.scoring_sections FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'judge'::app_role));

-- 10. RLS policies for deduction_types
CREATE POLICY "Admins can manage deduction types"
ON public.deduction_types FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges and admins can view deduction types"
ON public.deduction_types FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'judge'::app_role));

-- 11. RLS policies for score_deductions
CREATE POLICY "Admins can manage all score deductions"
ON public.score_deductions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Judges can manage their own score deductions"
ON public.score_deductions FOR ALL
USING (EXISTS (
    SELECT 1 FROM scores s
    WHERE s.id = score_deductions.score_id
    AND s.judge_user_id = auth.uid()
    AND s.status <> 'locked'::score_status
));

CREATE POLICY "Judges can view their own score deductions"
ON public.score_deductions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM scores s
    WHERE s.id = score_deductions.score_id
    AND s.judge_user_id = auth.uid()
));