-- Apply explicitly after a snapshot and before deploying the picks ranker. Do not run at startup.
ALTER TABLE doc.yepwatch_candidate ADD COLUMN reason OBJECT(STRICT) AS (code TEXT, text TEXT);
ALTER TABLE doc.yepwatch_room ADD COLUMN started_at BIGINT;
ALTER TABLE doc.yepwatch_room ADD COLUMN dealt_keys ARRAY(TEXT);
ALTER TABLE doc.yepwatch_room ADD COLUMN first_match_at BIGINT;
ALTER TABLE doc.yepwatch_room ADD COLUMN outcome_emitted_at BIGINT;
ALTER TABLE doc.yepwatch_room ADD COLUMN ranker_version TEXT;
ALTER TABLE doc.yepwatch_room ADD COLUMN taste_sources OBJECT(STRICT) AS (member BIGINT, profile BIGINT, none BIGINT);
ALTER TABLE doc.yepwatch_room ADD COLUMN outcome ARRAY(OBJECT(STRICT) AS (
  position BIGINT, reason TEXT, taste DOUBLE PRECISION, idea DOUBLE PRECISION, quality DOUBLE PRECISION,
  score DOUBLE PRECISION, yep BIGINT, nope BIGINT, unanswered BIGINT, matched BOOLEAN, moved BOOLEAN
));
