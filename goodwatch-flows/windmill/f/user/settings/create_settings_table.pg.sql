-- https://www.windmill.dev/docs/getting_started/scripts_quickstart/sql#result-collection
-- result_collection=legacy

CREATE TABLE IF NOT EXISTS user_settings (
    user_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,   -- The key/name of the setting
    value TEXT,                  -- The value of the setting (stored as text)

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, key)
);
