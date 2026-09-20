-- PROTOTYPE, wipe me. Requires explicit approval before execution on production.
-- Deliberately no IF NOT EXISTS: never reuse an unknown table.
CREATE TABLE doc.prototype_search_evidence_104_v1 (
  media_type TEXT,
  tmdb_id BIGINT,
  title TEXT,
  release_year INTEGER,
  votes BIGINT,
  fingerprint_scores OBJECT(IGNORED),
  essence_tags ARRAY(TEXT),
  keywords ARRAY(TEXT),
  trope_names ARRAY(TEXT),
  essence_text TEXT INDEX USING FULLTEXT WITH (analyzer = 'standard'),
  synopsis TEXT INDEX USING FULLTEXT WITH (analyzer = 'standard'),
  strong_evidence_standard TEXT INDEX USING FULLTEXT WITH (analyzer = 'standard'),
  text_evidence_standard TEXT INDEX USING FULLTEXT WITH (analyzer = 'standard'),
  strong_evidence TEXT INDEX USING FULLTEXT WITH (analyzer = 'english'),
  text_evidence TEXT INDEX USING FULLTEXT WITH (analyzer = 'english'),
  PRIMARY KEY (media_type, tmdb_id)
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = 0);

-- Loader: insert <= 5,000 rows into only this table with parameterized values.
-- Refresh after inserts, not before:
-- REFRESH TABLE doc.prototype_search_evidence_104_v1;
