# Final application Postgres removal

This runbook covers issue #13. It supersedes the final-removal steps in the earlier migration inventory; it does not authorize an early cutoff or assert that cleanup has happened.

## Gates and current state

The original observation window ends **2026-09-11 21:01:10 UTC** (23:01:10 Europe/Berlin). Native PostgreSQL 16, Patroni, HAProxy, PgBouncer and pgAdmin have been stopped since September 9. Their retained data and configuration must remain intact until the deadline **and** a positive review of actual replacement processing. A timer expiring is insufficient.

Before removal, review genuine post-shutdown daily roots and their material descendants, current priority source/publication/acknowledgment outputs, repaired paths from issues #6/#7/#10, and outstanding incidents. Distinguish useful work, no eligible work, overlap skips, cancellation, durable external-source retries, material failures and incomplete evidence. Infrastructure monitoring being green does not prove workflow success. Preserve the final evidence before retiring its temporary collector.

The full export has already been restored with an explicit manifest excluding exactly three pre-existing invalid UNIQUE constraints. Verify the retained bytes against their checksum and preserve the manifest and restore/count evidence. This proves logical recovery with those documented exceptions, not an identical source schema or server version. The source constraints are `priority_queue_movie_tmdb_id_key`, `priority_queue_tv_tmdb_id_key` and `user_settings_user_id_key_key`.

Issue #14 cannot remove retained recovery artifacts until **30 days after actual final cleanup**. No expiration date exists yet. Record `cleanup_completed_at` as an exact UTC timestamp only when cleanup and its postchecks finish; compute `retention_expires_at = cleanup_completed_at + 30 days`. Do not derive retention from shutdown, this PR, the observation deadline or the earlier export date.

## Scope boundaries

The removal inventory must identify current ownership immediately before mutation. The original Ansible removal playbook is unsafe for this scope: its default PostgreSQL version differs from the live version and optional etcd removal would affect APISIX.

| Resource | Removal scope after gates | Explicit preservation |
|---|---|---|
| Native database on `.11–13` | Old PostgreSQL 16 data at `/var/lib/postgresql/16/main`, its configuration and exclusively owned packages/binaries | Crate containers, `goodwatch-crate_crate_data`, private SQL 5432, HTTP 4200, transport 4300, snapshot mounts and backup schedule |
| Patroni/proxy services | Exact stopped `patroni`, `pgbouncer`, `haproxy` units and their old-cluster-only configuration | Shared systemd resources, SSH, metrics and unrelated packages |
| Shared etcd | Only an independently inventoried obsolete Patroni namespace, if included in the reviewed plan | etcd service, `/var/lib/etcd`, all APISIX and other namespaces |
| pgAdmin on `.11` | Stopped `goodwatch-db-pgadmin-1`, exclusively attached `goodwatch-db_pgadmin`, exact obsolete route if still present | Shared Caddy container, other routes and both Caddy volumes |
| Retired deployment files | `goodwatch-db/docker-compose.yml`, its Makefile and `scripts/pg-backup.sh`; exact retired deployment copies after backup | `goodwatch-remote/default` bundled PostgreSQL, Crate backup code and its repository named `goodwatch-db-backup` |
| Temporary validation | Disposable restore container/data and observation service/temporary credentials after evidence retention | Verified export, manifest/checksums, role/admin dumps and protected recovery configuration through issue #14 |

Do not run broad package autoremove, delete a whole host/repository, wipe `/var/lib/postgresql` without version/ownership checks, delete shared Docker networks, or restore an old whole-firewall dump over Docker. Existing scoped firewall retirement and worker rules remain in force.

## Execution record required at the gate

