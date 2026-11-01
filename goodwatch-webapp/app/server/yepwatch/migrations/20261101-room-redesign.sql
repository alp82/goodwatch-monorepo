-- CrateDB ADD COLUMN has no IF NOT EXISTS. Use apply-room-redesign.ts for idempotent replay.
-- Apply through the operator connection before deploying contract 3 and its OTA together.
-- Nullable additions preserve existing rows. Room search results live in immutable idea records.
ALTER TABLE doc.yepwatch_room ADD COLUMN idea_records ARRAY(TEXT);
ALTER TABLE doc.yepwatch_room ADD COLUMN disabled_service_ids ARRAY(BIGINT);
ALTER TABLE doc.yepwatch_room ADD COLUMN interpretation_count BIGINT;
ALTER TABLE doc.yepwatch_participant ADD COLUMN service_ids ARRAY(BIGINT);
ALTER TABLE doc.yepwatch_participant ADD COLUMN show_seen BOOLEAN;
ALTER TABLE doc.yepwatch_candidate ADD COLUMN idea_ids ARRAY(TEXT);
CREATE TABLE IF NOT EXISTS doc.yepwatch_idea (
  "record_id" TEXT PRIMARY KEY,
  "room_id" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "expires_at" BIGINT NOT NULL,
  "idea_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "attributes" ARRAY(OBJECT(STRICT) AS ("text" TEXT,"kind" TEXT,"key" TEXT)) NOT NULL,
  "ranked_keys" ARRAY(BIGINT) NOT NULL,
  "interpreted_at" BIGINT NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);
GRANT DQL,DML ON TABLE doc.yepwatch_idea TO yepwatch_runtime;
