CREATE TABLE IF NOT EXISTS user_skipped (
    user_id VARCHAR(255) NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(5) NOT NULL,

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, tmdb_id, media_type)
);