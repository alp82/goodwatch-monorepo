-- CrateDB only. Additive and safe to re-run; run explicitly during release.
-- IMDb ratings import. See docs/research/imdb-ratings-import.md and app/server/imdb-import.

-- One row per uploaded file. status: preview (nothing written to user_score yet), running, done, failed, undone.
-- counts is the preview's outcome counts as JSON text. added, updated, kept and failed count what the apply wrote.
-- updated_at is the apply's heartbeat: a running import whose heartbeat is old has stalled and can be resumed.
-- confirmed_at is written to user_score.created_at/updated_at by this import, which is how the apply recognises
-- its own writes after an interruption.
CREATE TABLE IF NOT EXISTS doc.user_import (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  file_name TEXT,
  conflict_choice TEXT,
  counts TEXT NOT NULL,
  processed INTEGER NOT NULL,
  total INTEGER NOT NULL,
  added INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  kept INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  without_fingerprint INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

-- One row per data row of the file, in file order. The source observation (IMDb ID, rating, date rated) is kept
-- apart from the effective GoodWatch rating in user_score.
-- outcome: new, update, unchanged, conflict, unmatched, unsupported, invalid.
-- current_score is the member's GoodWatch rating when the preview was made.
-- apply_state: NULL (nothing written), added, updated, kept (the GoodWatch rating stayed), failed (retry), undone.
-- prior_score and applied_score are set when the import writes the rating: what undo restores, and what it must
-- still find in user_score to do so. A later import reads applied_score to tell its own ratings from the member's.
CREATE TABLE IF NOT EXISTS doc.user_import_item (
  import_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  imdb_id TEXT,
  title TEXT,
  year INTEGER,
  title_type TEXT,
  raw_rating TEXT,
  imdb_score INTEGER,
  date_rated TEXT,
  outcome TEXT NOT NULL,
  reason TEXT,
  tmdb_id BIGINT,
  media_type TEXT,
  current_score INTEGER,
  apply_state TEXT,
  prior_score INTEGER,
  applied_score INTEGER,
  applied_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (import_id, row_index)
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
