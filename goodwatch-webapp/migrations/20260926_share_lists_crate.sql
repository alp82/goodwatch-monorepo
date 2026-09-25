-- CrateDB only. Additive and safe to re-run; run explicitly during release.
-- Share lists and public profiles. See docs/implementation/share-lists/README.md.
-- Deletes are soft: rows get deleted_at (and released_at for renamed handles), and every read filters them out.

-- A person's ranking of exactly five titles. items is in rank order.
CREATE TABLE IF NOT EXISTS doc.user_list (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_id TEXT,
  design TEXT NOT NULL,
  theme TEXT NOT NULL,
  signature TEXT,
  items ARRAY(OBJECT(STRICT) AS (media_type TEXT, tmdb_id BIGINT)),
  visibility TEXT NOT NULL,
  remixed_from TEXT,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.user_profile (
  user_id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

-- Crate has no unique index on non-key columns, so handles are claimed here: the handle is the key,
-- and an insert with ON CONFLICT DO NOTHING lets exactly one person claim it. A handle renamed away from
-- (released_at) or of a deleted account (deleted_at) is on hold for 90 days before anyone else can claim it.
CREATE TABLE IF NOT EXISTS doc.user_handle (
  handle TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
