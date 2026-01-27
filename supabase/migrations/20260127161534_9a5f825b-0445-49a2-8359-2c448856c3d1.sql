-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('pending', 'uploaded', 'processing', 'ready', 'failed');

-- Create enum for score status
CREATE TYPE public.score_status AS ENUM ('in_progress', 'submitted', 'locked');

-- Create video_submissions table
CREATE TABLE public.video_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    brightcove_video_id TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    status submission_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scores table (overall score for a team by a judge)
CREATE TABLE public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.video_submissions(id) ON DELETE CASCADE NOT NULL,
    judge_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.scoring_templates(id) NOT NULL,
    total_score DECIMAL(6,2),
    deductions DECIMAL(6,2) DEFAULT 0,
    comments TEXT,
    status score_status NOT NULL DEFAULT 'in_progress',
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (submission_id, judge_user_id)
);

-- Create score_details table (individual category scores)
CREATE TABLE public.score_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID REFERENCES public.scores(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.scoring_categories(id) ON DELETE CASCADE NOT NULL,
    points DECIMAL(5,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (score_id, category_id)
);

-- Enable RLS
ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_details ENABLE ROW LEVEL SECURITY;

-- Video submissions policies
CREATE POLICY "Coaches can view their team submissions"
ON public.video_submissions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = video_submissions.team_id
        AND t.coach_user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can manage their team submissions"
ON public.video_submissions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = video_submissions.team_id
        AND t.coach_user_id = auth.uid()
    )
);

CREATE POLICY "Judges can view submissions in their assignments"
ON public.video_submissions FOR SELECT
USING (
    public.has_role(auth.uid(), 'judge') AND
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.judge_assignments ja ON ja.event_id = t.event_id
        WHERE t.id = video_submissions.team_id
        AND ja.judge_user_id = auth.uid()
        AND (ja.division_id IS NULL OR ja.division_id = t.division_id)
        AND (ja.level_id IS NULL OR ja.level_id = t.level_id)
    )
);

CREATE POLICY "Admins can manage all submissions"
ON public.video_submissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Scores policies
CREATE POLICY "Judges can view their own scores"
ON public.scores FOR SELECT
USING (judge_user_id = auth.uid());

CREATE POLICY "Judges can create scores"
ON public.scores FOR INSERT
WITH CHECK (
    judge_user_id = auth.uid() AND
    public.has_role(auth.uid(), 'judge')
);

CREATE POLICY "Judges can update their own non-locked scores"
ON public.scores FOR UPDATE
USING (
    judge_user_id = auth.uid() AND
    status != 'locked'
);

CREATE POLICY "Admins can view all scores"
ON public.scores FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all scores"
ON public.scores FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Score details policies
CREATE POLICY "Judges can view their own score details"
ON public.score_details FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.scores s
        WHERE s.id = score_details.score_id
        AND s.judge_user_id = auth.uid()
    )
);

CREATE POLICY "Judges can manage their own score details"
ON public.score_details FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.scores s
        WHERE s.id = score_details.score_id
        AND s.judge_user_id = auth.uid()
        AND s.status != 'locked'
    )
);

CREATE POLICY "Admins can view all score details"
ON public.score_details FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all score details"
ON public.score_details FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_video_submissions_updated_at
BEFORE UPDATE ON public.video_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scores_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();