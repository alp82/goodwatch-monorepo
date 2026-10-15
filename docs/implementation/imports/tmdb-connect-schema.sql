-- Add before enabling TMDB Connect. Does not change the existing import tables.
CREATE TABLE IF NOT EXISTS doc.user_import_connection (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    payload TEXT INDEX OFF STORAGE WITH (columnstore = false),
    cleanup_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_until TIMESTAMP WITH TIME ZONE NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
