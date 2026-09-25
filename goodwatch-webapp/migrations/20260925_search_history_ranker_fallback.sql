-- CrateDB only. Additive: why today's ranking served a search while SEARCH_RANKING_MODE=on (the new ranking serves
-- otherwise). Values: lesser known, basic search, index not loaded, encoder not ready, encoder queue full, timeout,
-- error. NULL when the new ranking served, and for every search in modes off and shadow.
-- Run before deploying the webapp that writes it: the history insert names the column.
ALTER TABLE doc.search_history ADD COLUMN ranker_fallback TEXT;
