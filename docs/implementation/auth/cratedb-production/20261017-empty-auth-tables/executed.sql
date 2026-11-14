CREATE TABLE IF NOT EXISTS doc.auth_user (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_user;

CREATE TABLE IF NOT EXISTS doc.auth_account (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_account;

CREATE TABLE IF NOT EXISTS doc.auth_session (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_session;

CREATE TABLE IF NOT EXISTS doc.auth_verification (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_verification;

CREATE TABLE IF NOT EXISTS doc.auth_jwks (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_jwks;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_client (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_client;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_resource (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_resource;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_client_resource (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_client_resource;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_consent (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_consent;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_access_token (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_access_token;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_refresh_token (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_refresh_token;

CREATE TABLE IF NOT EXISTS doc.auth_oauth_client_assertion (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_oauth_client_assertion;

CREATE TABLE IF NOT EXISTS doc.auth_rate_limit (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_rate_limit;

CREATE TABLE IF NOT EXISTS doc.auth_capacity (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS ("userId" TEXT,"clientId" TEXT,"sessionId" TEXT,"referenceId" TEXT,"resourceId" TEXT,"identifier" TEXT,"refreshId" TEXT,"authorizationCodeId" TEXT,"lastRequest" DOUBLE PRECISION,"count" DOUBLE PRECISION),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_capacity;

CREATE TABLE IF NOT EXISTS doc.auth_user_email (
		email_norm TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_id TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL, user_seq LONG NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1);

SHOW CREATE TABLE doc.auth_user_email;

DENY DQL, DML ON TABLE doc.auth_user TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_user TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_user TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_user TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_user TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_account TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_account TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_account TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_account TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_account TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_session TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_session TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_session TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_session TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_session TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_verification TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_verification TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_verification TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_verification TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_verification TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_jwks TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_jwks TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_jwks TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_jwks TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_jwks TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_client TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_client TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_client TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_client TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_client TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_resource TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_resource TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_resource TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_resource TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_resource TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_client_resource TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_client_resource TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_client_resource TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_client_resource TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_client_resource TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_consent TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_consent TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_consent TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_consent TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_consent TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_access_token TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_access_token TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_access_token TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_access_token TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_access_token TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_refresh_token TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_refresh_token TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_refresh_token TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_refresh_token TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_refresh_token TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_oauth_client_assertion TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_oauth_client_assertion TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_oauth_client_assertion TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_oauth_client_assertion TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_oauth_client_assertion TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_rate_limit TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_rate_limit TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_rate_limit TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_rate_limit TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_rate_limit TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_capacity TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_capacity TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_capacity TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_capacity TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_capacity TO goodwatch_auth;

DENY DQL, DML ON TABLE doc.auth_user_email TO goodwatch_webapp;

DENY DQL ON TABLE doc.auth_user_email TO goodwatch_search;

DENY DQL, DML, DDL ON TABLE doc.auth_user_email TO goodwatch_windmill;

DENY DQL ON TABLE doc.auth_user_email TO goodwatch_readonly;

GRANT DQL, DML ON TABLE doc.auth_user_email TO goodwatch_auth;

GRANT DQL ON TABLE sys.cluster, sys.nodes TO goodwatch_auth;

CREATE TABLE IF NOT EXISTS doc.user_mcp_action (
    user_id TEXT,
    action_id TEXT,
    request_hash TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    result TEXT INDEX OFF STORAGE WITH (columnstore = false),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    PRIMARY KEY (user_id, action_id)
) CLUSTERED BY (user_id) INTO 3 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1, "translog.durability"='REQUEST');
