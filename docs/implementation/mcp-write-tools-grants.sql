-- MCP runs on the search roles. Apply as an administrator after these tables exist.
-- goodwatch_search already has DQL ON SCHEMA doc (with auth-table DENYs).
-- The seven native MCP writes need DML on only these seven tables; no schema-wide DML or DDL.
GRANT DML ON TABLE
    doc.user_mcp_action,
    doc.user_wishlist,
    doc.user_score,
    doc.user_not_interested,
    doc.user_watch_log,
    doc.user_watch_state,
    doc.user_setting
TO goodwatch_search;
