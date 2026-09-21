-- CrateDB only. Additive and safe to re-run; run explicitly during release.
CREATE TABLE IF NOT EXISTS doc.search_control (
  id TEXT PRIMARY KEY,
  halted BOOLEAN NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
INSERT INTO doc.search_control (id, halted) VALUES ('paid', false) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS doc.search_interpretations (
  cache_key TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  status TEXT NOT NULL,
  contract TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ciphertext TEXT INDEX OFF
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

-- Append-only estimates and adjustments. SUM(amount_nano) is accounted spend.
-- Settlements stay in the original estimate's UTC budget window.
CREATE TABLE IF NOT EXISTS doc.search_spending (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  event TEXT NOT NULL,
  budget_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  amount_nano BIGINT NOT NULL,
  price_version TEXT,
  evidence TEXT INDEX OFF
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE IF NOT EXISTS doc.search_history (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  account_id TEXT,
  ciphertext TEXT INDEX OFF,
  elapsed_ms INTEGER NOT NULL,
  charged_nano BIGINT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
