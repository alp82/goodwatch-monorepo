-- Apply explicitly after a snapshot and before deploying Matches I'm in. Do not run at startup.
-- CrateDB's ADD COLUMN has no IF NOT EXISTS: a replayed statement fails with "column already exists" and can be skipped.
ALTER TABLE doc.yepwatch_room ADD COLUMN in_version BIGINT;
ALTER TABLE doc.yepwatch_room ADD COLUMN tiebreak_record TEXT INDEX OFF STORAGE WITH (columnstore = false);
