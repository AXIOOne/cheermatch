-- Create scoring review tokens table for coach access via unique URLs
CREATE TABLE public.scoring_review_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.video_submissions(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    coach_email text NOT NULL,
    coach_name text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'review_requested', 'resolved')),
    review_notes text,
    requested_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.scoring_review_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can manage all tokens
CREATE POLICY "Admins can manage review tokens"
ON public.scoring_review_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create index for token lookups
CREATE INDEX idx_scoring_review_tokens_token ON public.scoring_review_tokens(token);
CREATE INDEX idx_scoring_review_tokens_submission ON public.scoring_review_tokens(submission_id);

-- Create a function to get review data by token (for public access)
CREATE OR REPLACE FUNCTION public.get_review_by_token(review_token text)
RETURNS TABLE (
    token_id uuid,
    token_status text,
    coach_email text,
    coach_name text,
    expires_at timestamp with time zone,
    team_name text,
    gym_name text,
    division_name text,
    level_name text,
    event_name text,
    video_url text,
    thumbnail_url text,
    submission_status text,
    scores json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        srt.id as token_id,
        srt.status as token_status,
        srt.coach_email,
        srt.coach_name,
        srt.expires_at,
        t.name as team_name,
        t.gym_name,
        d.name as division_name,
        l.name as level_name,
        e.name as event_name,
        vs.video_url,
        vs.thumbnail_url,
        vs.status::text as submission_status,
        (
            SELECT json_agg(json_build_object(
                'score_id', s.id,
                'total_score', s.total_score,
                'deductions', s.deductions,
                'comments', s.comments,
                'submitted_at', s.submitted_at,
                'categories', (
                    SELECT json_agg(json_build_object(
                        'name', sc.name,
                        'points', sd.points,
                        'max_points', sc.max_points,
                        'weight', sc.weight
                    ) ORDER BY sc.display_order)
                    FROM score_details sd
                    JOIN scoring_categories sc ON sc.id = sd.category_id
                    WHERE sd.score_id = s.id
                )
            ))
            FROM scores s
            WHERE s.submission_id = vs.id AND s.status = 'submitted'
        ) as scores
    FROM scoring_review_tokens srt
    JOIN video_submissions vs ON vs.id = srt.submission_id
    JOIN teams t ON t.id = vs.team_id
    JOIN divisions d ON d.id = t.division_id
    JOIN levels l ON l.id = t.level_id
    JOIN events e ON e.id = vs.event_id
    WHERE srt.token = review_token
      AND srt.expires_at > now();
END;
$$;

-- Function to submit a review request
CREATE OR REPLACE FUNCTION public.submit_review_request(review_token text, notes text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE scoring_review_tokens
    SET 
        status = 'review_requested',
        review_notes = notes,
        requested_at = now()
    WHERE token = review_token
      AND expires_at > now()
      AND status IN ('pending', 'viewed');
    
    RETURN FOUND;
END;
$$;

-- Function to mark token as viewed
CREATE OR REPLACE FUNCTION public.mark_review_viewed(review_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE scoring_review_tokens
    SET status = 'viewed'
    WHERE token = review_token
      AND expires_at > now()
      AND status = 'pending';
    
    RETURN FOUND;
END;
$$;