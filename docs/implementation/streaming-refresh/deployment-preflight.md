# Streaming refresh deployment preflight

Prepared on 2026-10-26 from `feat/streaming-refresh`, compared with base `a9f4cf06cd51aa73cf5e6bec6ad8eab7389751f2`. This manifest includes the monitoring finalization in the reviewed working tree. It records prerequisites and future operator actions; no deployment, activation, source HTTP request, application job or production database write was performed for this preflight. The approved [plan](plan.md) and staged [rollout](rollout.md) remain the release contract.

## Exact Windmill resource manifest

Deploy each script with its corresponding `.script.yaml` and `.script.lock`; retain unchanged dependency locks where the dependency set did not change. The resource paths below omit the local `goodwatch-flows/windmill/` prefix and `.py` suffix. Import-only modules belong in the manifest because Windmill imports them by resource path.

| Script resource | Change |
| --- | --- |
| `f/monitoring/backlog_collection` | Updated |
| `f/monitoring/backlog_health` | Updated |
| `f/monitoring/check` | Updated |
| `f/monitoring/collection` | Updated |
| `f/monitoring/incidents` | Updated |
| `f/monitoring/notifications` | Updated |
| `f/sync/availability_evidence` | Updated |
| `f/sync/copy/tmdb_streaming` | Updated |
| `f/sync/models/crate_schemas` | Updated |
| `f/tmdb_api/daily_list_ramp` | Updated |
| `f/tmdb_api/daily_provider_lists` | Updated |
| `f/tmdb_api/list_offer_refresh` | Updated |
| `f/tmdb_api/models` | Updated |
| `f/tmdb_api/provider_detector` | New |
| `f/tmdb_api/provider_evidence` | Updated |
| `f/tmdb_api/provider_observations` | New |
| `f/tmdb_api/tmdb_fetch_details_from_api/fetch` | Updated |
| `f/tmdb_web/availability_selector` | New |
| `f/tmdb_web/country_state` | Updated |
| `f/tmdb_web/models` | Updated |
| `f/tmdb_web/page_admission` | New |
| `f/tmdb_web/provider_identity` | Updated |
| `f/tmdb_web/tmdb_crawl_providers/batch` | New |
| `f/tmdb_web/tmdb_crawl_providers/fetch` | Updated |
| `f/tmdb_web/tmdb_crawl_providers/iterate` | Updated |
| `f/tmdb_web/tmdb_crawl_providers/next` | Updated |
| `f/tmdb_web/tmdb_crawl_providers/unsupported_canary` | New |
| `f/tmdb_web/tmdb_init_providers/main` | Updated |

Two existing flows change: `f/tmdb_web/crawl_all_by_id` and `f/tmdb_web/tmdb_crawl_providers`. Their local files are `<resource>.flow/flow.yaml`. Include the matching `wmill-lock.yaml` hashes; it is a local dependency/metadata manifest, not an instruction to deploy every workspace resource.

The only new schedule is `f/tmdb_api/provider_detector` (`provider_detector.schedule.yaml`): **disabled**, UTC cron `0 0 0-11 * * *`, script target `f/tmdb_api/provider_detector`, `is_flow=false`, arguments `{"mode":"shadow"}`, overlap prevention enabled. No new automatic Niger schedule exists. Its canary remains an explicitly requested, at-most-once-per-UTC-month entrypoint.

Existing resources referenced but unchanged include `f/tmdb_web/tmdb_crawl_providers/backfill`, `f/tmdb_api/daily_list_storage`, the daily service-list flow, `f/priority/crawl_all` and the standard streaming/vector publishers. Verify those references exist; do not silently replace their current schedules or settings.

## Read-only remote schedule snapshot

The configured GoodWatch remote returned 55 schedules through a read-only `schedule list --json` request on 2026-10-26, approximately 02:50 UTC. Only paths, timing, enabled state and reviewed operational arguments were retained here; no credentials or secret values were printed. Re-read immediately before any actual cutover.

| Remote resource | Observed state and timing |
| --- | --- |
| `f/tmdb_web/tmdb_crawl_providers` | Enabled, `18/20 * * * * *`, Europe/Berlin; arguments `{}` |
| `f/priority/crawl_all` | Enabled, `*/20 * * * * *`, Europe/Berlin; arguments `{}` |
| `f/tmdb_api/tmdb_fetch_details_from_api` | Enabled, `10/15 * * * * *`, Europe/Berlin; arguments `{}` |
| `f/tmdb_api/tmdb_fetch_details_from_api/awaited` | Enabled, `0 0 * * * *`, Europe/Berlin; arguments `{}` |
| `f/tmdb_web/tmdb_init_providers` | Enabled, `0 0 0 * * * *`, Europe/Berlin; arguments `{}` |
| `f/tmdb_api/read_daily_provider_lists` | Enabled, `0 0 14 * * *`, UTC; arguments `{}` |
| `f/monitoring/check` | Enabled, `0 */5 * * * *`, Europe/Berlin; arguments `{}` |
| `f/tmdb_api/provider_detector` | Not present in the returned schedule inventory |

