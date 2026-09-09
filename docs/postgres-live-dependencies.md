# Live Windmill application Postgres dependency audit

Initial read-only audit at 2026-09-09T13:19:26.099619+00:00 inspected all 172 current script paths and 40 current flow paths in the `goodwatch` workspace. After migration validation, remote retirement completed at 16:08 UTC: 65 scripts and 13 flows were archived, preserving their history, and 15 already-disabled schedules were removed. The post-retirement audit at 16:08:40 UTC found 107 current script paths and 27 current flow paths, with no remaining retirement candidates or identified application Postgres dependencies in the enabled schedules.

## Current consumers

All 22 enabled schedules are free of identified application Postgres dependencies through their deployed flow steps and recursively imported scripts. The separately inspected, temporarily paused `f/priority/crawl_all` reaches 62 distinct flow/script entries and has no identified application Postgres dependency.

The cache-warming schedule is confirmed to target `f/utils/visit_goodwatch_and_populate_cache`. Current `f/dna`, `f/sync`, source crawlers, CrateDB and Qdrant remain current. Windmill’s bundled Postgres is outside this audit.

| Enabled schedule | Deployed target | Entries in dependency closure |
| --- | --- | --- |
| `f/sync/copy/vector_data` | `f/sync/copy/vector_data` | 7 |
| `f/sync/copy/tvtropes` | `f/sync/copy/tvtropes` | 6 |
| `f/sync/copy/all_ratings` | `f/sync/copy/all_ratings` | 6 |
| `f/sync/copy/dna_data` | `f/sync/copy/dna_data` | 6 |
| `f/sync/copy/tmdb_streaming` | `f/sync/copy/tmdb_streaming` | 6 |
| `f/sync/copy/tmdb_details` | `f/sync/copy/tmdb_details` | 6 |
| `f/sync/copy/tmdb_daily` | `f/sync/copy/tmdb_daily` | 5 |
| `f/sync/populate_crate` | `f/sync/populate_crate` | 14 |
| `f/dna/initialize_dna` | `f/dna/initialize_dna` | 5 |
| `f/tmdb_web/tmdb_init_providers` | `f/tmdb_web/tmdb_init_providers` | 3 |
| `f/tmdb_web/tmdb_crawl_providers` | `f/tmdb_web/tmdb_crawl_providers` | 8 |
| `f/tvtropes_web/tvtropes_crawl_tags` | `f/tvtropes_web/tvtropes_crawl_tags` | 9 |
| `f/metacritic_web/metacritic_crawl_ratings` | `f/metacritic_web/metacritic_crawl_ratings` | 8 |
| `f/imdb_web/imdb_crawl_ratings` | `f/imdb_web/imdb_crawl_ratings` | 8 |
| `f/utils/visit_goodwatch_schedule` | `f/utils/visit_goodwatch_and_populate_cache` | 1 |
| `f/tvtropes_web/tvtropes_init_ratings` | `f/tvtropes_web/tvtropes_init_ratings` | 6 |
| `f/rotten_web/rotten_tomatoes_init_ratings` | `f/rotten_web/rotten_tomatoes_init_ratings` | 6 |
| `f/metacritic_web/metacritic_init_ratings` | `f/metacritic_web/metacritic_init_ratings` | 6 |
| `f/imdb_web/imdb_init_ratings` | `f/imdb_web/imdb_init_ratings` | 5 |
| `f/tmdb_daily/tmdb_extract_daily_dump_data` | `f/tmdb_daily/tmdb_extract_daily_dump_data` | 7 |
| `f/tmdb_api/tmdb_init_details` | `f/tmdb_api/tmdb_init_details` | 4 |
| `f/tmdb_daily/tmdb_check_daily_dump_availability` | `f/tmdb_daily/tmdb_check_daily_dump_availability` | 6 |

## Additional deployed legacy flow found

`f/recommendations/recommend_movies` contained deployed inline code importing the application Postgres connector and driver. Its local `flow.yaml` referenced absent `!inline` Python/lock companion files, so the original local code audit missed its implementation. It had no schedule and was not reached by an enabled schedule. The deployed definition is saved in the protected cutover backup as `recommend_movies-flow.json`; the incomplete local flow was moved into `goodwatch-flows/retired/` and removed from `wmill-lock.yaml`. The deployed flow was archived with the retirement inventory below. It calls `f/recommendations/movie_batch_embeddings`; that helper has no identified Postgres dependency and was retained.

