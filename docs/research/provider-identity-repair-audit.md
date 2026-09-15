# Provider country identity repair audit

Date: September 15, 2026. Scope: MongoDB provider identity repair and recurrence prevention, including source refresh, streaming publication and priority acknowledgment. Postgres deletion is outside this task.

## Confirmed findings

The old bulk importer used `(tmdb_id, tmdb_watch_url)` as its upsert selector (`git show ea7fa37^:goodwatch-flows/windmill/f/tmdb_web/tmdb_init_providers/main.py`, `build_operation`). Changing a title slug therefore inserted another country record. The current stable identity is `(media type, tmdb_id, country_code)`; movie and TV are separate collections. Do not confuse this with provider-name-to-service-ID mapping.

The actual current `identity_map` function reproduces ambiguous identities from five previously captured live title sets. Command:

```bash
goodwatch-flows/.venv/bin/python /home/alp/.local/state/goodwatch/postgres-retirement/final-20260915/duplicate_preflight.py
```

Result: exits 1, `FAIL: captured source records still have ambiguous country identities`. The minimized pattern is two validated watch URLs for the same numeric title/country with different slugs. Five fixtures contain 122 duplicate country groups, 244 implicated documents and 72 groups with different offer snapshots. Those counts are samples, not collection totals.

| Source | TMDB ID | Duplicate countries | Differing offer snapshots |
| --- | ---: | ---: | ---: |
| Movie | 18 | 23 | 15 |
| Movie | 526028 | 29 | 11 |
| TV | 406 | 4 | 4 |
| TV | 42412 | 33 | 20 |
| TV | 69283 | 33 | 22 |

Examples: movie 526028/AR has historical `eva-et-candela` and `como-te-llamas` URLs; movie 28264/GB has `blood-rage` and `nightmare-at-shadow-woods`. TV 69283/AU has a newer empty snapshot and older Crunchyroll offers. Unioning snapshots would resurrect expired offers.

At 08:08 UTC, read-only requests using the actual `crawl_tmdb_watch_page` parser succeeded for slug-free URLs: movie 526028/AR returned 3 offers; TV 69283/AU returned verified no offers. These probes did not persist results and cannot establish future HTTP availability.

## Live deployment and database

All four inspected deployed scripts exactly match local source:

| Path below `f/tmdb_web/` | Deployed hash |
| --- | --- |
| `country_state` | `cb66eea4cd53b8e2` |
| `tmdb_init_providers/main` | `436e26a268f2f38d` |
| `tmdb_init_providers/update` | `42c6285cfb6d6e55` |
| `tmdb_crawl_providers/fetch` | `3b653447f64328ae` |

MongoDB estimated counts: 6,616,574 movie records and 1,510,018 TV records (8,126,592 total). Both collections have `validated_country_identity`, unique on `(tmdb_id, country_code)` with partial filter `country_identity_ready: true`. Neither collection has a validator. Thus old or bypassing writers can still insert unvalidated duplicates. Indexing only validated records is an intermediate migration safeguard, not the final invariant.

### Full inventory still running

The full projected read-only scan uses ascending `_id` pages of 5,000, each bounded by `max_time_ms(30000)`, with private SQLite checkpoints. At handoff it had passed 955,000 movie records, of which 935,511 were ready. Exact total duplicate and invalid-identity counts are **not yet known**. The earlier daily initializer's 169,348 count is a count of reported errors over eligible details, not a full collection inventory.

Private state directory: `/home/alp/.local/state/goodwatch/provider-identity-repair`.

- `audit.py`: rerunnable/resumable scanner. Credentials are loaded in memory through the existing Windmill profile helper; not stored in inventory.
- `inventory.sqlite`: only identity projections, parsed country, validation error, readiness; **not an archive or a consistent snapshot**.
- `summary.json`: written at successful end; `duplicates` tuple means `(groups, implicated_documents, excess_documents, distinct_titles, maximum_group_size)`.
- `metadata.json`: indexes, options, estimates and deployment comparison.
- `probe.py`: read-only live parser probes.
- Existing full five-title source fixtures remain under `../postgres-retirement/final-20260915`.

The root tool process session ID is `6346`. Poll with `write_stdin`; if it exits, rerun `audit.py` to resume. Normal completion prints per-collection summary. The scan takes tens of minutes at observed throughput; SQLite grouping at the end may add time. It can run while implementation proceeds. Since writers remain live, re-read and validate every affected group before mutation and perform a final full invariant check after repair. Old-ID updates during scanning require the final check; a checkpoint alone does not make counts snapshot-consistent.

## Writer and publication seams