The schedule snapshot does not establish deployed script versions, an empty job queue, a prepared schema, correct indexes or initialized gate state. Those readbacks remain pending. In particular, the current legacy page and priority schedules are active; omitted new arguments do **not** make them previews.

## Required migration, indexes and state

1. Apply the reviewed additive Crate migration **before** deploying the opened-demand producer or invoking a new selector/detector preview. `goodwatch-flows/scripts/migrate_opened_demand.py` previews without connecting by default. Its explicit apply path first reads `information_schema.columns`, accepts an existing `timestamp with time zone` column, otherwise executes `ALTER TABLE crawl_priority ADD COLUMN last_opened_at TIMESTAMP WITH TIME ZONE`. Preserve demand, acknowledgments, claim counters and leases. Do not use unsupported `ADD COLUMN IF NOT EXISTS` or substitute the generic initializer for this migration.
2. For each of `tmdb_movie_providers` and `tmdb_tv_providers`, preview existing backfill with `{"media_type":"movie","batch_size":1000,"dry_run":true}` or `tv`. A reviewed non-preview run calls `ensure_indexes` and normalizes country identity / `has_streaming_links`; continue from returned `after_id` until `done=true`. The dry run does **not** install indexes. Read back these named definitions:

   | Index | Required key pattern |
   | --- | --- |
   | `availability_oldest_links` | `(updated_at, has_streaming_links, _id)` ascending |
   | `availability_pending_changes` | `(provider_change_pending, provider_change_pending_since, tmdb_id)` ascending |
   | `availability_parse_failures` | `(parse_failed_at)` ascending |
   | `country_eligibility` | `(next_fetch_at, lease_expires_at)` ascending |
   | `pending_identity_refresh` | Same keys, partial filter `identity_repair_pending` exists |

   Preserve the full unique `country_identity` index on `(tmdb_id,country_code)`. A partial `validated_country_identity` index alone is not evidence that the earlier identity migration is complete. Inspect identity errors and quarantines; resolve them through existing repair procedures instead of resetting evidence or claims. Opened-demand monitoring also relies on the existing `tmdb_id` country index.
3. Before resuming **any** new page transport, deploy the admission helper and read `f/tmdb_web/page_admission` with `{"dry_run":true}`. The reviewed bootstrap is `{"dry_run":false}` followed by the same readback. It inserts missing `tmdb_streaming_upstream/_id=tmdb_watch` state using `$setOnInsert`; it must preserve existing generations, block/probe state, wire clock, permits and counters. The dry-run result proves presence only: an operator still needs a bounded state readback of generation, block/probe expiry, wire clock/revision and permits. No bootstrap was run for this preflight.
4. Deploy new Mongo model declarations with the evidence writers/readers that use them. Existing detail and country records gain fields in place; there is no new generic queue. Verify actual API check timestamps survive BSON `Int64` round trips, proof hashes match retained payloads, and a valid live observation projects `provider_title_observed_at`. Omitted countries remain unknown. The independent `provider_change_pending_since` epoch-millisecond timestamp must survive newer coalesced revisions and clear only with the successfully handled revision.
5. Install the monitoring indexes before relying on new availability reports. The existing five-minute checker now reads bounded expired-open, pending-change and unresolved-parse evidence and uses existing incident handling. Leases/backoff/global refusal do not acknowledge pending priority work. Partial collection stays unknown/lower-bound; it cannot establish recovery. Sustained parse alerting requires at least three distinct unresolved country failures and ten minutes of observed persistence. The durable `parse_failed_at` marker survives later HTTP/transport failures and clears only after a verified successful parse; the latest failure classification alone cannot establish recovery. The existing two-hour upstream-block alert is retained. No notification delivery was tested against a real recipient.

The detector also uses existing details documents for sticky registry membership, deferred baselines, isolated shadow proof and revision-fenced publication intents; its shared lease/day budget is on `tmdb_streaming_upstream/_id=tmdb_api_detector`. It does not need a separate queue or an initial production run to create infrastructure.

