# Application Postgres retirement

Implementation and deployment runbook, 2026-09-09.

## Scope and current status

The repository implementation replaces application Postgres with CrateDB for priority demand, queue ownership, and immediate crawl publication. Current DNA/vector publication uses CrateDB and Qdrant. Windmill's bundled Postgres is excluded.

Production cutover is in progress. The replacement Windmill scripts and flow are deployed, the final complete movie/show flow passed, and the priority schedule has resumed against CrateDB. The queue import passed snapshot verification; comparison with the full raw backup subsequently found and reconciled 139 additional demand hidden by a corrupt source index. The frontend passed local browser/impression checks; commit `7da7486` is building in Coolify. Application Postgres services remain running, and Windmill's bundled Postgres remains untouched.

Initial inspection, before the cutover, confirmed:

- `f/priority/crawl_all` is enabled and its deployed definition still calls the old Postgres queue and three `combine_data` publishers.
- Standalone `combine_data` and old genome schedules are disabled.
- The cache-warming schedule `f/utils/visit_goodwatch_schedule` targets `f/utils/visit_goodwatch_and_populate_cache`.
- CrateDB has the six migrated `user_*` tables and no priority tables at inspection time.
- The Postgres queue contained 1,006,509 movie rows and 187,164 TV rows. These are inventory observations, not a frozen migration snapshot.

CrateDB also uses hosts `10.0.0.11–13` and port `5432` for its PostgreSQL wire protocol. Identify the old Postgres service, proxy/listener, and volumes individually. Do not retire whole hosts or block all traffic to that port.

### Cutover record

Protected rollback artifacts are stored locally in `/home/alp/.local/state/goodwatch/postgres-retirement/20260909T085648Z` (directory mode 700; files 600). They include the previous deployed definitions and schedule, snapshot, reconciliation sidecar, manifest, retention inventory, and current cutover/job status. Do not commit these artifacts: they can contain personal data or deployment configuration.

- Verified import: 1,006,508 movie entries and 187,163 show entries; demand totals 7,471,609 and 1,798,678 respectively. The earlier inventory counts were not a frozen snapshot.
- Canonical snapshot SHA-256: `b7cfa7ef1aaec89ec2654eebf1e712332c3ed4f9928e7d876b0ffb4edbd21b57`.
- Queue initialization succeeded in Windmill job `01a08642-c80a-11a3-3736-6e9d7f96df5d`.
- Movie/show smoke jobs: `01a08649-80ab-65a0-aae6-11f3ef457330` (movie 11) and `01a08649-80ed-99c8-945c-339f5bf922a0` (show 1399). Both reached publication and correctly retained their claims/demand after strict bulk checks caught missing primary-key values in existing metadata transformations. Missing image language and release certification now map to the established empty-string sentinel; the fixes are deployed. A read-only audit of 4,909 transformed records across 15 tables found no remaining null/duplicate primary keys for those titles.
- The first metadata-fixed publisher job, `01a08654-850c-0d5d-cf79-2920232a0c62`, exposed a targeted vector lookup that ignored its index-selection flag and scanned the date index. It was canceled before retry. Honoring the flag reduced a live bounded lookup from a timeout to 52 ms; the fix and regression are included.
- Publisher job `01a0865b-4800-9e5b-afcb-6698d323399a` succeeded for both titles, including all CrateDB stages and one Qdrant point each. Read-back confirmed Star Wars/movie 11 and Game of Thrones/show 1399 in both stores.
- Acknowledgment job `01a0865c-70b0-f4f0-cd12-97f4bc9d35af` succeeded using the original claims: leases cleared, acknowledged demand became 0/124, and newer demand 1/125 remained, leaving one pending impression each. Community Edition does not support restart-at-step, so this recovery used the individual scripts.
- Final complete movie/show flow run `01a0865d-7bd2-397b-26e7-2d886ea11385` succeeded in 759,731 ms (12 minutes 40 seconds), returning `{"acknowledged": 2}`. Its publisher `01a08668-9b5d-6d9a-5a4b-0df0468aded3` and reset `01a08668-ba9c-1a2f-2d63-fbe7dd2c2c13` both succeeded. Read-back confirmed cleared leases and demand/acknowledged demand of 1/1 for movie 11 and 125/125 for show 1399. Existing source retry delays accounted for most of the elapsed time; source freshness limitations below still apply.
- Local frontend endpoint returned 204 for an impression and its duplicate; live demand rose exactly once per title, from 0 to 1 for movie 11 and from 124 to 125 for show 1399, while claimed demand remained 0/124. These are intentional verification increments after the frozen import comparison.
- The shared Crate connector now bounds connection/read timeouts and flushes progress logs. A worker on `.11` cannot reach its own host's Crate HTTP endpoint; failover to the other nodes was tested successfully. The underlying container network issue remains to be corrected.
- Full application Postgres backup completed: `application-postgres-full.dump`, 2,282,167,152 bytes, SHA-256 `5299d930f8e1870c5ee10c3365d48e28a02eb2cbc3de944d3a102ef4de2f9d4b`. PostgreSQL 16.12 `pg_dump` and archive listing both succeeded. All 25 raw table counts matched the source audit after an isolated restore with the three source-schema exceptions described below. The original archive is unchanged.

