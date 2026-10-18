# Independent daily buzz signals

Owner decisions, 2026-10-18: GoodWatch remains free/open source; non-commercial
terms do not block this work; attempt scraping; assume Trakt approval for a
blended public score. Collection does not change the Wikipedia formula. The daily buzz flow can now
use these observations for the labelled [backup ranking](buzz-score.md#backup-ranking-when-wikipedia-is-late).

`f/buzz/signals` and its flow collect at **08:30 UTC daily**, cron
`0 30 8 * * *`, with overlap protection. All source failures are returned and
stored as statuses, so one unavailable vendor cannot suppress another vendor's
history. An HTTP 429 stops further requests to that host for that run; 202/403 fail
only their request scope so independent charts are still attempted.
No headless browser or challenge bypass is used. Current charts use collection
UTC dates, including weekly Letterboxd lists; only TMDB export dates can be
backfilled. Export dates are not claimed to represent the previous UTC day's
activity.

## Storage

The collector creates its own tables; catalog/Wikipedia tables are read-only.
No shared schema registration or schedule changes are needed. The daily flow
reads signal history without initializing or writing these tables. All three tables have one shard, one replica, strict columns.

```sql
CREATE TABLE IF NOT EXISTS doc.buzz_signal (
  source TEXT, day TEXT, title_key TEXT, rank INTEGER,
  value DOUBLE PRECISION, raw TEXT INDEX OFF,
  collected_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (source, day, title_key)
) CLUSTERED INTO 1 SHARDS
WITH (number_of_replicas = 1, column_policy = 'strict');

CREATE TABLE IF NOT EXISTS doc.buzz_signal_mapping (
  source TEXT, source_id TEXT, title_key TEXT, raw TEXT INDEX OFF,
  checked_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (source, source_id)
) CLUSTERED INTO 1 SHARDS
WITH (number_of_replicas = 1, column_policy = 'strict');

CREATE TABLE IF NOT EXISTS doc.buzz_signal_run (
  source TEXT, day TEXT, status TEXT, details TEXT INDEX OFF,
  collected_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (source, day)
) CLUSTERED INTO 1 SHARDS
WITH (number_of_replicas = 1, column_policy = 'strict');
```

Signal keys are `movie:<tmdb_id>` or `tv:<tmdb_id>`. Unknown identities use
`unmapped:<vendor>:<source_id>` (Trakt also includes media kind). Raw source IDs
and ranks are retained for later reconciliation. Unknown values remain NULL;
IMDb/Letterboxd ranks are not invented counts. Retries upsert each title's latest
successful observation; a source run marked `partial` is not a complete chart.
Rows already captured are never deleted because a subsequent request fails.
No retention pruning is applied to these new history tables.

Mapping cache entries persist by vendor/slug, including a successful page fetch
with no match. An HTTP failure is not cached as a permanent no-match. At most
five uncached title pages per vendor are fetched per daily run; remaining titles
are retained unmapped and can be resolved on future runs. Manual correction of
the mapping table is possible; rewriting old signal identities requires a future
reconciliation pass, not a fresh scrape of historical charts.

## Sources and bounds

| Source | Capture | Identity / bounds |
| --- | --- | --- |
| `tmdb_popularity` | Streaming gzip JSONL, movie + TV daily ID exports | Popularity ≥5, highest 20,000 per kind, plus Wikipedia candidate/history winners and top 250 catalog titles per kind regardless of value. Native TMDB IDs. At most 40,000 plus the retained cohort per day. |
| `trakt_trending` | Movies + shows, watcher count | Up to 10 pages ×100 per kind, stop at server page count; native `ids.tmdb`, otherwise Trakt ID. |
| `justwatch_chart` | US movies and shows, first 100 TRENDING titles each; two public GraphQL POSTs/day | Native `externalIds.tmdbId`, MOVIE→movie / SHOW→tv. Streaming rank (not list position), value = 1/rank. |
| `trakt_watched_daily` | Movies + shows, `watcher_count` | Same pagination; capture of the current daily list, not a closed calendar-day measurement. |
| `imdb_moviemeter`, `imdb_tvmeter` | One chart request each unless the host rate-limits this run | Embedded NEXT_DATA meter rank/change preferred, JSON-LD rank fallback. Existing Crate movie/show `imdb_id` fields publish TMDB-primary/Wikidata-fallback identities; duplicate mappings rejected. |
| `letterboxd_popular_week` | First three 72-entry pages | Film page `data-tmdb-id` or TMDB anchor; slug mapping cache. |
| `flixpatrol_top10` | US, seven service pages, movie + show sections | Netflix, Prime Video, Disney+, HBO/Max, Apple TV+, Hulu, Paramount+. Title page TMDB anchor, else exact case-insensitive catalog title/original title + year + kind, requiring one match. |

For FlixPatrol, a title may appear on multiple services. Its single row stores
all service/rank entries in `raw.charts`, the best chart rank in `rank`, and the
sum of `11 - rank` in `value`. It is a locally defined chart-points signal, not a
vendor view count. Service URL aliases/markup remain unverified behind the
current access challenge.

The TMDB URL/date convention and JSONL/popularity fields are the ones already
used in `f/tmdb_daily`; the collector streams directly rather than calling its
Mongo-mutating ingestion or redundant availability HEAD request. Existing IMDb
ID validation is imported from `f/external_ids/imdb_ids.py`; no second Wikidata
crosswalk or IMDb dataset ingest is introduced.

## Access observations and rate expectations

Direct requests on 2026-10-18 with the identifying UA
`GoodWatchBuzz/1.0 (https://goodwatch.app; hello@goodwatch.app)`:

- TMDB exports work. [Official exports documentation](https://developer.themoviedb.org/docs/daily-id-exports)
  says files are ready by 08:00 UTC and kept for three months. Daily mode requests
  two files; backfill probes 130 dates, at most three concurrent dates.
- Trakt requires `u/Alp/TRAKT_CLIENT_ID` (or local env `TRAKT_CLIENT_ID`). A missing
  variable produces `needs_owner`. [Rate limits](https://github.com/trakt/trakt-api/blob/master/projects/developer/src/lib/guides/rate-limiting.md)
  allow 500 GETs/5min; all collector requests are sequential and spaced ≥1 second,
  with at most 40 Trakt calls/day. The [pagination schema](https://github.com/trakt/trakt-api/blob/master/projects/api/src/contracts/_internal/request/pageQuerySchema.ts)
  says endpoint caps vary and excess limits are clamped. A 429 stops the host for
  the run rather than retrying ahead of Retry-After.
- [IMDb robots](https://www.imdb.com/robots.txt) disallows generic crawlers and
  states automated scraping needs permission. The chart request returned empty
  HTTP 202. Collection is blocked technically; the parser fixtures are synthetic
  examples, not a successful live chart validation.
- [Letterboxd robots](https://letterboxd.com/robots.txt) disallows
  `/*/popular/this/*`; the weekly chart request returned HTTP 403 with a challenge.
- FlixPatrol's chart and [robots](https://flixpatrol.com/robots.txt) both returned
  HTTP 403 challenges. Robots expectations could not be read.

The owner's scraping decision is recorded above; no crawler identity is spoofed.
These failures do not establish that JavaScript rendering is needed. No headless
browser was tested. Scraper mapping coverage cannot be measured until chart
access works. Their synthetic fixture tests validate supported parsing shapes,
not future site compatibility.

## Run locally

```sh
python -m pip install -r goodwatch-flows/tests/requirements-buzz-signals.txt
python -m unittest discover -s goodwatch-flows/tests -p 'test_buzz*.py'

python goodwatch-flows/tools/buzz_signals.py collect \
  --env /path/to/webapp/.env --output /tmp/buzz-signals-today.json

python goodwatch-flows/tools/buzz_signals.py backfill \
  --env /path/to/webapp/.env --days 130 --workers 3 \
  --output /tmp/buzz-signals-backfill.json

python goodwatch-flows/tools/buzz_signals.py backtest \
  --env /path/to/webapp/.env \
  --output docs/implementation/talked-about-now/buzz-signals-backtest-2026-10-18.md
```

`--source` restricts daily collection. Backfill only requests TMDB exports;
it probes dates beyond the retention edge and reports missing files individually.
Completed export dates are skipped on restart; `--force` recollects them (also
use this after changing the retained cohort). Output is checkpointed after every
date. Crate mutations are allowlisted to these three tables; the backtest only
runs SELECTs. Local env parsing matches `run_buzz.py`; credentials are never
included in result/status output.

The backtest uses each title's own preceding 28 calendar days, no zero imputation,
with `value >= 5`, `value - mean28 >= 2.5`, and denominator `max(mean28, 1)`.
Both floors are exploratory (`--minimum`, `--delta`), not calibrated to optimize
agreement. Reported overlap uses equal top-k cuts and fixed k denominators.
Spearman compares the relative ordering of titles shared by the two top-20 lists;
it is N/A below two shared titles. Coverage and complete-baseline counts accompany
every day. Retrospective cohort retention and floor censoring can bias results.

## Production verification, 2026-10-18

The three new scripts, flow and schedule were deployed with CLI 1.803.0 using
an exact include list; no existing collector files or schedules were deployed.
The schedule was read back as enabled, UTC, flow target `f/buzz/signals`,
`no_flow_overlap: true`, with its next job at **2026-10-19 08:30:00 UTC**.
The Git branch was not pushed.

Manual Windmill flow job `01a14f41-d643-7825-f4cb-6772a61285f8` completed
successfully. The worker stored **33,544 TMDB rows** for 2026-10-18, with **100%
native identity coverage**. Trakt returned `needs_owner` for both lists, confirming
that the Windmill variable is also missing. IMDb returned empty 202; Letterboxd
and FlixPatrol returned 403. Those sources have zero captured rows and mapping
coverage is unmeasurable, not 0% of a known chart. The worker result matches the
local collection result.

Validation: 50 offline unittest tests passed across `test_buzz.py` and
`test_buzz_signals.py`, including parsers, streaming gzip, storage allowlist,
ambiguous identities, mapping cache, partial pagination, source/DB isolation,
429 stop behavior, missing baselines, floors, ties and rank correlation.
Dependencies and Windmill hashes were generated with CLI 1.803.0.

## Files

- `goodwatch-flows/windmill/f/buzz/signals.py`: daily orchestration and HTTP adapters.
- `goodwatch-flows/windmill/f/buzz/signal_parsers.py`: pure source parsers.
- `goodwatch-flows/windmill/f/buzz/signal_store.py`: DDL, upserts and existing-catalog identity lookups.
- `goodwatch-flows/windmill/f/buzz/signals.flow/flow.yaml` and `signals.schedule.yaml`: deployment entry points.
- Corresponding `.script.yaml`/`.script.lock` files and new `wmill-lock.yaml` entries.
- `goodwatch-flows/tools/buzz_signals.py`: local collection, resumable backfill and read-only backtest.
- `goodwatch-flows/tests/test_buzz_signals.py`, `fixtures/buzz_signals/`, `requirements-buzz-signals.txt`: offline tests and inputs.
- [Backtest report](buzz-signals-backtest-2026-10-18.md): measured production comparison.

The production backtest covers **34 days, 2026-09-12 through 2026-10-15**.
All **680/680 Wikipedia winner title-days** have complete TMDB baselines.
Mean overlap@8 is **0.199** (about 1.59 common titles); mean overlap@20 is
**0.207** (about 4.15 common titles). Mean Spearman on the top-20 intersections
is **0.462**, defined on 32 days. This is modest overlap between different
attention signals, not evidence that TMDB is a drop-in Wikipedia replacement.
The full dated results and metric caveats are in the linked backtest report.

A follow-up collector check independently requested both IMDb charts and all
seven FlixPatrol service pages: both IMDb charts returned 202, and every
FlixPatrol service returned 403. These scopes remain independent after access
errors; only HTTP 429 suppresses subsequent requests to the same host. That
isolation adjustment is covered by the 50-test suite and deployed to Windmill.

## Completed export backfill

Production contains **3,071,863 TMDB observations over 122 consecutive dates**,
**2026-06-19 through 2026-10-18**, all with native TMDB identities. Both movie
and TV exports completed for every stored date. The retained below-floor cohort
contains 897 titles. An idempotent repeat of today's capture kept its row count
at 33,544.

We probed 130 dates (through 2026-06-11). The eight older dates, June 11–18,
return HTTP 403, rather than 404, and are recorded as unavailable/blocked. HEAD
checks independently confirmed both movie and TV files unavailable on June 18
and available on June 19. This observed retention is about four months, longer
than the official three-month description; the tool defaults to 130 days to
cover it. The eight unavailable dates are not fabricated as zero observations.
There were no failed or partial captures within the 122-day available range.


## JustWatch collector (2026-10-18)

POST `https://apis.justwatch.com/graphql`, without credentials, using the existing
identifying UA, sequential one-second spacing, bounded timeouts and host-wide
429 stop. Two independent scopes (MOVIE, SHOW), US only; GB/DE are deferred to
avoid conflating country ranks under one source key. Fetching the first 100 per
kind is deliberately bounded; no pagination/full-chart claim is made.

`popularTitles(country: US, first: 100, sortBy: TRENDING,
filter: {objectTypes: [MOVIE]})` selects titles. `streamingCharts(country: US)`
supplies the rank and `trend`, `trendDifference`, `daysInTop10`, `topRank`,
`updatedAt`; all are retained in raw alongside `country`, JustWatch `id` and title.
Only a positive integer rank, one unambiguous chart edge, and a positive native
TMDB id are accepted. Missing identities/ranks or multiple chart edges are
skipped. GraphQL errors and HTTP/transport failures produce blocked/partial
statuses and never suppress other vendors. The day is the UTC collection date;
raw `updatedAt` remains available to audit vendor freshness.

The owner verified this endpoint from the server on October 18. This workspace's
trial returned HTTP 403, so exact live schema, chart-edge cardinality and coverage
remain unverified here. Fixtures are synthetic examples of the supplied schema.
The earlier partner-API access observation in the research document describes a
different API; this implementation uses the public website GraphQL endpoint.
No deployment or production collection was performed for this change.
