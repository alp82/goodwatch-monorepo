-- Apply explicitly before deploying the text fingerprint storage changes.
-- Nullable additions preserve retained candidates; no backfill or startup DDL.
ALTER TABLE doc.yepwatch_candidate ADD COLUMN essence ARRAY(TEXT);
ALTER TABLE doc.yepwatch_candidate ADD COLUMN effects ARRAY(OBJECT(STRICT) AS (line TEXT, strength DOUBLE PRECISION, color TEXT));
ALTER TABLE doc.yepwatch_candidate ADD COLUMN not_for TEXT;
