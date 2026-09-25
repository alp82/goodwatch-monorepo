-- CrateDB only. Additive: stage timings per search, and the shadow ranking's list next to the served list.
-- Run before deploying the webapp that writes them. Rows from before this change keep NULL.

-- Milliseconds per stage of the served search, for example {"reading": 612.4, "ranking": 180.2, "display": 21.5}.
-- IGNORED: the keys can change without a schema change. Read the whole object; its keys aren't indexed.
ALTER TABLE doc.search_history ADD COLUMN stage_ms OBJECT(IGNORED);

-- One row per search that shadow mode saw (SEARCH_RANKING_MODE=shadow). history_id joins search_history.id.
-- The query text isn't stored here. Everything derived from it (the encoded texts, reference names, profile terms)
-- is in ciphertext, sealed with SEARCH_STORAGE_KEY like search_history.ciphertext.
CREATE TABLE IF NOT EXISTS doc.search_shadow (
  id TEXT PRIMARY KEY,
  history_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- ranked, skipped or failed; reason says why a search was skipped or failed.
  outcome TEXT NOT NULL,
  reason TEXT,
  served_ranker_version TEXT,
  ranker_version TEXT,
  build_id TEXT,
  -- general, non_english or reference
  route TEXT,
  lesser_known BOOLEAN,
  -- Keys (movie:<tmdb id>, show:<tmdb id>, person:<tmdb id>) of the served list's first 50 rows, in order.
  served_keys ARRAY(TEXT),
  -- The new ranking's list (at most 50), in order, with its blended scores.
  ranked_keys ARRAY(TEXT),
  ranked_scores ARRAY(DOUBLE),
  pool_size INTEGER,
  -- Milliseconds per stage of the new ranking, plus display (its display fields) and waited (queue before it ran).
  stage_ms OBJECT(IGNORED),
  -- Each Qdrant request: {name, queries, serverMs, wallMs}.
  rounds ARRAY(OBJECT(IGNORED)),
  ciphertext TEXT INDEX OFF
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