1. Capture a fresh UTC clock, current exact inventory, stopped-state checks, backup hashes and processing evidence. Record unresolved findings; do not translate unknown results into approval.
2. Save the exact removal plan and protected configuration/ownership evidence. Validate package removal in simulation and ensure no preserved package or shared service appears in the transaction.
3. Perform the reviewed old-cluster cleanup one host at a time, replicas `.11/.13` before former leader `.12`, checking preserved Crate/worker/shared services after each. Avoid starting the old database to inspect it during this phase.
4. Remove only the stopped pgAdmin container and its exclusively owned volume; validate/reload shared routing only if an obsolete route actually exists. Remove the exact suspended Postgres cron entry without changing hourly Crate backups or worker maintenance.
5. Retain observation/restore evidence, then remove only the disposable restore resources and temporary observer credentials/service. Keep recovery copies required for the 30-day retention.
6. Verify current frontend, authenticated Crate/Qdrant/Redis access, actual scheduled processing and absence of retired listeners/resources. Record the final owned-resource inventory, exact cleanup completion/retention timestamps and recovery locations. Update issue #14 with the computed deadline; leave it open and time-gated.

Protected recovery files are located under `/home/alp/.local/state/goodwatch/postgres-retirement/20260909T085648Z`; configuration and credentials must never be committed or printed. Existing restore and service backups are described in [the migration runbook](postgres-retirement.md) and [the shutdown inventory](postgres-decommission-inventory.md). The protected execution records and current host inventory must be reread at the cleanup gate.

## Reviewed inventory before the gate

Read-only inspection on September 11 confirmed the three custom service units remain stopped, while their enabled state still permits rollback. The data directories contain approximately 7.55 GB (`.11`), 7.67 GB (`.12`) and 7.54 GB (`.13`), with no tablespace symlinks. Exact package-removal simulation on every node proposes only `postgresql-16`, `postgresql-16-dbgsym`, `postgresql-server-dev-16`, `haproxy` and `pgbouncer`. Patroni 3.2.2 is a separate pip distribution under `/usr/local/lib/python3.10/dist-packages`; remove only that distribution, preserving shared dependencies. Recheck these facts and the simulated transaction immediately before executing the reviewed removals.

The old custom units are `/etc/systemd/system/{patroni,haproxy,pgbouncer}.service`. Old-cluster configuration is limited to `/etc/postgresql/16/main`, `/etc/patroni`, `/etc/pgbouncer` and `/etc/haproxy`; dedicated logs are `/var/log/postgresql`. Retain protected copies through the recovery period. Do not remove PostgreSQL client/common or `libpq` packages without separate ownership proof.

The sole stopped pgAdmin container ID is `9621a66be221017863cfc435925c3f8965428b6d28fe3196df85781c53f025a7`; its sole registered database connection targets the old cluster. No current Caddy route targets pgAdmin or port 6080. A read-only scan of all 28 APISIX records likewise found no upstream targeting pgAdmin/6080. The similarly numbered `/apisix/routes/016080` is currently named `healthcheck_016080`, has a different URI and no upstream/service reference; preserve it because its current ownership does not establish a pgAdmin route. No route deletion is needed merely to match an old numeric identifier.

The disposable local restore container is `goodwatch-retirement-restore-20260909`, ID `78e82c092cab4265d4b6e227e828f551cc4c6377ec21b39a1d14b21a7c214a7a`. It is stopped, has no network, ports or mounts, and its restored data exists only in its writable layer. There is no separate restore volume to delete; its image is not independently proven exclusive.

The temporary observer is `.10:/etc/systemd/system/goodwatch-postgres-observation-20260909.service`, with dedicated evidence/credential copies under `/root/goodwatch/postgres-retirement-observation-20260909`. Preserve required evidence first; removing those copies does not authorize revocation of any underlying shared token.

The 2,282,167,152-byte full dump still matches SHA-256 `5299d930f8e1870c5ee10c3365d48e28a02eb2cbc3de944d3a102ef4de2f9d4b`; all ten existing checksum sidecars and three service-configuration archives validate. The three-exception restore manifest matches `6e491c849b8d626e76fa5e486152eab745381c556977d00d27f9017b618c005b`. Recorded restore exit status is zero and all 25 raw table counts match. These copies remain protected and retained; no new destructive restore or cleanup has been performed.
