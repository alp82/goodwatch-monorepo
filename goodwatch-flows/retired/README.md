# Retired application Postgres pipelines

Archived on 2026-09-09 during the GoodWatch application Postgres migration. This directory preserves the original paths relative to `goodwatch-flows/windmill/`, including script schemas, SQL, lockfiles, folder metadata, and flow definitions. Embedding generators, schemas, clustering and recommendation experiments were subsequently removed on 2026-09-14; their history remains in Git.

This is historical source, outside the Windmill sync directory. Do not run Windmill sync from here or restore these files to `windmill/` as part of normal deployment. Internal imports and resource references deliberately retain their original paths for historical review; this archive is not a standalone executable package.

| Archived paths | Classification and replacement |
| --- | --- |
| `f/combine_data/` | Retired Postgres catalog publishing and schema setup. Standalone schedules were confirmed disabled in the deployed schedule inventory. The three remaining calls from priority crawling are replaced by `f/priority/publish`, which uses current CrateDB sync transformations. |
| `f/genome/` | Retired DNA generation. Current `f/dna/` and `f/sync/copy/dna_data` remain in Windmill. Embedding-related experiments and their calling flow have been removed. |
| `f/user/` | Postgres user table/index setup. Current user data lives in CrateDB. |
| `f/priority/create_priority_queue_movie`, `create_priority_queue_tv` | Old Postgres queue DDL. Replaced by the unified CrateDB `crawl_priority` schema. |
| `f/db/postgres` | Old application Postgres connector. |
| `f/sync/copy/postgres_user_data` | Historical user-data migration utility, retained for reconciliation/reference only. |

Each script name above includes all its previously tracked companion files. The full `combine_data`, `genome`, and `user` trees were archived together. Incoming Python imports and flow script references were checked against the removed script/flow paths; no current source callers remain. Current CrateDB and fingerprint-only Qdrant publication remain in Windmill.

## Historical data migration

The archived `postgres_user_data` script is for manual historical investigation only. Do not rerun it against current user records without reconciling timestamps and conflict behavior: old Postgres rows could overwrite newer CrateDB data. Verify retained user data and any other Postgres-only records before removing database storage. Use the current migration runbook for queue transfer and deployment sequencing.

## Deployed retirement is a separate step

Moving repository files does not remove deployed Windmill scripts, flows, or schedules. The normal deployment uses `--keep-deleted`, so old deployed entries remain until explicitly archived/removed after the replacement priority flow has been deployed and validated. Disable or retire old entry points and confirm there are no live consumers before removing application Postgres resources and variables.

Ignored local `u/Alp/resource/postgresql.resource.yaml` and `postgresql.variable.yaml` files are intentionally left in their original location; no credentials are copied into this archive. Resource/variable synchronization is skipped by the current configuration. Remove those local/deployed resources after cutover, along with application Postgres credentials and obsolete operational jobs.

Windmill's bundled Postgres is outside this migration. Identify the old application Postgres services and volumes precisely: CrateDB shares the cluster hosts and supports a PostgreSQL-compatible wire port. Keep CrateDB and Windmill's internal database.
