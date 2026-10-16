-- user_mcp_action: the durable receipts of MCP write tools (#584, see mcp-write-tools.md).
--
-- Created by hand in step 1.4 of the auth cut-over checklist, with that step's replica and translog settings, and not
-- declared in goodwatch-flows/windmill/f/sync/models/crate_schemas.py: the daily f/sync/populate_crate flow creates
-- every table listed there, so merging the auth stack would otherwise create this table in production on its own.
-- The local MCP rehearsals (webapp scripts/mcp-read/seed-local.py) create it from this file.
CREATE TABLE doc.user_mcp_action (
    user_id TEXT,
    action_id TEXT,
    request_hash TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    result TEXT INDEX OFF STORAGE WITH (columnstore = false),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (user_id, action_id)
) CLUSTERED BY (user_id) INTO 3 SHARDS;
