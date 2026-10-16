# Daily offer recheck of recent releases

Implements [#679](https://github.com/alp82/goodwatch-monorepo/issues/679).
Run `f/tmdb_api/recheck_recent_releases` every day at **13:00 UTC**. The previously
reported 11:30–12:00 UTC TMDB update time came from cached reads and is unconfirmed.
Owner decision Q56 keeps the schedule and requires fresh requests. The
[availability-history research](https://github.com/alp82/goodwatch-monorepo/blob/research/offer-arrival-everywhere/docs/research/availability-history.md)
found cached copies up to 7.7 hours old and cache misses with a unique `cb` query
parameter.

## Selection and publication

`f/tmdb_api/recent_releases` reads indexed Crate `movie.release_date` and
`show.first_air_date`. The window is **30 UTC calendar dates, including today,
plus the next seven days** (Q51): on October 16, September 17 through October 23,
inclusive. The SQL upper bound is exclusive, `today + 8 days`. Unknown dates and
dates outside that window do not qualify.

For movies, the selector also reads **Crate `release_event`**, with
`media_type = 'movie'` and `release_type = 4` (digital), in the same date window
(Q52). `f/sync/copy/tmdb_details.py` publishes these from Mongo
`tmdb_movie_details.release_dates.results[].release_dates[]`, preserving TMDB's
release type and date per country. Crate stores `release_date` as a timestamp;
the selector supplies UTC milliseconds. A digital release in any country
qualifies, even with an old or unknown primary release date. Repeated country
events and overlap with the primary release window count the movie once.
`digital_movies` counts selected movies with a qualifying digital event;
`digital_only_movies` counts the additional movies outside the primary window.

Shows qualify only by their premiere date. An old-premiere show with a new season
or recent episode remains outside the recheck (Q53).

The selector resolves the catalog's TMDB IDs to existing Mongo details documents,
excluding missing, TMDB-deleted, or currently reserved (`is_selected = true`)
documents. A movie and a show with the same ID remain distinct; each title appears
once. A successful **cache-bypassed** provider check since 12:00 UTC is excluded.
Noon remains a provisional same-day retry cutoff, not a verified TMDB update time.
A regular cached fetch cannot substitute for the fresh recheck, even when it ran
after noon. Morning checks and failed attempts also do not qualify. Reserved titles are left to
the regular queue. The plan reports candidate, already-checked, unavailable
(missing, deleted, or reserved), selected, movie, and show counts. This runs
alongside the [awaited-title rechecks](awaited-title-rechecks.md).

The flow passes batches of at most 50 Mongo IDs, sequentially, to the existing
`f/tmdb_api/tmdb_fetch_details_from_api/fetch`. Its one details request per title
includes `watch/providers` for every country and all five offer types. The flow
alone passes `bypass_cache: true`, adding a fresh `cb=<UUID>` query parameter on
every request, including batch retries. The shared fetcher's default is false:
regular 30-day refreshes and other existing callers keep their plain URLs. A
successful validated provider check records `cache_bypassed: true` in its Mongo
proof; later regular checks do not inherit that marker. The fetch still uses the
usual writer and bumps `updated_at`.

The existing `f/sync/copy/tmdb_streaming` scheduled writer picks up those updates.
Its production schedule is `0 0 2/6 * * *`, Europe/Berlin: 00:00, 06:00, 12:00,
18:00 UTC during summer time, one hour later in winter. A normal 13:00 UTC recheck
therefore publishes at **18:00 UTC in summer or 19:00 UTC in winter**: five or
six hours after the recheck starts. In winter the 13:00 UTC streaming publication
starts alongside the recheck and misses its results; count on the 19:00 run.
There is no new offer writer or extra publication schedule.
`CrateConnector.upsert_many` still excludes `created_at`
from conflict updates: existing offers retain their first-seen time and new rows
get the publication time. The member's Newly available signal keeps its meaning.

Neither the selector nor flow reserves the regular details queue, changes
`selected_at`, or reads or advances `tmdb_details_refetch_cycle`. All existing
30-day-cycle code is unchanged. The regular queue can still fetch an overlapping
title later in the day, or race the selection. Removing that last small overlap
would require coordinating reservations and is deliberately outside this change.

Each catalog source read has an explicit 20,001-row limit (avoiding Crate's
implicit SELECT limit) and fails before fetching if the combined candidate count
exceeds 20,000. Increase that budget only after checking daily request volume.
Each failed batch gets two retries, 60 seconds apart. After those are exhausted,
the loop continues with the remaining batches. The final report counts failed
iterations and per-title failures and raises if either is nonzero, so one broken
batch does not prevent the remaining titles from being fetched. A manual rerun
reselects and skips successful fresh checks since noon. The existing fetcher's handling
of malformed provider payloads remains unchanged:
it retains previous proof and sets the provider error, so the title is eligible
on a rerun. Only run one copy of the daily flow at a time.

## Deploy after review

No production changes were made by this build. No new Crate table, Mongo
collection, database index, credential, or migration is needed.

1. Deploy the selector, the updated shared details fetcher and its input schema,
   and the flow (including its inline report) through
   the normal main-branch Windmill sync.
2. Create one Windmill schedule after the code is deployed:

   ```json
   {
     "path": "f/tmdb_api/recheck_recent_releases",
     "script_path": "f/tmdb_api/recheck_recent_releases",
     "is_flow": true,
     "schedule": "0 0 13 * * *",
     "timezone": "UTC",
     "enabled": true,
     "args": {}
   }
   ```

   This six-field cron includes seconds and runs every day.
3. Watch the first daily flow and the following regular streaming publication.
   Confirm the newly available offers and retained `created_at` of existing rows.
   For the first week, record each UTC day's number of distinct US titles
   (`media_type`, `media_tmdb_id`) with a new `streaming_availability.created_at`
   for subscription, free, or ads offers. Compare it with the documented baseline
   of about **80 titles/day** in
   [availability-first-seen.server.ts](../goodwatch-webapp/app/server/availability-first-seen.server.ts#L41).
   Separate the first day's catch-up from the following six days; the historical
   baseline is a comparison, not an automatic failure threshold.
   Also count **offer flapping**: rows deleted and subsequently re-created with
   the same `(media_type, media_tmdb_id, country_code, streaming_service_id,
   streaming_type)` and a new `created_at`. Keep local read-only snapshots of
   those keys and timestamps before and after each streaming publication for the
   week; count keys observed absent and then present again, and separately flag
   keys whose `created_at` advances without an observed absence. Current rows
   alone cannot reveal deleted rows, and snapshots give a lower bound if a row
   disappears and returns between reads. No production history table is required.

Disable only this new schedule to undo the daily recheck. The existing refresh
cycle and streaming publications continue unchanged.

## Read-only validation

`goodwatch-flows/scripts/recent_release_dry_run.py` reads the real selection,
Crate offer rows and TMDB's `/watch/providers` endpoint for every selected title.
It uses the existing writer's pure `reconcile_availability` function to compare
offer identities. It never calls the writer's publication functions, takes a
lease, writes Mongo, refreshes a table, or creates an index. It starts at most ten
TMDB requests per second with eight threads, up to three attempts for transient
errors. Every request uses a fresh `cb` value; the report counts CloudFront cache
status headers from successful responses. Errors are counted separately, with
credential-free messages.

For a pre-deploy preview, replace its
`from f.tmdb_api.recent_releases import select_recheck` line with the new
selector's source up to (excluding) `def main()`. Submit that assembled source to
`POST /api/w/goodwatch/jobs/run/preview` with `language: python3`,
`path: f/tmdb_api/recent_releases_readonly_preview`, and `args: {}`. Use the local
Windmill remote token without printing it. Poll `/jobs_u/get/<job-id>`.

The comparison reports additions to existing offers, including titles receiving
their first offer. It does not simulate new scraper results,
identity-maintenance holds, or publication failures;
the normal writer remains responsible for those. Production is live throughout,
so counts are a time-stamped observation, not a transactionally fixed snapshot.

### Fresh production measurement, October 16, 2026

The expanded selector and cache-bypassed comparison ran at **22:57–23:08 UTC**,
with selection measured at 22:57:33. Job
`01a146ef-5297-95d8-ba7c-add2b92bcb17` completed successfully without database
writes. The [machine-readable result](research/recent-release-recheck-fresh-2026-10-16.json)
records the exact submitted source hash, failure IDs and cache evidence.

| Measurement | Count |
|---|---:|
| Selected titles, September 17–October 23 | 6,334 |
| Movies / shows | 5,321 / 1,013 |
| Selected movies with a qualifying digital release | 1,435 |
| Movies added solely by the digital-release rule | 404 |
| Already freshly checked / missing, deleted or reserved | 0 / 0 |
| Successfully compared | 6,264 |
| TMDB HTTP 404 responses, excluded from addition counts | 70 (44 movies, 26 shows) |
| Titles that would gain offers | 559 (320 movies, 239 shows) |
| Of those, titles currently without any offer | 386 |
| Additional offer rows, all five offer types | 16,209 |
| Of those, subscription, free, or ads | 13,200 |
| TMDB requests, including retries | 6,334 (no retries) |
| Successful responses reporting `Miss from cloudfront` | 6,264 (all) |

**Current daily request cost:** one appended-details request per selected title,
or **6,334 requests/day** at this observed catalog size, plus any retries. Digital
release selection adds no TMDB calls: it reads Crate. There is no per-country
request. The regular 30-day refresh budget remains unchanged. The 70 HTTP 404
responses were reported separately and caused no deletion or flag changes.

A separate read-only preview of the actual modified details-fetch functions
(`01a146f0-e15e-950b-41b9-6e78b70d0629`) made two additional validation requests:
movie 603 and East of Eden (`show:258165`). Both returned HTTP 200 with a `cb`
parameter, `Miss from cloudfront`, and no `Age` header. These two validation
requests are not part of the daily cost or full-comparison count.

### Original cached measurement, October 16, 2026

The read-only preview started its selection at **21:57:30 UTC**. Job
`01a146b8-5488-7e6c-5636-3b809dc3a29d` completed successfully. The
[machine-readable result](research/recent-release-recheck-2026-10-16.json)
includes source hashes and the IDs for the failed reads.
This is the original build's cached measurement, before the expanded window,
digital releases, fresh-check deduplication and reservation filter; its source
hashes remain unchanged. It is not the request-cost estimate for the current build.

| Measurement | Count |
|---|---:|
| Recent catalog titles, September 17–October 16 | 5,303 |
| Already successfully checked since noon | 73 |
| Missing or flagged deleted in Mongo | 0 |
| Selected for recheck | 5,230 (4,299 movies, 931 shows) |
| Successfully compared | 5,164 |
| TMDB HTTP 404 responses, excluded from addition counts | 66 (42 movies, 24 shows) |
| Titles that would gain offers | 394 (156 movies, 238 shows) |
| Of those, titles currently without any offer | 356 |
| Additional offer rows, all five offer types | 13,198 |
| Of those, subscription, free, or ads | 11,671 |
| TMDB requests, including retries | 5,230 (no retries) |

**East of Eden (`show:258165`) is selected:** no existing Crate offers; 142 added
subscription/free/ads offer rows in 131 countries. The 66 HTTP 404s were not
silently treated as empty offers. The deployed details fetch will use its
existing missing-title handling; this read-only measurement changed no flags.

**Original daily request cost:** one TMDB request per selected title, because the existing
details endpoint appends watch providers. This observation would cost 5,230
requests; a 13:00 run can skip fewer regular checks than this late-evening
measurement, so approximately 5,300 at this catalog size. The issue's 7,000-title
estimate would cost 7,000 requests/day, plus any retries. There is no request per
country, and the 30-day cycle's request budget is unchanged.

The first publication will also find the accumulated backlog, dated at its
first publication as before; these are not all offers that arrived on that day.

## Tests

The selection tests execute the selector's SELECT statements against an in-memory
SQL catalog and its Mongo queries against mongomock. They cover both date
boundaries, today, the next seven days and unknown dates, digital events and
deduplication, exclusion of returning seasons, both media types, UTC conversion,
post-batch check deduplication, reserved/missing/deleted/duplicate documents, batching,
empty selection, the budget guard, and unchanged database state.
An additional regression check executes the existing offer upsert SQL against
SQLite: rechecking an existing offer keeps its original `created_at`, while a
new offer receives the current publication time.

The optional `test_recent_release_flow_integration.py` runs the actual flow loop
and report in Windmill previews with inert selector/fetch scripts. It verifies
batch arguments, empty runs, partial title failures, and continued processing
after an iteration exhausts its retries, without database access.

Original-build validation: 97 tests passed (including three actual inert Windmill
previews); five pre-existing optional database integration tests were skipped.
The unchanged refetch-cycle, details-queue, TMDB fetch-failure and streaming
publication suites passed. The exact new selector and checked-in dependency lock
also passed a production read-only preview in 2.1 seconds
(`01a146bb-b0d4-64f8-e713-6962057d9ceb`). A live production write run was not made.

Review-fix validation: nine selector/first-seen tests, three report tests, four
recent-release flow previews and four existing DNA flow previews passed. The
failure preview exercised both 60-second retries, continued to the next batch,
and failed in the final report with one exhausted iteration. All previews used
inert fetches; the full production offer comparison was not repeated.

Cache-bypass tests call the shared fetcher's public entry point with Mongo and
HTTP test adapters. Both media types and repeated attempts get distinct cache
keys; default and explicit-false calls retain the original URL and do not mark
cached results as fresh. The flow preview checks that each batch receives the
opt-in flag. No production writer is invoked by these tests.

Expanded-window and cache-bypass validation: **110 tests passed** across selector
and first-seen (11), cache opt-in (2), fetch failures (8), deleted-title handling
(10), availability evidence (10), streaming publication (46), refetch cycle (16),
and report/flow (7). Four of the flow checks ran actual inert Windmill previews,
including both 60-second retries for an exhausted iteration. The full fresh
production comparison above was repeated after these changes. No live production
write run was made.

```sh
python -m unittest discover -s goodwatch-flows/tests -p 'test_recent_release_recheck.py'
python -m unittest discover -s goodwatch-flows/tests -p 'test_tmdb_recheck_cache.py'
# With TEST_WINDMILL_API and TEST_WINDMILL_TOKEN set:
python -m unittest discover -s goodwatch-flows/tests -p 'test_recent_release_flow_integration.py'
```
