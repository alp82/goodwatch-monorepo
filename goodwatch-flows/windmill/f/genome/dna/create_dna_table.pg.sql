-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS dna (
    id SERIAL PRIMARY KEY,

    category VARCHAR(255) NOT NULL,
    label TEXT NOT NULL,

    count_all INTEGER NOT NULL,
    count_movies INTEGER NOT NULL,
    count_tv INTEGER NOT NULL,

    movie_tmdb_id INTEGER[] NOT NULL,
    tv_tmdb_id INTEGER[] NOT NULL,

    -- relationships
    label_vector vector(512),
    label_vector_v2 vector(768),
    cluster_id INTEGER,

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_category_label UNIQUE (category, label)
);

CREATE INDEX IF NOT EXISTS idx_dna_category ON dna (category);

CREATE INDEX IF NOT EXISTS idx_dna_movie_tmdb_id ON dna USING GIN (movie_tmdb_id);
CREATE INDEX IF NOT EXISTS idx_dna_tv_tmdb_id ON dna USING GIN (tv_tmdb_id);

CREATE INDEX IF NOT EXISTS idx_dna_label_text_ilike ON dna USING GIN (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dna_label_text_fulltext ON dna USING GIN (to_tsvector('english', label));

CREATE INDEX IF NOT EXISTS idx_dna_count_all ON dna (count_all);
CREATE INDEX IF NOT EXISTS idx_dna_count_movies ON dna (count_movies);
CREATE INDEX IF NOT EXISTS idx_dna_count_tv ON dna (count_tv);

CREATE INDEX IF NOT EXISTS idx_dna_label_vector ON dna USING diskann (label_vector);
CREATE INDEX IF NOT EXISTS idx_dna_label_vector_v2 ON dna USING diskann (label_vector_v2);

CREATE INDEX IF NOT EXISTS idx_dna_cluster_id ON dna (cluster_id);
CREATE INDEX IF NOT EXISTS idx_dna_effective_id ON dna (COALESCE(cluster_id, id));