Retention reconciliation found no missing current favorites, scores, skipped titles, or history in CrateDB. The 223 missing setting rows use obsolete unsupported keys. Seven old wishlist rows are absent: five have newer watched/scored state, while two remain ambiguous. Preserve them in the full backup rather than recreating potentially deleted user data. Legacy DNA/clusters/progress also require backup retention; they are not current publication inputs.

### Full backup recovery verification

The protected directory contains `application-postgres-backup-manifest.json`, the original custom-format dump and checksum, archive listing, restore logs, and `application-postgres-restore-with-three-source-exceptions.list`. No application database data, schema, credentials, or services were changed during backup. Ownership and ACLs were intentionally omitted; cluster roles and service configuration are outside this logical database backup.

An exact-schema restore exposed existing source data that violates three declared UNIQUE constraints: `priority_queue_movie_tmdb_id_key`, `priority_queue_tv_tmdb_id_key`, and `user_settings_user_id_key_key`. The restore manifest excludes exactly these three constraints and preserves every raw row, including duplicates. Using that manifest, `pg_restore --exit-on-error` succeeded and all 25 restored table counts matched the read-only source inventory. The unmodified dump still contains the original constraint definitions. Do not claim an exact-schema restore or silently deduplicate the archive; use the explicit restore manifest for raw recovery, then reconcile duplicates deliberately before recreating these constraints.

**Queue discrepancy reconciled:** the raw backup revealed that the corrupt TV unique index hid a second row for show `215001`. The frozen snapshot contains demand 0 for that show, but the raw rows contain priorities 0 and 139. A comparison of all 1,193,671 unique queue keys found exactly this one demand discrepancy and no missing keys: raw total show priority is 1,798,817 versus snapshot 1,798,678, while movie totals agree. An explicitly journaled full-primary-key `_seq_no`/`_primary_term` conditional update added the missing 139 to the live CrateDB row, changing demand from 0 to 139 and preserving acknowledgment, claimed demand, leases, cooldown, and timestamps. Read-back verified the correction; re-running the helper performed no additional write. The original snapshot and Postgres remain unchanged. Evidence is in protected `application-postgres-queue-full-delta-verification.json`, `application-postgres-queue-retention-discrepancy.json`, and `queue-demand-reconciliation-show-215001.jsonl`.

Validation used isolated PostgreSQL 16.15 with vector 0.8.6 and vectorscale 0.9.0; the source was PostgreSQL 16.10 with vector 0.7.4 and vectorscale 0.3.0. The restore image additionally initializes its bundled TimescaleDB extensions. The disposable container `goodwatch-retirement-restore-20260909` has no network or published ports and is stopped with restored data retained for inspection. This verifies logical data recovery, not identical server/extension versions. No old application Postgres service has been stopped.

## Inventory

