# Step 1.4: empty auth storage and table privileges

Phase 1 preparation authorized by the owner; production operation on 2026-10-17 UTC.
No import, member data mutation, flags, proxy, Coolify, cron or webapp-role change.

## Sources and method

- Checklist: PR #595, branch `alp82/529-map-members-goodwatch-mcp-on-self-hosted-better`, pre-operation head `fa3de723d2b2caade23afe15cebf1171e6a1067c`.
- Schema/runbook sources: `origin/main` at `7206ec221afb435d1ce9c1f73dda7c2b74cbae0f`.
- Invoked the exact `migrateAuthTables` function and its model/index declarations from `goodwatch-webapp/app/server/auth/crate-adapter.server.ts` (PR #564 plus landed capacity/schema updates). Extracted that function into a standalone TypeScript module to avoid importing or starting the auth runtime. Its SQL callback uses SSH stdin to the trusted `crate` admin identity inside crate-01 at container-loopback HTTP 4200. No handwritten replacement for the migration.
- Created `user_mcp_action` from `docs/implementation/mcp-write-tools-schema.sql`, adding `IF NOT EXISTS` and the required replica/wait/durability settings. Its three-shard definition is preserved.
- Applied the four table-specific DENY statements from #562 `cratedb-hba-lab/grants.sql` to each auth table, then explicit auth-table DQL/DML and sys.cluster/sys.nodes DQL grants.
- Reused the existing protected credential on crate-01 in remote Python memory only. No secret rotation, copying, printing or logging.

## Preflight

- Direct SSH to root@10.0.0.11; credential root-owned 0600, parent root-owned 0700.
- `goodwatch_auth`: non-superuser, zero privileges, no inherited roles; supplied-password identity succeeded on 10.0.0.11/.12/.13:4200.
- All 16 target tables absent. Cluster: all three nodes 5.10.16; 97 GREEN health rows, zero missing/underreplicated shards; all 986 existing copies STARTED/STARTED.
- Exact pre-existing privilege inventory matched #562 and the subsequently documented search_history DML grant (`344e7ba3`, `goodwatch-search/README.md`). No unexpected grant was changed.

## SQL and evidence

`executed.sql` contains every schema/grant statement and migration schema-check SELECT, without secrets. `execution.jsonl` records each response. `verification.sql` lists all unique preflight and verification SQL (repeated across coordinators/roles as recorded in the receipts). `preflight.json` and `verification.json` retain sanitized live receipts. `preflight.py`, `verify.py`, `run-migration.mjs` and `repository-migration.ts` preserve the actual execution/verification method; local scratch paths in the runner identify this operation, not a general-purpose production command.

## Verified production outcome

Observed at 2026-10-17T00:23:55.788064+00:00. All 16 tables have zero rows and zero documents on every shard copy.

| Table (doc schema) | Shards | Replicas | Wait | Durability | Copies |
| --- | ---: | ---: | ---: | --- | --- |
| `auth_account` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_capacity` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_jwks` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_access_token` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_client` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_client_assertion` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_client_resource` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_consent` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_refresh_token` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_oauth_resource` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_rate_limit` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_session` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_user` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_user_email` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `auth_verification` | 1 | 2 | 1 | REQUEST | 3 STARTED/STARTED |
| `user_mcp_action` | 3 | 2 | 1 | REQUEST | 9 STARTED/STARTED |

Every shard has one primary and two replicas, one copy on each of crate-01/02/03. Final cluster health: **113 GREEN rows, zero missing or underreplicated shards**.

### Exact privilege delta

- All 25 pre-existing privilege entries unchanged (including webapp `admin` privileges).
- **32 GRANT entries for goodwatch_auth:** DQL and DML on each of the 15 auth tables above; DQL on sys.cluster and sys.nodes. Every grant is TABLE-scoped. No inherited roles, schema/cluster grant or user_mcp_action grant.
- **105 DENY entries:** for each auth table, goodwatch_webapp DQL/DML, goodwatch_search DQL, goodwatch_windmill DQL/DML/DDL, goodwatch_readonly DQL. No other privilege delta.
- Exact SQL is in `executed.sql`; complete final grant list is in `verification.json` under the sys.privileges query.

### Positive and negative checks

- **21 identity checks:** seven protected client roles through each coordinator, all matching current_user; includes goodwatch_auth with the reused correct password.
- **51 allowed auth reads:** empty COUNT on each auth table and successful sys.cluster/sys.nodes reads through all three coordinators.
- **423 negative checks passed:** 420 SQL denials plus three wrong-password HTTP401 responses.
- Auth user: movie/tv catalog reads, user_mcp_action read, CREATE TABLE and GRANT denied through every coordinator. CREATE targets the already-existing auth_user name, so even an erroneous authorization could not create a new table. The GRANT probe requests an already-held privilege.
- Other clients: all six roles (webapp, search, Windmill, readonly, backup, monitoring) denied reads on every auth table through every coordinator. Webapp and Windmill DELETE WHERE false probes denied on all tables; Windmill same-value auth-table ALTER probes also denied. No row was written or deleted, and no ALTER succeeded.
- CrateDB conceals inaccessible objects: SQL refusals were 315 HTTP404/code4041, 102 HTTP404/code4045 and three HTTP401/code4011. These are object/permission denials, not authentication failures; each role first passed current_user. Wrong passwords separately returned HTTP401.

## Deviations and verification limits

- No scope deviation: only Phase 1 empty-table preparation. The checklist's secret handoff stays owner-only in Coolify UI under step 1.5; it was not performed by this operation.
- Initial read-only preflight used an incorrect sys.privileges column (`securable`); CrateDB returned ColumnUnknownException/4043. Corrected it to the documented `class` column and reran the full preflight before any production mutation.
- No real member sign-in, importer or MCP-client acceptance was run; those remain later checklist gates.
