-- Create judge_panels table for configurable scoring panels per event
CREATE TABLE public.judge_panels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name text NOT NULL,
    abbreviation text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.judge_panels ENABLE ROW LEVEL SECURITY;

-- Admins can manage judge panels
CREATE POLICY "Admins can manage judge panels"
ON public.judge_panels
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view panels of visible events
CREATE POLICY "Anyone can view judge panels of visible events"
ON public.judge_panels
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = judge_panels.event_id 
    AND (e.status <> 'draft'::event_status OR has_role(auth.uid(), 'admin'::app_role))
));

-- Add panel_id to judge_assignments to link judges to specific panels
ALTER TABLE public.judge_assignments
ADD COLUMN panel_id uuid REFERENCES public.judge_panels(id) ON DELETE SET NULL;

-- Create unique constraint: one judge per panel per event
CREATE UNIQUE INDEX idx_unique_judge_panel 
ON public.judge_assignments(event_id, panel_id) 
WHERE panel_id IS NOT NULL;

-- Add panel_id to scores to track which panel scored each submission
ALTER TABLE public.scores
ADD COLUMN panel_id uuid REFERENCES public.judge_panels(id) ON DELETE SET NULL;