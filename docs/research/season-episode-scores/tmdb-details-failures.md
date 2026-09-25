# TMDB details flow failures (2026-09-25)

The flow is `f/tmdb_api/tmdb_fetch_details_from_api`. Its schedule runs `10/15 * * * * *`, with no overlapping runs.
It has two steps. Step `a` (`next`) picks the batch and has a 60 s timeout. Step `b` (`fetch`) calls TMDB and has a 300 s timeout.

## Summary

- **Symptom.** Step `a` times out after 60 s with `job process terminated due to timeout after exceeding job-specific duration limit`. Step `b` never runs. The TMDB API, the api key, rate limits and Mongo writes are all fine.
- **Root cause.** The query for never-selected titles in `f/data_source/common.py::completeness_queue` cannot use an index in popularity order. Its shape is `(selected_at = null OR (is_selected AND selected_at < buffer)) AND tmdb_deleted != true`, sorted by `-popularity`, limit 50. MongoDB fetches every never-selected document through `selected_at_1` and sorts them in memory:
  - movies: 175,075 docs examined, 38–65 s
  - TV: 27,823 docs examined, 9–23 s

  The two collections together take more than the 60 s step budget.
- **Why it degraded over time.** The never-selected titles are 135-byte stubs. On 2026-09-21 the flow restarted, and about 45k neighbouring stubs were rewritten as 34 KB detail documents. After that, reading the remaining 175k stubs meant reading many more pages from disk: the movie collection is 20 GB against 15 GB of RAM. The `next` median went from 3.5 s at 08:00 to 50 s by 19:00 and hit the timeout by 22:00.
- **Not the cause.** Commit 44c93d92 added `tmdb_deleted != true`, but `explain` gives the same plan and the same number of keys examined with and without that filter. It only stopped SUBPLAN caching. The `$or` plus in-memory sort was already there.

## Evidence

### Windmill job history

Retention starts 2026-09-21 07:58. The table covers 23,061 flow jobs.

| Period | Real runs/h | Succeeded | Failed (timeout in `a`) |
|---|---|---|---|
| 09-21 07–08 | — | 64 | 132 (TMDB 404 batch failures, before the fix went live at 08:35) |
| 09-21 09–14 | ~240 | ~100/h | 0 |
| 09-21 15–23 | ~240 | falling from 66 to 2 | rising from 2 to 48 |
| 09-22 00 → now | ~50 | 0–10/h (occasional bursts of up to 30) | ~45–50/h |

About 190 jobs per hour are "not allowed to overlap" skips that Windmill reports as successful. Leaving those out, **about 95% of real runs have failed since 2026-09-22**, and 100% overnight. Every failure in the last four days is the step-`a` timeout. The `next` step's own duration rose steadily: the median was 3.5 s, then 11 s, 20 s, 35 s and 50 s over 2026-09-21, and it has been 50–60 s since.

### Mongo (read-only `explain("executionStats")` on the primary, 2026-09-25)

| Query | Plan | Examined | Time |
|---|---|---|---|
| movies no-fetch (current code) | `SORT > FETCH > OR > IXSCAN(is_selected_1), IXSCAN(selected_at_1)` | 175,128 keys / 350,256 docs | 65 s cold |
| TV no-fetch (current code) | same | 27,823 keys | 9–23 s |
| movies/TV old-fetch (`selected_at != null`, sort `selected_at`) | `LIMIT > FETCH > IXSCAN(selected_at_1)` | 51 keys | 1–7 ms |

Only 53 movies and 2 TV titles are stuck with `is_selected=true`, so the queue itself is fine.

### Inputs, TMDB and data

- **Inputs.** Nothing fails per title. The step fails before any IDs are chosen, so movies and TV are equally blocked.
- **TMDB.** The `fetch` script is shared with `f/priority/crawl_all`, and that flow keeps working. Its 60 most recent runs saved 119 titles, flagged 1 as deleted and failed 0: no 401, 429 or timeouts. I did not need to repeat a TMDB request.
- **Code and deployment.** The deployed `next`, `fetch` and `f/data_source/common` match `main`. The locks only moved to newer versions (py3.12 for `fetch`, py3.11 for `next`), and nothing in the timing points to them.

## Staleness

| | Movies | TV |
|---|---|---|
| Total | 1,345,129 | 247,027 |
| Never fetched (`selected_at` null) | 175,075 | 27,821 |
| Updated in the last 1 d | 3,618 | 538 |
| Updated in the last 7 d | 48,704 | 12,557 |
| Updated in the last 365 d | 81,434 | 16,560 |
| Popularity ≥ 10, not updated in 30 d | 3,255 of 3,521 | 9,268 of 10,436 |

Almost nothing was refreshed between mid-2025 and 2026-09-21. The oldest `selected_at` is 2025-06-24, which fits the old 404 batch failure. The 2026-09-21 run caught up about 45k titles and then stalled. Today, only the titles the priority flow picks get refreshed.

Two design problems remain even after the fix:

- `completeness_queue` fills the whole batch with never-fetched titles before any refresh: `(no_fetch + old_fetch)[:count]`. While the 200k-title tail of popularity ≤ 1.3 lasts, and daily dumps keep adding to it, popular titles already fetched are never refreshed by this flow.
- The same `$or` shape is used by the imdb, metacritic, rotten, tvtropes and dna `next` scripts.

## Fix (prepared locally, not committed or deployed)

1. **`f/data_source/common.py`.** A new `no_fetch_entries_for()` splits the `$or` into two queries and merges them in Python. Each query is sorted by `-popularity` and limited to `count`:
   - never-selected titles: `selected_at = null`
   - stuck titles: `is_selected AND selected_at < buffer`

   A local MongoDB 8.0 test confirmed that the old `$or` keeps its blocking `SORT` even when the new index exists, so this split is required.
2. **`f/tmdb_api/models.py`.** Adds the index `("selected_at", "-popularity")`, named `selected_at_1_popularity_-1`, to `BaseTmdbDetails`.
3. **`goodwatch-flows/tests/test_details_queue_integration.py`.** This test is optional and runs only when `TEST_MONGO_URL` is set. It checks two things:
   - The never-selected query runs without a `SORT` stage and examines fewer than 150 documents.
   - The queue order is: stuck titles first, then the most popular never-selected titles. Deleted titles are excluded, and the titles are reserved.

   Without the index the test fails (`'SORT' unexpectedly found`). With it, the test passes.

   Run it with `TEST_MONGO_URL=mongodb://127.0.0.1:<port> PYTHONPATH=windmill .venv/bin/python -m unittest tests.test_details_queue_integration`.

### Rollout

1. Build the index by hand on the primary before pushing. Otherwise mongoengine's auto-create would start the build over 1.3M documents from inside a job that times out after 60 s.
   ```js
   db.tmdb_movie_details.createIndex({selected_at: 1, popularity: -1})
   db.tmdb_tv_details.createIndex({selected_at: 1, popularity: -1})
   ```
2. Push `common.py` and `models.py` with a Windmill sync.

A possible stopgap is to raise step `a`'s timeout in `flow.yaml`. It hides the problem and does not fix the growth, so it is not recommended.
