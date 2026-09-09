# Application Postgres service inventory and reversible shutdown

Read-only SSH inspection on 2026-09-09. No production service, credential, cron entry, or database configuration was changed. This document proposes later actions; none of the stop commands below have been executed.

## Exact service ownership

The old application database is a **host-managed PostgreSQL 16 / Patroni cluster**, not a Docker Postgres container. Its Patroni scope is `goodwatch-postgres-cluster`, under `/service`. The database inventory contains `goodwatch` and the administrative `postgres` database, plus templates; Windmill's database is elsewhere.

| Host | Private IP | Public IP | Patroni role at inspection | Native Postgres storage |
| --- | --- | --- | --- | --- |
| `pgnode01` | `10.0.0.11` | `128.140.87.34` | Streaming replica, lag 0 MB | `/var/lib/postgresql/16/main` |
| `pgnode02` | `10.0.0.12` | `49.13.88.203` | Leader | `/var/lib/postgresql/16/main` |
| `pgnode03` | `10.0.0.13` | `49.13.63.58` | Streaming replica, lag 0 MB | `/var/lib/postgresql/16/main` |

Roles can change. Re-read Patroni membership before stopping anything. On all three hosts, the Postgres data directory and its `pg_wal` directory are ordinary local paths; no external tablespace symlinks were present.

| Component | Verified ownership and configuration | Retirement candidate |
| --- | --- | --- |
| `patroni.service` on all three hosts | Runs as `postgres`; executable `/usr/local/bin/patroni`; configuration `/etc/patroni/patroni.yml`; native binaries `/usr/lib/postgresql/16/bin`; Postgres configuration `/etc/postgresql/16/main` | Yes, after application verification and before the observation window |
| `postgresql.service` | Active/exited wrapper whose start command is `/bin/true` | Package/configuration cleanup later; stopping this wrapper alone does not establish that Patroni's database stopped |
| `postgresql@16-main.service` | Inactive; PostgreSQL is managed by Patroni instead | Preserve during rollback; no separate active service to stop |
| `haproxy.service` on all three hosts | `/etc/haproxy/haproxy.cfg`; only Postgres master/replica listeners and its stats listener were configured | Yes |
| `pgbouncer.service` on all three hosts | Runs as `postgres`; `/etc/pgbouncer/pgbouncer.ini`; wildcard databases forward to local `/var/run/postgresql`, port 5432 | Yes |
| `goodwatch-db-pgadmin-1` on `.11` | Compose project `goodwatch-db`, `/root/goodwatch/goodwatch-monorepo/goodwatch-db/docker-compose.yml`; image `dpage/pgadmin4:8.2`; private port `10.0.0.11:6080`; volume `goodwatch-db_pgadmin` | Yes, after retaining its configuration; its sole registered connection targets this old cluster |
| Native Postgres data/config/log paths | `/var/lib/postgresql/16/main`, `/etc/postgresql/16/main`, `/etc/patroni`, `/etc/pgbouncer`, `/etc/haproxy`, `/var/log/postgresql` | Retain through rollback/observation; remove only after final retention decision |
| `etcd.service` on `.11` and `.12` | `/etc/etcd/etcd.conf`; data `/var/lib/etcd`; Patroni uses the v3 API | **Keep: shared with APISIX** |

The native service unit files for Patroni, HAProxy, and PgBouncer live under `/etc/systemd/system/`. Their configuration can contain credentials; preserve a protected copy before eventual removal and never publish its contents in the repository.

### Listener distinction

