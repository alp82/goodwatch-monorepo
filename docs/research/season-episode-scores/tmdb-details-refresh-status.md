# Is the TMDB details refresh healthy again? (issue #366)

Research date: 2026-10-06. Status: answered from the repository history, read-only `SELECT` queries on the production CrateDB (`show`, `movie`, `season`) and ten live TMDB `/tv/{id}` requests. Windmill job and schedule state and MongoDB were **not** read, so everything about the flow itself is inferred from the data it leaves behind. All timestamps are UTC; the queries ran around 19:30.

Follow-up to [tmdb-details-failures.md](tmdb-details-failures.md) (2026-09-25). Paths under `goodwatch-flows/windmill/` are shortened to `f/...`.

## Answer

**Yes for the backlog, not yet proven for the steady state.**

- The fix is committed and the catalog was re-fetched. Every one of the 10,761 shows with popularity ≥ 10 has been fetched from TMDB in the last 16 days (0 older than 30 days; on 2026-09-25 it was 9,268 of 10,436).
- Of 233,582 shows, 233,451 were fetched in the last 30 days. 214,568 shows have `season` rows, and no `season` row is older than 2026-09-25.
- What is not proven: the 30-day refresh itself. Nothing has turned 30 days old since the catch-up, so the stale half of the queue has had almost nothing to do. The first large wave falls due from 2026-10-21 and peaks around 2026-10-25 to 10-30.
- The refresh is too coarse for an episode catalog of airing shows. Popular shows are 11 days old at the median, and `last_air_date` already lags TMDB by a week on five of the ten airing shows checked.

## 1. Code: the fix is committed

Measured from `git log`:

| Commit | Date | What it does |
| --- | --- | --- |
| `5f629442` | 2026-09-25 11:02 +0200 | The fix the earlier note describes, and more. Splits the `$or` into `never_selected_titles` and `stuck_titles`, adds the `(selected_at, -popularity)` and `(-popularity, selected_at)` indexes to the TMDB details, IMDb, Metacritic, Rotten Tomatoes, TV Tropes and DNA models, and adds `tests/test_completeness_queue.py` and `tests/test_details_queue_integration.py`. |
| `b02c4279` | 2026-09-25 | Loads only `id`, `tmdb_id` and `popularity` for queue candidates. |
| `765577b3` | 2026-09-25 | Gives each source its own stale interval; the default stays `STALE_AFTER_DAYS = 30`. |

The commit message of `5f629442` says "The indexes were built by hand on the production primary before this push". I did not check the indexes in MongoDB.

Both design problems the earlier note left open are addressed in `f/data_source/common.py`:

- **Refreshes no longer wait for the never-fetched backlog.** `mix_batch` gives half of each batch of 50 to never-fetched titles and half to the most popular titles whose `selected_at` is older than 30 days. A group that cannot fill its half leaves the slots to the other.
- **The other sources use the same queue.** `completeness_queue` is shared, so the imdb, metacritic, rotten, tvtropes and dna `next` scripts got the split query too.

`f/tmdb_api/tmdb_fetch_details_from_api.flow/flow.yaml` is unchanged: step `a` still has a 60 s timeout and step `b` 300 s. `f/tmdb_api/tmdb_fetch_details_from_api/next.py` still asks for `BATCH_SIZE = 50`.

One behaviour worth knowing (read from the code, `f/data_source/common.py::stale_titles` and `fetch.py::isolate_failure`): staleness is judged on `selected_at`, the time a title was last *picked*, not on `updated_at`, the time it was last *fetched successfully*. A title whose fetch fails is released with a fresh `selected_at` and waits another 30 days.

## 2. Data: how stale shows are now

Source: production CrateDB, `doc.show`, `doc.movie`, `doc.season`. `show.tmdb_details_updated_at` is the Mongo details document's `updated_at` (`f/sync/copy/tmdb_details.py:390`), which `fetch.py:195` sets on every successful TMDB fetch. So it measures the last successful fetch, as copied to Crate. The earlier note measured the same thing in MongoDB directly; the totals differ slightly (10,436 popular shows there, 10,761 here).

### The earlier measurement, repeated

```sql
select count(*) popular,
       count(*) filter (where tmdb_details_updated_at < now() - interval '30 days'
                           or tmdb_details_updated_at is null) stale30,
       count(*) filter (where tmdb_details_updated_at >= now() - interval '7 days') last7,
       count(*) filter (where tmdb_details_updated_at >= now() - interval '1 day') last1
from show where popularity >= 10
```

