# CrateDB prerequisites for auth: owner-gated production runbook

Prepared 2026-10-14 for [#547](https://github.com/alp82/goodwatch-monorepo/issues/547), under map [#529](https://github.com/alp82/goodwatch-monorepo/issues/529). **Preparation only: no production upgrade, user creation, authentication change, snapshot creation, or firewall change was performed.** The issue remains open until the owner authorizes execution and production meets its acceptance checks.

## Target and inspected deployment

Upgrade directly from **5.10.9 to 5.10.16**, the newest published 5.10.x patch found on 2026-10-14. Never run 5.10.11, including during rollback. The official 5.10.12 notes recommend skipping it because of replication and generated/default-column regressions. Pin the official manifest list:

```text
crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307
```

This is a same-minor patch rolling upgrade; no intermediate release is needed. Sources: [5.10.16 release](https://cratedb.com/docs/crate/reference/en/latest/appendices/release-notes/5.10.16.html), [5.10.12 warning](https://cratedb.com/docs/crate/reference/en/5.10/appendices/release-notes/5.10.12.html), [official rolling procedure](https://cratedb.com/docs/guide/admin/upgrade/rolling.html), [detailed source checks](../../research/cratedb-rolling-upgrade-sources.md).

Read-only SSH used the repository-documented `root@10.0.0.x` route, BatchMode, strict existing host-key verification, and a five-second connection timeout. Evidence: [production-readonly.json](cratedb-rehearsal/production-readonly.json). The initial inventory command ended with missing remote `rg`; the follow-up used Python to read only an allowlist of non-secret environment fields and the image configuration. An exploratory `sys.nodes.settings` query was rejected because that column does not exist; use `sys.cluster.settings` for cluster settings.

| Host | Node | Running image | Published host addresses | Data volume |
| --- | --- | --- | --- | --- |
| `10.0.0.11` / `pgnode01` | `crate-01` | `crate:5.10.9` | `10.0.0.11:4200,4300,5432` | `goodwatch-crate_crate_data` |
| `10.0.0.12` / `pgnode02` | `crate-02` | `crate:5.10.9` | `10.0.0.12:4200,4300,5432` | `goodwatch-crate_crate_data` |
| `10.0.0.13` / `pgnode03` | `crate-03` | `crate:5.10.9` | `10.0.0.13:4200,4300,5432` | `goodwatch-crate_crate_data` |

All nodes report 5.10.9/build `39b6f0f`; all 80 table/partition health rows inspected were GREEN with zero missing and underreplicated shards. All 21 reported node checks passed. Allocation was `all`; graceful-stop minimum availability was `PRIMARIES`, force `false`, timeout two hours. Data disks had approximately 152/166/204 GiB available; the shared backup mount had 1.2 TiB available. These are observations, not reservations or future readiness guarantees.

Deployment is Compose project `goodwatch-crate`, service `cratedb`, directory `/root/goodwatch/goodwatch-monorepo/goodwatch-crate`, using `docker-compose.yml` and `.env`. `CRATE_VERSION=5.10.9`, `SELF_IP`/`NODE_NAME` differ per host; cluster `crate-cluster`, all three seeds/master names, expected/recover-after data nodes 3, heap 16g, container memory limit 26g, restart policy `always`. `/mnt/backup-cratedb/snapshots` mounts at `/snapshots`. Preserve every setting except the exact image reference. Keep the existing node identities, seeds, named volumes, bind mounts, port bindings, logging, and client authentication configuration.

Repository ownership: [Compose](../../../goodwatch-crate/docker-compose.yml), [backup behavior](../../../goodwatch-crate/README.md), [Ansible inventory](../../../goodwatch-hq/ansible/hosts.ini), [backup cron](../../../goodwatch-hq/ansible/cron.yml), [security audit playbook](../../../goodwatch-hq/ansible/secure-vps.yml), and [worker firewall reconciler](../../../goodwatch-remote/firewall/). No separate top-level `infra/` deployment was found. The Ansible audit checks UFW status; it does not make the Docker forwarding rules restrictive.

## Firewall check: private binding, with a forwarding caveat

On all three hosts, read-only `docker inspect`, `ss -lntp`, `ufw status verbose`, `ufw show added`, `iptables-save` and `ip6tables-save` agreed:

- HTTP 4200, SQL wire 5432 and transport 4300 are bound only to each host's private `10.0.0.x` address. There is no Crate listener/publication on a public IP, `0.0.0.0`, or IPv6 host address.
- Docker DNAT rules explicitly match the private destination address and forward to the Crate container; Docker's filter chain accepts those container ports. These paths pass through `DOCKER-USER`/Docker forwarding, rather than UFW's host INPUT allowances. The inspected `DOCKER-USER` entries were specific unrelated IP blocks, **not a general private-source allowlist or public-interface deny**. Thus the verified protection is private destination binding and private-network reachability; do not describe UFW as independently enforcing a private-source-only policy on forwarded 4200.
- UFW is active, incoming/routed default deny. Its SQL allowance is `10.0.0.0/24 -> 5432`, comment `Crate SQL - private clients`. Local worker HTTP rules target only the host's private IP, TCP 4200, actual worker subnet `172.18.0.0/16`, and exact worker bridge:

| Host | Bridge | Existing owner/purpose comment |
| --- | --- | --- |
| `.11` | `br-53bc77700b24` | `gw-worker:windmill_default:4200` |
| `.12` | `br-ae3acbead10d` | `gw-worker:windmill_default:4200` |
| `.13` | `br-6219705ee858` | `gw-worker:windmill_default:4200` |

- The actual Coolify webapp container on `10.0.0.20` successfully reached all three private HTTP endpoints for read-only `SELECT current_user` (reported `crate` without credentials). The source container name and responses are retained in the evidence; deployment names can change.
- `goodwatch-worker-firewall.timer` is enabled and active on all three. Repo host-11/12/13 configurations own only local worker HTTP 4200, with current/future subnet allowlists. Keep these rules and the timer intact.
- Persistent UFW user rules inspected have purpose comments, including `gw-worker` ownership. Legacy SSH/SQL/etcd comments name the service/purpose rather than uniformly using the newer `gw-*` owner convention. Docker-generated NAT/filter and unrelated direct IP-block rules lack comments. A literal audit of **every kernel rule** therefore does not pass AGENTS.md's comment convention. No comments or rules were changed. Any later manual firewall rule needs an owner and purpose comment; leave generated Docker chains under Docker's ownership.

No firewall change is part of the upgrade. Recheck publication and routing at execution time; reject any Compose result that broadens the bind address. This inspection did not probe from an external Internet host or inspect provider-side ACLs; it does not prove that every external route is blocked. No TLS is introduced, following [#536](https://github.com/alp82/goodwatch-monorepo/issues/536).

## Authentication finding and release gate

**Current production does not enforce HTTP passwords.** All three private endpoints accepted `SELECT current_user` without Authorization as `crate`; all also accepted Basic `crate` with an intentionally invalid password. Actual image `/crate/config/crate.yml` does not enable HBA, and container commands define trust/password rules but omit `auth.host_based.enabled=true`. CrateDB's default is false. With HBA off, callers can choose an existing Basic username without verifying its password, or omit it and become `crate`. Grants constrain a chosen user but do not prevent impersonation. [Authentication defaults](https://cratedb.com/docs/crate/reference/en/5.10/config/node.html#authentication), [tagged fallback implementation](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/io/crate/auth/AlwaysOKAuthentication.java).

The upgrade/user preparation below can be executed independently after the owner's go, but **auth must not launch until password authentication is effective on every node and existing clients are migrated**. `backup.py` currently sends credentialless SQL, so blindly enabling HBA would break backups. Inventory webapp, search services, Windmill resources/jobs, monitoring and backups; provision their credentials, keep a verified administrative route and assess transport/protocol rules before enabling HBA. This is a separate owner-reviewed configuration/client migration, not an implicit action in this runbook. The local rehearsal enables HBA only to test passwords and table privileges; its broad `crate` trust rule is a disposable lab convenience and must never be copied to production.

## Pre-checks after the owner's go

1. Record the go, maintenance window, operator, three node IDs/names, baseline versions, image IDs/RepoDigests, effective Compose configuration, restart policies, mounts, port bindings, volume names, data disk space, memory/headroom and baseline query/error latency. Save configuration/backups securely without printing secrets. Confirm the host checkout has no unreviewed Compose drift. Inspect `docker compose config` in a protected session; it can expand environment values.
2. Run these read-only SQL checks from a healthy private coordinator. List explicit columns during mixed versions. Require three expected nodes, GREEN for every table/partition, zero missing/underreplicated shards, no initializing/relocating/unassigned shards, and no failing bootstrap checks. Investigate discrepancies before stopping a node:

   ```sql
   SELECT id, name, version['number'], rest_url FROM sys.nodes ORDER BY name;
   SELECT table_schema, table_name, partition_ident, health,
          missing_shards, underreplicated_shards FROM sys.health;
   SELECT state, count(*) FROM sys.shards GROUP BY state;
   SELECT node['name'], count(*) FROM sys.shards GROUP BY node['name'];
   SELECT node_id, id, description, severity, passed FROM sys.node_checks;
   SELECT settings['cluster']['routing']['allocation']['enable'],
          settings['cluster']['graceful_stop'] FROM sys.cluster;
   SELECT name, settings FROM sys.repositories;
   SELECT name, state, finished FROM sys.snapshots
   WHERE repository = 'goodwatch-db-backup-v2' AND state = 'SUCCESS'
   ORDER BY finished DESC LIMIT 1;
   ```

   Capture the initial allocation setting. This recipe requires `all`, graceful minimum `PRIMARIES` and `force=false`; do not silently override unrelated settings. Review failed/warning node checks. Determine master node from the cluster monitoring view and prefer it last, while retaining at least two voting nodes throughout. Check that every shard has an active surviving copy on another node; GREEN alone can include zero-replica tables. Audit existing replica counts and placement, including BLOB shards; if any shard has only a copy on the intended node, confirm graceful decommission can relocate it before proceeding.
3. Verify `/mnt/backup-cratedb` is mounted and readable on every host, latest backup log has a successful finish, and repository listing is non-empty. `sys.snapshots` can take minutes on the network mount; use a five-minute read timeout, not the ten-second app timeout. If the repository is disabled/stale or restore has not been validated for this deployment, stop and fix that prerequisite under separate authorization.
4. Preserve a fresh named pre-upgrade snapshot in the active v2 repository, outside automatic retention names. Serialize with `/var/lock/backup_crate.lock` on `.11` so hourly create/prune cannot overlap the maintenance operation. Do not write the legacy repository or run legacy cleanup:

   ```sql
   CREATE SNAPSHOT "goodwatch-db-backup-v2"."pre_auth_547_YYYYMMDDHHMMSS"
   ALL WITH (wait_for_completion = true);
   SELECT name, state, finished FROM sys.snapshots
   WHERE repository = 'goodwatch-db-backup-v2'
     AND name = 'pre_auth_547_YYYYMMDDHHMMSS';
   ```

   Replace the timestamp once, use a 30-minute snapshot request timeout, and require `SUCCESS`. A client timeout does not cancel the server statement: inspect state before any retry. Record tables, user-management metadata, external secrets/configuration, snapshot name and restore location. **Snapshots exclude BLOB tables**: production has `blob.search_index_files`; retain/rebuild those files from the search deployment artifacts and verify that recovery path separately. A snapshot is not a backup of Compose, credentials, firewall configuration or post-snapshot writes. [Snapshot scope](https://cratedb.com/docs/crate/reference/en/5.10/admin/snapshots.html).
5. Pre-pull the pinned target on all three hosts and retain each running old image locally. Check the target digest/architecture. This is the first infrastructure mutation, and occurs only after the owner's go:

   ```sh
   docker pull crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307
   docker image inspect crate:5.10.16 --format '{{json .RepoDigests}}'
   docker inspect crate-01 --format '{{.Image}} {{.HostConfig.RestartPolicy.Name}}'
   # Use crate-02 / crate-03 on the other hosts; record actual old image IDs.
   ```

## Per-node rolling steps

Execute one host at a time, preferring the current elected master last. Do not advance until the previous node passes every recovery gate. The local rehearsal uses the official allocation/decommission procedure. **Do not substitute Docker stop/SIGTERM for SQL decommission**; do not force a failed drain. With two replicas on three nodes, minimum availability `FULL` cannot evacuate a node; `PRIMARIES` allows expected YELLOW while down. [Availability options](https://cratedb.com/docs/guide/admin/upgrade/rolling.html#data-availability-options).

For each `(10.0.0.11, crate-01)`, `(10.0.0.12, crate-02)`, `(10.0.0.13, crate-03)` in the chosen order:

1. Repeat the baseline health/shard checks. Ensure live clients can use the other two endpoints and retries respect ambiguous write outcomes from [#530](https://github.com/alp82/goodwatch-monorepo/issues/530). A maintenance restart can fail an in-flight HTTP request; do not retry non-idempotent operations with fresh CAS versions merely because an answer was lost.
2. On this host, preserve `.env` securely and render a reviewed configuration with only `CRATE_VERSION` changed to the digest-pinned `5.10.16@sha256:...` suffix above (Compose prefixes `crate:`). Preserve file mode/ownership. Validate the rendered service still has the original private bindings and data mounts. Disable the existing container's automatic restart before SQL drain so Docker cannot restart the old binary:

   ```sh
   cd /root/goodwatch/goodwatch-monorepo/goodwatch-crate
   docker update --restart=no crate-01
   # Replace crate-01 with the exact node for this host.
   ```

3. On a **different, healthy coordinator**, set transient allocation and decommission the exact recorded node ID (or node name, supported by CrateDB). Execute each SQL once, checking its response. Do not direct the command through the endpoint about to exit:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries';
   ALTER CLUSTER DECOMMISSION '<recorded-node-id>';
   ```

   Poll `sys.nodes` until the target is absent; inspect `docker inspect <node> --format '{{.State.Status}} {{.State.ExitCode}}'` until it has actually exited. Check the two survivors remain joined and every table has `missing_shards = 0`. YELLOW/underreplication is expected while this node is absent. Watch progress in logs and `SELECT id, stmt, started FROM sys.jobs`; decommission waits for active requests, including work whose HTTP caller already timed out. Drain/remove this endpoint from client routing where supported and wait for those operations to settle. Do not terminate production jobs without a separate decision. The cluster graceful timeout is two hours, not permission to kill it early. A failed/timed-out drain stops the rollout. Do not delete volumes or alter forced-stop settings.
4. Recreate only this service using the reviewed target `.env`; Compose restores the declared `restart: always`. The named data volume is retained:

   ```sh
   docker compose -f docker-compose.yml -p goodwatch-crate up -d --no-deps --force-recreate cratedb
   docker inspect crate-01 --format '{{.Config.Image}} {{.HostConfig.RestartPolicy.Name}} {{json .HostConfig.PortBindings}} {{json .Mounts}}'
   docker logs --since 10m --tail 200 crate-01
   ```

5. Through a surviving coordinator, require the same node identity to return with `version['number'] = '5.10.16'`, expected addresses and passing node checks. Then restore allocation:

   ```sql
   SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all';
   ```

   Wait for three nodes, every table/partition GREEN, missing/underreplicated counts zero, every shard STARTED and no initializing/relocating shards. On a large production cluster this may take longer than the lab; allow recovery to finish, and investigate sustained non-progress rather than advancing after an arbitrary timeout. Verify private HTTP from the actual webapp/Windmill client paths, representative catalog reads and an approved idempotent write/read probe. Do not mutate real auth/member rows merely to test maintenance. Compare client errors/latency and inspect crashes, OOM events, replication errors and rejected checks.
6. Verify the host's restart policy is `always`, private bindings/mounts are unchanged and firewall reconciliation remains active. Capture versions/health and the approved write probe result. Repeat on the next host only after these checks pass.

At the end require all three nodes at 5.10.16, all GREEN/STARTED, allocation restored, stable application traffic, and a successful new scheduled backup. Clear this runbook's transient allocation override only if its pre-run configuration provenance shows no earlier transient override: `RESET GLOBAL "cluster.routing.allocation.enable"` removes both persistent/transient overrides, so do **not** use it when that would erase an existing persistent setting. Otherwise leave the recorded effective baseline `all` and document the override. Do not use nonexistent `RESET GLOBAL TRANSIENT` syntax.

## Dedicated runtime user and future auth tables

After all nodes pass, the owner-authorized operator creates `goodwatch_auth` once using a new password from the secret manager. If it already exists, inspect its identity/grants and stop rather than rotating someone else's password. Supply passwords as bound SQL arguments over the private administrative session; do not commit them, put them in shell arguments, or log full request payloads.

```sql
SELECT name FROM sys.users WHERE name = 'goodwatch_auth';
-- Execute via the HTTP API with args = [<secret>], not a literal committed password.
CREATE USER goodwatch_auth WITH (password = ?);
SELECT name FROM sys.users WHERE name = 'goodwatch_auth';
SELECT grantee, class, ident, type, state FROM sys.privileges
WHERE grantee = 'goodwatch_auth' ORDER BY class, ident, type;
```

This deliberately gives **zero table privileges until #548 creates its reviewed migration tables**. CrateDB has no future-table `auth_*` wildcard grant. Runtime privileges must be explicit `DQL, DML ON TABLE`; never schema/cluster-wide `ALL`, `DDL`, `AL`, role membership or ownership privileges. Migrations run with a separate administrative identity. [CREATE USER](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-user.html), [GRANT](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/grant.html).

After the adapter migration, this read-only SQL produces candidate executable GRANT statements. Match the output against the migration's exact approved table allowlist before executing it; an arbitrary table named `auth_*` is not automatically authorized:

```sql
SELECT 'GRANT DQL, DML ON TABLE "' || replace(table_schema, '"', '""') ||
       '"."' || replace(table_name, '"', '""') || '" TO goodwatch_auth;'
FROM information_schema.tables
WHERE table_schema = 'doc' AND table_name ~ '^auth_'
ORDER BY table_name;
-- Result shape, once this exact table exists and is approved:
-- GRANT DQL, DML ON TABLE "doc"."auth_user" TO goodwatch_auth;
```

Every migration-created auth table must have:

```sql
-- Include in CREATE TABLE ... WITH (...); or use per approved existing table:
ALTER TABLE doc.auth_user SET (
  number_of_replicas = '2',
  "write.wait_for_active_shards" = 1,
  "translog.durability" = 'REQUEST'
);
```

`auth_user` above is an example to substitute with the adapter's reviewed table name, not a command to run now. Do not apply these settings to catalog tables. Two replicas give three copies when healthy; wait-for-one permits one-node maintenance and is not a promise of three copies during a failure. [Table settings](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-table.html#with).

Verify as admin that every approved auth table has the exact settings, all three copies STARTED, and the user has only table-scoped DQL/DML on the approved `auth_*` identities. After the separate HBA/client migration, check correct-password `SELECT current_user` reports `goodwatch_auth` on each endpoint; wrong/missing credentials are rejected from an actual app source; an approved auth-table read/write succeeds; catalog reads, arbitrary table DDL and privilege administration fail. Do not expose this account to production clients while password enforcement is absent. Store its secret for the auth adapter only; keep catalog access on its existing separate connection.

## Rollback and abort

- **Before target startup:** stop the rollout, restore allocation to its recorded baseline, restore the current host's old `.env` image reference and `restart: always`, and start the original image on the retained volume. Wait for the same three-node GREEN/STARTED gates. If drain failed and the original process remains live, restore its restart policy and investigate the decommission state before any restart; do not start another node while one is uncertain.
- **Clean patch regression after target startup:** official planning guidance permits a same-minor patch downgrade when there is no corruption. This exact 5.10.16 → 5.10.9 path is covered by the local rehearsal, including writes under the target. Retain each host's actual old image ID/digest from pre-checks (do not rely on a mutable tag). With this Compose template, set `CRATE_VERSION=5.10.9@sha256:<retained-old-RepoDigest>`; a raw image ID cannot be appended after the template's `crate:` prefix. Use the same per-node decommission/recreate/recovery procedure with the old reference, one at a time. Restore restart policies and allocation; check every acknowledged probe and production client behavior. Never downgrade through 5.10.11. [Rollback guidance](https://cratedb.com/docs/guide/admin/upgrade/planning.html#define-a-rollback-plan).
- **Corruption, incompatible gateway/shard metadata, or failed old-image startup:** halt; retain the affected data volumes and logs. Do not force a version override, remove gateway metadata, copy isolated old shards into the live cluster, or run `docker compose down -v`. The same-minor metadata guard is not proof that every production data state is compatible. Restore the named pre-upgrade snapshot to an isolated, fresh three-node cluster running the retained old image, with the same repository mounted and registered read-only. The `fs` read-only setting is supported by the [tagged 5.10.9 repository implementation](https://github.com/crate/crate/blob/5.10.9/server/src/main/java/org/elasticsearch/repositories/fs/FsRepository.java#L65). Validate tables, user management, settings and separate BLOB recovery before switching clients. Restoring onto existing tables is not supported.

  ```sql
  -- Fresh recovery cluster only, never against the live original cluster.
  CREATE REPOSITORY "goodwatch-db-backup-v2" TYPE fs
    WITH (location = '/snapshots/v2', readonly = true);
  RESTORE SNAPSHOT "goodwatch-db-backup-v2"."pre_auth_547_YYYYMMDDHHMMSS"
    ALL WITH (wait_for_completion = true);
  ```

  Freeze/drain writes before the recovery switchover, account for every write after the snapshot using the approved replay/export source, and have the owner acknowledge any unavoidable loss and downtime. Snapshot rollback is not a zero-data-loss promise. Keep hourly backup writers on the original repository coordinated during recovery. The destructive recovery/switchover needs a new concrete owner decision; it is not automatically authorized by an upgrade go.
- If user preparation must be undone, first confirm no live auth consumer depends on it, revoke only the exact granted table privileges (`REVOKE DQL, DML ON TABLE <approved list> FROM goodwatch_auth`), then `DROP USER goodwatch_auth` only if this run created it. Do not drop the future auth tables or change catalog accounts. No firewall rollback is needed because this runbook changes no firewall rules. The later HBA/client migration must have its own rollback plan.

## Rehearsal and limits

Checkpoint: rolling upgrade, local HBA roll, CAS/fault tests and all three nodes' password/grant/CRUD checks passed. CrateDB deliberately masks inaccessible schemas with 404 responses. The final rolling rollback/re-upgrade is running; its observation file will be added when complete.

The localhost-only runner in [cratedb-rehearsal/](cratedb-rehearsal/) reuses #530's Compose topology and full CAS/fault script from branch `research/cratedb-cas-proof`, commit `d87126eeaa8e9d98842f250722b86eed05005570`. Changes isolate its project/loopback ports, parameterize pinned images, match production's recover-after-three setting and verify 5.10.16 instead of 5.10.12. Run:

```sh
bash docs/implementation/auth/cratedb-rehearsal/run.sh
```

The script accepts only a local Unix Docker socket, uses project `goodwatch-upgrade-547`, binds `127.0.0.1:16430–16432`, rejects existing project containers and removes its own containers/volumes/network on exit. Three nodes have 384 MiB heaps, 1 GiB limits and one CPU each. No production endpoint/SSH/credential is present in the executable rehearsal. Its HBA override is explicitly local and does not represent a production auth migration.

The rehearsal exercises the upgrade with writes while each node is down, all three shard copies recovering between nodes, #530's stable contention and six primary failovers, password/grant enforcement, patch rollback and re-upgrade retaining data/user metadata. The initial run passed the rolling upgrade and all CAS/fault assertions, then aborted a later drain after four minutes because the node still had active server requests after fault injection. [Initial follow-up observations](cratedb-rehearsal/initial-fault-followup.json) and the [drain log excerpt](cratedb-rehearsal/initial-drain-log.txt) retain that abort. The follow-up rolling run reuses the already passing CAS evidence (`run.sh --skip-cas`) and tests explicit `restart: always` suppression/restoration and auth CRUD. The default runner now performs destructive fault injection last so lingering operations do not contaminate subsequent planned drains. The committed observation files record the actual result; see [rolling observations](cratedb-rehearsal/rolling-observations.json) and [CAS observations](cratedb-rehearsal/cas-observations.json). Production-scale catalog queries, restore/BLOB recovery, external Internet reachability and an actual production credential migration remain separate execution-time checks; the small lab cannot validate their duration or availability.

## Exactly what will run on production after the owner's go

Only the operator-approved window runs: repeated read-only health/config/firewall/client checks; a serialized named pre-upgrade snapshot; target image pulls; per-node `.env` image pin updates, temporary `docker update --restart=no`, transient allocation `primaries`, SQL decommission, service recreation on existing volumes, restart-policy/allocation restoration and recovery checks; then one parameterized `CREATE USER goodwatch_auth` with no initial grants and a final backup/health check. Approved table-specific GRANT/settings statements run later after #548's migration exists and is reviewed.

No production command above has run during preparation. No firewall command that changes rules, TLS rollout, HBA toggle, catalog schema change, Better Auth launch or Supabase cut-over is included. **Auth launch remains gated on the separately reviewed password/client migration.** Keep #547 open until production versions, user and firewall acceptance are recorded; report this document as runbook-ready preparation, not a completed production prerequisite.
