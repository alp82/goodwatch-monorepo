# CrateDB client credentials and password enforcement (#562)

**Production update:** use [the inspected rollout runbook](cratedb-production-rollout.md) for current inventory,
Q35 authorization, owner-only Coolify UI steps, stale-context blockers and execution/rollback. The original lab
findings below remain useful; historical production observations are not current rollout readiness.

Code and plan for [#562](https://github.com/alp82/goodwatch-monorepo/issues/562): every CrateDB client logs in as
its own user, then the nodes enforce passwords one at a time. This branch contains the client code, the grants and a
local proof. **Nothing here touched production.** The production steps at the end need the owner and the private
network.

Background: [#547](https://github.com/alp82/goodwatch-monorepo/issues/547) found that every private endpoint
accepts no credentials, or a wrong password, as `crate`
([runbook, "Authentication finding and release gate"](https://github.com/alp82/goodwatch-monorepo/blob/auth/cratedb-prereqs/docs/implementation/auth/cratedb-prereqs.md#authentication-finding-and-release-gate)).
Historical snapshot early on 2026-10-15: crate-01 5.10.9, crate-02 and crate-03 5.10.16.
Latest inspection: all three 5.10.16, HBA off; see linked production runbook.

## Findings that change the plan

1. **The HBA rules in `goodwatch-crate/docker-compose.yml` never reached the nodes.** The `# host-based auth map`
   line sits inside the folded `command: >` block. Compose passes it on as four arguments (`#`, `host-based`, `auth`,
   `map`), and CrateDB ignores every `-C` setting after a non-option argument. A probe with
   `-Cnode.name=named-after-comment` after those tokens started with a random node name
   ([argv-probe.json](cratedb-hba-lab/results/argv-probe.json)). So simply adding
   `-Cauth.host_based.enabled=true` at the end, the obvious fix, would change nothing: the lab ran exactly that on a
   node and it still accepted no credentials as `crate`. The compose file on this branch removes the comment and
   puts the switch before the rules.
2. **Grants already apply while HBA is off.** With HBA off, CrateDB does not check the password but does run the
   statement as the user named in the Basic header. A client switched to its own user gets exactly that user's
   privileges at once, while a wrong password is still accepted. So the credentials rollout is the step that shows
   missing grants, while it can still be undone by switching the variables back. It cannot show a wrong password.
   Only the first HBA node can.
3. **A restarted node refuses valid credentials for 1.5 to 2 seconds.** With HBA on, a node that has just come back
   answers `401 password authentication failed` (plain text, not Crate's JSON error) until it has the users from
   the cluster state. Polling the node directly: 8 to 12 such answers over 1.5 to 2 s after every restart, then `ok`. Through
   the #589 wrapper this failed **6 reads and 1 upsert** during one graceful restart
   ([failover-before-fix.log](cratedb-hba-lab/results/failover-before-fix.log)). The wrapper now treats that refusal as
   a coordinator problem (see below); the same run then had **0 failures**. Clients without failover (Windmill's
   Python driver, `backup.py`, the sitemap script, `catalog.server.ts`) can see this error after each node restart,
   the same way they already see errors from a restarting node.
4. **Transport needs no HBA entry here.** The rules have no transport entry, and entry 1 (`method=password`, no
   `protocol`) would refuse a transport connection if transport were checked. Still the cluster stayed GREEN through a
   rolling switch-on, a graceful restart and a SIGKILL: without transport SSL (production has none), 5.10.16 did not
   apply the rules to node-to-node traffic.
5. **`/_blobs` checks only the login.** No credentials, or a wrong password, get 401. Any valid user may read
   **and write** blobs, whatever its grants (the lab's `goodwatch_auth` wrote one). The search index files are
   checked by SHA-1 on read, so a foreign blob cannot replace a file, but any client user can add blobs.
6. **Snapshots need cluster-wide DDL.** `CREATE SNAPSHOT` and `DROP SNAPSHOT` fail with `AL` alone and work with
   cluster `DDL` plus `DQL` on `sys`. CrateDB has nothing narrower. `DENY DDL ON SCHEMA doc` and `blob` takes table
   DDL back. What the backup user can still do: create tables in a new schema, `CREATE`/`DROP REPOSITORY`, `KILL`
   its own jobs.
7. **sys tables need `DQL ON SCHEMA sys`**, not cluster-wide DQL (which would also cover every future schema).
   `information_schema` is readable by every user and shows only what it may see.

## Client inventory

"Credentials" is about the code. The values of `CRATE_USER` in production were not inspected (#547 only probed with no
or wrong credentials); with HBA off, whatever they are, a client runs as the user it names, or as `crate` without one.

| Client | Where | How it connects | Credentials (before this branch) | What it needs |
| --- | --- | --- | --- | --- |
| Webapp page instances (Coolify, vector1 `.20`, abio `.21`) | `goodwatch-webapp/app/utils/crate.ts` (node-crate 3.0.0, #589 failover), all `app/server/*` | HTTP, all of `CRATE_HOSTS`, `CRATE_PORT` | `CRATE_USER`/`CRATE_PASS` as URL userinfo. **Broke on `#`, `/`, `?` in a password** (invalid URL), and node-crate sent percent-encoded userinfo. Fixed. | DQL+DML on `doc` (catalog, member data, imports, IMDb import, settings, lists), `REFRESH TABLE`, `information_schema`. No DDL. |
| Webapp search paths in the same process | `combined-search/catalog.server.ts`, `search-ranking/search-index-build.server.ts` | Own HTTP: first host only (`catalog`), each host for the manifest, `/_blobs` on the first host | Basic header from `CRATE_USER`/`CRATE_PASS` (`Basic Og==` when unset). Correct for any password. | DQL on `doc`; blob GET. |
| Search roles `goodwatch-search-a`/`-b` (vector1) | Same webapp image, `WEBAPP_ROLE=search`; `goodwatch-search/.env` from `./deploy.sh copy-env` | As the webapp | As the webapp, from their own `.env` | DQL on `doc`; DML on `doc.search_interpretations`, `doc.search_spending`, `doc.search_control`; blob GET. |
| Auth adapter (not on main) | `app/server/auth/crate-adapter.server.ts` on `auth/integration` | Own HTTP (undici), `AUTH_CRATEDB_ORIGINS` | Requires `AUTH_CRATEDB_USERNAME`/`AUTH_CRATEDB_PASSWORD`; refuses URL credentials | DQL+DML on the approved `doc.auth_*` tables only. |
| Auth maintenance CLI (not on main) | `scripts/auth-maintenance/cli.ts` on `auth/integration` | Adapter transport | As the adapter | As the adapter. |
| Supabase importer | `scripts/auth-importer/import.ts` | Adapter transport | Loopback only; guarded `production` profile uses an owned SSH forward, dedicated credentials, frozen copy and signed dry/apply/rerun receipt | `goodwatch_auth`; see [production route](../../auth-supabase-import-rehearsal.md#production-route-for-552-step-23). |
| Windmill jobs (38 scripts via `CrateConnector`, plus social, search index build) | `goodwatch-flows/windmill/f/db/cratedb.py`, `f/social/store.py`, `f/search/build_indexes.py` | crate-python 2.2.1 to all `u/Alp/CRATE_HOSTS`; social and index build use own HTTP | Windmill variables `u/Alp/CRATE_USER`, `u/Alp/CRATE_PASS` | DQL/DML/DDL on `doc` and `blob` (`f/sync/init/cratedb.py`, `CREATE TABLE IF NOT EXISTS` in buzz, social, priority, monitoring store), blob PUT, `information_schema`. |
| Monitoring (Windmill) | `f/monitoring/{backup_check,cluster_collection,cluster_health,check,store}.py` | `CrateConnector` | As Windmill | DQL on `sys.snapshots`, `sys.shards`, `sys.nodes`, `sys.cluster`; DML on `doc.workflow_monitoring`, `CREATE TABLE IF NOT EXISTS` for it. Alloy metrics have no direct SQL access; live Uptime Kuma has three credentialless Crate root monitors (see production runbook). |
| `backup.py`, `cleanup_legacy.py` (root cron on `.11`, `goodwatch-hq/ansible/cron.yml`) | `goodwatch-crate/` | `requests` to `http://10.0.0.11:4200` only | **None.** Fixed: `CRATE_BACKUP_USER` + `CRATE_BACKUP_PASSWORD_FILE` | `CREATE`/`DROP SNAPSHOT`, `sys.snapshots`. |
| Sitemap script (by hand, weekly) | `goodwatch-webapp/scripts/create_sitemaps.py` | crate-python 2.0.0, first host | URL userinfo from `CRATE_USER`/`CRATE_PASS`; broke on URL characters. Fixed: separate arguments | DQL on `doc`. |
| Operator scripts | `goodwatch-flows/scripts/*.py`, `tools/run_buzz.py`, `goodwatch-webapp/scripts/measure-*.mjs`, `benchmark-user-data.mjs`, `prototype-crate-evidence/*.py`, `goodwatch-search/acceptance/history.mjs`, `goodwatch-qdrant/diagnostics/*` | Mixed | All read `CRATE_USER`/`CRATE_PASS` (or `PROVIDER_REPAIR_CRATE_USER`). The node-crate ones put them in a URL (avoid URL characters, or use a hex password). | Reads: `goodwatch_readonly`. Writers (backfills, migrations) run as `goodwatch_windmill`. |
| `goodwatch-flows/tools/bench_buzz.py` | Piped over SSH to `.21` | `http.client` to `10.0.0.11:4200` | Previously none; now supports `CRATE_USER` and `CRATE_PASSWORD_FILE`/`CRATE_PASS`. | Read-only benchmark; configure the readonly identity before using it with HBA. |
| Owner / administration | Admin UI, `crash` | Today: anything as `crate` | None | Superuser. After HBA: `docker exec crate-0N curl … http://127.0.0.1:4200/_sql` (trusted `crate`). |

Not CrateDB clients: the firewall reconciler (`goodwatch-remote/firewall`) only opens worker paths to 4200; Caddy
has no Crate route; the retired Postgres flows.

## Code on this branch

Every change keeps today's behaviour when the new variables are unset.

- `goodwatch-crate/backup.py`, `cleanup_legacy.py`: `CRATE_BACKUP_USER` and `CRATE_BACKUP_PASSWORD_FILE` (a root-only
  file, so the password is in neither the crontab nor the process list). Neither set: no credentials, as today.
  One set, or a file that group or others can read, or an empty file: `BACKUP FAILED:` before any statement. UTF-8
  passwords are sent as UTF-8. Tests: `goodwatch-crate/test_backup.py` (`CredentialTests`, a loopback server that
  records the header).
- `goodwatch-webapp/app/utils/crate.ts`:
  - The credentials go to node-crate as the request's `auth` option, not as URL userinfo. A password with `#`, `/`
    or `?` threw `Invalid URL` on the first query; now any password works. Unset/empty `CRATE_USER`: `crate` with an empty password, preserving current main after #607.
  - `CrateAuthenticationError`: a plain-text HTTP 401 (an HBA refusal, sent before any statement runs) cools that
    coordinator down for 5 s and tries the next one, **for writes too**, because a refused request never ran. Once
    every coordinator has refused (a wrong password), the error reaches the caller after one attempt each. A missing
    privilege (Crate's JSON 401) still reaches the caller at once. The rest of the #589 policy is unchanged; its 25
    tests pass unchanged. Tests: `app/utils/crate-credentials.test.ts` (10).
- `goodwatch-webapp/scripts/create_sitemaps.py` + `sitemap_crate.py`: username and password as driver arguments.
  Tests: `scripts/test_sitemap_crate.py` (the driver case runs with `uv run --with crate`).
- `goodwatch-crate/docker-compose.yml`: no comment inside `command:`, and
  `-Cauth.host_based.enabled=${CRATE_HBA_ENABLED:-false}` before the existing two rules. Without the variable the
  node behaves as today (the lab put node 1 on it: no credentials still `crate`). Tests:
  `goodwatch-crate/test_compose.py` renders the file with `docker compose config`.
- `docs/implementation/auth/verify_crate_endpoints.py`: the production check (stdlib only, prints no password).

Windmill and the search paths already send `CRATE_USER`/`CRATE_PASS`; the auth adapter and importer
already require credentials; `goodwatch-hq/ansible/cron.yml` now supports optional `crate_backup_user` and `crate_backup_password_file`
inventory values, both or neither (set only after provisioning). Backup now fails over to .12/.13 for reads and
provably unsent writes, never ambiguous CREATE/DROP. Catalog transport now receives the explicit Basic header after
merging #604/#607. Scheduled sitemap source downloads include the new helper. `bench_buzz.py` accepts credentials.

## Users and grants

[`cratedb-hba-lab/grants.sql`](cratedb-hba-lab/grants.sql) is the plan; the lab runs exactly that file. Passwords
are bound arguments, never literals. Generate each with `openssl rand -hex 32`: hex survives URLs, `.env`
quoting, Coolify and Compose `$` handling.

| User | Client(s) | Grants |
| --- | --- | --- |
| `goodwatch_webapp` | Page instances | `DQL, DML ON SCHEMA doc`; `DENY DQL, DML` on each `doc.auth_*` |
| `goodwatch_search` | Search roles | `DQL ON SCHEMA doc`; `DML ON TABLE doc.search_interpretations, doc.search_spending, doc.search_control, doc.search_history` plus the seven explicit member tables in [MCP grants](../mcp-write-tools-grants.sql); `DENY DQL` on each `doc.auth_*` |
| `goodwatch_windmill` | All Windmill jobs, monitoring, writing operator scripts | `DQL, DML, DDL ON SCHEMA doc` and `ON SCHEMA blob`; `DQL ON SCHEMA sys`; `DENY DQL, DML, DDL` on each `doc.auth_*` |
| `goodwatch_auth` | Auth adapter, auth maintenance | `DQL, DML` on each approved `doc.auth_*` table only |
| `goodwatch_readonly` | Sitemap, measurement and evidence scripts | `DQL ON SCHEMA doc`; `DENY DQL` on each `doc.auth_*` |
| `goodwatch_backup` | `backup.py`, `cleanup_legacy.py` | cluster `DDL`; `DQL ON SCHEMA sys`; `DENY DDL ON SCHEMA doc`, `DENY DDL ON SCHEMA blob` |
| `crate` | Administration | Superuser, only from `127.0.0.1` inside a node's container |

Why one Windmill user: every Windmill job can read every `u/Alp/*` variable, so separate users per job would not
isolate jobs from each other.

Schema grants cover tables created later. That is what keeps ingestion working, and it is why the `doc.auth_*`
tables need their `DENY` lines: **the #548 migration that creates an auth table must add the four DENY lines in the
same change, before the table holds data.** The auth tables do not exist yet, so the DENY lines wait until then
(`DENY` on a missing table fails). A separate `auth` schema would make the DENY lines unnecessary; the adapter
currently hard-codes `doc.auth_*`.

Before granting, check that production has no application schema besides `doc` and `blob`:

```sql
SELECT DISTINCT table_schema FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'sys', 'pg_catalog');
```

## HBA configuration per node

The same compose file on all three hosts. Each host's `.env` gets one line, one node at a time:

```sh
CRATE_HBA_ENABLED=true
```

What each node then runs (from `docker compose config`; `NODE_NAME`/`SELF_IP` differ per host):

```text
-Cauth.host_based.enabled=true
-Cauth.host_based.config.0.user=crate
-Cauth.host_based.config.0.address=127.0.0.1
-Cauth.host_based.config.0.method=trust
-Cauth.host_based.config.1.method=password
```

- Entry 0: `crate` without a password, only from `127.0.0.1`. Published ports reach the container from the host's
  private address or a Docker gateway, never from `127.0.0.1`, so this is `docker exec` into the node only. That is
  the administrative route.
- Entry 1: every other connection (HTTP and PostgreSQL wire) needs a user with a password. `crate` has no password,
  so `crate` from anywhere else is refused, as are a missing header, a wrong password and an unknown user.
- No transport entry (finding 4). No firewall rule changes; the private binding of 4200/4300/5432 stays as it is.

## Production rollout

Each step needs the owner's go, the private network, and the #547 runbook's health gates (three nodes, every table
GREEN, every shard STARTED) before the next one.

0. **Before:** finish or explicitly park the crate-01 upgrade (#547). Everything here was tested on 5.10.16 only.
   This branch changes `docker-compose.yml`: once merged and pulled, the runbook's "compose matches the checkout"
   check sees a new file; the rendered command differs only by dropping the four comment tokens and adding
   `-Cauth.host_based.enabled=false`.
1. **Users.** Through the administrative route on any node, run `grants.sql` with one fresh password per user (bound
   arguments), leaving out the `DENY … doc.auth_user` lines until auth tables exist. Check
   `SELECT grantee, class, ident, type, state FROM sys.privileges WHERE grantee LIKE 'goodwatch_%'`. Store the
   passwords in the owner's secret store.
2. **Credentials, HBA still off**, one client at a time, watching its errors (`MissingPrivilegeException` means a
   missing grant; add it or switch back):
   - Page instances: Coolify env `CRATE_USER=goodwatch_webapp`, `CRATE_PASS`, redeploy (this branch's `crate.ts`
     must be deployed first if the password has URL characters; a hex password works with the old code too).
   - Search roles: `CRATE_USER=goodwatch_search`, `CRATE_PASS` in `goodwatch-search/.env` on vector1 (`copy-env`
     copies the page instance's values: edit after it), then `./deploy.sh <commit>` one role at a time.
   - Windmill: variables `u/Alp/CRATE_USER=goodwatch_windmill`, `u/Alp/CRATE_PASS`; run `f/monitoring/check`,
     `f/monitoring/backup_check`, one copy flow and `f/search/build_indexes` by hand.
   - Backup: `/root/.config/goodwatch/crate-backup-password` (root, `600`), then the cron line from
     `goodwatch-crate/README.md`, applied through `goodwatch-hq/ansible/cron.yml` (change the `job:` line there in
     the same step). Run it once by hand: `Backup run
     finished.`
   - Operator `.env` files: `goodwatch_readonly` or `goodwatch_windmill`.
   - Wait at least one full day of normal jobs (the daily and hourly flows) with no `MissingPrivilegeException`.
3. **Administrative route check on every node:** `docker exec crate-0N curl -sS -H 'Content-Type: application/json'
   http://127.0.0.1:4200/_sql -d '{"stmt":"SELECT current_user"}'` answers `[["crate"]]`.
4. **HBA, node by node** (the master last), each with the #547 rolling procedure (allocation `primaries`, SQL
   decommission through another node, recreate this one service, allocation `all`, wait for GREEN): add
   `CRATE_HBA_ENABLED=true` to that host's `.env`, check `docker compose config` shows the five lines above and no
   `#`, recreate. Then, before the next node:
   - the administrative route on this node answers `crate`;
   - from `.20`, `.21`, a Windmill worker on each crate host, and `.11` (backup), the verification script against
     **this node only** passes (it is the first place a wrong password shows);
   - no new `CrateAuthenticationError`/401 in webapp, search and Windmill logs beyond the restart window.
5. **Done** when `verify_crate_endpoints.py` passes against all three nodes from every client host, the next hourly
   backup succeeds, monitoring is green, and a day of jobs has run.

### Verification commands

From a real app host, with the client's own environment (prints no password, exits non-zero on any failure):

```sh
# Webapp or search container, its own CRATE_* variables:
docker exec -i <container> node --input-type=module -e "$(cat <<'EOF'
for (const host of process.env.CRATE_HOSTS.split(",")) {
  const url = `http://${host}:${process.env.CRATE_PORT || 4200}/_sql`
  const ask = async (auth) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Basic " + Buffer.from(auth).toString("base64") } : {}) }, body: JSON.stringify({ stmt: "SELECT current_user" }) }); return r.status === 200 ? (await r.json()).rows[0][0] : r.status }
  console.log(host, await ask(), await ask("crate:wrong"), await ask(`${process.env.CRATE_USER}:wrong`), await ask(`${process.env.CRATE_USER}:${process.env.CRATE_PASS}`))
}
EOF
)"
# expect per host: 401 401 401 goodwatch_webapp (or goodwatch_search)

# A host with python3 (backup host, or a Windmill worker with the user given explicitly):
CRATE_HOSTS=10.0.0.11,10.0.0.12,10.0.0.13 CRATE_USER=goodwatch_backup \
  CRATE_PASSWORD_FILE=/root/.config/goodwatch/crate-backup-password \
  python3 docs/implementation/auth/verify_crate_endpoints.py
# <env file>: root-only, lines CRATE_HOSTS=..., CRATE_USER=goodwatch_windmill, CRATE_PASS=... (docker exec --env-file
# needs Docker 23+; it keeps the password out of the process list)
docker exec -i --env-file <env file> <worker container> python3 - < docs/implementation/auth/verify_crate_endpoints.py

# PostgreSQL wire protocol, from a private host with psql:
PGPASSWORD=wrong psql -w "host=10.0.0.1N port=5432 user=crate dbname=doc sslmode=disable" -c 'SELECT 1'   # must fail
```

`verify_crate_endpoints.py` checks per host: no credentials, `crate` with a wrong password and the user with a wrong
password are refused with 401; the user with its password answers its own name.

## Rollback

- **One node misbehaves after its HBA restart** (clients refused, cluster not GREEN): remove `CRATE_HBA_ENABLED`
  from that host's `.env` and recreate it with the same rolling procedure. The other nodes are unaffected; clients
  fail over (webapp) or retry on their next run.
- **A client is refused everywhere** (wrong or missing password): fix that client's variable. If that cannot wait,
  turn HBA off on every node that has it, last-enabled first. Turning HBA off accepts every client again.
- **Lost password:** the administrative route still works with HBA on:
  `ALTER USER goodwatch_x SET (password = ?)` through `docker exec`.
- **A missing grant during step 2:** `GRANT` it, or switch the client's variables back (HBA is still off, so the old
  value works).
- **Undo the users** only after every client is back on its old variables and HBA is off everywhere:
  `DROP USER goodwatch_x` (drops its grants too).
- Nothing in the firewall changes, so there is nothing to roll back there.

## Local proof

[`cratedb-hba-lab/lab.py`](cratedb-hba-lab/lab.py): three nodes on the pinned
`crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307`, users and grants from
`grants.sql`, HBA arguments rendered from the committed `docker-compose.yml`, and the webapp's real `crate.ts` as the
client. Final run 2026-10-15 05:22–05:27 UTC: **431 of 431 checks passed**
([observations.json](cratedb-hba-lab/results/observations.json)); every `hba-*` container and volume removed and
checked absent.

| Stage | Result |
| --- | --- |
| Today's command (with the `#` tokens), HBA off | Every node: no credentials and a wrong password act as `crate`. Reproduces #547. |
| Users created, HBA off | Every user does its job and is refused the rest (table below). A wrong password for `goodwatch_webapp` is still accepted as that user. |
| Naive fix: today's command + `enabled=true` | Still no enforcement on that node (finding 1). |
| New compose file, variable unset | Node 1: still `crate` without credentials. No change. |
| Rolling switch-on, nodes 1, 2, 3 | GREEN after each. Each switched node: missing header, empty user, unknown user, `crate` with or without a password, wrong and empty passwords refused (HTTP 401); PostgreSQL wire: `crate` and wrong password refused, correct password works; each user's password answers its name; admin route answers `crate`. Not-yet-switched nodes still accept `crate`. `verify_crate_endpoints.py` exits 1 after nodes 1 and 2, 0 after node 3. |
| Final, every node | The authentication matrix and the job table below on all three nodes. |
| Webapp wrapper with `goodwatch_webapp`, 4 readers + 1 upserter | Graceful restart of node 2: 3,217 reads / 420 upserts, **0 failed**, max 790 / 1,044 ms. SIGKILL + start of node 2: 5,544 reads / 726 upserts, **0 failed**. Every request ran as `goodwatch_webapp`. Before the 401 handling: 6 reads and 1 upsert failed in the restart. |

Jobs per user (each line checked on every node; "refused" is HTTP 401 for a missing privilege or 404 for an object
hidden from that user):

| User | Allowed | Refused |
| --- | --- | --- |
| `goodwatch_webapp` | catalog SELECT, `information_schema`, upsert/UPDATE/DELETE member rows, `REFRESH TABLE` | auth table read/write, CREATE/DROP/ALTER TABLE, CREATE USER, GRANT, snapshot, SET GLOBAL |
| `goodwatch_search` | catalog and manifest SELECT, its three runtime tables | member-data and catalog writes, auth table, DDL, CREATE USER |
| `goodwatch_windmill` | CREATE/ALTER/DROP TABLE, upserts, REFRESH, `information_schema`, `sys.nodes/cluster/shards/snapshots`, CREATE/DROP BLOB TABLE, blob PUT | auth table read/delete/drop, CREATE USER, GRANT, snapshot, SET GLOBAL |
| `goodwatch_auth` | auth table SELECT/INSERT/UPDATE/DELETE/REFRESH | catalog, member data, DDL, CREATE USER |
| `goodwatch_readonly` | SELECT on `doc` | writes, auth table, DDL, CREATE USER |
| `goodwatch_backup` | CREATE SNAPSHOT, `sys.snapshots`, DROP SNAPSHOT | SELECT/DELETE on `doc`, DROP TABLE, CREATE TABLE in `doc`, DROP BLOB TABLE, CREATE USER, GRANT, SET GLOBAL |

Blobs: no credentials and a wrong password get 401 on GET and PUT; every valid user may GET and PUT (finding 5).

Lab-only deviations, none touching authentication: this shared Docker host caps open files at 20,000 and keeps
`vm.max_map_count` at 65,530, so a node bound to a non-loopback address fails CrateDB's bootstrap checks. The nodes
therefore use the host network and bind `127.0.0.11–13` (HTTP 16300, PostgreSQL 16310, transport 16320). Clients come
from `127.0.0.1`, which plays the private network; the administrative route comes from `127.0.0.99`, which plays
"127.0.0.1 inside the container" (the rule's address is rewritten to it). Disk-based allocation is off, because the
host's disk is above the default watermarks. Heap 512 MB.

Rerun from the repository root after `cd goodwatch-webapp && npm ci`:

```sh
uv run --with requests --with 'psycopg[binary]' python docs/implementation/auth/cratedb-hba-lab/lab.py
uv run --with requests python docs/implementation/auth/cratedb-hba-lab/argv_probe.py   # finding 1
bash docs/implementation/auth/cratedb-hba-lab/cleanup.sh                                # only after a hard kill
```

## Not exercised

- Production, the private network, real client hosts and their source addresses (Docker gateways, worker bridges).
- CrateDB 5.10.9 (crate-01) with HBA, and a mixed 5.10.9/5.10.16 cluster with HBA.
- The SQL decommission procedure in the lab: nodes were stopped with `docker stop`/`restart`/`kill`.
- Windmill's Python driver, the search roles and the sitemap script against an HBA cluster (only their credential code
  is unit-tested); the 1.5 to 2 s refusal window after a restart is unhandled there.
- The auth adapter against an HBA cluster (its branch is not merged).
- The `crash` CLI and the Admin UI through the administrative route (only `curl` inside the container).
