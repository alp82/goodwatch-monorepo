-- Additive personal creation allowances. Preserve live rooms, history and legacy control.
CREATE TABLE IF NOT EXISTS doc.yepwatch_creation_quota (
  "creator_digest" TEXT PRIMARY KEY,
  "format" BIGINT NOT NULL,
  "expires_at" BIGINT NOT NULL,
  "reservations" ARRAY(OBJECT(STRICT) AS ("room_id" TEXT,"admission_digest" TEXT,"expires_at" BIGINT)) NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);

CREATE TABLE IF NOT EXISTS doc.yepwatch_creation_reservation (
  "room_id" TEXT PRIMARY KEY,
  "creator_digest" TEXT NOT NULL,
  "admission_digest" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);
GRANT DQL,DML ON TABLE doc.yepwatch_creation_quota TO yepwatch_runtime;
GRANT DQL,DML ON TABLE doc.yepwatch_creation_reservation TO yepwatch_runtime;
