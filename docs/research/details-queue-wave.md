# Should the 30-day details queue be spread out?

Research for [#623](https://github.com/alp82/goodwatch-monorepo/issues/623), part of map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365). Measured on 2026-10-15 between 18:00 and 19:30 UTC.
Read-only: Windmill preview jobs that only read Mongo and Crate, and GETs on the Windmill API. Nothing in flows,
schedules, Mongo, Crate, Windmill or Coolify was changed.

## Summary

1. **The queue is already spread out.** Commit `fbaad780` ([the 30-day refetch cycle](../details-refetch-cycle.md))
   gives every title a fixed second in the 30 days, derived from its TMDB id. It was deployed to Windmill on
   2026-10-12 at 18:41 UTC, and step `a` of `f/tmdb_api/tmdb_fetch_details_from_api` runs it. The cycle's state
   document says it has worked up to 2026-10-15 18:26 UTC, a few seconds behind real time. Mongo shows 50,281
   titles fetched on 2026-10-13 and 50,815 on 2026-10-14, against the 51,600 the design predicted.
2. **No wave is coming from 2026-10-25 to 2026-10-31.** Each day from 2026-10-16 to 2026-11-15 brings
   49,513 to 50,162 due titles (about 42,000 movies and 7,800 shows), computed title by title from production data.
   Without the cycle, the old rule would bring 117,495 to 245,075 titles a day from 2026-10-25 to 2026-10-30, and
   fewer than 700 a day from 2026-11-01 to 2026-11-10.
3. **The old rule would not have hit the 288,000 ceiling.** Its peak, 245,075 titles on 2026-10-28, is under the
   272,949 a day that the flow sustained on 2026-09-29. No title would have waited past 30 days. The cost of the
   wave would have been load on the publication and the dating of offers, not stale titles.
4. **The September catch-up cost the publication hours of runtime, but no measurement shows harm to the
   webapp.** From 2026-09-28, at about 270,000 fetches a day and with the code fixed during the catch-up,
   `f/sync/copy/tmdb_streaming` took 21 to 27 minutes a run and `f/sync/copy/tmdb_details` 46 to 68. Earlier,
   with older code, streaming runs took up to 153 minutes, 4 streaming and 2 details runs failed, and 6 scheduled
   streaming runs never started. A Crate replica checkpoint stalled from 2026-09-27 to 2026-10-14. The webapp's
   response times and error rate in those days can't be read with the access available here.
5. **The cycle costs a little every day instead of a lot for one week.** Since 2026-10-13, streaming runs take
   10.8 to 14.9 minutes (8 before) and details runs 4.0 to 8.7 minutes (1.5 before). No run failed.
6. **The cycle's price is one late first round.** Of the 1,495,385 live titles, 717,878 (48%) are refetched more
   than 30 days after their last fetch this time: 226,401 after more than 40 days, 31,535 after more than 45 and
   1,830 after more than 50 (at most 51.4). The mean is 30.2 days. From 2026-11-12, every title is 30 days old at
   its fetch.
7. **The signal of #456 goes silent in the United States either way, and that's the urgent problem.** The
   catch-up gave 92,300 US titles a new subscription, free or ads offer in 11 days, 28,676 of them on 2026-09-26
   alone. Under the cycle, about 470 US titles a day get one. Projected from two days of that rate, the 20,000-title
   limit of `readFirstSeen` is passed around 2026-11-07. The old rule's wave would have passed it around 2026-10-29.

**Recommendation: keep the refetch cycle and don't change the queue before 2026-10-21.** Spend the time on the
20,000-title limit of #456 instead, before about 2026-11-07, and correct the expectations in #375, which still
waits for a wave on 2026-10-25.

## How it was measured

| Source | What |
|---|---|
| Windmill API, GET | Deployed source of `f/tmdb_api/tmdb_fetch_details_from_api/next` and `f/tmdb_api/refetch_cycle`, the flow's modules, and runs of both publications since 2026-10-02. Windmill keeps about 14 days of job history, so the catch-up's runs are gone from there. |
| Crate `workflow_monitoring`, read | The monitoring ledger (see [workflow-monitoring.md](../workflow-monitoring.md)) has kept every observed job since 2026-09-09 without deleting. It gives start, duration and outcome of all 142 streaming and 74 details publication runs, plus the incidents. |
| Crate `streaming_availability`, read | Rows and distinct titles by day of `created_at`, from 2026-09-01, for all countries, and for the United States and Germany with offer types `flatrate`, `free` and `ads` (the types of #456). |
| Mongo, read | `tmdb_details_refetch_cycle`. `tmdb_movie_details` and `tmdb_tv_details` by day of `selected_at`. Every live title's TMDB id and last save (`updated_at`) through the covering index `updated_at_1_tmdb_id_1`. Last selection and popularity through the covering index `selected_at_1_updated_at_1_popularity_-1`. Titles deleted on TMDB (111,879) were read through `tmdb_deleted_1` and left out. No full collection scan ran. |
| Code | `f/data_source/common.py`, `f/tmdb_api/refetch_cycle.py`, `f/tmdb_api/tmdb_fetch_details_from_api/next.py` and `fetch.py` on `origin/main`, and the webapp's `availability-first-seen.server.ts`. |

**What couldn't be read:**

- **Sentry:** the build token in `goodwatch-webapp/.env.sentry-build-plugin` gets 403 on every read endpoint.
- **Grafana Cloud** (node metrics of all hosts, and the webapp's own metrics): the token in
  `goodwatch-metrics/.env` may write but not read ("invalid scope requested").
- **PostHog** was not checked.
- **Crate's `sys` tables** hold only the current state, not September's.

**How due dates were computed.** The cycle's due second of a title follows from its TMDB id: the second `s` with
`s × 1,601,501 ≡ tmdb_id (mod 2,592,000)`, taken after the cycle's state time and skipped by one cycle if the title
was fetched within the day before. The age at the fetch uses `updated_at`, which the fetch sets on a successful
save. It's a close stand-in for `selected_at`, but other writers also touch it: from 2026-10-02 to 2026-10-11, about 8,400
shows (4%) and 8,300 movies (under 1%) got a new `updated_at` without a new selection. Their ages are understated. The old rule's due date is `selected_at` plus 30 days, counted by hour. The ceiling and the
options were simulated hour by hour on those counts.

## 1. What the September catch-up did to production

### The publication runs

Runs from the monitoring ledger. Times are UTC. `f/sync/copy/tmdb_streaming` is scheduled four times a day,
`f/sync/copy/tmdb_details` twice. "Fetched" is the number of details documents whose last selection falls on that
day, counted on 2026-10-15. The refetch cycle has taken about a tenth of each September day since 2026-10-12, so
the September days held about 10% more at the time: 276,398 on 2026-09-28, as measured on 2026-10-12.

| Day | Fetched | Streaming runs (minutes) | Streaming failed | Details runs (minutes) | Details failed |
|---|---:|---|---|---|---|
| Sep 14 to 18 | | 35 to 53 (from 2026-09-14 21:32) | 3 on Sep 14 | under 1 | 0 |
| Sep 19 to 20 | | 0.4 to 1.2, one of 48.9 | 7 | under 1 | 0 |
| Sep 21 | 40,426 | 0.7, 1.3, 92.8, 127.4 | 2 (00:00 and 06:00, before fix `5d6653a6`) | 0.4, 5.0 | 0 |
| Sep 22 | 4,381 | 103.3, 109.6, 132.7, 142.6 | 0 | 7.4, 7.5 | 0 |
| Sep 23 | 5,447 | 46.0, 84.6, 114.6, 120.9 | 0 | 3.2, 7.0 | 0 |
| Sep 24 | 3,417 | 37.3 to 40.3 | 0 | 1.4, 1.5 | 0 |
| Sep 25 | 122,237 | 35.1, 37.9, then two of 152.5 (21:32) | 2 (both 152.5) | 1.5, 21.7 | 0 |
| Sep 26 | 245,208 | 18.2, 84.5 | 2 (both) | 59.4, 61.7 | 1 (14:00) |
| Sep 27 | 230,088 | 24.4, 26.2, 28.9 | 0 | 48.6, 72.5 | 1 (02:00) |
| Sep 28 | 249,254 | 24.6 to 27.0 | 0 | 63.8, 67.8 | 0 |
| Sep 29 | 247,259 | 22.8 to 25.4 | 0 | 58.0, 61.0 | 0 |
| Sep 30 | 237,006 | 20.6 to 24.9 | 0 | 45.5, 52.5 | 0 |
| Oct 1 | 63,189 | 9.7 to 22.0 | 0 | 27.1, 39.8 | 0 |
| Oct 2 to 11 | 571 to 689 | 7.3 to 9.5 | 0 | 1.5 to 17.6 | 0 |
| Oct 13 to 15 (cycle) | 50,281 / 50,815 / 40,045 (to 18:30) | 10.8 to 14.9 | 0 | 4.0 to 8.7 | 0 |

- **Six scheduled streaming runs never started:** 12:00 and 18:00 on 2026-09-25, 00:00, 12:00 and 18:00 on
  2026-09-26, and 00:00 on 2026-09-27. The runs before them were still busy. Three runs at 21:32 started outside
  the schedule.
- **The early catch-up ran on code that was changed during it.** Between 2026-09-21 and 2026-09-27, seven commits
  changed the publication: for example `b897cafc` (select scheduled titles once through indexes), `8cd25ffe`
  (publish in batches since the last run) and `d0f07704` (page the details copy by id). The runs from 2026-09-28
  on are the ones a wave would bring with today's code: **streaming 21 to 27 minutes, details 46 to 68 minutes**.
- **Not everything slow in September was the catch-up.** Streaming runs took 35 to 53 minutes from 2026-09-15 to
  2026-09-18, before it, after the repair of provider countries on 2026-09-14 (228,999 offers written that day),
  and failed from 2026-09-19 to the fix on 2026-09-21. The monitoring incident for the streaming publication opened
  on 2026-09-11.
- **No publication retried a write.** The ledger counts 0 publication retries in every run.

### Crate

- **A replica checkpoint stalled during the catch-up.** The monitor opened `crate_checkpoint_stalled` on 2026-09-27
  at 12:25 UTC, the second day at about 245,000 fetches, and reported recovery on 2026-10-14 at 22:35 UTC.
  [workflow-monitoring.md](../workflow-monitoring.md#crate-shard-and-disk-health) says a stuck checkpoint left
  `movie` shards 8 and 9 at 24 to 29 GB instead of 0.2 GB in September. That the write volume caused it is
  plausible and not shown.
- **Today the shards are healthy** (no checkpoint lag, translog 0 MB) and the fullest disk is at 33% (crate-02).
- **CPU, memory and IO of the Crate nodes in September** are in Grafana Cloud as node metrics, if its retention
  still holds them. They couldn't be read here.

### The webapp

**No measurement exists that I could read.** Sentry and Grafana Cloud refused the available tokens (see "How it was
measured"). The webapp's own metrics in Grafana Cloud were added for the viral spike map (#237), which started on
2026-10-03, so they likely don't reach back to September. The only
trace is the job `f/utils/visit_goodwatch_schedule`, which loads the homepage. The ledger holds 1 or 2 of its runs
a day. From 2026-09-21 to 2026-10-01, 1 of 15 failed (2026-09-21, after 132 seconds). From 2026-10-02 to
2026-10-15, 4 of 16 failed the same way. That is no sign of harm, and it's too thin to be a sign of none.

**To close the gap,** the owner can look at two places for 2026-09-21 to 2026-10-01:

- In Sentry, the event count of the `webapp` project.
- In Grafana Cloud, `node_load1` and disk IO of the Crate hosts and of the webapp host, for `job="vps_node_metrics"`.

## 2. Due dates from 2026-10-16 to 2026-11-15

The table lists, for each day, the live titles that come due under the cycle that runs today, and under the old
rule ("due 30 days after the last selection") if the cycle were reverted today. Titles deleted on TMDB are left
out, as both rules do. "Oldest title" is the longest time since a due title's last fetch. Under the old rule it's
30 days on every day. The old rule's counts for November 14 and 15 include only titles fetched up to today.

| Day | Cycle: movies | Cycle: shows | Cycle: total | Cycle: oldest title (days) | Old rule: movies | Old rule: shows | Old rule: total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Oct 16 | 42,151 | 7,786 | 49,937 | 26 | 0 | 0 | 0 |
| Oct 17 | 42,249 | 7,791 | 50,040 | 27 | 0 | 0 | 0 |
| Oct 18 | 42,250 | 7,841 | 50,091 | 28 | 0 | 0 | 0 |
| Oct 19 | 41,983 | 7,829 | 49,812 | 29 | 0 | 0 | 0 |
| Oct 20 | 41,986 | 7,819 | 49,805 | 30 | 0 | 0 | 0 |
| Oct 21 | 41,861 | 7,799 | 49,660 | 31 | 30,170 | 8,948 | 39,118 |
| Oct 22 | 42,084 | 7,789 | 49,873 | 32 | 4,015 | 362 | 4,377 |
| Oct 23 | 42,026 | 7,747 | 49,773 | 33 | 4,945 | 447 | 5,392 |
| Oct 24 | 42,051 | 7,821 | 49,872 | 34 | 3,005 | 309 | 3,314 |
| Oct 25 | 42,050 | 7,839 | 49,889 | 35 | 71,732 | 45,763 | 117,495 |
| Oct 26 | 41,905 | 7,860 | 49,765 | 36 | 167,042 | 45,904 | 212,946 |
| Oct 27 | 41,987 | 7,734 | 49,721 | 37 | 198,170 | 24,482 | 222,652 |
| Oct 28 | 42,320 | 7,842 | 50,162 | 38 | 228,854 | 16,221 | 245,075 |
| Oct 29 | 42,070 | 7,815 | 49,885 | 39 | 213,421 | 17,983 | 231,404 |
| Oct 30 | 42,306 | 7,834 | 50,140 | 40 | 189,456 | 44,336 | 233,792 |
| Oct 31 | 42,108 | 7,830 | 49,938 | 41 | 16,417 | 4,603 | 21,020 |
| Nov 1 | 42,126 | 7,803 | 49,929 | 42 | 550 | 80 | 630 |
| Nov 2 | 42,101 | 7,848 | 49,949 | 43 | 547 | 67 | 614 |
| Nov 3 | 41,763 | 7,820 | 49,583 | 44 | 480 | 83 | 563 |
| Nov 4 | 41,940 | 7,864 | 49,804 | 45 | 484 | 80 | 564 |
| Nov 5 | 42,007 | 7,787 | 49,794 | 46 | 499 | 89 | 588 |
| Nov 6 | 41,950 | 7,777 | 49,727 | 47 | 512 | 114 | 626 |
| Nov 7 | 42,109 | 7,842 | 49,951 | 48 | 562 | 107 | 669 |
| Nov 8 | 41,868 | 7,824 | 49,692 | 49 | 611 | 76 | 687 |
| Nov 9 | 41,732 | 7,781 | 49,513 | 50 | 538 | 113 | 651 |
| Nov 10 | 41,954 | 7,814 | 49,768 | 51 | 507 | 116 | 623 |
| Nov 11 | 42,024 | 7,808 | 49,832 | 51 | 9,786 | 1,781 | 11,567 |
| Nov 12 | 41,928 | 7,817 | 49,745 | 31 | 42,330 | 7,872 | 50,202 |
| Nov 13 | 42,170 | 7,861 | 50,031 | 31 | 42,783 | 7,952 | 50,735 |
| Nov 14 | 41,891 | 7,773 | 49,664 | 31 | 33,565 | 6,525 | 40,090 |
| Nov 15 | 42,151 | 7,786 | 49,937 | 31 | 0 | 0 | 0 |

**What the 288,000-a-day ceiling does:**

- **Under the cycle, nothing.** Every day holds about 49,800 titles. With 1,110 awaited titles and about 700 new
  ones, the flow fetches about 51,600 a day, 18% of the ceiling. Each run of 15 seconds takes about 9 titles.
- **Under the old rule, also nothing.** The flow sustained 272,949 titles a day on 2026-09-29 (288,000 is the
  schedule's limit). The peak, 245,075 on 2026-10-28, stays under both, so the simulation, hour by hour and most
  popular first, never builds a backlog. The queue runs at 43 to 90% of the sustained rate for 6 days, and no title
  waits past 30 days.
- **Had the cycle never shipped,** the wave would be about 10% larger, because the cycle has already refetched a
  tenth of the September titles. Measured on 2026-10-12, it was 125,900 to 257,200 titles a day from 2026-10-25 to
  2026-10-30, still under the sustained rate.

**How stale titles get under the cycle.** Only the first round is late, because the September titles are
refetched at their id's second, not 30 days after their fetch:

| Age at the fetch, days | Titles | Share |
|---|---:|---:|
| 30 or less | 777,507 | 52% |
| More than 30 | 717,878 | 48% |
| More than 40 | 226,401 | 15% |
| More than 45 | 31,535 | 2.1% |
| More than 50 (at most 51.4) | 1,830 | 0.1% |

The mean is 30.2 days. The longest waits come due from 2026-11-05 to 2026-11-11. From 2026-11-12 every title is
fetched 30 days after its last fetch. Ten titles had their last successful save in 2025 and aren't flagged as
deleted. They come due at their second like the rest, and their age (481 to 503 days) is left out of the figures.
Which titles wait longer depends on the id, not the popularity. The awaited titles are fetched daily and aren't
affected.

## 3. Ways to spread the queue

The cycle that runs today is the first row. "Do nothing" now means keeping it. The old meaning of "do nothing",
the rule before 2026-10-12, is the second row. All figures for 2026-10-16 to 2026-11-15 come from the production
counts of section 2.

| | Change in code | Write to production | Titles a day | Age at the fetch | Measured or simulated cost |
|---|---|---|---|---|---|
| **A. Keep the refetch cycle** (shipped in `fbaad780`, live since 2026-10-12) | None | None | 49,513 to 50,162 every day | First round: mean 30.2 days, 48% over 30, at most 51.4. Then 30. | Measured since 2026-10-13: streaming runs 10.8 to 14.9 min, details 4.0 to 8.7, no failure |
| **B. Revert to the old rule** | `git revert fbaad780`: `next.py` stops passing `refetch`, and `completeness_queue` in `f/data_source/common.py` again takes the most popular titles older than 30 days | None | 117,495 to 245,075 from Oct 25 to 30, 39,118 on Oct 21, under 700 a day from Nov 1 to 10. Repeats every month. | At most 30 days | From the catch-up's last days: streaming 21 to 27 min and details 46 to 68 min a run, for 6 days a month. 23 quiet days. |
| **C. Random interval per title** (30 ± J days) | `selected_at` can't carry a per-title interval in an indexed query. So: a new field `due_at` on both details models with an index, set in `fetch.py` at each save, and `stale_titles` in `common.py` reads `due_at < now` | 1.5 million `due_at` values, or none if the first wave stays as it is | Without the backfill: the first wave is B's, then smoother cycles. With it, J = 7: up to 93,912 a day for 12 days; J = 15: 44,000 to 49,000. | J = 7: at most 37; J = 15: at most 45, 232,000 over 40 | A backfill drawn as `selected_at + 30 ± J` makes about 176,000 titles (J = 15) overdue at once on a deploy on 2026-10-17. An outage still lines titles up; the jitter smooths that out only over several cycles. |
| **D. Daily cap, oldest first** | `completeness_queue` counts the day's stale fetches in a state document and stops at the cap. `stale_titles` sorts by `selected_at` (the index `selected_at_1_popularity_-1` exists). | None | Exactly the cap from Oct 26 | Cap 50,000: the backlog never clears, ages settle at about 46 days. Cap 60,000: at most 46, then 30. | Popular titles lose their head start. After an outage, the backlog drains at only the cap minus 50,000 a day. With a cap over the demand, the shape of a month returns (25 days at the cap, 5 quiet). |
| **E. Re-date `selected_at` once** (now minus a random 0 to 30 days) | A one-off script, no change to the queue | 1.5 million `selected_at` values | About 50,000 a day, like A | Like A | `selected_at` stops saying when a title was fetched. The 1-day skip of the awaited titles, #375's queries and the monitoring read it. The next outage or catch-up brings the wave back. With A live it changes nothing: the cycle reads `selected_at` only for the 1-day skip. |

**B to E only make sense if the cycle had to go.** A already gives E's shape without a write, keeps it through
outages (the due second doesn't depend on the last fetch), and is measured. C and D each need a new piece of state
and still let an outage bunch titles up again.

## 4. What the wave does to offer dates and to the signal of #456

An offer's `created_at` is the time of the publication run that first wrote it, not the time it appeared on TMDB.
A wave doesn't change how many offers are found. It changes the day they're dated.

**The September catch-up, measured in `streaming_availability`:**

| | 2026-09-21 to 2026-10-01 | Per day before it (Sep 4 to 13) | Per day after it (Oct 2 to 11) |
|---|---:|---:|---:|
| Rows created, all countries and types | 5,529,651 | 497 to 54,697 | 1,098 to 2,314 |
| Of them subscription, free or ads | 3,712,363 | 392 to 11,023 | 899 to 1,673 |
| United States, subscription, free or ads: rows | 217,025 | 33 to 476 | 100 to 160 |
| United States: distinct titles | 92,300 | 12 to 187 | 58 to 93 |
| United States: distinct titles on the peak day (Sep 26) | 28,676 | | |
| Germany: distinct titles | 38,256 | 6 to 145 | 18 to 30 |

The catch-up stamped, in 11 days, offers that had appeared over a long time: many titles hadn't been fetched for
more than 30 days (on 2026-09-25, #366 found 9,268 of 10,436 popular shows in that state). Every one of them looks like an arrival of late September.
The launch of #456 on 2026-10-12 is set after the catch-up for that reason (`LAUNCH` in
`availability-first-seen.server.ts`).

**Under the cycle, measured since 2026-10-13:** the United States gets 453, 486 and 467 titles a day with a new
subscription, free or ads offer (Germany 106, 115 and 87). That is five to eight times the days before the cycle,
because the queue now checks 50,000 titles a day instead of about 650. Since the launch the United States has
1,628 such titles, 8% of the limit.

**The 20,000-title limit of `readFirstSeen` is passed either way.** The function announces nothing for a country
once more than 20,000 titles have a new offer since the launch (later: in the last 90 days). The projection below
assumes that the titles found per day grow with the age of the titles fetched that day, at the rate measured on
2026-10-13 and 2026-10-14: about 29 US titles per day of age. It's a projection, not a measurement.

| | United States passes 20,000 titles | US titles a day after the first round |
|---|---|---|
| Cycle (today) | About 2026-11-07, during the late first round | About 875, so about 79,000 in 90 days |
| Old rule (B) | About 2026-10-29, on the 5th day of the wave | 0 to 4,300, by day of the month |

With either rule, "newly available" goes silent in the United States in November and stays silent. The cycle
gives it about 9 more days and dates arrivals evenly. The wave would put a month of arrivals into 6 days of
dates, every month, in every country.

**What a date means under the cycle.** In steady state, a title's offer is found between 0 and 30 days after it
appeared, 15 on average, and dated the day it's found. In the first round, up to 51 days. "Newly available" can say
"found on this day", not "arrived on this day". The [offer-arrival research](https://github.com/alp82/goodwatch-monorepo/blob/research/offer-arrival-freshness/docs/research/offer-arrival-freshness.md)
(option 1, discover lists) is what would give the day of arrival.

## Recommendation

1. **Keep the refetch cycle. Don't change the queue before 2026-10-21.** The spreading the owner is deciding on
   has been running since 2026-10-12, stays within 0.7% of its mean on each of the 31 days, and costs 2 to 6 minutes
   more per publication run, measured, with no failure.
2. **Replace the 20,000-title limit of #456 before about 2026-11-07.** It is the deadline that remains. The
   limit was sized on 80 US titles a day; the cycle brings about 470 now and about 875 after the first round. The
   offer-arrival research suggests telling a catch-up apart by how many offers appear on one day. A cap per day,
   for example 5,000 US titles, would have caught each day of the September catch-up from 2026-09-25 to
   2026-09-30 (5,862 to 28,676 titles), while 875 a day passes. That needs its own ticket.
3. **Correct #375.** Its latest comment expects 9,027 popular shows on 2026-10-25 and plans its counts around the
   wave. Under the cycle the popular shows come due evenly. The checks of
   [details-refetch-cycle.md](../details-refetch-cycle.md#checks) apply instead.

## Checks for the coming days

| When | What to see |
|---|---|
| Every day | `tmdb_details_refetch_cycle.worked_until` less than a minute old. About 51,600 details documents with that day's `selected_at`. |
| 2026-10-21 and 2026-10-25 to 2026-10-31 | No rise in fetches, and streaming runs at 11 to 15 minutes, details runs under 10. These are the days the old rule would have peaked. |
| 2026-11-05 to 2026-11-11 | The longest waits of the first round (up to 51 days). Nothing to do. |
| From 2026-11-12 | Every title 30 days old at its fetch. |
| Weekly until the limit is replaced | US titles with a subscription, free or ads offer created since 2026-10-12 (`count(DISTINCT ...)` on `streaming_availability`), against 20,000. |

## Not measured

- **The webapp's response times and error rate** from 2026-09-21 to 2026-10-01 (Sentry and Grafana Cloud weren't
  readable).
- **Crate's CPU, memory and IO** in September, and whether the write volume caused the stalled checkpoint.
- **Evidence rows written per publication** during the catch-up and under the cycle.
- **The arrival rate per day of age** beyond two days of measurement. The dates in the #456 table move with it.
- **PostHog's Web Vitals** for the catch-up days.
