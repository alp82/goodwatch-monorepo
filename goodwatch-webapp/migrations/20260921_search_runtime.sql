-- Apply with the dedicated search database owner, never through a request handler.
-- This is PostgreSQL SQL, not CrateDB SQL. No production migration was run.
BEGIN;
CREATE SCHEMA IF NOT EXISTS search_runtime;
REVOKE ALL ON SCHEMA search_runtime FROM PUBLIC;
CREATE TABLE search_runtime.control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), halted boolean NOT NULL DEFAULT false
);
INSERT INTO search_runtime.control DEFAULT VALUES;
CREATE TABLE search_runtime.budget (
  kind text NOT NULL CHECK (kind IN ('day', 'month')),
  starts date NOT NULL,
  charged_nano bigint NOT NULL DEFAULT 0 CHECK (charged_nano >= 0),
  PRIMARY KEY (kind, starts)
);
CREATE TABLE search_runtime.attempt (
  id uuid PRIMARY KEY,
  cache_key text NOT NULL,
  day_start date NOT NULL, month_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL CHECK (status IN ('reserved','dispatched','unknown','settled')),
  reserved_nano bigint NOT NULL CHECK (reserved_nano > 0),
  charged_nano bigint NOT NULL CHECK (charged_nano >= 0),
  price_version text NOT NULL,
  reconciliation_evidence text
);
CREATE INDEX ON search_runtime.attempt (status, created_at);
CREATE TABLE search_runtime.interpretation (
  cache_key text PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES search_runtime.attempt(id),
  status text NOT NULL CHECK (status IN ('pending','ready','unknown')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  contract text NOT NULL,
  ciphertext text
);
CREATE TABLE search_runtime.admission (
  scope text NOT NULL,
  admitted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON search_runtime.admission(scope, admitted_at);
-- Deliberately no visitor ID, IP, cookie, cache key, or attempt FK in retained history.
CREATE TABLE search_runtime.history (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  account_id uuid,
  ciphertext text NOT NULL,
  elapsed_ms integer NOT NULL CHECK (elapsed_ms >= 0),
  charged_nano bigint NOT NULL CHECK (charged_nano >= 0),
  outcome text NOT NULL CHECK (outcome IN ('ready','cached','basic')),
  reason text
);
REVOKE ALL ON ALL TABLES IN SCHEMA search_runtime FROM PUBLIC;
COMMIT;