| Classification | Paths | Treatment |
| --- | --- | --- |
| Current scheduled publication | `f/sync/copy/{tmdb_details,tmdb_streaming,all_ratings,tvtropes,dna_data,vector_data,tmdb_daily}`, `f/sync/populate_crate` | Keep; scheduled lookback semantics unchanged. |
| Current ingestion | TMDB, IMDb, Metacritic, Rotten Tomatoes, TV Tropes initializers/crawlers, daily dumps, `f/dna/*` | Keep. |
| Replaced active Postgres path | `f/priority/{next,reset,crawl_all}` | CrateDB claims, publication, then acknowledgment. |
| New publication | `f/priority/publish` | Targeted current transformations for details, ratings, streaming, tags, valid existing DNA, and vectors. |
| Deprecated standalone pipelines | Old `combine_data`, `genome`, Postgres vector/recommendation experiments | Archived outside sync and remotely in Windmill; see [retired inventory](../goodwatch-flows/retired/README.md). |
| Historical migration/setup | User migration, Postgres DDL, old connector | Archived for reconciliation/reference. |
| Removed webapp dependencies | `app/utils/postgres.ts`, direct `pg`/`@types/pg`, example Postgres variables | No current webapp Postgres connection. |
| Still operational until cutover | Live application credentials/resources, `goodwatch-db` pgAdmin/backup tooling | Retire after verification and final backup. |

Absence of a schedule does not rule out manual/API invocation. Confirm external triggers, recent jobs, and database clients before deleting deployed entries.

The subsequent [live dependency audit](postgres-live-dependencies.md) checked all 22 enabled schedules and the paused replacement priority flow (62 recursively referenced entries), finding no application Postgres dependency. It lists the exact 65 script, 13 flow, and 15 disabled-schedule retirement candidates, including the previously overlooked deployed recommendation flow with missing local inline sources. A concurrent Postgres client check found only the full-backup `pg_dump`; this is a point-in-time observation, not the final observation window.

## Queue behavior

`crawl_priority` has primary key `(media_type, tmdb_id)`, with `movie | show`, and stores:

- `demand`: cumulative accepted impression weight.
- `acknowledged_demand`: demand successfully published by a completed crawl.
- `claimed_demand`: demand captured when the current worker claimed the row.
- `lease_token`, `lease_expires_at`: ownership and two-hour retry lease.
- `last_success_at`: seven-day cooldown after successful publication.
- `created_at`, `updated_at`.

Selection ranks outstanding demand and uses full-key `_seq_no`/`_primary_term` conditional updates. Ranking may be stale; only a successful conditional update grants ownership. Mapping uses TMDB IDs in the queue and Mongo ObjectIDs at the existing crawler boundary. Missing mappings are skipped without clearing demand; selection can page beyond unmapped candidates. Explicit IDs bypass cooldown while respecting active leases.

Acknowledgment verifies current, unexpired ownership and only acknowledges `claimed_demand`; later impressions remain pending. Failures retain demand and expired leases permit retry. Partial explicit selection failures release claims already acquired by that selection. Leases prevent duplicate claims, not exactly-once external fetching: a worker delayed beyond its lease can still finish external work, but cannot acknowledge a replacement lease.

Visible poster tracking batches up to 50 titles after at least 50% visibility for one continuous second. Browser deduplication and Redis deduplication/rate limiting make these approximate demand counters, not billing analytics. Failures do not interrupt browsing and failed impressions are not retried. Redis must be available, request origin must match the configured public origin, and ingress must overwrite `X-Forwarded-For`. `APP_ORIGIN` defaults to `https://goodwatch.app` in production and `http://localhost:3003` in development; set it explicitly for staging or alternate URLs. This avoids deriving HTTPS origin from the HTTP connection behind Coolify's TLS termination. Search/decorative/history thumbnails are not instrumented.

## Immediate publication

`crawl_all` now runs source crawlers, then `f/priority/publish`, then `f/priority/reset` with `results.g.claims`. The publisher uses `results.g.tmdb_ids`, **not** source collection ObjectIDs.

