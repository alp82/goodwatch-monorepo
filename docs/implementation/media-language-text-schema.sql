-- Additive Crate schema migration. Owner checkpoint before application; no data backfill.

CREATE TABLE IF NOT EXISTS doc.season_translation (
  show_id INTEGER NOT NULL, tmdb_id INTEGER NOT NULL,
  language_code TEXT NOT NULL, country_code TEXT NOT NULL,
  name TEXT INDEX OFF,
  overview TEXT INDEX OFF STORAGE WITH (columnstore = false),
  PRIMARY KEY (show_id, tmdb_id, language_code, country_code)
) CLUSTERED BY (show_id) INTO 6 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.episode_translation (
  show_id INTEGER NOT NULL, tmdb_id INTEGER NOT NULL,
  language_code TEXT NOT NULL, country_code TEXT NOT NULL,
  name TEXT INDEX OFF,
  overview TEXT INDEX OFF STORAGE WITH (columnstore = false),
  PRIMARY KEY (show_id, tmdb_id, language_code, country_code)
) CLUSTERED BY (show_id) INTO 6 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.prose_translation (
  source_id TEXT NOT NULL, source_revision TEXT NOT NULL, language TEXT NOT NULL,
  text TEXT INDEX OFF STORAGE WITH (columnstore = false), status TEXT,
  model TEXT, attempts INTEGER, prompt_tokens LONG, completion_tokens LONG,
  cost_usd DOUBLE, validation_revision TEXT, created_at TIMESTAMP, updated_at TIMESTAMP,
  PRIMARY KEY (source_id, source_revision, language)
) CLUSTERED INTO 3 SHARDS WITH (number_of_replicas = '0-1');
