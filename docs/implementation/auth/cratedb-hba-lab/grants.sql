-- Least-privilege CrateDB users for #562. Run as `crate` through the administrative route, one statement at a
-- time, with each password as a bound argument (`args`), never as a literal. The local lab (lab.py) runs exactly
-- these statements. `-- lab:` lines are lab-only notes, not part of the production plan.
--
-- `doc.auth_user` stands for every table the auth adapter owns (doc.auth_*). Repeat each DENY line for every
-- approved auth table, and again whenever #548 adds one: a schema grant also covers tables created later.

-- Page instances: catalog reads, member data reads and writes.
CREATE USER goodwatch_webapp WITH (password = ?);
GRANT DQL, DML ON SCHEMA doc TO goodwatch_webapp;
DENY DQL, DML ON TABLE doc.auth_user TO goodwatch_webapp;

-- Search roles: catalog and index reads, their own runtime rows. Reading the index files over /_blobs needs
-- only a valid login: CrateDB checks no table privilege there (lab: results/observations.json, "blobs").
CREATE USER goodwatch_search WITH (password = ?);
GRANT DQL ON SCHEMA doc TO goodwatch_search;
GRANT DML ON TABLE doc.search_interpretations, doc.search_spending, doc.search_control TO goodwatch_search;
DENY DQL ON TABLE doc.auth_user TO goodwatch_search;

-- Windmill jobs: ingestion, schema creation, index uploads, monitoring of sys tables.
CREATE USER goodwatch_windmill WITH (password = ?);
GRANT DQL, DML, DDL ON SCHEMA doc TO goodwatch_windmill;
GRANT DQL, DML, DDL ON SCHEMA blob TO goodwatch_windmill;
GRANT DQL ON SCHEMA sys TO goodwatch_windmill;
DENY DQL, DML, DDL ON TABLE doc.auth_user TO goodwatch_windmill;

-- The auth adapter: its own tables only.
CREATE USER goodwatch_auth WITH (password = ?);
GRANT DQL, DML ON TABLE doc.auth_user TO goodwatch_auth;

-- Operator scripts and the sitemap: reads only.
CREATE USER goodwatch_readonly WITH (password = ?);
GRANT DQL ON SCHEMA doc TO goodwatch_readonly;
DENY DQL ON TABLE doc.auth_user TO goodwatch_readonly;

-- backup.py: create, list and drop snapshots. CREATE/DROP SNAPSHOT need cluster-wide DDL, which CrateDB has no
-- narrower form of; the DENY lines take back table DDL on the application schemas. Residual power: DDL in a new
-- schema, CREATE/DROP REPOSITORY. No AL: it cannot manage users or cluster settings.
CREATE USER goodwatch_backup WITH (password = ?);
GRANT DDL TO goodwatch_backup;
GRANT DQL ON SCHEMA sys TO goodwatch_backup;
DENY DDL ON SCHEMA doc TO goodwatch_backup;
DENY DDL ON SCHEMA blob TO goodwatch_backup;
