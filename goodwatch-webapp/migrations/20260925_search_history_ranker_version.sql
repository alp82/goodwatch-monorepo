-- CrateDB only. Additive: the ranking that produced each search's served list.
-- Run before deploying the webapp that writes it. Rows from before this change keep NULL.
ALTER TABLE doc.search_history ADD COLUMN ranker_version TEXT;