- Bulk initialization: `tmdb_init_providers/main.py::initialize_batch`, using shared `identity_map`, `normalization_update`, `insertion_update`.
- Priority initialization: `tmdb_init_providers/update.py` -> `country_state.initialize_countries`.
- Source claims/success/failure and normalization: `country_state.py`; fetch entrypoint in `tmdb_crawl_providers/fetch.py`; scheduled selector and iterator in that folder.
- Both initializers already insert using stable validated identity, with duplicate-key race handling. They skip existing-country URLs rather than updating a changed URL; fix this to safely refresh URL metadata through shared, race-aware helpers.
- All source writes located in active Python code are in those initialization/state seams. Legacy `f/main_db` readers still exist locally; verify deployed runnable writers/flows and reject obsolete writes at the database boundary.
- Publication: `f/sync/copy/tmdb_streaming.py`, shared by scheduled and priority processing, has 15-minute per-title publication leases, while country fetch claims last five minutes.
- Critical trap: `reconcile_availability` currently treats a source record with `updated_at` and no failure/identity error as verified. Merely setting `next_fetch_at` to now on a historical winner would permit stale publication. Pending repair state must be excluded from confirmed availability until fresh success.
- `f/priority/reset.py` acknowledges publication outputs with existing partial-success/retry handling. Verify actual demand/acknowledgment and durable retries, not parent job success alone.

## Concrete next phase: implement reversible repair and tests

1. Add a repository-owned repair command/module with `audit`, `plan`, `apply`, `verify` modes, explicit bounded batches and private output directory. Reuse `country_from_url` for classification. Distinguish safe same-country duplicates from invalid URL, invalid ID, stored-country disagreement and unsupported ID types. Do not auto-assign ambiguous records to a guessed country.
2. Produce deterministic manifests per collection/title/country containing exact source IDs, canonical ID, complete-document hashes, chosen action, required source refresh and batch/checkpoint IDs. Choose a deterministic identity survivor (prefer an existing ready record, otherwise lowest ObjectId), **not a truth winner**. Preserve all originals, including survivor, in lossless BSON/Extended JSON and archive original published `streaming_availability` rows before changes. Verify archive durability/hash/readback before deleting anything. Hash complete documents, including leases and retry state.
3. Re-read the entire title/group immediately before applying; reject changed plan inputs. Use replica-set transactions where supported for archive + canonical replacement + redundant-record removal + manifest completion, with majority write concern. A transaction alone does not serialize publication in Crate. Acquire existing title publication lease and avoid active source leases; coordinate initializers so no new source writer slips through. Prefer a temporary repair gate honored by all affected entrypoints or a brief schedule pause/drain with recorded restore state. Never hold a long DB transaction across HTTP.
4. Canonical source must become explicitly pending fresh verification. Preserve original verified snapshot and retry state in archive; do not pretend historical offers are current or write a new successful `updated_at`. Preserve upstream block/backoff limits. A dedicated repair marker is useful: source claims may fetch it, publication must retain existing published country availability while it remains pending. Successful fenced scrape clears marker; failure leaves durable pending retry. For failed/ambiguous refresh, freeze the affected published country scope, including API reconciliation if necessary, so existing availability is retained exactly.
5. Route fresh work through the existing country claim and parser, with bounded concurrency and shared upstream backoff. Use canonical numeric watch URLs or the latest validated details link. Never combine offer arrays. Record success/no-offers/failure/deferred separately. Structural reconciliation can finish while some country freshness remains pending, but do not report those countries as verified.
6. Normalize remaining valid singleton identities and establish a full unique `(tmdb_id,country_code)` index. Require positive integer TMDB IDs and uppercase two-letter country codes at the database boundary; prevent inserts that omit identity readiness or evade the partial index. Combine required fields/type constraints with the unique index; uniqueness alone permits missing/null identity loopholes. Audit invalid records before deciding quarantine policy; quarantine must preserve originals and be visible to operators. Ensure a future `ensure_indexes` invocation does not undo/misidentify the final index.
7. Add meaningful integration coverage at the real shared writer/repair/publication seams: changed slug, two concurrent inserts, movie/TV numeric ID overlap, conflicting empty/nonempty snapshots, complete archive fidelity, mid-repair restart/idempotency, changed snapshot or active lease rejection, successful empty refresh removing old offers, failed refresh preserving published rows, and database rejection of unvalidated duplicates. Use a real MongoDB test instance for index/transaction/concurrency behavior; mocked MongoDB cannot establish it.
8. Add monitoring for structural identity violations, pending repair countries and retry failures. Existing country backlog checks must not silently omit pending/unvalidated records and report zero backlog.

## Execution and completion plan

Implement and test before mutating production. Next sequential agent should own implementation while the scanner finishes. Then independently review code, execute a small live batch using movie 526028 and TV 69283 plus an ID-overlap case, verify archive/readback/fresh parser/source timestamps, and run representative priority processing through publication and acknowledgment. Verify failed refresh preserves previous published rows. Then apply structural reconciliation in bounded checkpointed batches and process refreshes without a serial per-country HTTP bottleneck.

Fresh work for tens of thousands of groups can take hours even if structural repair is fast; honor upstream limits and persist progress. Report structural duplicates, invalid records, fresh successes, verified empty results, pending/backoff and publication failures separately. The final invariant is one active valid identity per country, all originals recoverable, all writers unable to recreate duplicates, and explicit verified or durable-retry outcomes. Full freshness is a separate measurable completion claim.

No production records, schedules or infrastructure were changed by this audit. No human input blocker identified. Python packages were installed into the existing local `goodwatch-flows/.venv` solely to run read-only parser probes; unrelated working-tree changes were preserved.
