# Can an availability history be day-accurate?

Research for [#678](https://github.com/alp82/goodwatch-monorepo/issues/678). It builds on
[offer-arrival-everywhere.md](offer-arrival-everywhere.md) ([#624](https://github.com/alp82/goodwatch-monorepo/issues/624)).

The owner's decisions so far (2026-10-16):

- Data: discover the 15 big brands in every country first (option 3), then every list (option 1).
- The daily recheck of recent releases is built now, in [#679](https://github.com/alp82/goodwatch-monorepo/issues/679).
- Page wording is variation A of [#625](https://github.com/alp82/goodwatch-monorepo/issues/625), a day per arrival, everywhere.
  Where the day isn't exact, a title says only "New on Netflix", with no date.
- An info icon shows the date of the last update, with no sentence about TMDB's delay.
- Instead of a per-day rule for [#637](https://github.com/alp82/goodwatch-monorepo/issues/637), the owner leans toward an
  availability history: one record per title, country, service, and offer type, with the day it appeared and the day
  it was dropped, each marked exact or unknown.

Measured on 2026-10-16 from 21:50 to 22:35 UTC. A small measurement keeps running on the owner's
machine until 2026-11-06 (see [What the running measurement adds](#what-the-running-measurement-adds)). Nothing was
built and nothing was written to production: read-only queries on Crate, and about 20,000 GETs on the TMDB
API with the local development key.

**Real day**: the day a service starts or stops offering a title in a country. For originals it's the premiere. For
licensed titles on Netflix US it's the date in What's on Netflix's monthly lists.

**TMDB day**: the first UTC day on which TMDB's API shows the change.

**Exact**: a history record whose day was seen by a read the day before that showed the opposite. Every other record
has a range: "between these two reads".

## Summary

1. **A history can be exact to TMDB's day, not to the real day.** A record is exact when the title or list was read
   the day before. That works for every list read daily (option 3, then 1) and every title rechecked daily (#679).
2. **TMDB's day is one day after the real day for every Netflix US arrival seen so far.** The Storm, Transformers One,
   and Hollywood Arts arrived on Netflix US on 2026-10-15 and reached TMDB on 10-16. The 6 Netflix US arrivals of
   10-16 were not on TMDB at 22:00 UTC that day. JustWatch showed the three of 10-15, and two of those of 10-16, on
   the real day, so the day is lost between JustWatch and TMDB. Variation A would say "today" for titles that arrived
   yesterday. Two Prime Video originals of 10-16 were on TMDB the same day.
3. **For originals, the real day is in TMDB's own data.** A show's `first_air_date` or a movie's digital release date
   is the day the service starts it. A record can take that day when the service is the original's network and TMDB
   lists it within a few days.
4. **The departures seen so far reached TMDB on the day.** 58 of 62 announced Netflix US departures of 2026-10-01 to 10-16 are gone from
   TMDB. Snake Eyes and The Squid and the Whale, due on 10-16, vanished between 12:58 and 22:00 UTC that day. The other
   4 were still listed 0 to 4 days after their day (Detroiters' day was unconfirmed), and JustWatch still lists Kid Cannabis (due 10-12) on Netflix too. Either the
   departure moved or both are late; only the service could say.
5. **TMDB's API answers from a CloudFront cache that can be up to 7.7 hours old.** `Cache-Control: max-age` is fixed
   per URL, between 0 and about 28,000 seconds. A plain read can return a copy from hours earlier, and the pages of
   one list can be of different ages. An unknown query parameter bypasses the cache. GoodWatch's fetches don't.
6. **So #624's batch time, "11:30 to 12:00 UTC", is not reliable.** Those reads used plain URLs. The change could
   have happened hours before it showed. The running measurement reads fresh every 30 minutes.
7. **Read fresh, a list is almost complete with one sort.** On 10-16 at 22:02 UTC, the 60 lists read fresh missed
   10 of 156,030 entries sorted by title and 279 sorted by date. 58 of 60 matched `total_results`. Dates have many
   ties, and tied titles shift across pages.
8. **A drop needs a per-title check before it counts.** A title that vanishes from a list is rechecked with one
   `/watch/providers` request, which covers every country. It also catches the titles a sort missed. The first
   two fresh daily reads meet on 2026-10-17 at 20:00 UTC, so the share of false drops and of returns is not in yet.
9. **New originals reach countries on different days.** TYSON was listed in 53 countries on 10-15 and 131 on 10-16.
   Hollywood Arts is in 55 of Netflix's countries a day after its premiere. A per-country record would give one
   original several days, all exact. Point 3 gives them one.
10. **Storage is small.** 10.4 million current subscription, free, and ads offers become 10.4 million records, about
    2 GB. Growth is under 10,000 records a day.
11. **The history can replace the limit of #456 before the United States crosses it, around 2026-11-23.** The US has
    2,109 titles since the launch (475 a day). The first step needs no new fetch: the existing offer writer opens and
    closes records, and the signal reads exact records only. That's about two weeks of work.

## How it was measured

- **Announced days.** What's on Netflix's US lists for
  [October arrivals](https://www.whats-on-netflix.com/coming-soon/first-look-at-whats-coming-to-netflix-in-october-2026/),
  [October departures](https://www.whats-on-netflix.com/news/whats-leaving-netflix-october-2026/),
  [November arrivals](https://www.whats-on-netflix.com/coming-soon/first-look-at-whats-coming-to-netflix-in-november-2026/),
  and [November departures](https://www.whats-on-netflix.com/leaving-soon/whats-leaving-netflix-in-november-2026/),
  read on 2026-10-16. 199 titles were matched to TMDB ids by title and year (`netflix_us_schedule.tsv`).
  Three wrong matches were removed by hand.
- **Originals.** 84 shows and movies of Netflix, Disney+, Apple TV, Prime Video, HBO Max, Hulu, Paramount+, and
  Peacock that premiere from 2026-10-01 to 2026-11-15, from discover by network (shows) and by studio with a digital
  release (movies).
- **JustWatch.** One read of JustWatch's public
  [new on Netflix US](https://www.justwatch.com/us/provider/netflix/new) page and one title page, on 2026-10-16
  at about 22:00 UTC. JustWatch was not read by a script.
- **Cache.** Response headers of discover, `/watch/providers`, and title details, with and without an extra query
  parameter.
- **Lists.** The 60 lists of #624 (155,702 entries), read fresh and sorted two ways on 2026-10-16 at 22:02 UTC, and
  compared with the 10 cached reads of 10-15 and 10-16.
- **Crate.** Table sizes from `sys.shards` and the count of US titles since the launch, read-only.
- **Code.** The offer writer and the signal on `origin/main` at `d2183c9d`.

The scripts are in [availability-history-measure/](availability-history-measure/).

## Findings

### 1. TMDB's day against the real day

The following table lists the Netflix US titles with an announced day near the measurement. "TMDB" is the first
read that showed the change. The reads of 10-15 18:44 to 10-16 12:58 were cached (see finding 3), the read of 10-16
22:00 was fresh.

| Title | Kind | Real day | JustWatch day | TMDB |
|---|---|---|---|---|
| Cocaine Bear | Licensed movie | 10-14 | 10-14 | By 10-15 18:44 (+1 or less) |
| Transformers One | Licensed movie | 10-15 | 10-15 | After 10-16 12:58 (+1) |
| The Storm | Original movie | 10-15 | 10-15 | By 10-16 11:56 (+1) |
| Hollywood Arts | Original show | 10-15 | 10-15 | After 10-16 12:58 (+1), 55 countries |
| Sacrifice | Original movie | 10-16 | 10-16 | Not at 10-16 22:00 |
| Norm: The Tale of Norm Macdonald | Original movie | 10-16 | 10-16 | Not at 10-16 22:00 |
| Seriously Too Single, Therapy Done Right | Original movies | 10-16 | Not seen | Not at 10-16 22:00 |
| Heat, The Fate of the Furious | Licensed movies | 10-16 | Not seen | Not at 10-16 22:00 |
| Snake Eyes, The Squid and the Whale | Licensed movies, leaving | 10-16 | | Gone between 10-16 12:58 and 22:00 (0) |
| The Smurfs 2 | Licensed movie, leaving | 10-15 | | Gone by 10-15 18:44 (0) |
| Death Note | Licensed show, leaving | 10-15 | | Still listed on 10-16 22:00 |

- **Netflix arrivals came one day late on TMDB, every time a day could be told.** None was seen on TMDB on its real
  day. Cocaine Bear's day could not be told.
- **JustWatch had the real day.** Its "new" page dated The Storm, Transformers One, Hollywood Arts, and Cocaine Bear
  on their real days. Sacrifice and Norm were on it at 22:00 UTC on 10-16.
- **JustWatch's "new" dates aren't always arrivals.** Of the 6 titles it dated 10-16 that could be checked, 4 (The
  Shallows, The Girl with the Dragon Tattoo, Paddington in Peru, and The Adam Ray Show) had been on TMDB since at least
  10-15 18:44, a day before JustWatch's date. JustWatch
  also dated some titles a day after What's on Netflix (Save Yourselves!, Lucky, Rumours).
- **Departures were on the day.** The 3 departures with a known time left TMDB on or before their real day.
- **Prime Video was on the day.** Prime Video's Masterplan and Friends Sex and Games (10-16) were on TMDB at
  22:00 UTC on 10-16 in 13 countries. When in the day they came is not known yet.
- **The sample is small.** 4 arrivals with a TMDB day, 3 departures. The running measurement reads 283 titles with an
  announced day every 30 minutes as their day comes, which gives the spread and the hour by 2026-10-24.

TMDB shows all 35 Netflix US arrivals announced for 10-01 to 10-14, and 53 of the 55 departures of the same period
are gone.

### 2. Originals and countries

38 originals premiered from 2026-10-01 to 10-16 on the 8 networks. On 10-16 at 22:00 UTC:

- Netflix: 12 of 16 listed (11 in the US), 9 of them in 130 or 131 countries. Least Eligible Bachelor (10-09), Hunting Gary
  Glitter (delayed by Netflix), Money Trap (10-16), and The Great Hang-jun (10-15) were not listed.
- Other networks: 14 of 22 listed (9 in the US), in 1 to 83 countries. Traffic Jam (Prime Video, 10-01) is still not listed
  after 15 days.
- TYSON went from 53 countries on 10-15 to 131 on 10-16. Hollywood Arts was in 55 countries a day after its premiere.

So a per-country record of a global original can carry different days in different countries, each exact by its
own read. For an original whose network is the service, the premiere date is a better day than any read:
`first_air_date` for shows, the earliest digital release (type 4) for movies. TMDB has both for every original found.

### 3. TMDB's cache

Every TMDB API response is served by CloudFront with `Cache-Control: public, max-age=N`:

- `N` is fixed per URL and doesn't count down. It ranged from 0 to 27,666 seconds (7.7 hours) over 6 discover pages,
  and was 11,300 and 26,292 for two `/watch/providers` URLs.
- A repeated plain read was `Hit from cloudfront` with an `Age`. The same URL with an unknown parameter (`cb=…`) was
  `Miss from cloudfront` and carried the same `ETag`, so the content is the origin's.
- GoodWatch's details fetch (`f/tmdb_api/tmdb_fetch_details_from_api/fetch.py:129`) and provider crawl send plain
  URLs, so they may store a copy that is hours old. For the 30-day cycle that doesn't matter. For a daily job that
  wants the day, it does: a change made after the cached copy can show up a day late.
- A list read page by page from the cache mixes copies of different ages. When TMDB changes the list between those
  copies, titles shift across page borders and some are missed or seen twice. That is a likely cause of the paging
  misses of #624.
- The batch time of #624 came from plain reads. A cached copy can be up to 7.7 hours old, so the change could have
  happened any time from about 03:15 to 11:56 UTC on 10-16.

### 4. Lists read fresh

The 60 lists of #624 were read fresh on 2026-10-16 from 22:02 to 22:15 UTC, outside the hours of #624's change.
Each list was read twice, sorted by title (`title.asc`, `name.asc`) and by date (`primary_release_date.desc`,
`first_air_date.desc`). Lists over 10,000 titles were read in date spans.

| Read | Lists complete | Entries missed |
|---|---:|---:|
| Fresh, sorted by title | 56 of 60 | 10 of 156,030 (0.006%), in 4 lists |
| Fresh, sorted by date | 35 of 60 | 279 (0.18%), in 25 lists |
| Fresh, both sorts together | 58 of 60 | 0 against `total_results` overall; 1 short in one list, 1 over in another |
| Cached, sorted by title, 10-16 11:56 and 12:41 (#624) | 50 and 34 of 60 | About 0.5% |

- **Title sort is the one to use.** It missed 7 of the 26,122 Prime Video US movies and 3 other entries. The date
  sort missed most in the largest lists: 72 in Prime Video US movies, 65 in Netflix France movies.
- **The per-title check covers the rest.** A missed title looks like a drop, and the per-title check of every drop
  says it's still there. So one sort plus the check is enough, and a second sort isn't worth its cost.
- **Cost:** 15,690 requests for 60 lists twice, in 13 minutes at 6 parallel requests, with 2 retries and no refusals.
  Option 3 with one fresh sort stays at about 141,000 requests a day.
- **Not yet compared:** fresh and cached reads at the same hour. The fresh read was outside TMDB's change, the cached
  ones of #624 inside it.

### 5. Drops and fetch errors

What is known now:

- **A drop in one read can be a fetch error, even when read fresh.** In the cached reads of #624, The Storm was
  listed at 11:56 and 12:41, missing at 12:58, and listed again at 22:00. The fresh read of Netflix US movies at
  22:01 UTC on 10-16 returned 4,740 of 4,741 titles; Interceptor (2022) was missing and was back at 22:30. Only the
  per-title check tells a drop from a miss.
- **The rule for a drop:** a title missing from a complete or near-complete list is rechecked with `/watch/providers`,
  read fresh. It's dropped only when that check has no subscription, free, or ads offer of the service in the
  country. Then `dropped_on` is the day of the read, and it's exact when the previous day's read listed it.
- **A short list doesn't tell drops.** When a list returns fewer titles than `total_results` by more than a handful,
  its drops wait for the next day. Its arrivals still count after the per-title check.
- **A change of offer type counts as a drop.** A title that goes from subscription to rent leaves the "New on" set.
- **Returns are a new record.** The daily read records titles that come back after a confirmed drop, and after how
  many days.

What the running measurement gives from 2026-10-17: per day, how many drops the per-title check confirms and how many
it rejects, and how many confirmed drops return within 1, 2, 7, and 14 days.

### 6. Storage

The current tables, from `sys.shards` (primary shards only):

| Table | Rows | Size |
|---|---:|---:|
| `streaming_availability` | 18,945,074 | 5,897 MB (311 bytes a row) |
| `streaming_evidence` | 9,253,186 | 6,920 MB |

Of the offers, 10,417,570 are subscription, free, or ads in 139 countries. Buy and rent are 8.5 million more.

A history record has 6 key columns and 4 small columns (see [Table design](#table-design)), about half a current row.
At about 160 bytes a record:

- Start: 10.4 million records, about 1.7 GB, from the current offers.
- Growth: TMDB's lists change by about 3,000 arrivals and 1,000 departures a day (#624). The 30-day cycle finds 6,800
  to 8,000 new offers a day, most of them backlog. A new record per arrival and a closed record per drop is under
  10,000 writes a day, about 0.6 GB a year.

### 7. How the current data feeds it

- **One writer.** `f/sync/copy/tmdb_streaming.py` is the only writer of `streaming_availability`. It already computes
  the changed rows and the removed rows per title (`publication_writes`, lines 486 to 488), upserts the first and
  deletes the second (lines 582 to 592, 663 to 673). Opening a record on insert and closing it on delete is the same
  place.
- **`created_at` survives an upsert but not a delete.** An offer that ends and returns gets a new `created_at`. A
  history keeps both stays.
- **The day of a per-title change is the TMDB check, not the copy run.** The writer runs on changes since a watermark,
  about every 11 minutes, so the copy time is close. The check time is in `watch_providers_attempted_at`.
- **Exactness from the 30-day cycle.** A title the cycle refetches was last checked about 30 days before, so a new
  offer found there has a range of 30 days: "New on Netflix", no date. A title also checked the day before, by #679
  or by a daily list, gets an exact day.
- **Backfill.** Every current offer becomes an open record whose day is `date(created_at)`, marked unknown.

### 8. Time to ship

By 2026-10-16, the US had 2,109 titles counted since the launch on 2026-10-12 (226, 451, 482, 477, and 475 a day).
At 475 a day it crosses 20,000 about 38 days later, around 2026-11-23, as #624 said.

| Step | Needs | Size |
|---|---|---|
| 1. Table, backfill, and the writer opening and closing records | Crate table, one INSERT … SELECT, a change in `tmdb_streaming.py` | Small |
| 2. The signal reads exact records only, no limit | `availability-first-seen.server.ts` and its tests | Small |
| 3. #679 rechecks recent releases daily | Separate thread | In progress |
| 4. Daily discover of the 15 brands, writing records with a per-title check | New Windmill job | Medium |
| 5. Originals take their premiere day | Rule in step 1 or 4 | Small |

Steps 1 and 2 replace the limit. They give exact days only where a title was checked the day before, which today is
#679's titles and nothing else, so until step 4 most arrivals show "New on Netflix" without a date. Steps 1 and 2 fit
before 2026-11-23 with room. If they slip, the stopgap is the per-day rule of #624: skip a country's day when it
holds more than 1% of the country's catalogue.

## Table design

A Crate table `availability_history`, one record per stay:

| Column | Type | Meaning |
|---|---|---|
| `media_tmdb_id`, `media_type`, `country_code`, `streaming_service_id`, `streaming_type` | Key | As in `streaming_availability` |
| `appeared_on` | DATE, key | The first day the offer was seen |
| `appeared_after` | DATE | The last day before `appeared_on` on which a read saw no offer, or null |
| `appeared_source` | TEXT | `list` (daily discover), `title` (per-title check), `premiere`, or `backfill` |
| `last_seen_on` | DATE | The last day a read saw the offer |
| `dropped_on` | DATE | The first day a confirmed read saw no offer, or null while it lasts |

Primary key: the five offer columns plus `appeared_on`. A return is a second record. Clustered by `media_tmdb_id`
into 12 shards, the shard count of `streaming_availability`.

- **Exact is derived, not stored.** An arrival is exact when `appeared_after = appeared_on - 1`, and a drop when
  `last_seen_on = dropped_on - 1`. A range of 2 to 7 days is still known to the day it ended, which leaves room for
  wording later.
- **Days are TMDB days**, the UTC day of the read, except `premiere`, which is the original's premiere date.
- **Two sources write the same table.** The offer writer (per-title checks) and the daily list job. The earlier read
  wins for `appeared_on`, the later for `appeared_after`.
- **Reads for the pages:** "New on" is `appeared_on` within the window and exact. "Left Netflix" is `dropped_on`
  exact. "Available since at least" is any open record.

## What the running measurement adds

A measurement runs on this machine from `~/.local/share/goodwatch-availability-measure/` (cron, UTC), until
2026-11-06:

- Every 30 minutes: the offers of the titles with an announced day within the last 5 or next 3 days, fresh and
  cached, plus the full Netflix US lists, fresh. About 29,000 requests a day.
- Every day at 20:00: the 60 lists read fresh and sorted two ways, with a per-title check of every change. About
  17,000 requests a day.

It answers:

| Question | First numbers | Final |
|---|---|---|
| When in the day TMDB changes offers, and whether it's the same hour daily | 2026-10-18 | 2026-10-24 |
| TMDB's day against the real day, for about 120 announced arrivals and departures, movies and shows | 2026-10-20 | 2026-11-06 (covers 11-01) |
| How long a cached copy lags the fresh one | 2026-10-18 | 2026-10-24 |
| How often a fresh list is incomplete, and with which sort | 2026-10-18 | 2026-11-06 |
| Drops that are fetch errors, and drops that return | 2026-10-19 | 2026-11-06 |
| A big arrival and departure day (2026-11-01, 50 announced Netflix US departures) | 2026-11-02 | 2026-11-06 |

To read the results, run `python3 ~/.local/share/goodwatch-availability-measure/bin/summarize.py`.

## Decisions for the owner

1. **Which day the page shows for licensed titles:** TMDB's day as it is (one day late on Netflix so far), or TMDB's
   day minus one once the running measurement shows a steady delay of one day?
2. **Originals take their premiere date** as the exact day when the service is their network: yes or no?
3. **Fresh reads:** the daily list job and #679 add an unknown query parameter to bypass TMDB's cache: yes or no?
4. **Returns:** does a title that comes back after a drop count as "New on" again? Decide when the return numbers
   are in (2026-11-06).
5. **Build order:** steps 1 and 2 of [Time to ship](#8-time-to-ship) now, to replace the limit before 2026-11-23,
   then the daily list job: yes or no?
6. **The running measurement:** keep it until 2026-11-06 (about 46,000 TMDB requests a day from this machine), or stop
   it earlier?

## Not measured

- Services other than Netflix US against a real day, except for originals.
- Countries other than the US against a real day.
- What happens at the service between JustWatch and TMDB. Only the delay is visible.
- Whether TMDB tolerates fresh reads (cache misses) at the volume of option 1.
