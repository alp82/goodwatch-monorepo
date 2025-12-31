-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS streaming_providers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255),
    display_priority INTEGER,

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);