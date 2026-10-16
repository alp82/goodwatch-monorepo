# Daily offer recheck of recent releases

Implements [#679](https://github.com/alp82/goodwatch-monorepo/issues/679).
TMDB updates watch providers around 11:30–12:00 UTC. Run
`f/tmdb_api/recheck_recent_releases` every day at 13:00 UTC.

## Selection and publication

`f/tmdb_api/recent_releases` reads indexed Crate `movie.release_date` and
`show.first_air_date`. The window is **30 UTC calendar dates, including today**:
on October 16, September 17 through October 16, inclusive. Future and unknown
release dates are excluded. Shows use their premiere date, not their latest
episode date. The research's roughly 7,000-title estimate also included the next
seven days; this build follows the issue's released-titles scope.

The selector resolves the catalog's TMDB IDs to existing Mongo details documents,
excluding missing or TMDB-deleted documents. A movie and a show with the same ID
remain distinct; each title appears once. A successful provider check since
12:00 UTC is excluded. A morning fetch, failed attempt, or queue reservation does
not count as a successful check after TMDB's batch. The plan reports candidate,
already-checked, unavailable, selected, movie, and show counts.

The flow passes batches of at most 50 Mongo IDs, sequentially, to the existing
`f/tmdb_api/tmdb_fetch_details_from_api/fetch`. Its one details request per title
includes `watch/providers` for every country and all five offer types. It stores
the usual validated provider evidence and bumps `updated_at`.

The existing `f/sync/copy/tmdb_streaming` scheduled writer picks up those updates.
Its production schedule is `0 0 2/6 * * *`, Europe/Berlin: 00:00, 06:00, 12:00,
18:00 UTC during summer time, one hour later in winter. A normal 13:00 UTC recheck
therefore publishes at 18:00 or 19:00 UTC. There is no new offer writer or extra
publication schedule. `CrateConnector.upsert_many` still excludes `created_at`
from conflict updates: existing offers retain their first-seen time and new rows
get the publication time. The member's Newly available signal keeps its meaning.

Neither the selector nor flow reserves the regular details queue, changes
`selected_at`, or reads or advances `tmdb_details_refetch_cycle`. All existing
30-day-cycle code is unchanged. The regular queue can still fetch an overlapping
title later in the day, or race the selection. Removing that last small overlap
would require coordinating reservations and is deliberately outside this change.

The catalog read has an explicit 20,001-row limit per media type (avoiding Crate's
implicit SELECT limit) and fails before fetching if the combined candidate count
exceeds 20,000. Increase that budget only after checking daily request volume.
The flow fails on a failed batch or any per-title failures returned by the existing
fetcher. A manual rerun reselects and skips successful checks since noon. The
existing fetcher's handling of malformed provider payloads remains unchanged:
it retains previous proof and sets the provider error, so the title is eligible
on a rerun. Only run one copy of the daily flow at a time.

## Deploy after review

No production changes were made by this build. No new Crate table, Mongo
collection, database index, credential, or migration is needed.

1. Deploy the new selector script, its metadata/lock, and the new flow through
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

   This six-field cron includes seconds. Every weekday is selected (`*`);
   Windmill's weekday numbering is 1 = Sunday.
3. Watch the first daily flow and the following regular streaming publication.
   Confirm the newly available offers and retained `created_at` of existing rows.

Disable only this new schedule to undo the daily recheck. The existing refresh
cycle and streaming publications continue unchanged.

## Read-only validation

`goodwatch-flows/scripts/recent_release_dry_run.py` reads the real selection,
Crate offer rows and TMDB's `/watch/providers` endpoint for every selected title.
It uses the existing writer's pure `reconcile_availability` function to compare
offer identities. It never calls the writer's publication functions, takes a
lease, writes Mongo, refreshes a table, or creates an index. It starts at most ten
TMDB requests per second with eight threads, up to three attempts for transient
errors. Errors are counted separately, with credential-free messages.

For a pre-deploy preview, replace its
`from f.tmdb_api.recent_releases import select_recheck` line with the new
selector's source up to (excluding) `def main()`. Submit that assembled source to
`POST /api/w/goodwatch/jobs/run/preview` with `language: python3`,
`path: f/tmdb_api/recent_releases_readonly_preview`, and `args: {}`. Use the local
Windmill remote token without printing it. Poll `/jobs_u/get/<job-id>`.

The comparison reports additions to existing offers, including titles receiving
their first offer, and singles out East of Eden (`show:258165`). It does not
simulate new scraper results, identity-maintenance holds, or publication failures;
the normal writer remains responsible for those. Production is live throughout,
so counts are a time-stamped observation, not a transactionally fixed snapshot.

### Production measurement, October 16, 2026

The read-only preview started its selection at **21:57:30 UTC**. Job
`01a146b8-5488-7e6c-5636-3b809dc3a29d` completed successfully. The
[machine-readable result](research/recent-release-recheck-2026-10-16.json)
includes source hashes and the IDs for the failed reads.

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

**Daily request cost:** one TMDB request per selected title, because the existing
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
boundaries, today, future and unknown dates, both media types, UTC conversion,
post-batch check deduplication, missing/deleted/duplicate documents, batching,
empty selection, the budget guard, and unchanged database state.
An additional regression check executes the existing offer upsert SQL against
SQLite: rechecking an existing offer keeps its original `created_at`, while a
new offer receives the current publication time.

The optional `test_recent_release_flow_integration.py` runs the actual flow loop
and report in Windmill previews with inert selector/fetch scripts. It verifies
batch arguments, empty runs and failure reporting without database access.

Validation completed: 97 tests passed (including three actual inert Windmill
previews); five pre-existing optional database integration tests were skipped.
The unchanged refetch-cycle, details-queue, TMDB fetch-failure and streaming
publication suites passed. The exact new selector and checked-in dependency lock
also passed a production read-only preview in 2.1 seconds
(`01a146bb-b0d4-64f8-e713-6962057d9ceb`). A live production write run was not made.

```sh
python -m unittest discover -s goodwatch-flows/tests -p 'test_recent_release_recheck.py'
# With TEST_WINDMILL_API and TEST_WINDMILL_TOKEN set:
python -m unittest discover -s goodwatch-flows/tests -p 'test_recent_release_flow_integration.py'
```
