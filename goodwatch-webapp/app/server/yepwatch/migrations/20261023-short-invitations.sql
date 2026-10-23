-- Additive upgrade for an existing typed store, before deploying short invitations.
-- Run through the trusted operator connection. No existing data or policy is changed.
CREATE TABLE IF NOT EXISTS doc.yepwatch_invitation (
  "code_hash" TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);
GRANT DQL,DML ON TABLE doc.yepwatch_invitation TO yepwatch_runtime;
