# Day-accurate offer arrivals for a "new on <service>" page

Research for [#489](https://github.com/alp82/goodwatch-monorepo/issues/489), prototype C (a public page per country
and service). Measured on 2026-10-12. Nothing was built and nothing was written to production: read-only queries on
Crate and Mongo, GETs on the Windmill API, and about 8,500 GETs on the TMDB API with the local development key.

**Arrival**: the first time a service carries a title in a country. Crate keeps it as `created_at` of the
`streaming_availability` row, which is the time of the publication run that first wrote the row, not the time the
offer appeared on TMDB.

## Summary

1. **Crate finds about one arrival in seven, and finds it late.** For 9 large US services TMDB lists 2,971
   arrivals that Crate does not have, collected over the 16 to 17 days since the last full check: about 180 a day.
   Crate found 25 a day for the same services from 2 to 11 October.
2. **TMDB's change feeds do not report offer changes.** No change key for offers exists, and 18 to 20% of the titles
   that got a new offer have no logged change at all.
3. **TMDB's discover endpoint does.** It lists what one service carries in one country, 20 titles a request. The
   title endpoint confirmed 531 of 536 sampled differences (99%). Comparing two daily lists gives the arrivals of
   that day, for 400 requests in the case of Netflix in the United States.
4. **Rechecking titles one by one is expensive on Crate, not on TMDB.** Each recheck of a popular title rewrites
   about 100 evidence rows whether or not anything changed. A daily recheck of the 525,000 titles that would cover
   96 to 98% of arrivals would rewrite about 9 million rows (6.6 GB) a day.
5. **Recommended: watch the page's services through discover and recheck only the titles that changed.** About
   10,000 requests a day for the 10 largest subscription services of the United States and Germany, and at most
   48,000 for every subscription, free and ads service of both. An arrival is in Crate at the latest about 27 hours
   after TMDB lists it.
6. **Two risks need a decision whatever is chosen.** The signal of #456 turns itself off for a country once more
   than 20,000 titles have a new offer in 90 days; the United States will pass that as soon as arrivals are found at
   their real rate. And the 30-day queue does not run evenly: the whole catalogue comes due again between
   2026-10-25 and 2026-10-31, which stamps a month of arrivals with those seven days.

## How it was measured

| Source | What |
|---|---|
| Mongo, read-only | Counts of `tmdb_movie_details` and `tmdb_tv_details` by `selected_at` day and popularity |
| Crate, read-only | Counts of `movie`, `show`, `streaming_availability`, `streaming_evidence`; `created_at` by day; table sizes from `sys.shards` |
| Windmill API, GET | The 56 runs of `f/sync/copy/tmdb_streaming` and 28 of `f/sync/copy/tmdb_details` since 2026-09-28: duration, rows, logs |
| TMDB API, GET | `/{movie,tv}/{id}/changes` (546 requests), `/discover/{movie,tv}` (about 7,000), `/{movie,tv}/{id}/watch/providers` (about 900) |
| Code | `f/data_source/common.py` (queue), `f/tmdb_api/tmdb_fetch_details_from_api/fetch.py`, `f/sync/copy/tmdb_streaming.py`, the webapp's `availability-first-seen.server.ts` |

The measuring scripts stayed outside the repository. The first recheck of the awaited titles this morning is used
as a natural experiment: 1,093 titles last checked 11
to 17 days earlier were fetched at 09:03 Berlin and published at 14:00
([awaited-title-rechecks.md](../awaited-title-rechecks.md)).

## Findings

### 1. The catalogue and how the queue cycles

| | Movies | Shows |
|---|---:|---:|
| Titles in Crate | 1,259,825 | 234,228 |
| Details documents in Mongo (of them flagged deleted on TMDB) | 1,356,281 (96,971) | 248,817 (14,687) |
| With an offer in any country | 284,499 | 76,514 |
| With a subscription, free or ads offer in any country | about 256,000 | about 74,000 |
| With an offer in the United States / Germany | 172,737 / 86,768 | 37,574 / 22,419 |

`streaming_availability` holds 18.9 million rows (6.0 GB) in 139 countries; 10.4 million are subscription, free or
ads offers. `streaming_evidence` holds 9.2 million rows (6.6 GB).

