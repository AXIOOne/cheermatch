
-- 1. Extend submission_status enum
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'imported';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'denied';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'complete';
