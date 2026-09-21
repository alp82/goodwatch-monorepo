-- Apply after 20260921_search_runtime.sql. Owner operation; never auto-run.
BEGIN;
ALTER TABLE search_runtime.admission ADD COLUMN attempt_id uuid REFERENCES search_runtime.attempt(id);
CREATE INDEX ON search_runtime.admission(attempt_id, admitted_at);
COMMIT;
