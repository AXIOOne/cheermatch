
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- EVENTS: add legacy-format columns
-- =========================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS long_description text,
  ADD COLUMN IF NOT EXISTS start_time time NOT NULL DEFAULT '00:00:00',
  ADD COLUMN IF NOT EXISTS end_time time NOT NULL DEFAULT '00:00:00',
  ADD COLUMN IF NOT EXISTS broadcast_deadline_date date,
  ADD COLUMN IF NOT EXISTS broadcast_deadline_time time NOT NULL DEFAULT '00:00:00',
  ADD COLUMN IF NOT EXISTS broadcast_channel text NOT NULL DEFAULT 'VTV',
  ADD COLUMN IF NOT EXISTS sub_deadline date,
  ADD COLUMN IF NOT EXISTS reg_cost numeric(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sanctioned_event boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS release_score_leaderboard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS per_show_registrations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS season_id integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS screen_capture_cnt integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS duration_of_capture integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS current_match text,
  ADD COLUMN IF NOT EXISTS scoresheet_template_name text,
  ADD COLUMN IF NOT EXISTS hide_from_website boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_teams_and_divisions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dont_show_scoresheet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS list_on_special_events_page boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_video_from_team_gym_division boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_uuid text UNIQUE;

-- Short uuid generator for legacy event_uuid (18 chars, base62-ish)
CREATE OR REPLACE FUNCTION public.generate_short_uuid()
RETURNS text
LANGUAGE plpgsql
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

UPDATE public.events SET event_uuid = public.generate_short_uuid() WHERE event_uuid IS NULL;

-- =========================================================
-- PROFILES: password hash for mobile login
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash text;

-- =========================================================
-- ROLES: add content_contributor
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'content_contributor'
                 AND enumtypid = (SELECT oid FROM pg_type WHERE typname='app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'content_contributor';
  END IF;
END$$;

-- =========================================================
-- MOBILE SESSIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.mobile_sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

GRANT ALL ON public.mobile_sessions TO service_role;
ALTER TABLE public.mobile_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage mobile sessions"
  ON public.mobile_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS mobile_sessions_user_id_idx ON public.mobile_sessions(user_id);
CREATE INDEX IF NOT EXISTS mobile_sessions_expires_at_idx ON public.mobile_sessions(expires_at);

-- =========================================================
-- PASSWORD RESET CODES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.password_reset_codes TO service_role;
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view reset codes"
  ON public.password_reset_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS password_reset_codes_email_idx ON public.password_reset_codes(email);
CREATE INDEX IF NOT EXISTS password_reset_codes_code_idx ON public.password_reset_codes(code);

-- =========================================================
-- CONTENT CATEGORIES & VIDEOS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_categories TO anon, authenticated;
GRANT ALL ON public.content_categories TO service_role;
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read content categories"
  ON public.content_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage content categories"
  ON public.content_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.content_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.content_categories(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_videos TO authenticated;
GRANT ALL ON public.content_videos TO service_role;
ALTER TABLE public.content_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own content videos"
  ON public.content_videos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert their own content videos"
  ON public.content_videos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage content videos"
  ON public.content_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER content_categories_updated_at
  BEFORE UPDATE ON public.content_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER content_videos_updated_at
  BEFORE UPDATE ON public.content_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- HELPER FUNCTIONS (SECURITY DEFINER) for edge functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.legacy_session_lookup(_token text)
RETURNS TABLE(user_id uuid, email text, full_name text, organization_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.user_id, p.email, p.full_name, p.organization_name
  FROM public.mobile_sessions ms
  JOIN public.profiles p ON p.user_id = ms.user_id
  WHERE ms.token = _token AND ms.expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_mobile_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.mobile_sessions WHERE expires_at < now();
$$;

-- =========================================================
-- PLATFORM SETTINGS: seed mobile app + dropbox defaults
-- =========================================================
INSERT INTO public.platform_settings (key, value)
VALUES
  ('mobile_app_version', '{"min_version":"1.0.0","latest_version":"1.0.0","force_update":false,"update_url":""}'::jsonb),
  ('dropbox_settings', '{"app_key":"","app_secret":"","access_token":"","upload_folder":"/submissions","enabled":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
