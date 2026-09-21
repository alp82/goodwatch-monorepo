-- Executed only against the scratch table after the user's 50,000-title request.
-- The expansion loader first checks whether this column already exists.
ALTER TABLE doc.prototype_search_evidence_104_v1 ADD COLUMN poster_path TEXT;
-- Insert 45,000 additional titles in parameterized batches; retain original 5,000.
-- Populate original titles' posters with parameterized primary-key UPDATEs.
-- No mutations of movie, show, trope, or production sync flows.