| Listener on each node | Owner | Treatment |
| --- | --- | --- |
| Private `10.0.0.11–13:5000` | HAProxy master endpoint → public node addresses on PgBouncer `6432` → local Postgres socket | Old application Postgres |
| Public node address `5001`, `5002`, `5003` | HAProxy replica listeners | Old application Postgres |
| Public node address `7000` | HAProxy stats | Old application Postgres proxy |
| `0.0.0.0:6432` | PgBouncer | Old application Postgres |
| Public node address and `127.0.0.1:5432` | Native PostgreSQL 16 | Old application Postgres |
| Public node address `8008` | Patroni REST API | Old application Postgres management |
| **Private `10.0.0.11–13:5432`**, `4200`, `4300` | Docker containers `crate-01`, `crate-02`, `crate-03`, image `crate:5.10.9` | **Keep: CrateDB** |
| Public/loopback `2379`, public `2380` on `.11`/`.12` | etcd | **Keep: shared DCS** |

Do not block port 5432 indiscriminately, stop Docker, or decommission these hosts. CrateDB uses the private addresses while native Postgres uses the public and loopback addresses on the same port.

### Shared components to preserve

- etcd has 37 v3 keys across `/service/goodwatch-postgres-cluster` **and `/apisix/routes`**. Removing the old Patroni namespace may be considered separately after rollback is no longer needed. Stopping etcd or removing `/var/lib/etcd` would also affect the APISIX data; its ownership and ongoing usage have not been retired by this work.
- Each Crate container has its own host-local Docker volume named `goodwatch-crate_crate_data`, plus `/mnt/backup-cratedb/snapshots` mounted as `/snapshots`. Preserve both on all three hosts.
- All active `windmill-default_worker-1` containers use a separate database target, `coinmatica.net:15432/windmill`. Preserve these workers, `windmill_worker_dependency_cache`, and Windmill's bundled Postgres. The bundled database's host/container was not altered or audited for removal.
- Preserve the shared `caddy` container and `goodwatch-proxy_caddy_data` / `goodwatch-proxy_caddy_config` volumes on `.11`; any obsolete pgAdmin route should be edited individually later.
- Preserve `grafana-alloy`, `node-exporter`, shared metrics configuration, and general host services. An obsolete Postgres-specific monitoring target can be removed separately after identifying it; do not stop the metrics stack.

## Backup and cron ownership

All three hosts use `Etc/UTC`.

| Host / owner | Schedule | Action | Treatment |
| --- | --- | --- | --- |
| `.11` / root crontab | `31 0 * * *` | `/root/goodwatch/goodwatch-monorepo/goodwatch-db/scripts/pg-backup.sh` | Retire this exact entry when the old database is stopped; keep the script and backup evidence through rollback |
| `.11` / root crontab | `5 * * * *` | `uv run .../goodwatch-crate/backup.py` | **Keep: CrateDB backup** |
| All three / root crontab | `31 21 * * *` | `killall -9 windmill` | Existing Windmill worker maintenance; **keep outside this migration** |

