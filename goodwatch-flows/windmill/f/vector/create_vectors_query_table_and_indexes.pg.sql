CREATE TABLE IF NOT EXISTS vectors_query (
    query_text TEXT PRIMARY KEY,
    query_vector vector(512),

	  -- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create index for cast_vector
CREATE INDEX IF NOT EXISTS vectors_query_query_vector_idx ON vectors_query USING diskann (query_vector);