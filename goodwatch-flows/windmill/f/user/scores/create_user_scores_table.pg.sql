CREATE TABLE IF NOT EXISTS user_scores (
    user_id VARCHAR(255) NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type VARCHAR(5) NOT NULL,
    score INTEGER,
    review TEXT,

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, tmdb_id, media_type)
);