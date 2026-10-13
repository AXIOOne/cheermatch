DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.conname, c.conrelid::regclass AS t, a.attname AS col
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.confrelid='auth.users'::regclass AND c.contype='f' AND c.confdeltype='a'
      AND c.conrelid::regclass::text IN ('teams','video_submissions','platform_settings','email_templates')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.t, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.t, r.conname, r.col);
  END LOOP;
END $$;