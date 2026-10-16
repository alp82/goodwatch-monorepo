# Availability history (#681)

Implementation of [#681](https://github.com/alp82/goodwatch-monorepo/issues/681).
The reader change in [#637](https://github.com/alp82/goodwatch-monorepo/issues/637)
is deliberately separate. Research: `docs/research/availability-history.md` on
`origin/research/offer-arrival-everywhere`.

## Contract

`availability_history` has one row per stay of a title/media type/country/service/
offer type (`flatrate`, `free`, `ads`). The writer opens it before inserting the
offer and closes it before deleting the offer, under the existing publication
leases. Returns open another row. Both the targeted and scheduled batch paths use
this helper. A title-specific history failure skips that title's offer/evidence/media
writes, records the error on its pending marker, and marks the run `partial_success`.
Other titles continue and the watermark advances; pending titles are always selected
again. Shared infrastructure failures (history reads, leases, marker storage) still
raise. Retrying a committed history write finishes the offer write without duplicating
or reopening the stay. A durable `streaming_history_pending` Mongo marker also
reconciles interrupted titles when the source changes before the retry. Provider failures, quarantine, and retained offers keep the
existing publication behavior.

The schema lives in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`.
[ddl.sql](ddl.sql) is its generated CREATE statement. It routes by `media_tmdb_id`
and uses 12 shards. Day columns are UTC-midnight timestamps (Crate's date
representation). `observed_at` normally records the source-read timestamp. Missing read times fall
back to copy time with unknown precision. A return with a colliding/older timestamp
uses the preceding stay's `observed_at + 1 ms`, also unknown. Closing compares UTC
days, clamps to the stay's observation day, and uses unknown precision if clamped.
It replaces `appeared_on` in the proposed six-column primary key so two stays can
start on the same day without colliding.

`appeared_precision` and `dropped_precision` are `exact` or `unknown`; the latter
is NULL while a stay is open. These explicit columns are the contract for #637:
filter `appeared_precision = 'exact'` and the requested appearance-day window.
A premiere is exact even without an earlier absence check. Backfill appearances
are always unknown. Do not infer precision just from timestamp arithmetic.

For a licensed arrival, the current payload must have a valid, fresh provider
proof showing the offer, and the previous UTC day's fresh proof must show its
absence. A drop must likewise have yesterday's presence and today's absence.
The current observation's day must match the API read day. Multiple reads today
retain yesterday's proof. A two-minute gap over UTC midnight qualifies; a gap of
two calendar days, a cached read, legacy payloads without proof, a failed request,
or an unrelated source timestamp does not. There is no minus-one correction.
`test_consecutive_fresh_title_reads_make_arrival_and_drop_exact` proves the
positive rule through the publisher; the gap/cached/presence and scrape-day tests
prove the negative cases.
`test_recent_release_flow_reads_establish_exact_days_but_cached_reads_do_not`
uses the real daily flow configuration and fetch/persist/publish path for movies
and shows; it also verifies cached queue reads between daily rechecks cannot
erase the earlier uncached proof.

The details fetch uses #679's existing `bypass_cache` option and unique `cb`
query parameter for both media types. The daily recent-release flow passes this
option. The member-awaited list feeds the ordinary details queue, which carries
`bypass_cache_ids` for its reserved awaited entries through `next` to `fetch`.
Only those entries bypass the cache in a mixed batch; ordinary crawl entries stay
cached. Both requests and saved proofs use the same flag. History uses its `cache_bypassed` proof
marker and stores `offers` only for bypassed reads and only for `flatrate`/`free`/`ads`.
It retains compact `previous_day` proof in the existing Mongo
`watch_providers_check` dictionary. The writer also creates the small
`streaming_history_pending` Mongo collection automatically on the first transition.
It uses the built-in `_id` index, one pending lookup per full scheduled run,
a lease-protected recheck for transitioning titles (or a targeted copy), and one bulk marker insert
before transitions and one bulk removal after success. It needs no manual index,
flow, or schedule. Only interrupted publications leave documents there. The full scheduled copy
also selects pending titles outside its normal watermark, so a failed targeted
publication cannot become stranded.
This also records an empty title read, which is necessary to recognize its first
arrival the next day. Another caller of `capture_provider_check` must explicitly
supply `bypass_cache=True` only after bypassing the API cache and pass the prior
proof. Cached reads preserve bounded `last_uncached` evidence so an ordinary
queue read between daily rechecks cannot erase yesterday's fresh observation.
The current cached read itself remains ineligible for exact days.

Originals use `first_air_date` for a matching TV network. Movies use their own
country's earliest type-4 digital release, falling back to the earliest global
digital release only if that country has none. The premiere must be between the
observation day minus `PREMIERE_WINDOW_DAYS = 7` and the observation day inclusive.
Older premieres (including old originals reaching new countries/tiers) use normal
observation precision. Prime Video includes provider 119. The explicit network/studio/provider
ID mapping comes from the research's `availability-history-measure/events.py`.
It includes service variants, not unrelated channel bundles or broad production
houses. Unknown mappings, missing dates, and future dates fall back to observation
with normal precision. Premiere substitution applies only to the first recorded
stay of that offer; a returning original uses the return observation.

To keep writer cost small, unchanged offers cause **no history SQL**. The helper
reads history only for titles with added/removed eligible offers and batches its
writes. `appeared_after` preserves an earlier confirmed absence when available.
`last_seen_on` is the last positive observation known when the stay is written;
it is updated from the retained proof when closed. It is **not a live freshness
heartbeat for open stays**. The existing streaming evidence remains the freshness
source. This differs from the research's proposed daily update of every open row.
The explicit precision columns retain exact drop classification without those
writes. Existing `streaming_availability.created_at` handling is unchanged.

## Production rollout, after review

Nothing in this build creates a production table, applies a backfill, deploys,
or changes a schedule.

1. Re-review the fix commit. **Do not push to main yet: pushing deploys the writer.**
2. Run `goodwatch-flows/scripts/backfill_availability_history.py` with workspace
   credentials for a SELECT-only dry run. Record all six grouped counts and size.
3. Disable both existing Windmill schedules: `f/sync/copy/tmdb_streaming`
   (02:00, 08:00, 14:00, 20:00 UTC) and `f/priority/crawl_all` (every 20 minutes).
   Wait for all active jobs from both callers to finish, including targeted copies.
   Keep other offer-deletion jobs/manual publishes paused during the baseline too.
4. Create only [ddl.sql](ddl.sql), then compare `information_schema.columns`.
   Do not run the broad schema initializer merely to create this table.
5. Run the reviewed script with `--apply`. It runs **six INSERT SELECT statements**
   (movie/show × flatrate/free/ads), then `REFRESH TABLE availability_history` and
   compares grouped open-stay counts with the source counts it read before applying.
   Compare the report with step 2; investigate changes during the pause gap.
   All baseline appearances are `backfill`/`unknown`, drops and `last_seen_on` are
   NULL. No source row or its `created_at` is modified. Keep schedules paused if
   verification fails.
6. **After the backfill passes, push to main: this is the deploy step.** Confirm
   `push-windmill-workspace.yml` succeeds and the deployed writer, history helper,
   deletion helper, details queue/fetch, and proof modules match main.
7. Re-enable `f/sync/copy/tmdb_streaming` first. Watch a full run, its duration,
   pending markers/errors, and non-backfill row counts. Then re-enable
   `f/priority/crawl_all`. No new flow or schedule is needed for this ticket.
8. After daily recent-release rechecks (13:00 UTC) have run on two days, inspect
   exact title-derived stays. Member-awaited rechecks also provide fresh evidence.

The baseline can be retried before writer activation (deterministic key plus
ON CONFLICT DO NOTHING). It refuses application after writer-created or closed
stays exist, and refuses source rows without `created_at`.

For rollback, pause both schedules and wait for active jobs, revert through the
normal main deployment, then re-enable both. Preserve history. Before re-enabling
the history writer after rollback or repairing a pause gap, pause both callers
again and use `--reconcile` for a **SELECT-only preview**, then
`--reconcile --apply` after reviewing counts. Reconcile closes open stays whose
offer is gone and opens unknown stays for offers without an open stay, in batches
of 2,000 rows per group. It preserves old closed stays, handles same-day returns,
refreshes after writes, and verifies that no drift remains. It never changes offers.
The two stores must remain quiescent during any apply; there is no cross-store
transaction. Reconcile doesn't infer exact dates for the unobserved interval.

Flagged TMDB titles and orphaned titles are closed with unknown drop precision
in `deleted_titles.delete_title_rows` before their offer DELETE. Both the details
copy and orphan sweep use this shared path; TMDB 404 flags are consumed there.
Absent-country removal semantics remain unchanged for #682.

## Verification and measurements

Tests run at the repo's existing fake Mongo/Crate publication seam. Optional SQL
checks require a disposable localhost Crate and reject non-local URLs:

```sh
python -m unittest discover -s goodwatch-flows/tests -p 'test_availability_history*.py'
TEST_CRATE_URL=http://127.0.0.1:16881 python -m unittest discover \
  -s goodwatch-flows/tests -p test_availability_history_integration.py
```

`test_availability_history_preview.py` is opt-in via `TEST_WINDMILL_PREVIEW=1`,
`BASE_INTERNAL_URL`, `WM_WORKSPACE`, and `WM_TOKEN`. It submits an in-memory
Windmill preview of the checkout's code; it does not deploy or connect to a data
store. It was not submitted during this build. SQL validation used local Crate
5.10.16 and the actual CrateConnector, including a metadata-changing offer upsert
to prove `created_at` preservation, same-day return records, exact dates, and
idempotent backfill SQL.

The production backfill dry run executed only two SELECTs on 2026-10-16 UTC:

| Media | Offer type | Open records |
|---|---|---:|
| Movie | Ads | 2,554,663 |
| Movie | Flatrate | 4,515,828 |
| Movie | Free | 1,316,816 |
| Show | Ads | 315,766 |
| Show | Flatrate | 1,634,919 |
| Show | Free | 79,559 |
| Total | | 10,417,551 |

No eligible row lacked `created_at`. Eligible groups cover up to 139 countries
(movie ads: 138). Estimated primary history size: **2,500,212,240 bytes (2.50 GB,
2.33 GiB)** at 240 bytes/record, excluding replicas. This is a planning estimate
for the larger implemented row, not measured production history storage. The
source table's primary shards reported 18,936,178 rows and 6,182,218,227 bytes.
Concurrent source activity can make the grouped and shard counts differ.

The reproducible benchmark is `goodwatch-flows/tools/benchmark_availability_history.py`:

```sh
TEST_CRATE_URL=http://127.0.0.1:16881 TEST_MONGO_URL=mongodb://127.0.0.1:16882 python \
  goodwatch-flows/tools/benchmark_availability_history.py \
  --baseline-ref 56f62ee392260db8916882f5004e9fb12f4b6e21 --rounds 9
```

It runs the full scheduled publisher against real local Crate; `TEST_MONGO_URL`
selects a disposable local MongoDB instead of the default fake Mongo,
with 200 titles and 10,000 offers per batch. It alternates paired before/after
runs to control host-load drift, first unchanged fresh daily reads, then replaces
100 offers (1%) per round. Production writer timing is not measured: that would
require unauthorized production writes. See [evidence.json](evidence.json) for
raw dry-run counts and local timing samples. After rebasing onto #679
(`cf418d9f`), the combined regression run passed 122 tests, including real local
Crate checks and the recent-release selector/report tests. Five opt-in Windmill
preview tests were skipped (127 total); no preview jobs were submitted.

Final paired measurements, including durable retry markers, with real local
MongoDB 8.0 and Crate 5.10.16, including full-catalog selection and watermark
updates (nine rounds per case):

| Batch | Before median | After median | Median paired overhead |
|---|---:|---:|---:|
| Unchanged, fresh read | 649.9 ms | 659.0 ms | -0.37% (noise) |
| Replace 1% of offers | 659.3 ms | 699.0 ms | 7.94% |

Median elapsed increases were 9.1 ms for unchanged batches and 39.7 ms for
1% changes (1.4% and 6.0% of the respective before medians). The separate
paired-overhead column takes the median of each round's after/before ratio,
which differs from the ratio of the two medians under host-load noise.

The initial approach updated all open rows daily and measured roughly 36–41%
extra time; it was replaced with transition-only writes before these final
measurements. Host load makes individual samples noisy; this local benchmark
does not prove production latency. No production writer or Windmill preview
job was run.

## Changed files

All paths below are relative to the repository root.

- `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`: authoritative table schema.
- `goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py`: both writer paths and original-date projection.
- `goodwatch-flows/windmill/f/sync/availability_history.py`: batched stays, precision, original mapping, recovery markers.
- `goodwatch-flows/windmill/f/sync/availability_history.script.yaml`: Windmill library metadata.
- `goodwatch-flows/windmill/f/sync/availability_history.script.lock`: pinned library dependencies.
- `goodwatch-flows/windmill/f/tmdb_api/provider_evidence.py`: bounded prior-day proof.
- `goodwatch-flows/windmill/f/tmdb_api/tmdb_fetch_details_from_api/fetch.py`: reuse #679's cache-bypass option for prior-day proof persistence.
- `goodwatch-flows/scripts/backfill_availability_history.py`: dry-run/default one-off baseline.
- `goodwatch-flows/tests/test_availability_history.py`: publisher behavior and fresh-fetch tests.
- `goodwatch-flows/tests/test_availability_history_backfill.py`: read-only dry-run seam.
- `goodwatch-flows/tests/test_availability_history_integration.py`: real local Crate SQL checks.
- `goodwatch-flows/tests/test_availability_history_preview.py`: opt-in in-memory Windmill preview.
- `goodwatch-flows/tests/test_streaming_publication.py`: extend the existing recording adapter/import seam.
- `goodwatch-flows/tools/benchmark_availability_history.py`: paired full-writer timing harness.
- `docs/implementation/availability-history/README.md`: contract, rollout, verification, and file list.
- `docs/implementation/availability-history/ddl.sql`: generated owner-applied DDL.
- `docs/implementation/availability-history/evidence.json`: production read-only counts and benchmark samples.

The `recent_releases.py` script and its flow were not touched. No PR, push, merge,
production data write, deployment, or schedule change was made.

## Review fixes for efc4d8b4

The review fixes include the seven-day premiere window and local digital date,
unknown-precision fallbacks for skew/missing times/colliding returns, per-title
history failure isolation, deletion-path closes, compact fresh proofs, a six-group
baseline with verified counts, bounded reconcile mode, and member-awaited cache
bypass using main's existing mechanism. History planning now uses named title/key
and observation types, shared UTC-day helpers, and separate planning/write steps.
The rollout above names both schedules and makes the post-backfill main push the
deployment step. No changes were made to `recent_releases.py` or its flow; absent
country semantics remain for #682.

Additional or revised files in this fix commit:

- `goodwatch-flows/windmill/f/sync/copy/deleted_titles.py`: Close stays before offer deletion.
- `goodwatch-flows/windmill/f/sync/init/cratedb.py`: Generate table-level checks.
- `goodwatch-flows/windmill/f/tmdb_api/tmdb_fetch_details_from_api/next.py`: Carry awaited document IDs to the shared fetch bypass.
- `goodwatch-flows/tests/test_availability_history_review.py`: Review regression cases, including timestamp fallback, title isolation and pending-marker timing.
- `goodwatch-flows/tests/test_deleted_titles.py`, `test_orphaned_title_rows.py`: Deletion tests and adapter support for history closes.
- `goodwatch-flows/tests/test_details_queue_awaited.py`, `test_tmdb_fetch_failures.py`, `test_tmdb_recheck_cache.py`: Mixed queue bypass and proof persistence tests.
- `goodwatch-flows/README.md`, `docs/agents/domain.md`: Backfill/report entry point and stay vocabulary.

Red runs reproduced the reviewed bugs before their fixes. The final full-suite
command was:

```sh
PYTHONPATH=goodwatch-flows:goodwatch-flows/tests PYTHONWARNINGS=ignore \
TEST_CRATE_URL=http://127.0.0.1:16881 /tmp/gw681-venv/bin/python \
  -m unittest discover -s goodwatch-flows/tests
```

**1,529 tests: 1,486 passed, 42 skipped, one pre-existing failure.** The remaining
failure is `test_deleted_titles.DeleteFromCrateTests.test_user_tables_are_untouched_and_all_derived_tables_are_covered`:
`social_title_link`, `social_link_report`, and `social_relevance` are in the schema
but absent from `TITLE_KEYED_TABLES`. The same failure was reproduced from an
untouched `origin/main` archive (`cf418d9f`); this fix does not change social-table
deletion policy. Its new history exemption retains stays rather than deleting them.
The skipped tests require opt-in services/previews; no Windmill jobs were submitted.

Real local Crate tests passed for six-group/idempotent backfill, read-only reconcile
preview, repair in both directions, same-day returns, deletion closes, the paired
drop-date/precision constraint, exact-day classification, and preserved offer
`created_at`. The production dry-run numbers above remain the earlier read-only
snapshot; no production writes or further production reads were performed for
these review fixes.

The final review-fix benchmark used the same real local Mongo/Crate setup and nine
paired rounds (200 titles, 10,000 offers). Raw samples are in `evidence.json`:

| Batch | Before median | After median | Median paired overhead |
|---|---:|---:|---:|
| Unchanged fresh read | 658.1 ms | 671.6 ms | 4.27% |
| Replace 1% of offers | 759.3 ms | 812.9 ms | 8.16% |

These remain local measurements, not production timing.
