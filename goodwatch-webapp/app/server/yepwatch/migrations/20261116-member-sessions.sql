-- Apply explicitly before deploying durable member sessions. The API never runs DDL.
-- Encrypted OAuth credentials; only the YepWatch runtime gets access to this table.
CREATE TABLE IF NOT EXISTS doc.yepwatch_member_session (
  "id" TEXT PRIMARY KEY,
  "session_ciphertext" TEXT NOT NULL,
  "version" BIGINT NOT NULL,
  "user_key" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);

GRANT DQL,DML ON TABLE doc.yepwatch_member_session TO yepwatch_runtime;