## Safe argument readbacks and staged behavior

| Resource | Arguments to review | Effect |
| --- | --- | --- |
| `f/tmdb_api/provider_detector` | `{"mode":"preview","max_titles":100,"max_requests":100000,"max_seconds":3600}` | Selection reads only; requires the Crate column even in preview. Window/list-run gates can defer it. |
| Same detector | Schedule remains disabled with `mode=shadow` | Future shadow execution performs bounded API HTTP and isolated evidence writes; it is not a read-only action. |
| `f/tmdb_web/tmdb_crawl_providers` | `{"availability_selection":true,"shadow_selection":true,"publication_enabled":false}` | Selects a preview cohort without page claims/HTTP/publication. |
| `f/tmdb_web/tmdb_crawl_providers/batch` | `{"entries":[],"shadow_selection":true,"publication_enabled":false}` | Empty bounded preview; direct omitted defaults are also shadow/no publication. |
| `f/tmdb_web/page_admission` | `{"dry_run":true}` | Gate-presence read only. |
| `f/tmdb_web/tmdb_crawl_providers/unsupported_canary` | `{"dry_run":true}` | Selects one possible Niger canary without consuming its monthly attempt. |
| `f/tmdb_web/tmdb_crawl_providers/backfill` | Explicit media type, `dry_run=true`, bounded batch | Reads identities/index-migration candidates; does not create the indexes. |

These are reviewed argument sets, not jobs executed during this preflight. Provider `mode=publish`, admitted page reads with `shadow_selection=false`, bootstrap/backfill non-preview and schedule activation require the staged operator rollout. Keep detector script timeout at 3,900 seconds around its 3,600-second work budget. Preserve random worker placement, six shared page permits, 1.3 total page wire requests/second, and the separate detector 3 requests/second / 100,000 UTC-day ceiling.

## Material cutover ordering and legacy impact

The generic runbook's “deploy resources, then bootstrap” order needs a coordinated pause/drain for the observed active page callers. Otherwise a schedule may execute between partial resource updates, or the new page transport may fail closed before its gate exists. Pause affected legacy page/priority root scheduling, drain already-running callers that retain old unpaced code, deploy the reviewed helper/model/script/flow set, prepare migration/index/gate readbacks, then resume only the intended legacy or reviewed preview stage. Do not allow old unpaced workers and new admitted workers to overlap.

Legacy selection remains the omitted default (`availability_selection=false`), with real page HTTP and publication enabled through the enclosing flow. It now uses the shared limiter/gate, HTTP/2 batches, parser/identity fixes and Niger/verified-empty/deleted skips. Existing metadata and daily-list readers immediately use the shared provider persistence path after their new resources are deployed, independently of the disabled detector schedule. The schema/model rollout and observation ordering therefore matter before detector activation. The daily 14:00 UTC list flow remains enabled on its own allocation and retains its precision/history behavior.

Do not enable unrestricted new page selection while the legacy selector remains an independently active replacement. After the daily detector cohort's three complete UTC shadow days and integrated recovery proof, freeze the first 100 canonical nondeleted registered popularity-at-least-20 titles and their DE/US countries with complete positive provider evidence; use explicit bounded IDs for the at-most-200-pair canary. The unrestricted selector has no built-in canary cohort argument. Observe the two separate 24-hour expansion stages in the rollout document. Historical identity repair remains a separately backed-up operation and is not a deployment prerequisite.

Monitoring finalization validation: the focused offline monitor suite ran 79 tests with five existing optional skips, including eight collector scenarios on an isolated real Mongo database at the approved localhost test endpoint. It covers expired opens through leases/backoff, first-pending change age, BSON Int64 timestamps, bounded keyset paging, row/time caps, partial observations without false recovery, batch source accounting, distinct sustained parse failures and fixed notification copy. Notification formatting/delivery boundaries were tested locally; no real notification was sent. Production schedule/schema/index/gate readbacks and the rollout observations above remain operator prerequisites.

## Registry index follow-up from live cutover

The first read-only preview exposed collection scans in the sticky registry and page-404 confirmation lookup. Explicit `provider_detector.ensure_registry_indexes(db)` preparation adds partial indexes on details `(provider_detector_registered, tmdb_id, popularity)` where registered is true and countries `(api_confirmation_pending, tmdb_id)` where confirmation is true. Registry reads exclude `_id` so those lookups are covered. The detector itself never builds indexes. Selection projects only provider evidence and scheduling fields, and registry/due bookkeeping is batched; metadata credits/images/recommendations are not transferred. These changes preserve selection and polling bounds.