## Exact deployed retirement inventory

The 65 scripts and 13 flows below were archived remotely at 16:08 UTC and match the repository’s historical archive, including the additional recommendation flow identified in this audit. Their version history remains available. The 15 listed schedules were backed up and removed while still disabled.

### Scripts (65)

```text
f/combine_data/copy_cast/create_cast_table
f/combine_data/copy_cast/main
f/combine_data/copy_collections/create_collections_table
f/combine_data/copy_collections/main
f/combine_data/copy_crew/create_crew_table
f/combine_data/copy_crew/main
f/combine_data/copy_movies/create_movies_table
f/combine_data/copy_movies/main
f/combine_data/copy_movies/update
f/combine_data/copy_networks/create_networks_table
f/combine_data/copy_networks/main
f/combine_data/copy_production_companies/create_production_companies_table
f/combine_data/copy_production_companies/main
f/combine_data/copy_streaming_countries/main
f/combine_data/copy_streaming_provider_links/create_streaming_provider_links_table
f/combine_data/copy_streaming_provider_links/main
f/combine_data/copy_streaming_provider_links/update
f/combine_data/copy_streaming_provider_ranking/create_streaming_provider_ranking_table
f/combine_data/copy_streaming_provider_ranking/main
f/combine_data/copy_streaming_providers/create_streaming_providers_table
f/combine_data/copy_streaming_providers/main
f/combine_data/copy_streaming_providers/populate_from_tmdb_api
f/combine_data/copy_streaming_providers/postgresql/create_streaming_provider_tables
f/combine_data/copy_streaming_providers/postgresql/execute_query_and_return_results
f/combine_data/copy_tv/create_tv_table
f/combine_data/copy_tv/main
f/combine_data/copy_tv/update
f/db/postgres
f/genome/cluster/detect_clusters
f/genome/cluster/detect_clusters_old
f/genome/cluster/detect_clusters_v2
f/genome/dna/copy_dna_data
f/genome/dna/create_dna_table
f/genome/generate/cleanup
f/genome/generate/fetch
f/genome/generate/fetch_from_chat
f/genome/generate/iterate
f/genome/generate/next
f/genome/groq_test
f/genome/hug_api
f/genome/hugchat
f/genome/init/main
f/genome/init/update
f/genome/models
f/genome/openai
f/genome/refine/vectorize_dna
f/priority/create_priority_queue_movie
f/priority/create_priority_queue_tv
f/recommendations/100_movies
f/recommendations/chroma_movies
f/recommendations/user_recommendations
f/recommendations/weaviate_movies
f/sync/copy/postgres_user_data
f/user/create_user_indexes
f/user/favorites/create_favorites_table
f/user/scores/create_user_scores_table
f/user/settings/create_settings_table
f/user/skipped/create_skipped_table
f/user/watch_history/create_watch_history_table
f/user/wishlist/create_wishlist_table
f/vector/create_vectors_media_table_and_indexes
f/vector/create_vectors_query_table_and_indexes
f/vector/save
f/vector/save_weaviate
f/vector/test_weaviate_vectors
```

### Flows (13)

```text
f/combine_data/copy_cast
f/combine_data/copy_collections
f/combine_data/copy_crew
f/combine_data/copy_movies
f/combine_data/copy_networks
f/combine_data/copy_production_companies
f/combine_data/copy_streaming_provider_links
f/combine_data/copy_streaming_providers
f/combine_data/copy_tv
f/genome/crawl_all_by_id
f/genome/genome_init
f/genome/hugchat_generate_genome
f/recommendations/recommend_movies
```

### Disabled schedules (15)

Schedule paths can differ from their target paths. All listed schedules were disabled during the initial audit and immediately before their removal.

| Schedule path | Target |
| --- | --- |
| `f/genome/refine/vectorize_dna` | `f/genome/refine/vectorize_dna` |
| `f/genome/dna/copy_dna_data` | `f/genome/dna/copy_dna_data` |
| `f/genome/hugchat_generate_genome` | `f/genome/hugchat_generate_genome` |
| `f/genome/genome_init` | `f/genome/genome_init` |
| `f/combine_data/f/combine_data/copy_streaming_providers/populate_from_tmdb_api` | `f/combine_data/copy_streaming_providers/populate_from_tmdb_api` |
| `f/combine_data/copy_streaming_countries/schedule` | `f/combine_data/copy_streaming_countries/main` |
| `f/combine_data/copy_streaming_provider_links` | `f/combine_data/copy_streaming_provider_links` |
| `f/combine_data/copy_streaming_providers` | `f/combine_data/copy_streaming_providers` |
| `f/combine_data/copy_networks` | `f/combine_data/copy_networks` |
| `f/combine_data/copy_production_companies` | `f/combine_data/copy_production_companies` |
| `f/combine_data/copy_crew` | `f/combine_data/copy_crew` |
| `f/combine_data/copy_cast` | `f/combine_data/copy_cast` |
| `f/combine_data/copy_collections` | `f/combine_data/copy_collections` |
| `f/combine_data/copy_tv` | `f/combine_data/copy_tv` |
| `f/combine_data/copy_movies` | `f/combine_data/copy_movies` |

