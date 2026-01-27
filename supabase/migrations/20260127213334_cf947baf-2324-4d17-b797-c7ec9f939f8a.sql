-- Function to auto-lock scoring templates when event goes in_progress
CREATE OR REPLACE FUNCTION public.auto_lock_templates_on_event_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status changes TO 'in_progress'
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status <> 'in_progress') THEN
    UPDATE public.scoring_templates
    SET is_locked = true
    WHERE event_id = NEW.id
      AND is_locked = false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on events table
DROP TRIGGER IF EXISTS trigger_auto_lock_templates ON public.events;
CREATE TRIGGER trigger_auto_lock_templates
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_lock_templates_on_event_start();