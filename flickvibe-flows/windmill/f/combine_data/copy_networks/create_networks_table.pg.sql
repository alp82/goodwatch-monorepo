CREATE TABLE IF NOT EXISTS networks (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255),
    origin_country VARCHAR(2),
    tv_ids INTEGER[],

    -- metadata
    updated_at TIMESTAMP WITH TIME ZONE
);