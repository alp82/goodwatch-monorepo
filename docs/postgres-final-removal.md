# Application Postgres retirement: final execution

Issue #13's scoped infrastructure cleanup was executed on September 15, 2026, after the final processing review and the provider identity/alias repairs. Cleanup and postchecks completed at **2026-09-15T13:17:24Z**. Retain recovery artifacts until **2026-10-15T13:17:24Z** under issue #14.

## Removed resources

| Host | Removed |
| --- | --- |
| `.11`, `.13`, then `.12` | Native PostgreSQL 16 data `/var/lib/postgresql/16/main`; old configuration `/etc/postgresql/16/main`, `/etc/patroni`, `/etc/pgbouncer`, `/etc/haproxy`; dedicated `/var/log/postgresql`; custom Patroni/PgBouncer/HAProxy systemd units. |
| All three database hosts | Exactly five packages: `postgresql-16`, `postgresql-16-dbgsym`, `postgresql-server-dev-16`, `haproxy`, `pgbouncer`. Separately uninstalled the Patroni pip distribution and its entrypoints, preserving shared Python dependencies. |
| All three database hosts | Inventoried unowned PostgreSQL 16 extension artifacts, old database-account password files and residual proxy log rotation; three obsolete `goodwatch-db` deployment files per host. These files were archived before removal. |
| `.11` | Stopped `goodwatch-db-pgadmin-1` and its exclusively attached `goodwatch-db_pgadmin` volume; the exact suspended Postgres backup cron entry and its label. |
| `.10` | Dedicated retired `postgresql_cluster` and `autobase` deployment copies, after preserving their contents and custom inventories; temporary `goodwatch-postgres-observation-20260909.service` and its dedicated evidence/credential directory, after archival. Temporary observer credential copies were also removed from the retained observation archive and local observer directory. No underlying shared token was revoked. |
| Local machine | Stopped `goodwatch-retirement-restore-20260909`. Its restored data existed in its writable layer; there was no separate volume. Its image was not removed. |
| `.10` deployment checkout | Three obsolete `goodwatch-db` deployment files. Its unrelated environment file contains Weaviate/OpenAI settings and was preserved; the `.11` pgAdmin-only `SELF_IP` environment file was archived and removed. |
| Repository | `goodwatch-db/Makefile`, `goodwatch-db/docker-compose.yml`, `goodwatch-db/scripts/pg-backup.sh`. |

The original broad Ansible removal defaults were not executed. No package autoremove was run. PostgreSQL client/common and libpq packages remain available.

## Preserved resources

- All Crate data volumes, private SQL 5432, HTTP/transport listeners, snapshot mounts, and the hourly Crate backup cron. The similarly named Crate repository `goodwatch-db-backup` is retained.
- Qdrant `media_fingerprint_v1`, Redis, Windmill workers, Windmill's bundled PostgreSQL, Coolify databases and unrelated containers/data.
- Shared etcd services, all their state including the old Patroni namespace, and all 28 APISIX records. The records matched byte-for-byte before/after. The old Patroni namespace was not included in the deletion plan.
- Shared Caddy container, both Caddy volumes and current routing. Fresh Caddy/APISIX inspection found no pgAdmin or port-6080 target; no route needed deletion. The unrelated `healthcheck_016080` route remains.
- Source-repair archives and resolved-alias tombstones. Postgres artifact retention does not authorize deletion of the separate provider-repair evidence.

## Processing gate

The original observation deadline was September 11 at 21:01:10 UTC. The temporary observer's Windmill 404s and incomplete daily summary were explicitly rejected as proof of workflow health. Its hard-coded Qdrant `media` collection was obsolete after the fingerprint rollout; the actual `media_fingerprint_v1` collection was checked instead.

Final review used genuine scheduled roots, material descendants, source records and publication outputs:

- Scheduled `populate_crate` on September 14 at 17:00 UTC (`01a09bb6-232d-6ce8-65d8-bc51d02058a7`) completed initialization and all seven branches with nonzero row counts. Five useful post-shutdown daily runs were recorded.
- September 15 TMDB details, IMDb, Rotten Tomatoes, TV Tropes and DNA initializers completed their actual child executions. Some oversized results remain `WINDMILL_TOO_BIG`; the review retained child execution/log evidence rather than inventing returned counts.
- The September 12 Metacritic Mongo timeout was followed by successful scheduled roots on September 13 and 14. The September 15 run was deliberately cancelled during alias retirement to discard its stale input snapshot; this was not an unexplained failure.
- The provider initializer's historical duplicate failures are resolved by the full source repair, enforced unique indexes, verified alias tombstones, successful targeted initializer/crawl/publication replay and resumed ordinary country processing. The daily provider initializer had not yet reached its next scheduled slot; it is not claimed as a fresh successful daily run.
- The noon streaming catch-up (`01a0a498-5b30-482a-d83d-890d1881536a`) completed at 12:52:55 UTC with partial success, writing 8,823 movie rows, 6,914 show rows and 12,750/3,838 respective availability rows. Countries pending repair or source retry retain protected published data.
- Scheduled priority root `01a0a51b-39c6-7589-c76e-aefa4f9c021b` published and acknowledged two titles despite explicitly recorded external-source failures. Genuine Metacritic and Rotten Tomatoes outputs and successful country fetches were inspected.
- The 10:00 homepage warmup failure recovered in scoped replay `01a0a528-2bdd-e352-9208-1db7f8bcfb1f` at 13:01 UTC. It confirmed all four expected identities, DE/en, the 86,400-second TTL and verified cache writes.