Targeted entry points bypass the 48-hour lookback. Empty movie/show lists do no work. Details are published first; ratings, streaming, TV Tropes and valid DNA enrich the rows. Qdrant is refreshed for titles with existing vectors; missing vectors are a valid no-op. Crate bulk per-row failures and incomplete Qdrant updates raise errors and prevent acknowledgment. Partial writes can occur, so retries reuse idempotent upserts.

The existing DNA branch is failure-tolerant. Its legacy `expr: 'false'` does not disable it: Windmill `branchall` runs all branches. This change preserves that behavior. If DNA generation fails, existing valid DNA can still be published; incomplete DNA is not used to erase current data.

Existing Rotten Tomatoes and TV Tropes subflows also skip failed individual loop iterations. During the smoke crawls, external timeouts/rate limits were tolerated by those subflows and publication proceeded with available source records. A successful priority run therefore confirms publication of available data, not a fresh response from every source. Qdrant client 1.15.1 is pinned for compatibility with the deployed 1.15.4 server.

Scheduled syncs remain unchanged as catch-up. Their 48-hour windows require an explicit backfill following longer outages.

## Deployment and transfer sequence

Pushes to `main` changing `goodwatch-flows/**` automatically deploy to Windmill. Pause priority processing **before** merging/pushing this migration. Do not let the new webapp accept queue writes until the import has been verified.

1. Export the deployed flow/script versions and schedule configuration for rollback. Record the application Postgres endpoint and its service ownership. Verify historical user data and any other retained Postgres-only records; do not blindly rerun the archived user-data copy over newer CrateDB rows.
2. Pause `f/priority/crawl_all`, disable external/manual triggers during transfer, and drain all queued/running instances. Pause any other queue writers. Keep the old webapp version running until transfer is finished; its priority helper has no active callers in the reviewed checkout.
3. Deploy the new scripts/flow while priority scheduling is paused. Run `f/priority/init` to create **only** the new queue table. It derives the schema from `SCHEMAS['crawl_priority']`; inspect an already-existing table before proceeding. The general scheduled Crate schema initializer also includes the table.
4. Export both Postgres queues to a protected JSONL snapshot. Export uses one read-only repeatable-read transaction, preserves priorities and timestamps, and maps `tv` to `show`. Null/invalid keys, negative demand, duplicates, and out-of-range values require reconciliation. Export publishes its final snapshot path only after validation.
5. Import and verify while all writers/consumers remain paused. Existing matching rows allow a resumed import; conflicting rows, extra target rows, active leases, or changed counters require reconciliation. No conflict is automatically overwritten and priorities are never blindly added together.
6. Deploy the webapp, verify accepted impressions increment demand, and run explicit movie/show smoke crawls. Confirm Crate/Qdrant publication and queue acknowledgment, then resume the normal priority schedule.
7. Observe retry/failure rates, outstanding demand, lease age, publication freshness, and remaining Postgres connections. Keep scheduled syncs enabled.

Run the transfer commands from the repository root. `--windmill-workspace goodwatch` uses the existing local CLI profile to read application database variables; it does not expose credential values in command arguments. Alternatively provide a protected `--env-file` containing the correct `POSTGRES_*` and `CRATE_*` variables.

```bash
uv run --no-project --with crate --with psycopg2-binary --with python-dotenv --with requests \
  goodwatch-flows/scripts/migrate_priority_queue.py export /secure-backup/priority.jsonl \
  --windmill-workspace goodwatch --writers-paused

uv run --no-project --with crate --with psycopg2-binary --with python-dotenv --with requests \
  goodwatch-flows/scripts/migrate_priority_queue.py inspect /secure-backup/priority.jsonl

uv run --no-project --with crate --with psycopg2-binary --with python-dotenv --with requests \
  goodwatch-flows/scripts/migrate_priority_queue.py import /secure-backup/priority.jsonl \
  --windmill-workspace goodwatch --writers-paused

uv run --no-project --with crate --with psycopg2-binary --with python-dotenv --with requests \
  goodwatch-flows/scripts/migrate_priority_queue.py verify /secure-backup/priority.jsonl \
  --windmill-workspace goodwatch --writers-paused
```

