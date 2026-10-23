-- #759: member season, episode and part scores, apart from user_score (movies and whole shows only).
-- Additive. Run once against CrateDB before relying on the feature; the webapp tolerates the table being absent:
-- show pages show no member episode scores and offer no score control, the score route answers 503, and import
-- previews keep season and episode scores as "not imported yet".
-- Matches SCHEMAS["user_episode_score"] in goodwatch-flows/windmill/f/sync/models/crate_schemas.py, so the
-- f/sync/init/cratedb flow would create the same table.
CREATE TABLE IF NOT EXISTS doc.user_episode_score (
  user_id TEXT,
  tmdb_id INTEGER,
  score_key TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('season','episode','part')),
  season_number INTEGER,
  episode_number INTEGER,
  episode_tmdb_id INTEGER,
  ranges TEXT INDEX OFF STORAGE WITH (columnstore = false),
  label TEXT,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (user_id, tmdb_id, score_key)
) CLUSTERED BY (user_id) INTO 6 SHARDS;

REFRESH TABLE doc.user_episode_score;