| | 2026-09-25 (Mongo) | 2026-10-06 (Crate) |
| --- | --- | --- |
| Shows with popularity ≥ 10 | 10,436 | 10,761 |
| Not updated in 30 days | 9,268 | **0** |
| Movies with popularity ≥ 10, not updated in 30 days | 3,255 of 3,521 | **0 of 3,073** |

Of the 10,761 popular shows, 1,720 were fetched in the last 7 days and 200 in the last day. The median age is 11.3 days and the oldest is 15.5 days.

### Distribution of the show fetch timestamp

All 233,582 shows:

| Last fetched | Shows |
| --- | --- |
| Last 1 day | 1,005 |
| Last 7 days | 66,572 |
| Last 30 days | 233,451 |
| 2025-06 (older than 30 days) | 2 |
| Never (`tmdb_details_updated_at` null, `status` null) | 129 |

By day (`date_format('%Y-%m-%d', tmdb_details_updated_at)`, grouped):

| Day | Shows | of which popularity ≥ 10 | Movies |
| --- | --- | --- | --- |
| 09-21 | 9,933 | 370 | 33,507 |
| 09-22 | 398 | 5 | 4,448 |
| 09-23 | 501 | 1 | 5,495 |
| 09-24 | 341 | 1 | 3,358 |
| 09-25 | 44,234 | 7,452 | 78,369 |
| 09-26 | 50,165 | 289 | 182,893 |
| 09-27 | 27,478 | 336 | 218,547 |
| 09-28 | 18,746 | 338 | 253,936 |
| 09-29 | 20,763 | 314 | 237,545 |
| 09-30 | 49,938 | 292 | 211,083 |
| 10-01 | 6,063 | 287 | 19,211 |
| 10-02 | 998 | 263 | 1,526 |
| 10-03 | 990 | 227 | 1,518 |
| 10-04 | 1,028 | 212 | 1,470 |
| 10-05 | 1,047 | 211 | 1,496 |
| 10-06 (to 19:30) | 828 | 163 | 1,288 |

This is each title's *latest* fetch, so a title fetched twice counts only on the later day.

Movies: 1,256,280 rows, 1,255,690 fetched in the last 30 days, 581 never, 9 last fetched in 2025-06.

**Inferred from this table.** The flow started working on 2026-09-25, the day the fix was pushed, and ran at 200k to 270k titles a day until the whole catalog had been fetched in the early hours of 2026-10-01. Since then there is nothing never-fetched and nothing 30 days old, so the flow has almost nothing to pick.

What still refreshes about 1,000 shows and 1,500 movies a day:

- **Hourly, 25 to 55 shows and exactly the same number of movies.** That equality fits `f/priority/next.py`, which picks one movie and one show per run ("Preserve one movie and one show per scheduled run"), not the details flow.
- **A burst at 09:00 every day** (114 to 162 shows on each of 10-01 to 10-06; 587 movies on 10-06). About 90 shows a day have a new `tmdb_details_created_at`. I read this as the details flow fetching the titles the daily TMDB dump added, which would mean the flow is alive. It is an inference, not a job-history fact.

**The 11 titles still older than 30 days** (2 shows, 9 movies, all popularity ≤ 1.7, last fetched 2025-06-24 to 06-30) are the only stale titles in the catalog, and the stale half of the queue has not refreshed them in eleven days. The likely reason is the `selected_at` behaviour described in section 1: they were picked, the fetch failed, and they wait another 30 days. I could not confirm this without MongoDB. It matters as the only evidence so far of how the stale path behaves in production.

### Season rows

```sql
select count(*), count(distinct show_id), min(updated_at), max(updated_at), sum(episode_count) from season
```

- `season` has 400,926 rows for **214,568 shows**, with 6,717,445 episodes summed over `episode_count`. On 2026-09-25 it had 364,462 rows.
- 214,213 shows have `number_of_seasons > 0`, and 212,761 have `number_of_episodes > 0` (sum 6,484,730). The remaining 19,000 or so shows have no seasons on TMDB or were never fetched.
- All 10,761 popular shows have `season` rows (61,699 rows, 2,329,054 episodes).
- The oldest `season.updated_at` is 2026-09-25 08:52; 311,684 rows were last written in September and 89,242 in October.

`season.updated_at` is the time the Crate row was last written by the copy, not the time TMDB was fetched. For season freshness, use the parent show's `tmdb_details_updated_at`.

### Currently airing popular shows