The JSONL snapshot is for queue transfer and rollback evidence. It does not replace a full, tested Postgres backup. Keep its reported checksum and per-type totals with the cutover record. `--writers-paused` is an operator assertion, not a command that pauses Windmill.

During the 2026-09-09 export, source validation found duplicate movie ID `284054` despite the declared unique index. Both rows had priority zero, identical creation timestamps, and different update/reset timestamps. After read-only inspection, the export was retried with `--reconcile-zero-duplicates`: it preserves the earliest creation and latest update/reset timestamps and writes the original duplicate records to a protected `.reconciliation.json` sidecar. This policy never merges nonzero demand or changes Postgres. Keep the sidecar with the snapshot. The standalone `uv run` commands use `--no-project` to bypass the existing invalid empty project name in `goodwatch-flows/pyproject.toml`.

## Rollback and final removal

The [live infrastructure inventory and reversible stop procedure](postgres-decommission-inventory.md) identifies native Patroni/Postgres services, HAProxy/PgBouncer, pgAdmin and its volume, the exact backup cron entry, and the private CrateDB listeners to preserve. **etcd is shared with APISIX and must stay running.** No production service stop has occurred; the observation window starts only after actual disconnection and must cover at least 24 hours plus completion of daily jobs.

Before accepting new demand, rollback can restore the saved deployed versions and old schedule while preserving the untouched Postgres queues. After accepting new CrateDB demand, pause the new system first and reconcile outstanding demand plus success timestamps before returning to the old queue; restoring the original snapshot alone would lose new activity. Do not run old and new consumers concurrently.

Repository archival does not archive deployed Windmill entries: the deployment uses `--keep-deleted`. Remote retirement completed at 2026-09-09 16:08 UTC after the full replacement flow passed: 65 scripts and 13 flows were archived with history retained, and 15 backed-up schedules were removed while disabled. All 93 definitions matched their backups immediately before action; none was reachable from enabled schedules or queued/running work. Verification confirmed all 93 postconditions and unchanged definitions for all 22 enabled schedules. Evidence and rollback definitions remain in the protected cutover directory; see the [live audit](postgres-live-dependencies.md).

Application `POSTGRES_*` variables/resources and deployment credentials, including ignored local resource files, remain to be removed separately. Keep `CRATE_*`, CrateDB's wire protocol, and Windmill's internal `DATABASE_URL`/Postgres service.

Take a final restorable database backup; disable application access to the old Postgres service. Observe through the longest relevant schedule interval and investigate any remaining clients or failed jobs. Only then retire its service/proxy, pgAdmin if unused elsewhere, Postgres backup/cron/monitoring jobs, and eventually its volumes. Leave CrateDB backups and Windmill's database untouched.

## Validation

The original 56 Python tests passed, including five real-database integration checks with the regenerated deployment dependencies. After source-reconciliation and metadata-publication regressions were added, all 54 non-integration tests passed (59 discovered, five optional integration checks skipped in that run). After adding the targeted-index regression, all ten publisher tests passed. Coverage includes bulk write failures, targeted publishing, queue ownership/demand, snapshot import conflicts, and normalization of real metadata primary keys. Optional integration tests use disposable tables in a dedicated local CrateDB matching deployed `5.10.9`:

```bash
TEST_CRATE_URL=http://127.0.0.1:4200 python -m unittest discover -s goodwatch-flows/tests -v
```

Use a local test instance only: integration tests create/drop test tables. The webapp production build passed, including the public-origin correction. Typecheck reports the same 292 pre-existing diagnostics as the unchanged baseline and adds none. A real local browser visit generated a successful 12-poster impression request; direct duplicate submissions were verified against live CrateDB counters. Browser scrolling/deduplication was not verified because Orca's scroll did not move the page. The final complete movie/show flow passed publication and acknowledgment; deployed frontend verification remains a cutover check.

Reference behavior: [CrateDB concurrency](https://cratedb.com/docs/crate/reference/en/latest/general/occ.html), [bulk per-row results](https://cratedb.com/docs/python/en/latest/by-example/client.html), [Windmill OpenFlow](https://www.windmill.dev/docs/openflow).
