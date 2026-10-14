-- Issue #525. Owner applies this DDL to production before deploying the exposure writer.
-- The schema initializer holds the same definition for fresh installs.
CREATE TABLE IF NOT EXISTS doc.user_list_exposure (
    user_id TEXT,
    list_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN ('discover','watch-next')),
    ordering TEXT NOT NULL,
    ordering_flags OBJECT(DYNAMIC),
    sort TEXT NOT NULL,
    sort_requested TEXT,
    for_you BOOLEAN NOT NULL,
    for_you_applied BOOLEAN NOT NULL,
    filters OBJECT(IGNORED),
    country TEXT NOT NULL,
    services ARRAY(INTEGER),
    taste_key_version TEXT NOT NULL,
    page INTEGER,
    batch TEXT NOT NULL CHECK (batch IN ('page','cards')),
    title_keys ARRAY(BIGINT),
    positions ARRAY(INTEGER),
    taste_matches ARRAY(INTEGER),
    PRIMARY KEY (user_id, list_id)
) CLUSTERED BY (user_id) INTO 6 SHARDS;
