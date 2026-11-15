-- Apply explicitly after a snapshot. The API never runs this migration.
CREATE TABLE IF NOT EXISTS doc.yepwatch_taste_profile (
  "id" TEXT PRIMARY KEY,
  "answers" OBJECT(STRICT) AS ("items" ARRAY(OBJECT(STRICT) AS ("key" BIGINT,"answer" TEXT,"source" TEXT,"at" BIGINT))) NOT NULL,
  "followups" ARRAY(OBJECT(STRICT) AS ("key" BIGINT,"decided_at" BIGINT,"state" TEXT)) NOT NULL,
  "dealt" ARRAY(BIGINT) NOT NULL,
  "revision" BIGINT NOT NULL,
  "created_at" BIGINT NOT NULL,
  "updated_at" BIGINT NOT NULL,
  "expires_at" BIGINT NOT NULL,
  "write_window" BIGINT NOT NULL,
  "write_count" BIGINT NOT NULL
) CLUSTERED INTO 4 SHARDS WITH (column_policy='strict',number_of_replicas=2,"write.wait_for_active_shards"='3',refresh_interval=1000);

ALTER TABLE doc.yepwatch_participant ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE doc.yepwatch_participant ADD COLUMN IF NOT EXISTS taste_revision BIGINT;
GRANT DQL,DML ON TABLE doc.yepwatch_taste_profile TO yepwatch_runtime;
