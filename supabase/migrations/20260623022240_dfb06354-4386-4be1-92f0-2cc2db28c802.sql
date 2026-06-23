
-- Default new submissions to 'imported'
ALTER TABLE public.video_submissions ALTER COLUMN status SET DEFAULT 'imported'::submission_status;

-- Backfill legacy statuses
UPDATE public.video_submissions SET status = 'imported'::submission_status
WHERE status IN ('pending','uploaded','processing','ready','failed');

-- Trigger: when a judge is assigned to (event, division, level),
-- mark matching approved submissions as 'assigned'
CREATE OR REPLACE FUNCTION public.set_submissions_assigned_on_judge_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.video_submissions vs
  SET status = 'assigned'::submission_status
  FROM public.teams t
  WHERE vs.team_id = t.id
    AND vs.event_id = NEW.event_id
    AND t.division_id = NEW.division_id
    AND t.level_id = NEW.level_id
    AND vs.status = 'approved'::submission_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_judge_assignment_set_submissions_assigned ON public.judge_assignments;
CREATE TRIGGER trg_judge_assignment_set_submissions_assigned
AFTER INSERT ON public.judge_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_submissions_assigned_on_judge_assignment();

-- Trigger: when an event becomes 'completed' or 'archived',
-- mark its approved/assigned submissions as 'complete'
CREATE OR REPLACE FUNCTION public.set_submissions_complete_on_event_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed'::event_status, 'archived'::event_status)
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.video_submissions
    SET status = 'complete'::submission_status
    WHERE event_id = NEW.id
      AND status IN ('approved'::submission_status, 'assigned'::submission_status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_close_complete_submissions ON public.events;
CREATE TRIGGER trg_event_close_complete_submissions
AFTER UPDATE OF status ON public.events
FOR EACH ROW EXECUTE FUNCTION public.set_submissions_complete_on_event_close();