"Airing" here means `status = 'Returning Series'` and `last_air_date` in the last 14 days, as stored in Crate: 276 shows, 87 of them with popularity ≥ 10. Because `last_air_date` itself lags, this undercounts.

Of the 87 popular airing shows: 80 were last fetched more than 1 day ago, 65 more than 3 days ago and 32 more than 7 days ago.

Ten of the most popular were compared with live TMDB `GET /tv/{id}` on 2026-10-06 19:32:

| Show (TMDB id) | Fetched | Episodes Crate / TMDB | `last_air_date` Crate / TMDB |
| --- | --- | --- | --- |
| The Tonight Show (59941) | 10-05 02:33 | 2,421 / 2,424 | 09-27 / 10-05 |
| The Simpsons (456) | 10-02 19:34 | 806 / 806 | 09-27 / 10-04 |
| American Horror Story (1413) | 10-03 16:37 | 145 / 145 | 10-01 / 10-01 |
| Ted Lasso (97546) | 10-03 17:04 | 44 / 44 | 09-29 / 09-29 |
| Slow Horses (95480) | 10-03 14:32 | 36 / 36 | 09-30 / 09-30 |
| MobLand (247718) | 10-03 14:42 | 20 / 20 | 09-25 / 10-02 |
| Mushoku Tensei (94664) | 10-06 12:27 | 61 / 61 | 09-28 / 09-28 |
| Lanterns (95350) | 10-03 21:29 | 8 / 8 | 09-27 / 10-04 |
| Raw (4656) | 10-04 05:13 | 1,747 / 1,747 | 09-28 / 10-05 |
| The Daily Show (2224) | 10-02 17:43 | 4,280 / 4,280 | 09-24 / 09-24 |

- **Season lists match.** All ten shows have the same number of `season` rows as TMDB lists. `episode_count` matches on every season except The Daily Show season 31 (122 in Crate, 126 on TMDB).
- **Episode totals match on nine of ten.** TMDB's `number_of_episodes` and season `episode_count` include episodes that are scheduled but not yet aired, which is why they hold up better than the air date.
- **`last_air_date` is a week behind on five of ten.** That is what a fetch two to four days old looks like on a weekly show.

## 3. Windmill: not checked

I could not read Windmill job or schedule state.

- The repository holds no schedule definitions (`find f -name '*.schedule.yaml'` finds none), so the `10/15 * * * * *` schedule from the earlier note cannot be confirmed from the code.
- The installed `wmill` CLI does not start (`Module not found "https://deno.land/x/wmill@v1.763.0/main.ts"`).
- Reading the Windmill host over SSH was denied by this session's permission rules, and I did not look for another route.

So these stay open: whether the flow's schedule is enabled, its current failure rate, and how long step `a` takes now. The data shows the flow *did* run at full speed from 2026-09-25 to 2026-10-01; whether it is running today rests on the 09:00 burst alone.

## What must hold before an episode crawl relies on this

1. **Confirm the flow in Windmill.** Read the job history of `f/tmdb_api/tmdb_fetch_details_from_api`: schedule enabled, failure rate since 2026-09-25, duration of step `a`.
2. **Watch the first stale wave.** About 9,900 shows and 33,500 movies fall due on 2026-10-21, and 200k to 270k titles a day from 2026-10-25 to 10-30. The flow managed that rate once. Repeat the query in section 2 on 2026-10-22 and 2026-11-01; `stale30` for popular shows should stay at or near 0.
3. **Do not use the 30-day refresh as the trigger for airing shows.** A crawl that walks `season` rows to fetch episodes will see new seasons and episode counts up to 30 days late for most shows, and 3 to 15 days late for popular ones. Airing shows need their own, shorter cadence.
4. **Look at the 11 titles stuck since 2025-06 in MongoDB** (`selected_at`, `is_selected`, `tmdb_deleted`). If they are failed fetches waiting out `selected_at`, a show whose fetch fails twice goes 60 days without data, and the episode crawl inherits that.

## Method notes

- Crate was queried over its HTTP endpoint with the connection settings in `goodwatch-webapp/.env`, `SELECT` only, through scratch scripts that are not committed.
- One of my queries, a correlated `NOT EXISTS` between `season` and `show`, ran for more than two minutes. I sent a `KILL` for that one statement after checking its id and text in `sys.jobs`. The `KILL` reported 0 statements cancelled, and the statement was gone from `sys.jobs` three seconds later. I replaced it with an equi-join that took 0.4 s.
- TMDB was read ten times with the project's API key.
