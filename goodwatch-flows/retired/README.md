# Retired application Postgres pipelines

Archived on 2026-09-09 during the GoodWatch application Postgres migration. This directory preserves the original paths relative to `goodwatch-flows/windmill/`, including script schemas, SQL, lockfiles, folder metadata, and flow definitions. It contains 190 previously tracked files: 65 script entries and 13 flow entries.

This is historical source, outside the Windmill sync directory. Do not run Windmill sync from here or restore these files to `windmill/` as part of normal deployment. Internal imports and resource references deliberately retain their original paths for historical review; this archive is not a standalone executable package.

| Archived paths | Classification and replacement |
| --- | --- |
| `f/combine_data/` | Retired Postgres catalog publishing and schema setup. Standalone schedules were confirmed disabled in the deployed schedule inventory. The three remaining calls from priority crawling are replaced by `f/priority/publish`, which uses current CrateDB sync transformations. |
| `f/genome/` | Retired DNA generation, clustering, and vector experiments. Current `f/dna/` and `f/sync/copy/dna_data` remain in Windmill. The archived genome flow also called the archived `f/vector/save`. |
| `f/vector/save`, `save_weaviate`, `test_weaviate_vectors` | Old vector scripts with direct Postgres imports. Current vector publishing uses `f/sync/copy/vector_data` and Qdrant. |
| `f/vector/create_vectors_media_table_and_indexes`, `create_vectors_query_table_and_indexes` | Postgres vector table/index setup. |
| `f/recommendations/100_movies`, `chroma_movies`, `user_recommendations`, `weaviate_movies` | Recommendation experiments with direct Postgres imports. No current flow references were found. |
| `f/recommendations/recommend_movies` | Deployed inline implementation imports application Postgres. Unscheduled; discovered during the live dependency audit. Its archived local flow is incomplete because the referenced inline companions were already absent; the full deployed definition was saved separately in the protected cutover backup. |
| `f/user/` | Postgres user table/index setup. Current user data lives in CrateDB. |
| `f/priority/create_priority_queue_movie`, `create_priority_queue_tv` | Old Postgres queue DDL. Replaced by the unified CrateDB `crawl_priority` schema. |
| `f/db/postgres` | Old application Postgres connector. |
| `f/sync/copy/postgres_user_data` | Historical user-data migration utility, retained for reconciliation/reference only. |

Each script name above includes all its previously tracked companion files. The full `combine_data`, `genome`, and `user` trees were archived together. Incoming Python imports and flow script references were checked against the removed script/flow paths; no current source callers remain. Existing CrateDB/Qdrant scripts and Postgres-free experiments under `f/vector` and `f/recommendations` are retained. Their presence is not a claim that every experiment is scheduled or production-supported.

## Historical data migration

The archived `postgres_user_data` script is for manual historical investigation only. Do not rerun it against current user records without reconciling timestamps and conflict behavior: old Postgres rows could overwrite newer CrateDB data. Verify retained user data and any other Postgres-only records before removing database storage. Use the current migration runbook for queue transfer and deployment sequencing.

## Deployed retirement is a separate step

Moving repository files does not remove deployed Windmill scripts, flows, or schedules. The normal deployment uses `--keep-deleted`, so old deployed entries remain until explicitly archived/removed after the replacement priority flow has been deployed and validated. Disable or retire old entry points and confirm there are no live consumers before removing application Postgres resources and variables.

Ignored local `u/Alp/resource/postgresql.resource.yaml` and `postgresql.variable.yaml` files are intentionally left in their original location; no credentials are copied into this archive. Resource/variable synchronization is skipped by the current configuration. Remove those local/deployed resources after cutover, along with application Postgres credentials and obsolete operational jobs.

Windmill's bundled Postgres is outside this migration. Identify the old application Postgres services and volumes precisely: CrateDB shares the cluster hosts and supports a PostgreSQL-compatible wire port. Keep CrateDB and Windmill's internal database.
