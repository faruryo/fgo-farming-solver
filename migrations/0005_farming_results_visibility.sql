-- Migration number: 0005 	 2026-09-27T00:00:00.000Z

-- 1 = public (accessible by anyone with the link), 0 = private (owner only).
-- Default is 1 so all pre-existing results and shared links remain publicly accessible.
ALTER TABLE farming_results ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
