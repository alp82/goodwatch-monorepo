-- Apply before deploying search invocation attribution. Additive, no historical backfill.
ALTER TABLE doc.search_spending ADD COLUMN attribution OBJECT(STRICT) AS (
  version INTEGER, consumer TEXT, surface TEXT, trigger TEXT, actor_kind TEXT,
  search_id TEXT, reported_by TEXT
);
ALTER TABLE doc.search_history ADD COLUMN attribution OBJECT(STRICT) AS (
  version INTEGER, consumer TEXT, surface TEXT, trigger TEXT, actor_kind TEXT,
  search_id TEXT, reported_by TEXT
);
