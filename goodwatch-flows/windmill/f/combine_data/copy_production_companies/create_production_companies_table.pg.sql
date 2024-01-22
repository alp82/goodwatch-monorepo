CREATE TABLE IF NOT EXISTS production_companies (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255),
    origin_country VARCHAR(2),
    movie_ids INTEGER[],
    tv_ids INTEGER[],

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);