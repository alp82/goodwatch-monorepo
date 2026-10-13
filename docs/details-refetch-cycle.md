# The 30-day refetch cycle of the TMDB details queue

Follow-up to the research for [#489](https://github.com/alp82/goodwatch-monorepo/issues/489). Every title's
details and streaming offers are fetched from TMDB again once in 30 days. Each title has a fixed second in those
30 days, so every day brings a thirtieth of the catalogue, about 50,000 titles, whatever happened before. Paths
under `goodwatch-flows/windmill/` are shortened to `f/...`.

## Why

Until this change a title was due 30 days after its last fetch, and the queue fetched due titles as fast as it
could, most popular first. Two things followed.

- **Titles fetched together came back together.** The catch-up of late September fetched 96% of the catalogue
  between 2026-09-25 and 2026-10-01. All of it would have come due again between 2026-10-25 and 2026-10-31: seven
  days at the flow's ceiling and 23 days with almost nothing, every month. An offer is dated with the day it is
  found, so a month of new offers would have carried the dates of one week.
- **Within such a week, the popular titles came first.** The catch-up fetched in order of popularity: of the
  118,000 titles with a popularity of 2 or more, 94% were fetched in its first two days. Fetching the same titles
  again in the same order at a slower pace would still have put most new offers into the first days of each
  cycle.

A second problem ended with the old rule. Its query fetched every title that TMDB deleted and that was older than
30 days, on each run, to reject it. Today that is 214 documents and half a second. About 112,000 deleted titles
were last fetched between 2026-09-21 and 2026-10-01 and would have joined them from 2026-10-21 on.

## Parts

| Part | Path | What it does |
|---|---|---|
| Cycle | `f/tmdb_api/refetch_cycle.py` | Says which TMDB ids are due in a second, and takes the titles due since the last run. |
| Queue | `f/tmdb_api/tmdb_fetch_details_from_api/next` | Each run of the details flow (every 15 s) fills its batch of 50: awaited titles, never-fetched titles, titles due in the cycle. |
| Shared queue | `f/data_source/common.py` | Lets a source bring its own titles to fetch again. IMDb, TV Tropes and DNA keep the rule "most popular title not fetched for N days". |
| Fetch, publication | `f/tmdb_api/tmdb_fetch_details_from_api/fetch`, `f/sync/copy/tmdb_streaming`, `f/sync/copy/tmdb_details` | Unchanged. |

There is no new flow, no new schedule, no new index and no change to a stored title.

## How it works

**A title's second.** The 30 days have 2,592,000 seconds. In second `s` (counted from 1970) the id
`s × 1,601,501 mod 2,592,000` is due, for movies and for shows, and so is every id that lies a multiple of
2,592,000 above it. The step is about 0.618 of the cycle and shares no factor with 2,592,000, which gives two
properties:

- Every id is due in exactly one second of a cycle, and again 30 days later to the second.
- The ids of any stretch of time are spread over the whole id range. Each day holds a thirtieth of every part of
  the range to within 0.1%. Low ids are old and well-known titles, high ids recent and obscure ones.

**The queue** keeps the time it has worked up to in one document, `{_id: "details", worked_until}` in the Mongo
collection `tmdb_details_refetch_cycle`. A run reads the ids of the seconds since then, looks them up through the
`tmdb_id` index, and takes the titles it finds.

- The seconds are counted from the last run, not from the schedule. A late or skipped run loses no title.
- A batch gives the cycle the room that never-fetched titles leave, and at least half. Titles that don't fit wait
  for the next run, in order. A second is taken whole.
- A run works at most 300 seconds through the cycle, 20 times the 15 seconds between two runs. After an outage
  the queue catches up at that pace, as far as its batches have room.
- A queue that stood still for more than 30 days goes back 30 days and no further.
- A title fetched within the last day is left out. That covers the awaited titles, which are fetched daily
  ([awaited-title-rechecks.md](awaited-title-rechecks.md)).
- A title that TMDB deleted is left out. A title TMDB lists again is fetched when its second comes.
- A never-fetched title is fetched at once, as before, and again when its second comes: between 0 and 30 days
  later the first time, every 30 days from then on.
- The first run ever stores the current time and takes nothing. The cycle starts there.

A title's last fetch no longer decides when it is due. That is what keeps the spread: a week of catch-up, an
outage or a bulk import changes when titles were last fetched, and not when they are due next.

## The numbers

Measured on 2026-10-12 on production (Mongo and the Windmill API, read-only).

| | |
|---|---:|
| Titles in the cycle (1,259,310 movies and 234,130 shows; 111,658 more are deleted on TMDB) | 1,493,440 |
| Due per day | 49,781 |
| Due per run of 15 seconds | 8.6 on average, 2 to 15 in a simulated two days |
| What a run reads to find them (one sampled stretch of 15 seconds) | 11 documents, 8 ms |
| What a run reads while catching up (one sampled stretch of 300 seconds) | 194 documents, 172 ms |
| Runs of the details flow per day | 5,760 |
| What the flow can carry: schedule (50 titles a run) / measured on 2026-09-29 | 288,000 / 272,949 |
| Duration of a run with 50 titles (2026-09-29) / with almost none (2026-10-11) | 14.1 s / 3.7 s |

- **Two simulated days took 49,892 and 49,731 titles** against 49,781 expected, on a local MongoDB with production's
  counts, id ranges and September's fetch order. 288 and 317 of them had a popularity of 2 or more, against 302
  for a thirtieth. No title was taken twice and no deleted one at all.
- **The cycle needs 18% of what the flow can carry,** with the 1,110 awaited titles and about 700 new titles a
  day: 51,600 of 288,000. A run with 9 titles should take about 6 seconds (3.7 for an empty run, 0.2 per title).
- **At the ceiling the flow has no reserve.** On 2026-09-29 the median run took 14.1 of its 15 seconds and 529
  of 5,760 runs took longer. 273,000 titles a day is what it sustains.
- **The awaited titles take 10 of 50 places** in the 111 runs after 07:00 Berlin. The cycle's 9 titles fit
  beside them; nothing waits.
- **Load on Crate follows the titles fetched.** In late September, at 270,000 titles a day, a run of
  `f/sync/copy/tmdb_streaming` took 22 to 25 minutes and one of `f/sync/copy/tmdb_details` 52 to 61. With almost
  nothing to publish they take 8 and 2 minutes. At 50,000 a day the estimate is 11 and 12 minutes, every day.
  Left as it was, the queue would have brought the September durations back for a week of every month.

## The first cycle

The cycle starts with the first run after the deploy. From then on each title is fetched when its second comes,
so the titles of September are between 13 and 53 days old at their next fetch. The figures below are for a start
on 2026-10-14; each day later adds a day to every age. They count the 1,493,000 titles that are not deleted, and
assume the deleted ones are spread over the September days like the others (a sample of 400 was).

| | Unchanged queue | Refetch cycle |
|---|---|---|
| Titles coming due per day | 41,600 on 10-21; 125,900 to 257,200 a day from 10-25 to 10-30; 61,000 on 10-31; about 2,000 otherwise | 49,800 every day |
| Order | Most popular first | A thirtieth of every kind each day |
| Age of a title at its next fetch | 30 days | 13 to 53 days in the first cycle (mean 31), 30 days after |
| Fetched earlier than 30 days after the last fetch | none | 46% of the titles, by up to 17 days |
| Fetched later | none | 54%, by up to 19 days (23 for the 41,600 titles of 09-21) |
| Titles older than 40 / 45 / 50 days at their fetch | none | 315,000 / 80,000 / 4,700, once |

Which half a title falls into depends on its id, not on its popularity. A popular title is as likely to wait 45
days as an obscure one. The awaited titles are not affected: they are fetched daily.

**What this means for offers and "newly available".** `created_at` of an offer is the time of the publication
that first wrote it, so a title fetched later has its new offers dated later.

- **Per day.** In steady state each day finds the offers that appeared on a thirtieth of the catalogue during 30
  days: as many as appear on TMDB in one day, and each between 0 and 30 days after it appeared (15 on average).
  That is the same delay as before, and it is now the same on every day.
- **In the first cycle** the amount rises with the age of the titles: about 0.6 days' worth of offers on the
  first day and 1.5 on the last, then 1.0. The unchanged queue would have found 4.3 days' worth on each of seven
  days and almost none on the other 23.
- **The worst case, once:** an offer that appeared right after a title's September fetch is found up to 49 days
  later (53 for the titles of 09-21), where 30 was the rule.
- **The 90-day totals don't change.** The same offers are found, spread differently. The limit of 20,000 titles
  per country in `availability-first-seen.server.ts` is therefore as close as before
  ([research](https://github.com/alp82/goodwatch-monorepo/issues/489)).
- **A title without offers** counts as checked for 30 days (`PROVIDER_CHECK_MAX_AGE` in `f/sync/copy/tmdb_streaming`).
  The rule is read when a title is published, and a title without offers is published after its fetch, so the
  ages of the first cycle don't touch it.

## Deploy and undo

Nothing has to be done on production besides deploying the code. No stored fetch time is changed.

1. Push before 2026-10-21, 06:00 UTC, when the first 41,600 titles of September turn 30 days old. The sooner, the
   lower the ages of the first cycle.
2. The first run after the deploy creates `tmdb_details_refetch_cycle` and stores the start. The run 15 seconds
   later fetches the first titles.

Undo: revert the commit. The queue then takes every title not fetched for 30 days again, most popular first, at
the ceiling: after 2026-10-25 that is every title the cycle has not reached yet. The state document can stay; it
is read by nothing else.

- **To let a backlog go** (after a long outage): set `worked_until` to the current time. The titles in between
  are fetched one cycle later.
- **To change the pace:** there is no setting. Every title once in 30 days is `CYCLE`; changing it moves every
  title's second.

## Checks

On the Mongo primary, database `goodwatch`. Both reads use an index only.

```js
// 1. The queue keeps up: worked_until is less than a minute old.
db.tmdb_details_refetch_cycle.findOne()

// 2. Titles fetched per day (documents by day of selected_at). Takes about 5 seconds.
for (const name of ["tmdb_movie_details", "tmdb_tv_details"])
  db[name].aggregate([
    {$match: {selected_at: {$gte: ISODate("2026-09-20")}}},
    {$project: {_id: 0, selected_at: 1}},
    {$group: {_id: {$dateToString: {format: "%Y-%m-%d", date: "$selected_at"}}, n: {$sum: 1}}},
    {$sort: {_id: 1}},
  ], {hint: "selected_at_1"}).forEach(day => print(name, day._id, day.n))
```

| When | What to see |
|---|---|
| Minutes after the deploy | `worked_until` exists and moves on with every run. Runs of the details flow succeed and return about 9 ids. |
| The first full day | Movies and shows together: about 51,600 documents with that day (49,800 from the cycle, 1,110 awaited, about 700 new). Each day from 09-21 to 10-01 has lost a thirtieth of its live titles. |
| Every day after | The same number, within a few hundred. No day above 60,000. |
| Windmill | 5,760 runs of `f/tmdb_api/tmdb_fetch_details_from_api` a day, none failed, about 6 seconds each. `f/sync/copy/tmdb_streaming` and `f/sync/copy/tmdb_details` at about 11 and 12 minutes, the same every day. |
| 2026-10-21 and 2026-10-25 to 10-31 | No rise. These are the days the unchanged queue would have run at its ceiling. |
| 30 days after the start | The days from 09-21 to 10-01 hold only the titles deleted on TMDB, about 112,000. Every later day holds about 51,600. |

## Limits

- A title is passed for one cycle if a run dies between storing `worked_until` and reserving its titles. That
  window is a few milliseconds.
- Two runs of `next` at the same moment would take the same titles and fetch them twice. A run of `next` takes
  about a second and the next one starts 15 seconds later.
- The first refetch of a new title comes between 0 and 30 days after its first fetch, not after exactly 30.
- The delay between an offer appearing on TMDB and in Crate stays 15 days on average for titles nobody waits
  for. The cycle makes it even; it does not make it shorter.
