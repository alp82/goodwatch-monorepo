-- Apply explicitly after a snapshot, before deploying the API. The API never runs this migration.
-- Additive. Crate 6.4.6 ADD COLUMN has no IF NOT EXISTS: a replay fails with
-- "already has a column named nopes" and can be skipped.
ALTER TABLE doc.yepwatch_taste_profile ADD COLUMN nopes ARRAY(OBJECT(STRICT) AS ("key" BIGINT, "at" BIGINT));
