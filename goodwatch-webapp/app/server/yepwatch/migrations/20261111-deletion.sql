-- Additive YepWatch lifecycle table. Preserve existing rooms/history and the room key.
CREATE TABLE IF NOT EXISTS doc.yepwatch_deletion (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "user_id" TEXT,
  "room_id" TEXT,
  "participant_id" TEXT,
  "requested_at" BIGINT NOT NULL,
  "purge_after" BIGINT NOT NULL,
  "phase" TEXT NOT NULL,
  "lease_until" BIGINT NOT NULL,
  "purge_token" TEXT,
  "targets" ARRAY(OBJECT(STRICT) AS ("roomId" TEXT,"participantId" TEXT)) NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);
GRANT DQL,DML ON TABLE doc.yepwatch_deletion TO yepwatch_runtime;
