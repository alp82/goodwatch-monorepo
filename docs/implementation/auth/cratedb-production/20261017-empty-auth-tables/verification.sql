-- Unique preflight and verification SQL; credential values are never part of these statements.
-- Initial read-only typo, rejected with ColumnUnknownException/4043:
SELECT grantee,securable,ident,type,state FROM sys.privileges ORDER BY grantee,securable,ident,type;

SELECT current_user;

SELECT name,superuser FROM sys.users ORDER BY name;

SELECT grantee,class,ident,type,state FROM sys.privileges ORDER BY grantee,class,ident,type;

SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND (table_name LIKE 'auth_%' OR table_name='user_mcp_action') ORDER BY table_schema,table_name;

SELECT id,name,version['number'] FROM sys.nodes ORDER BY name;

SELECT health,count(*),sum(missing_shards),sum(underreplicated_shards) FROM sys.health GROUP BY health;

SELECT state,routing_state,count(*) FROM sys.shards GROUP BY state,routing_state;

SELECT column_name FROM information_schema.columns WHERE table_schema='sys' AND table_name='users' ORDER BY ordinal_position;

SELECT table_name,number_of_shards,number_of_replicas,settings['write']['wait_for_active_shards'],settings['translog']['durability'] FROM information_schema.tables WHERE table_schema='doc' AND table_name IN ('auth_user','auth_account','auth_session','auth_verification','auth_jwks','auth_oauth_client','auth_oauth_resource','auth_oauth_client_resource','auth_oauth_consent','auth_oauth_access_token','auth_oauth_refresh_token','auth_oauth_client_assertion','auth_rate_limit','auth_capacity','auth_user_email','user_mcp_action') ORDER BY table_name;

SELECT table_name,id,primary,state,routing_state,node['name'],num_docs FROM sys.shards WHERE schema_name='doc' AND table_name IN ('auth_user','auth_account','auth_session','auth_verification','auth_jwks','auth_oauth_client','auth_oauth_resource','auth_oauth_client_resource','auth_oauth_consent','auth_oauth_access_token','auth_oauth_refresh_token','auth_oauth_client_assertion','auth_rate_limit','auth_capacity','auth_user_email','user_mcp_action') ORDER BY table_name,id,primary DESC,node['name'];

SELECT granted_roles FROM sys.users WHERE name='goodwatch_auth';

SELECT count(*) FROM doc.auth_user;

SELECT count(*) FROM doc.auth_account;

SELECT count(*) FROM doc.auth_session;

SELECT count(*) FROM doc.auth_verification;

SELECT count(*) FROM doc.auth_jwks;

SELECT count(*) FROM doc.auth_oauth_client;

SELECT count(*) FROM doc.auth_oauth_resource;

SELECT count(*) FROM doc.auth_oauth_client_resource;

SELECT count(*) FROM doc.auth_oauth_consent;

SELECT count(*) FROM doc.auth_oauth_access_token;

SELECT count(*) FROM doc.auth_oauth_refresh_token;

SELECT count(*) FROM doc.auth_oauth_client_assertion;

SELECT count(*) FROM doc.auth_rate_limit;

SELECT count(*) FROM doc.auth_capacity;

SELECT count(*) FROM doc.auth_user_email;

SELECT count(*) FROM doc.user_mcp_action;

SELECT id FROM sys.cluster;

SELECT name FROM sys.nodes;

SELECT * FROM doc.movie LIMIT 0;

SELECT * FROM doc.tv LIMIT 0;

SELECT * FROM doc.user_mcp_action LIMIT 0;

CREATE TABLE doc.auth_user (id TEXT PRIMARY KEY);

GRANT DQL ON TABLE doc.auth_user TO goodwatch_auth;

SELECT * FROM doc.auth_user LIMIT 0;

DELETE FROM doc.auth_user WHERE false;

ALTER TABLE doc.auth_user SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_account LIMIT 0;

DELETE FROM doc.auth_account WHERE false;

ALTER TABLE doc.auth_account SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_session LIMIT 0;

DELETE FROM doc.auth_session WHERE false;

ALTER TABLE doc.auth_session SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_verification LIMIT 0;

DELETE FROM doc.auth_verification WHERE false;

ALTER TABLE doc.auth_verification SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_jwks LIMIT 0;

DELETE FROM doc.auth_jwks WHERE false;

ALTER TABLE doc.auth_jwks SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_client LIMIT 0;

DELETE FROM doc.auth_oauth_client WHERE false;

ALTER TABLE doc.auth_oauth_client SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_resource LIMIT 0;

DELETE FROM doc.auth_oauth_resource WHERE false;

ALTER TABLE doc.auth_oauth_resource SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_client_resource LIMIT 0;

DELETE FROM doc.auth_oauth_client_resource WHERE false;

ALTER TABLE doc.auth_oauth_client_resource SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_consent LIMIT 0;

DELETE FROM doc.auth_oauth_consent WHERE false;

ALTER TABLE doc.auth_oauth_consent SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_access_token LIMIT 0;

DELETE FROM doc.auth_oauth_access_token WHERE false;

ALTER TABLE doc.auth_oauth_access_token SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_refresh_token LIMIT 0;

DELETE FROM doc.auth_oauth_refresh_token WHERE false;

ALTER TABLE doc.auth_oauth_refresh_token SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_oauth_client_assertion LIMIT 0;

DELETE FROM doc.auth_oauth_client_assertion WHERE false;

ALTER TABLE doc.auth_oauth_client_assertion SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_rate_limit LIMIT 0;

DELETE FROM doc.auth_rate_limit WHERE false;

ALTER TABLE doc.auth_rate_limit SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_capacity LIMIT 0;

DELETE FROM doc.auth_capacity WHERE false;

ALTER TABLE doc.auth_capacity SET ("write.wait_for_active_shards"=1);

SELECT * FROM doc.auth_user_email LIMIT 0;

DELETE FROM doc.auth_user_email WHERE false;

ALTER TABLE doc.auth_user_email SET ("write.wait_for_active_shards"=1);
