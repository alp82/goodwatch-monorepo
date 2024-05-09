CREATE TABLE IF NOT EXISTS streaming_provider_ranking (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    logo_path TEXT,
    link_count INTEGER NOT NULL,

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);