### Accepted external-source and monitoring limitations

IMDb HTTP 202 and TV Tropes rate limits remain explicit failures. Live movie/show source reads matched those failed fetches, retained their older success timestamps, recorded failure times and released selection. These are accepted existing retry behavior for this retirement; no fresh ratings/tags are claimed for failed fetches, and no upstream restrictions were bypassed. Existing monitoring incidents remain visible rather than being cleared to make the report green.

Country repair freshness is asynchronous. At the 12:18 UTC verification, 67,330 movie and 15,331 TV countries remained pending, down from the 84,662 reopen baseline; eight had recorded failures. Pending country state does not mean verified freshness. Both collections had full unique indexes, maintenance was open, all five previously failing sample titles had no identity errors/pending repair, and no unresolved quarantines remained. Counts continue changing through the durable queue.

Bounded monitoring histories and ordinary country-backlog coverage remain incomplete. Their unknown states are not treated as zero backlog or proof of health. Complete identity-repair metrics, inspected actual executions and readback support this scoped gate.

## Execution and validation

Each node's package transaction was simulated immediately before execution and restricted to the five owned packages. Current configuration/password/deployment files were archived first. Tablespace symlinks and mounts beneath native PostgreSQL data were absent. Every host passed post-removal Crate, worker and frontend checks before the next host was processed.

On `.11`, the first purge paused at PostgreSQL's interactive removal prompt. Only that prompt process was terminated; the same scoped transaction was rerun with `DEBIAN_FRONTEND=noninteractive`. Final package audits confirm consistent state. A preservation assertion initially compared Docker mount lists in incidental order; canonical comparison by mount destination proved every preserved container/mount unchanged. These execution-harness corrections did not widen deletion scope.

Fresh post-removal checks confirm missing native data/configuration/password/tooling paths, no installed retired packages, clean `dpkg --audit`, absent old custom units/listeners, preserved container mounts and exact unrelated cron entries. Frontend, authenticated Crate/Redis, Qdrant and shared etcd checks pass. The `.10` cleanup preserved all 24 existing containers' running states. The normal Crate snapshot `hourly_20260915_130502` completed with `SUCCESS` during cleanup, as did its two predecessors; snapshot mounts and scheduling remain operational.

### Post-cleanup scheduled publication

Scheduled priority root `01a0a52f-5dfa-80e3-8e8f-3ac025d40b14` started at 13:09:20 UTC after native storage removal and completed with success. Its publication and acknowledgment started at `2026-09-15T13:16:11.318600Z` and `2026-09-15T13:16:17.815349Z`, respectively. Readback confirmed show 148 demand/acknowledgment 131/131 and movie 718100 90/90, with cleared leases. Both title rows and Qdrant points exist, and their streaming availability sets match after converting Crate's country/service encoding to Qdrant's service/country encoding. The first verification comparison omitted that established conversion; correcting the read-only checker passed without modifying production data.

Ordinary post-cleanup country crawls also completed successfully. This confirms ongoing source work and complete publication/acknowledgment, without claiming every external source refreshed successfully. Final node/frontend checks passed after this readback.

## Recovery retention

The verified export, supplemental role/admin dumps, original and fresh configuration backups, checksums and recovery instructions remain protected. Retention begins only after final cleanup postchecks finish; it is not measured from shutdown or the original observation deadline.

**Cleanup completed:** `2026-09-15T13:17:24Z`. **Retention expires:** `2026-10-15T13:17:24Z` (30 days later). Issue #14 remains open and must not delete artifacts before the recorded expiration or while an active recovery incident requires them.

Recovery locations:

- Original export and cutover evidence: `/home/alp/.local/state/goodwatch/postgres-retirement/20260909T085648Z`.
- Final execution inventories, journals, processing evidence and fresh archives: `/home/alp/.local/state/goodwatch/postgres-retirement/final-20260915`.
- Earlier firewall rollback archive: `/home/alp/.local/state/goodwatch/ufw-retirement-20260910`; it contains mixed-purpose changes, so any later retention cleanup must preserve unrelated firewall/worker evidence.

The original dump is 2,282,167,152 bytes and matches SHA-256 `5299d930f8e1870c5ee10c3365d48e28a02eb2cbc3de944d3a102ef4de2f9d4b`. All ten original checksum sidecars were reverified at the deletion gate, along with the three-exception manifest (`6e491c849b8d626e76fa5e486152eab745381c556977d00d27f9017b618c005b`). Fresh archives have separate manifests and hashes.

For logical recovery, use the unchanged custom dump and `application-postgres-restore-with-three-source-exceptions.list`, omitting exactly `priority_queue_movie_tmdb_id_key`, `priority_queue_tv_tmdb_id_key`, and `user_settings_user_id_key_key`. These source UNIQUE constraints were already violated by retained raw rows. The prior restore passed with all 25 raw table counts matching; no exact-schema restore is claimed. Reconcile duplicates deliberately before recreating those constraints. See [the migration recovery instructions](postgres-retirement.md) for original source/restore versions and demand reconciliation. Rebuilding infrastructure requires the retained configurations and scoped firewall changes; simply restarting old units is no longer possible.
