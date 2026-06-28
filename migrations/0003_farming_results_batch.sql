-- Migration number: 0003 	 2026-06-28T00:00:00.000Z

-- Batch ID to link A/B dual-goal results (目標A=必要分 / 目標B=ストック込み).
-- NULL = single-goal row (pre-feature, or stockEnabled=OFF, or B==A).
-- Both rows share the same batch_id (UUID) generated at solve time.
ALTER TABLE farming_results ADD COLUMN batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_results_batch ON farming_results(batch_id);