The details flow runs every 15 seconds and fetches 50 titles: never-fetched titles first, then the most popular
titles whose last fetch is more than 30 days old. One request per title returns the details and the offers of every
country. Its ceiling is 288,000 titles a day.

- **96% of the catalogue was last fetched in seven days,** 2026-09-25 to 2026-10-01: 1,301,029 movies and 235,535
  shows, up to 276,398 titles on one day (2026-09-28).
- **Since 2026-10-02 the flow fetches 630 to 760 titles a day:** new titles and the priority path. The awaited
  titles add 1,110 from today.
- **So the catalogue is 11 to 17 days stale today,** and it will be 24 to 30 days stale just before the queue
  reaches it again.
- **The queue does not spread its work.** Every title becomes stale 30 days after its fetch, so the seven days of
  late September come back as seven days at the ceiling from 2026-10-25, and the 44,749 titles of 2026-09-21 on
  2026-10-21. The average is 50,000 titles a day; the shape is 23 quiet days and a week at 270,000.

### 2. The TMDB request budget

TMDB's rate-limiting page says the limit sits "somewhere in the 40 requests per second range" and "could change at
any time". That is about 3.4 million requests a day.

| | Requests a day | Share of the limit |
|---|---:|---:|
| Details flow today (new titles, priority path, awaited titles) | about 1,900 | 0.05% |
| Episode flow (measured earlier today) | about 13,000 | 0.4% |
| Details flow at its ceiling, as in late September | 276,000 | 8% |
| Details flow averaged over a 30-day cycle | 50,000 | 1.4% |

The limit is not the constraint for any option below. A request costs 300 KB for the full details of a popular
movie, 79 KB for its offers alone (`/watch/providers`) and 12 KB for a discover page of 20 titles.

### 3. The change feeds do not report offers

`/movie/{id}/changes` and `/tv/{id}/changes` were read for 14 days (2026-09-29 to 2026-10-12) for awaited titles
rechecked today, split by whether the recheck found a new offer.

| Group | Sampled | With any logged change | Keys seen |
|---|---:|---:|---|
| Movies with a new offer | 150 of 432 | 123 (82%) | images, release_dates, overview, plot_keywords, runtime, crew, … |
| Movies without | 150 of 232 | 102 (68%) | the same |
| Shows with a new offer | 96 of 96 | 77 (80%) | images, season, overview, tagline, … |
| Shows without | 150 of 304 | 94 (63%) | the same |

No key names offers or providers. A fifth of the titles with a new offer have no logged change, and two thirds of
the titles without one have. The daily lists `/movie/changes` and `/tv/changes` (8,189 and 2,746 ids for one day)
are built from the same log. These titles are popular ones, which are edited often; for the long tail the feed
would say even less.

### 4. Discover reports what a service carries

`/discover/movie?watch_region=US&with_watch_providers=8&with_watch_monetization_types=flatrate` returns the movies
TMDB lists on Netflix in the United States, 20 a page. Paging through a list returned every title exactly once
(4,743 ids for 4,743 results). A query stops at page 500, so a list of more than 10,000 titles has to be split by
release year; Prime Video and Tubi in the United States needed that and it worked.

Each list was compared with Crate's rows for the same service, country and offer type, and a sample of each
difference was checked against the title endpoint, which is what the details flow stores.

| Service | On TMDB | In Crate | On TMDB, not in Crate | In Crate, not on TMDB | Requests |
|---|---:|---:|---:|---:|---:|
| Netflix, US | 8,315 | 9,497 | 151 | 1,333 | 417 |
| Prime Video, US | 31,269 | 34,357 | 1,363 | 4,451 | 1,572 |
| Tubi (ads), US | 62,189 | 67,979 | 916 | 6,706 | 3,123 |
| Hulu, US | 3,269 | 4,205 | 158 | 1,094 | 164 |
| HBO Max, US | 3,923 | 4,358 | 70 | 505 | 197 |
| Peacock Premium, US | 2,245 | 4,494 | 123 | 2,372 | 113 |
| Paramount+ Premium, US | 1,926 | 1,847 | 123 | 44 | 97 |
| Disney+, US | 2,985 | 3,112 | 57 | 184 | 150 |
| Apple TV, US | 355 | 357 | 10 | 12 | 19 |
| Netflix, DE | 8,965 | 10,250 | 109 | 1,394 | 449 |
| Prime Video, DE | 9,873 | 11,305 | 360 | 1,792 | 495 |
| Disney+, DE | 4,048 | 4,277 | 75 | 304 | 203 |

