-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS streaming_provider_links (
    tmdb_id INTEGER NOT NULL,
    tmdb_url TEXT NOT NULL,
    media_type VARCHAR(5) NOT NULL,
    provider_id INTEGER NOT NULL,
    country_code CHAR(2) NOT NULL,
    stream_type VARCHAR(16) NOT NULL,
    stream_url TEXT NOT NULL,
    price_dollar FLOAT,
    quality VARCHAR(16) NOT NULL,
    display_priority INTEGER NOT NULL,

    -- metadata
    obsolete_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);