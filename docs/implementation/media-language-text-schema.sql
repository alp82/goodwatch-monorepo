-- Additive Crate schema migration. Approved only after branch lands on main, owner coordinates application; no data backfill.

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
