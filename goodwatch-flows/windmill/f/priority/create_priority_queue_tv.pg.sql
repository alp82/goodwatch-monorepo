-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE priority_queue_tv (
    tmdb_id INTEGER UNIQUE,
    priority INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    reset_at TIMESTAMP WITHOUT TIME ZONE
)
