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
this helper. History failures prevent offer writes and watermark advancement;
retries after a committed history write finish the offer write without duplicating
or reopening the stay. A durable `streaming_history_pending` Mongo marker also
reconciles interrupted titles when the source changes before the retry. Provider failures, quarantine, and retained offers keep the
existing publication behavior.

The schema lives in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`.
[ddl.sql](ddl.sql) is its generated CREATE statement. It routes by `media_tmdb_id`
and uses 12 shards. Day columns are UTC-midnight timestamps (Crate's date
representation). `observed_at` is the source-read timestamp, not the copy time.
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
option; ordinary cached fetches do not. History uses its `cache_bypassed` proof
marker and stores a compact `offers`/`previous_day` proof in the existing Mongo
`watch_providers_check` dictionary. The writer also creates the small
`streaming_history_pending` Mongo collection automatically on the first transition.
It uses the built-in `_id` index, one lookup per batch, one bulk marker insert
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

Originals use `first_air_date` for a matching TV network and the earliest type-4
digital release for a matching movie studio. The explicit network/studio/provider
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

1. Pause the streaming copy while applying the baseline, including targeted copy
   calls. The baseline must finish before enabling the history writer.
2. Create only the table in [ddl.sql](ddl.sql). Do not run the broad schema
   initializer merely to create this table.
3. Run `goodwatch-flows/scripts/backfill_availability_history.py` with workspace
   credentials for another read-only dry run. It is dry by default.
4. Run the same reviewed script with `--apply` (or `main(dry_run=False)`). It uses
   one INSERT SELECT, preserves `date(created_at)`, labels every appearance
   `backfill`/`unknown`, leaves drops open, and leaves `last_seen_on` NULL because
   existing offers do not prove a recent read. No source row is modified.
5. Deploy the writer, helper and modified details-fetch/proof modules together,
   then resume the existing copy. No new flow or schedule is required. The helper
   has Windmill metadata but is an imported library, not a scheduled job.

The backfill can be retried before writer activation (deterministic key plus
ON CONFLICT DO NOTHING). It refuses application if history already contains
writer-created or closed stays; do not rerun a baseline after the writer starts.
It also refuses rows without `created_at`. It deliberately does not create the
target table. Source changes during a live baseline are not supported.

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
