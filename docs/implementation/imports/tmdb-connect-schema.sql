-- Add before enabling TMDB Connect. Does not change the existing import tables.
CREATE TABLE IF NOT EXISTS doc.user_import_connection (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    slot INTEGER NOT NULL,
    payload TEXT INDEX OFF STORAGE WITH (columnstore = false),
    cleanup_at TIMESTAMP WITH TIME ZONE,
    lease_until TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, slot)
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
