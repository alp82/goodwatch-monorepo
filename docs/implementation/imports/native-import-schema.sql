-- Additive migration for native Letterboxd/Trakt imports.
-- Run once against CrateDB before enabling /api/imports. Do not drop or rewrite IMDb data.
ALTER TABLE doc.user_import ADD COLUMN options TEXT INDEX OFF;
ALTER TABLE doc.user_import ADD COLUMN warnings TEXT INDEX OFF;
ALTER TABLE doc.user_import ADD COLUMN kinds TEXT INDEX OFF;
ALTER TABLE doc.user_import ADD COLUMN file_hash TEXT;

ALTER TABLE doc.user_import_item ADD COLUMN kind TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN source_key TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN payload TEXT INDEX OFF STORAGE WITH (columnstore = false);
ALTER TABLE doc.user_import_item ADD COLUMN season_number INTEGER;
ALTER TABLE doc.user_import_item ADD COLUMN episode_number INTEGER;
ALTER TABLE doc.user_import_item ADD COLUMN episode_tmdb_id BIGINT;
ALTER TABLE doc.user_import_item ADD COLUMN watched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE doc.user_import_item ADD COLUMN watched_at_precision TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN pass INTEGER;
ALTER TABLE doc.user_import_item ADD COLUMN source_status TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN watch_id TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN prior_state TEXT;
ALTER TABLE doc.user_import_item ADD COLUMN applied_state TEXT;

REFRESH TABLE doc.user_import, doc.user_import_item;
