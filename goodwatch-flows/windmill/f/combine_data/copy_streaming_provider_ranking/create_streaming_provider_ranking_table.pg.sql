-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS streaming_provider_ranking (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    logo_path TEXT,
    link_count INTEGER NOT NULL,

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);