## Scope and limits

The traversal covers flow/script references, inline source, Python imports under `f` and `u`, and literal Windmill script/flow invocations. Source was scanned for the application connector, application Postgres variable/resource names, and common Postgres drivers. No dynamic Windmill invocation was detected by the literal-call scan. This is static inspection of deployed source, not proof against unlisted external/manual callers or database-side jobs. Flow branches are conservatively included even when conditional.

One historical `f/combine_data/copy_streaming_providers` step pins SQL script hash `d778dcddf8cd0d96`; that whole flow is disabled and marked for retirement. Two missing imported scripts under the unscheduled old `f/sync/init/milvus` entry (`f/db/milvus`, `f/sync/models/milvus_schemas`) do not affect any enabled schedule or the migrated priority flow.

Application Postgres resources/variables are removed separately after callers and retained data are verified. Preserve CrateDB’s PostgreSQL wire endpoint and Windmill’s internal database.

## Prepared rollback export and recent job history

At 2026-09-09 13:33 UTC, all 65 deployed scripts, 13 flows and 15 disabled schedules were exported to the protected cutover directory `retired-definitions-20260909T133312Z`. All 93 JSON definitions have mode `0600`; their directory has mode `0700`. Every file was verified against its SHA-256 entry in `manifest.json`. The manifest SHA-256 is `65bc1194fecb7c7ec0f37ce71be725970b267a408b2c279c29c3a8baa46c3ceb`. Full definitions remain outside the repository because they can contain sensitive source or arguments.

Job history was queried for the preceding 30 days, starting 2026-08-10 13:33 UTC and ending at the query on 2026-09-09 13:33 UTC. For each retired script/flow path, the audit fetched up to five latest completed jobs and up to twenty unscheduled top-level jobs; none of the latter queries reached the limit. No unscheduled top-level application execution was found. The 63 returned unscheduled top-level jobs were dependency-resolution jobs, not executions of the retired pipelines.

The recent application executions found were the three former priority publishing scripts (`copy_movies/update`, `copy_tv/update`, and `copy_streaming_provider_links/update`), all attributed to the old `f/priority/crawl_all` schedule. Their latest sampled starts were 2026-09-09 12:36:42 UTC. No retired path was queued or running when the full queue was enumerated at 13:33 UTC.

These observations do not establish a full 30-day retention guarantee: Windmill may already have removed older jobs. The five-job samples are not exhaustive execution histories, and external callers that did not run during the retained interval remain possible. Recheck the live queue and schedule states immediately before archival. No deployed definitions or schedules were changed by this preparation.

## Completed remote retirement

Immediately before archival at 16:08 UTC, all 93 live definitions exactly matched their checksum-verified rollback exports. A fresh traversal confirmed that none of the 78 script/flow targets was reachable from the 22 enabled schedules or the replacement priority flow. The complete queued/running job inventory contained no retired execution or job whose inspected dependency closure reached a retired target.

The retirement used Windmill's script/flow archive endpoints, preserving content and version history. Each of the 15 schedules was compared against its backup again and confirmed disabled immediately before deletion. Post-action verification confirmed all 65 script versions and 13 flows were archived, all 15 removed schedules returned 404, and all 22 enabled schedule definitions were unchanged. A subsequent dependency audit found no remaining current retirement candidates and no application Postgres dependencies in enabled schedules or the replacement priority flow.

Protected evidence: `retirement-preflight.json`, `retirement-action-journal.jsonl`, and `retirement-verification.json` in the existing cutover directory. The journal records intent and API result for every action. Restore disabled schedules from their saved definitions and restore/redeploy archived script/flow definitions if rollback is needed. Application Postgres credentials/resources, database services, and Windmill's internal database were not changed by this retirement.
