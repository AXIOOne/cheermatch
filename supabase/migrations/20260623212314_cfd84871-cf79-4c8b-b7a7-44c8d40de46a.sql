
CREATE OR REPLACE FUNCTION public.verify_password(_password text, _hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT _hash IS NOT NULL AND crypt(_password, _hash) = _hash;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_password(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hash_password(_password text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(_password, gen_salt('bf', 10));
$$;
REVOKE EXECUTE ON FUNCTION public.hash_password(text) FROM PUBLIC, anon, authenticated;
