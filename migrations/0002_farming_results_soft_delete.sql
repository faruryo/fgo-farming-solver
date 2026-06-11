-- Migration number: 0002 	 2026-06-12T00:00:00.000Z

-- NULL = active row. Soft delete keeps result pages (shared links) reachable.
ALTER TABLE farming_results ADD COLUMN deleted_at DATETIME;

-- JSON summary of the quest selection at solve time. NULL = pre-feature rows.
ALTER TABLE farming_results ADD COLUMN quest_selection TEXT;
