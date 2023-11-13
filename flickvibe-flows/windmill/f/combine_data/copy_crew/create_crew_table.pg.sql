CREATE TABLE IF NOT EXISTS "crew" (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    gender INTEGER,
    adult BOOLEAN,
    popularity FLOAT,
    profile_path TEXT,
    known_for_department VARCHAR(255),
    movie_jobs TEXT[],
    tv_jobs TEXT[],
    movie_ids INTEGER[],
    tv_ids INTEGER[],

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);