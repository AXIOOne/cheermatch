
-- Fix search_path on generate_short_uuid + restrict execute
CREATE OR REPLACE FUNCTION public.generate_short_uuid()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..18 LOOP
    result := result || substr(chars, (floor(random() * 62) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_short_uuid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.legacy_session_lookup(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_mobile_sessions() FROM PUBLIC, anon, authenticated;