- **"On TMDB, not in Crate" are arrivals Crate has not found.** The title endpoint confirmed 531 of 536 sampled
  titles. All but one of the US titles are in the catalogue, last checked a median of 16 to 17 days ago.
- **One list disagreed:** for Prime Video shows in the United States the title endpoint confirmed 14 of 40. It
  files the others under Prime Video's free offers. Discover is a signal for which titles to recheck; what the
  recheck stores stays the truth.
- **The rates.** Over 16.5 days: Netflix US 9 arrivals a day, Hulu 10, Prime Video US 70 to 80, Tubi 55, Netflix
  DE 6 to 7, Prime Video DE 22. The 9 US services together: 2,971 arrivals on 2,833 different titles, about 180 a day.
  They hold 18% of the US subscription, free and ads rows, so the whole United States is in the order of 1,000
  arrivals a day. That last figure is an extrapolation.
- **What Crate found meanwhile.** For the 9 US services 252 offers from 2 to 11 October, 25 a day against 180.
  On Netflix US 31 titles in 11 days (the prototype's count) against 9 a day; on Netflix DE 8 in 11 days against
  6 to 7 a day.
- **"In Crate, not on TMDB" are offers that ended.** The title endpoint confirmed 119 of 120 sampled Netflix US
  titles as no longer on Netflix. For the 9 US services that is 16,701 rows, 13% of what Crate shows for them. Most
  carry a link from the country scrape, whose contribution stays until that country is scraped again. This is
  outside the question here, and it is the same staleness seen from the other side.
- **How current TMDB itself is** was not measured. Titles dated 2026-10-09 were listed on Netflix US on
  2026-10-12, none dated later. Measuring it needs lists from several days.

### 5. Which titles would a short cycle have to cover

The 2,833 arrivals of the 9 US services, by what Crate knew about the title before:

| Subset | Movies in it | Shows in it | Movie arrivals caught | Show arrivals caught |
|---|---:|---:|---:|---:|
| Has an offer in any country | 284,499 | 76,514 | 94% | 80% |
| Has an offer in the United States | 172,737 | 37,574 | 91% | 70% |
| Released (shows: last aired) in the last 24 months | 114,816 | 35,700 | 12% | 33% |
| Popularity 2 or more | 57,644 | 76,753 | 58% | 65% |
| Popularity 5 or more | 10,088 | 25,789 | 28% | 40% |
| Offer anywhere, or last 24 months | 382,697 | 98,914 | 98% | 86% |
| Offer anywhere, or last 24 months, or popularity 2 or more | 395,189 | 129,674 | 98% | 96% |

Arrivals are mostly library titles: 88% of the movies are older than two years. Recent or popular titles alone
miss most of them. The last row, 525,000 titles, is the smallest subset found that covers nearly everything.

### 6. What a recheck costs on Crate

| Publication run of `f/sync/copy/tmdb_streaming` | Duration | Evidence rows written | Availability rows changed |
|---|---:|---:|---:|
| A usual run (the 14:00 Berlin runs of 10 and 11 October) | 8.0 to 8.2 min | 16,000 to 18,000 (33 to 39 MB) | 4 to 12 |
| With the 1,093 awaited titles (14:00 Berlin, 12 October) | 10.9 min | 173,211 (461 MB) | 54,997, of them 5,482 new |
| During the catch-up, a quarter of a day's 270,000 fetches a run | 23 to 25 min | not measured | 150,000 to 460,000 |

- **A recheck rewrites the title's evidence in every country, changed or not.** The evidence holds the time of the
  check. The awaited titles account for 103,675 of today's evidence rows (360 MB): 98 rows and 0.34 MB a title,
  every day from now on. The other 52,000 rows above a usual run were not attributed.
- **Availability rows are written only when they differ,** and `created_at` is kept on an update: of 55,000 rows
  changed today 5,482 were new.
- **The details copy pays too,** because the flow fetches the full details. `f/sync/copy/tmdb_details` took 5.0
  minutes today against 1.6, and 45 to 61 minutes twice a day during the catch-up.

### 7. `created_at` and the signal of #456 when a catch-up arrives

- **Every offer found by a late check gets the day of that check.** From 2026-09-21 to 2026-10-01 the catch-up
  wrote 218,000 US subscription, free and ads rows; 2025-06 holds 480,000 (the first import). Since 2026-10-02 the
  US gets 100 to 160 a day.
- **It happened again today, in small.** The first recheck of the awaited titles wrote 5,482 new rows dated
  2026-10-12 for offers that appeared at some point in the 11 to 17 days before. Under the rule of #456 that is 20
  landings for 12 members on 18 titles in one day. The README of #456 counted 6 landings in a usual week.
- **An offer that ends and returns gets a new `created_at`.** #456 accepts that. How often it happens was not
  measured; daily checks will show it more often than monthly ones.
- **#456 turns itself off above 20,000 titles.** `readFirstSeen` keeps no times for a country when more than 20,000
  titles have a subscription, free or ads offer newer than the launch (later: newer than 90 days), and then nothing
  is announced there. The constant was sized on 80 titles a day in the United States. The 9 services measured here
  alone give 172 a day, 15,500 in 90 days, and they are 18% of the rows.
- **The next wave is dated.** Whatever the queue finds from 2026-10-25 to 2026-10-31 is a month of arrivals stamped
  with one week, in every country.

## Options

| | 1. Watch services through discover | 2. Recheck a subset of titles daily | 3. Shorten the cycle to 7 days |
|---|---|---|---|
| What is checked | The lists of the page's services and countries; then only titles that entered or left a list | 525,000 titles, each by its own request | The subset of option 2, or the whole catalogue |
| Requests a day | 9,900 (US and DE, 10 largest subscription services each) to 47,700 (every subscription, free and ads service of both); 130,000 for the 12 countries members live in | 525,000 | 75,000 for the subset, 213,000 for the catalogue |
| Share of TMDB's limit | 0.3% to 4% | 15% | 2% to 6% |
| Publication load on Crate | The titles that changed: for the 9 US services about 180 arrivals a day plus the offers that ended | 9 million evidence rows a day unless unchanged titles are skipped; with the skip, the titles that changed | A seventh of option 2 |
| Covers | The services and countries on the list | Every country and service, 96 to 98% of arrivals | The same as its subset |
| Worst delay from TMDB to Crate | about 27 hours with one list a day; about 8 with one before each publication | about 30.5 hours | 7 days and 6 hours |
| Typical delay | about 14 hours; about 4 | about 16 hours | 3.5 days |
| The page can say | The day, for the watched services | The day, everywhere | "This week", roughly; no day |
| Build | Middle | Large | Small, but needs the evidence skip of option 2 |

The request figures of option 1 are upper bounds: they are Crate's row counts divided by 20, and for the 9 US
services Crate holds 12% more rows than TMDB lists.

### 1. Watch services through discover (recommended)

- **A list job** reads, once a day, what each watched service carries in each watched country, and stores it in
  Mongo. A list counts only when every page was read and its size is plausible.
- **A comparison** with the previous list gives the titles that entered or left.
- **Those titles are rechecked at once** through the details queue, the way awaited titles are: they take slots of
  the batch. The publication writes the rows as it does today, so the reconciliation, the leases and the scrape's
  contribution are untouched.
- **`created_at` is then the day of the arrival,** for the watched services, from the second list on.
- **Timing as for the awaited titles:** list at about 06:00 Berlin, rechecks in the hour before the 08:00
  publication. A second list before each of the other three publications cuts the worst delay to about 8 hours for
  four times the requests.
- **It also reports offers that ended,** which nothing reports today.

### 2. Recheck a subset of titles daily

- **A list of 525,000 titles** (an offer anywhere, or the last 24 months, or popularity 2 or more), rebuilt daily
  from Crate, fetched through `/watch/providers` alone.
- **Needs more than the flow carries.** 525,000 a day is above the flow's 288,000, so it needs a second, parallel
  fetch.
- **Needs the publication to skip a title whose offers did not change.** The stored `payload_hash` allows the
  comparison. But the evidence's time of the last check is what tells the webapp that a title was checked, so
  "checked and unchanged" needs its own cheap record. That touches the core of the publication.
- **Its strength** is that it needs no list of services: every country and every service at once.

### 3. Shorten the cycle to 7 days

One constant for the subset or the catalogue, and the same evidence skip. An arrival is then found within a week
and dated with the day it was found. The page could say "found this week", not the day, and a title "found today"
arrived at some point in the last seven.

### Not options

- **The change feeds.** See finding 3.
- **The whole catalogue daily.** 1.49 million requests a day is 43% of TMDB's limit and 5.4 times the catch-up,
  which already took 24 minutes of streaming publication four times a day and an hour of details publication twice
  a day.
- **The country scrape.** It reads 43,200 title and country pages a day against 9.2 million pairs with evidence.
  Its queue order was not examined.

## Recommendation

**Option 1, started with the page's first services:** the 10 largest subscription services of the United States
and Germany, about 10,000 requests a day, then more services and countries by adding them to the list. It is the
only option whose cost follows what changed and not how many titles exist, it leaves the publication alone, and it
gives the day for exactly the pages #489 wants to show.

With it, three things that hold for every option:

1. **Start the page's look-back the day after the first list.** The first comparison is against Crate, not against
   a list, so it finds the whole backlog at once: 2,971 title and service pairs for the 9 US services. Those must
   not show as arrivals of that day.
2. **Replace the 20,000 limit of #456** before arrivals are found at their real rate, or the signal goes silent in
   the United States. The limit protects against a catch-up; a catch-up could be told apart by how many offers
   appear on one day.
3. **Spread the 30-day queue** before 2026-10-21, so that it fetches about 50,000 titles every day and no week at
   270,000. Without it the wave of 2026-10-25 stamps a month of arrivals in every country with one week, and loads
   Crate as the catch-up did.

## Risks

- **Discover is not documented as a change signal.** It agreed with the title endpoint in 99% of 536 samples, and
  disagreed on the offer type for Prime Video shows. A wrong entry costs one wasted recheck, not a wrong row.
- **A partial list would look like a mass departure and, a day later, a mass arrival.** The list job must refuse a
  list that is incomplete or shrinks by more than a set share.
- **TMDB's own delay is unknown.** The day the page shows is the day TMDB listed the offer, at best.
- **Offers that end and return** get a new day. If daily lists show this to be common, the page needs a rule, for
  example that a title returning within some days is not new.
- **The first list of every added service brings its backlog.** The same rule as in recommendation 1 applies each
  time.
- **The details copy runs for every recheck,** because the queue fetches full details. At a few hundred titles a
  day this is small; at option 2's volume it is not.
- **Evidence load of what is already live:** the awaited titles rewrite about 104,000 evidence rows (360 MB) a
  day. That is affordable, and it grows with the list.

## Build size

Compared with the awaited-titles change (a list in Mongo, a list job, a change to the queue, 21 tests, a doc):

| | Size | Parts |
|---|---|---|
| Option 1 | About three of those | List job with paging, the split by year and the completeness check; the stored lists and the comparison; one-off rechecks in the queue; the list of watched services and countries; monitoring and doc. No change to the publication and none to Crate's tables |
| Option 2 | About six | A fetch for offers alone; a second fetch flow; the skip in the publication with a record for "checked and unchanged"; the subset job; load tests on Crate |
| Option 3 | About two | The skip of option 2 is most of it |
| The 20,000 limit of #456 | Small, webapp | |
| Spreading the 30-day queue | Small, flows | |

## Not measured

- How long TMDB takes to list an offer after the service has it.
- How often an offer ends and returns.
- Arrival rates outside the United States and Germany, and for the services not in the table.
- The evidence rows written during the catch-up runs.
- Whether TMDB tolerates 8 parallel discover requests for an hour a day; the measurements ran 4 in parallel at
  about 5 requests a second without a refusal.
