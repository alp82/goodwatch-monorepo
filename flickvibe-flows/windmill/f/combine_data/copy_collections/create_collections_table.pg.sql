CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    tmdb_ids INTEGER[],

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);