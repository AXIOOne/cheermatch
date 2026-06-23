
-- Phase 1: Lifecycle windows + review metadata
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_open_at  timestamptz,
  ADD COLUMN IF NOT EXISTS registration_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_open_at    timestamptz,
  ADD COLUMN IF NOT EXISTS submission_close_at   timestamptz,
  ADD COLUMN IF NOT EXISTS scoring_open_at       timestamptz,
  ADD COLUMN IF NOT EXISTS scoring_close_at      timestamptz;

-- Back-fill submission_close_at from existing sub_deadline (date) where possible
UPDATE public.events
SET submission_close_at = (sub_deadline::timestamp AT TIME ZONE COALESCE(time_zone, 'America/New_York'))
WHERE submission_close_at IS NULL AND sub_deadline IS NOT NULL;

-- Extend submission_status enum with revision_requested
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'submission_status' AND e.enumlabel = 'revision_requested'
  ) THEN
    ALTER TYPE public.submission_status ADD VALUE 'revision_requested';
  END IF;
END $$;

ALTER TABLE public.video_submissions
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by  uuid REFERENCES auth.users(id);

-- Helper RPC: aggregate coach-account status for an event
CREATE OR REPLACE FUNCTION public.coach_account_status(_event_id uuid)
RETURNS TABLE(
  coach_email text,
  coach_name  text,
  team_count  bigint,
  user_exists boolean,
  has_gym_coach_role boolean,
  user_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH coaches AS (
    SELECT
      lower(trim(t.coach_email)) AS coach_email,
      max(t.coach_name) AS coach_name,
      count(*) AS team_count
    FROM public.teams t
    WHERE t.event_id = _event_id
      AND t.coach_email IS NOT NULL
      AND trim(t.coach_email) <> ''
    GROUP BY lower(trim(t.coach_email))
  )
  SELECT
    c.coach_email,
    c.coach_name,
    c.team_count,
    (p.user_id IS NOT NULL) AS user_exists,
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'gym_coach'::app_role
    ) AS has_gym_coach_role,
    p.user_id
  FROM coaches c
  LEFT JOIN public.profiles p ON lower(p.email) = c.coach_email;
$$;

GRANT EXECUTE ON FUNCTION public.coach_account_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_account_status(uuid) TO service_role;