The Postgres backup script targets database `goodwatch`, writes to `/root/backup`, and uploads to a Hetzner Storage Box. Its retention is one day locally and seven days remotely. Those rolling backups are not a substitute for the permanent, tested cutover archive described in [the migration runbook](postgres-retirement.md#full-backup-recovery-verification). Retire only the Postgres cron entry; retain the hourly Crate backup and other root crontab lines. No cron entries have been modified by this inventory.

## Preconditions and observation window

Before disconnecting old Postgres:

1. Verify the deployed frontend accepts poster impressions and the resumed priority schedule completes successful claims, CrateDB/Qdrant publication, and acknowledgment. Keep current source crawlers and scheduled syncs enabled.
2. Finish retirement of deployed legacy Postgres entry points and confirm no current application configuration points at this cluster.
3. Preserve the verified full dump, its original constraint definitions, explicit recovery manifest, queue snapshot, reconciliation journal, and service/cron configuration for rollback. The three known source duplicate-constraint exceptions remain documented in the runbook.
4. Inspect active sessions and proxy clients again, distinguishing idle PgBouncer server connections from actual application clients. The read-only snapshot during this inventory showed local administrative/Patroni sessions and an idle pool connection; it does not prove a full interval without consumers.
5. Record a UTC observation start time when the old service is actually unavailable. Neither the paused priority schedule nor the earlier successful smoke tests start this clock.

Observe for **at least 24 hours and until every enabled daily job started in that interval has finished**. A **48-hour window** is the recommended operational margin for the current daily schedules. Extend it if any active weekly/less frequent consumer is discovered. Watch frontend/API errors, all Windmill scheduled jobs, priority backlog/leases, publication freshness, Crate/Qdrant health, and failed connection attempts to the old endpoints. Do not remove storage during this window.

## Proposed reversible stop commands — not executed

First re-check membership and confirm it is not in Patroni pause mode:

```bash
ssh root@10.0.0.11 'sudo -u postgres /usr/local/bin/patronictl -c /etc/patroni/patroni.yml list -f json'
```

With the preconditions satisfied, save the root crontab on `.11` privately and suspend only its Postgres backup entry. Then stop the three old proxy/pool services and optional pgAdmin container:

```bash
ssh root@10.0.0.11 'systemctl stop haproxy.service pgbouncer.service'
ssh root@10.0.0.12 'systemctl stop haproxy.service pgbouncer.service'
ssh root@10.0.0.13 'systemctl stop haproxy.service pgbouncer.service'
ssh root@10.0.0.11 'docker stop goodwatch-db-pgadmin-1'
```

For the inspected role assignment, stop **replicas first and the leader last**, preventing an unnecessary promotion of a replica during planned shutdown. If membership changed, reorder these commands accordingly:

```bash
ssh root@10.0.0.11 'systemctl stop patroni.service'
ssh root@10.0.0.13 'systemctl stop patroni.service'
ssh root@10.0.0.12 'systemctl stop patroni.service'
```

Verify that native Postgres and its public/loopback listener stopped, while private CrateDB listeners and Windmill workers remain healthy. Patroni pause mode or unusual shutdown behavior requires investigation; do not compensate with a broad `killall postgres` or Docker shutdown. An intentional systemd stop leaves units available for rollback; a later host reboot can restart still-enabled units, so monitor their state throughout observation.

Keep etcd running. Do not run `patronictl remove`, delete DCS keys, remove data directories/volumes, or uninstall packages during this reversible stage.

### Rollback of the infrastructure stop

Start the last confirmed leader first, then the replicas, keeping the original etcd state and data intact:

```bash
ssh root@10.0.0.12 'systemctl start patroni.service'
ssh root@10.0.0.11 'systemctl start patroni.service'
ssh root@10.0.0.13 'systemctl start patroni.service'
ssh root@10.0.0.11 'sudo -u postgres /usr/local/bin/patronictl -c /etc/patroni/patroni.yml list -f json'
```

After verifying the elected leader and healthy replication, restore the old proxy/pool listeners and pgAdmin if required:

```bash
ssh root@10.0.0.11 'systemctl start pgbouncer.service haproxy.service'
ssh root@10.0.0.12 'systemctl start pgbouncer.service haproxy.service'
ssh root@10.0.0.13 'systemctl start pgbouncer.service haproxy.service'
ssh root@10.0.0.11 'docker start goodwatch-db-pgadmin-1'
```

Restore the exact suspended Postgres backup cron entry if returning the old service to use. Infrastructure restart alone does not roll back application queue state: follow the runbook's demand/acknowledgment reconciliation rules before restoring old consumers.

## Duplicate TV timestamp audit

A read-only source scan with index scans disabled confirmed the hidden row for show `215001` has priority 139, `updated_at` 2025-02-28 07:11:02.245327 and `reset_at` 2025-01-14 05:52:48.351319. The retained priority-zero row has newer `updated_at` and `reset_at` of 2026-09-09 12:36:44.323010. Both share creation time 2024-05-28 22:48:19.705361. These are source timestamp-without-time-zone values, interpreted as UTC by the migration.

The live Crate row retained the newer reset/success timestamp, and the +139 demand correction changed no timestamps. No source timestamp was lost that requires a further queue update. Protected evidence: `queue-show-215001-source-timestamp-audit.json`.
