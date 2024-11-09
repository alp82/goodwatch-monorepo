CREATE TABLE IF NOT EXISTS dna (
    category VARCHAR(255) NOT NULL,
    label TEXT NOT NULL,

    count_all INTEGER NOT NULL,
    count_movies INTEGER NOT NULL,
    count_tv INTEGER NOT NULL,

    movie_tmdb_id INTEGER[] NOT NULL,
    tv_tmdb_id INTEGER[] NOT NULL,

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (category, label)
);

CREATE INDEX IF NOT EXISTS idx_dna_category ON dna (category);

CREATE INDEX IF NOT EXISTS idx_dna_movie_tmdb_id ON dna USING GIN (movie_tmdb_id);
CREATE INDEX IF NOT EXISTS idx_dna_tv_tmdb_id ON dna USING GIN (tv_tmdb_id);

CREATE INDEX IF NOT EXISTS idx_dna_label_text_ilike ON dna USING GIN (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dna_label_text_fulltext ON dna USING GIN (to_tsvector('english', label));

CREATE INDEX IF NOT EXISTS idx_dna_count_all ON dna (count_all);
CREATE INDEX IF NOT EXISTS idx_dna_count_movies ON dna (count_movies);
CREATE INDEX IF NOT EXISTS idx_dna_count_tv ON dna (count_tv);
