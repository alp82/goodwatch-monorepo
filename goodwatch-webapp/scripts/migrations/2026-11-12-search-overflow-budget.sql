-- Apply before deploying the search overflow runtime, even when overflow is disabled.
-- Historical NULL pools remain JEV. Every adjustment copies its estimate's pool and budget_at.
ALTER TABLE doc.search_spending ADD COLUMN budget_pool TEXT;
ALTER TABLE doc.search_history ADD COLUMN interpretation_provider TEXT;
ALTER TABLE doc.search_history ADD COLUMN interpretation_model TEXT;
ALTER TABLE doc.search_history ADD COLUMN overflow_reason TEXT;
