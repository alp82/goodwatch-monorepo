# Arrival data for every country

Research for [#624](https://github.com/alp82/goodwatch-monorepo/issues/624), for the "New on your services" page
(part C of [#489](https://github.com/alp82/goodwatch-monorepo/issues/489)). It follows
[offer-arrival-freshness.md](https://github.com/alp82/goodwatch-monorepo/blob/research/offer-arrival-freshness/docs/research/offer-arrival-freshness.md)
(branch `research/offer-arrival-freshness`, measured on 2026-10-12), which recommended watching the 10 largest
subscription services of the United States and Germany. The owner wants every country. Measured on 2026-10-15 and
2026-10-16. Nothing was built and nothing was written to production: read-only queries on Crate, GETs on the Windmill
API, and about 98,000 GETs on the TMDB API with the local development key.

**Arrival**: the first time a service carries a title in a country, as a subscription, free, or ads offer. Crate
keeps it as `created_at` of the `streaming_availability` row, which is the time of the publication run that first
wrote the row.

**List**: what TMDB's discover endpoint returns for one service, one country, and one media type
(`/discover/{movie,tv}?watch_region=…&with_watch_providers=…&with_watch_monetization_types=flatrate|free|ads`).

## Summary

1. **Every country is 139 countries, 925 services, and 11,849 lists** that hold at least one subscription, free, or
   ads offer: 9.0 million entries. Reading every list once costs **about 460,000 requests a day**, 13% of TMDB's
   limit. The United States and Germany are 46,000 of them; the 12 largest countries 129,000.
2. **Going global turns the old comparison around.** A list covers one country; a title request covers all 139.
   Rechecking every title that matters daily costs **about 540,000 requests a day**, close to the price of every
   list. For two countries discover was ten times cheaper; for every country it is not.
3. **Discover has two new pitfalls.** Paging misses titles depending on the sort, and which sort is safe changes
   from day to day: on 2026-10-15 popularity (the default) missed one in five Netflix US movies and title was exact;
   during TMDB's refresh on 2026-10-16 title missed some and release date was exact. A list job must check every
   list against `total_results` and fall back to a second sort. And the type filter applies to the title, not to
   the service: Apple TV Store, Google Play, and Amazon Video appear as subscription lists of 20,000 titles.
4. **The 30-day refetch cycle is live since 2026-10-13** and already covers every country and every service. It
   finds 6,800 to 8,000 new offers a day on about 1,100 titles, against 1,000 a day before. Each one is up to 30 days
   late, so today the page can honestly say "in the last 30 days" for everything.
5. **Arrivals are mostly on titles that already had an offer somewhere:** 94% of new movie offers and 81% of new
   show offers. Adding popular titles (popularity 2 or more) and titles of the last 24 months covers 99% and 100%.
   That subset is 539,000 titles.
6. **Popularity alone splits arrivals well for shows, badly for movies.** Rechecking the 298,000 titles with
   popularity 2 or more or a release in the last 24 months daily catches 92% of new show offers and 65% of new movie
   offers.
7. **A catch-up day is easy to tell from a real day.** Across 139 countries and 42 days, the biggest catch-up day of
   every country was at least 45 times its biggest ordinary day, and at least 6% of its catalogue. Ordinary days
   stayed under 0.3% (99th percentile). A per-day rule can replace the country-wide limit of #456.
8. **The limit of #456 turns the United States off around 2026-11-23** even without a wider recheck: the cycle adds
   about 467 titles a day there, and 1,628 have counted since the launch on 2026-10-12. Austria follows in January.
9. **TMDB changes offers once a day, at about 11:30 to 12:00 UTC.** 60 lists read 10 times over 18 hours did not
   change for 17 hours, then gained 50 titles and lost 16 of 155,702 in one batch. One read a day after that batch
   is all a list can tell. A day's change is small: a few titles per list.
10. **TMDB lists a new original one to three days after its premiere,** some later or never: 19 of 24 network
    originals of 2026-10-01 to 10-13 had an offer on 10-16, 1 of the 9 of 10-14 to 10-16 (none in the United
    States).
    The page's day is TMDB's batch day, the arrival day at best.
11. **New releases are missing from Crate for weeks.** Only 6% of shows and 2% of movies released in the last 30 days
    have an offer in Crate; TMDB lists offers for 19 of the 24 originals above, Crate for 3. A new title is fetched
    before its premiere and then once in 30 days. A daily recheck of recent releases (about 7,000 titles) fixes it
    for every option.
12. **Offers that end and return** could not be measured in a day. Real departures were 16 in 155,702 entries; the
    only "end and return" seen was a paging miss, which is what a list job without a completeness check would
    announce as new.

## How it was measured

| Source | What |
|---|---|
| TMDB API, GET | `/watch/providers/regions` and `/watch/providers/{movie,tv}` for all 139 regions (278 requests); page 1 of discover for each of 10,663 region, media type, and provider triples; full lists of a panel of 60 lists, read 10 times from 2026-10-15 18:37 to 2026-10-16 12:58 UTC (about 7,800 requests each); the Netflix US lists hourly from 03:55 to 12:56 UTC; `/tv/{id}/watch/providers` for 35 shows of 8 streaming networks with a first air date from 2026-10-01 to 2026-10-18, read 16 times |
| Crate, read-only | `streaming_availability` by country, service, type, and `created_at` day for 90 days; the 22,304 offers created since 2026-10-13 with the popularity and release year of their titles; title counts by popularity |
| Windmill API, GET | Recent runs of `f/sync/copy/tmdb_streaming` |
| Code on `origin/main` | `goodwatch-webapp/app/server/availability-first-seen.server.ts`, `docs/details-refetch-cycle.md` (commit `fbaad780`) |

The measuring scripts stayed outside the repository. Discover ran at about 27 requests a second with 10 parallel
requests; the script retried refusals and did not count them.

## Findings

### 1. What "every country" holds

| | Count |
|---|---:|
| Regions TMDB lists for offers | 139 |
| Provider entries over all regions (movie and TV lists) | 10,663 |
| Lists with at least one subscription, free, or ads offer in Crate | 11,849 |
| Country and service pairs among them | 7,036 |
| Services among them | 925 |
| Entries in those lists (Crate rows; Crate holds 17% more than TMDB lists, mostly ended offers it still shows) | 9.0 million |
| Titles with a subscription, free, or ads offer anywhere | 326,831 (253,255 movies, 73,576 shows) |

The universe is Crate's pairs, sized by TMDB's `total_results` where that is below its cap and by Crate's rows where
it is not. TMDB reports at most 20,001 results for a list.

### 2. Discover for every list

One pass over every list costs **457,959 requests**. Most of it is a few hundred big lists:

| List size | Lists | Requests a day | Entries |
|---|---:|---:|---:|
| 1 to 20 | 1,987 | 1,987 | 11,444 |
| 21 to 100 | 1,974 | 6,413 | 109,704 |
| 101 to 1,000 | 4,296 | 80,363 | 1,563,878 |
| 1,001 to 5,000 | 1,861 | 192,783 | 3,840,349 |
| More than 5,000 | 401 | 195,642 | 3,908,893 |

By service, Plex alone is 18% (82,000 requests in 131 countries), Netflix 12% (55,000), Prime Video 8% (36,000). By
country, the United States is 35,000, Canada 14,000, the United Kingdom 12,500, Germany 11,000; the median country
2,400. The United States and Germany together are 46,000, the 12 largest countries 129,000, and the other 127
countries 329,000.

- **Run time.** At 27 requests a second one pass takes 4.7 hours; at TMDB's stated 40 a second, 3.2 hours. A
  second pass a day doubles both.
- **Storage.** 9 million ids a day, as sorted arrays per list: about 36 MB a day before compression. Two days are
  enough for the comparison.
- **Paging needs a stable sort.** On 2026-10-15, with the default `popularity.desc`, the 237 pages of Netflix US
  movies returned 4,738 entries but only 3,812 unique titles, whether fetched one at a time or in parallel. Sorted by
  `title.asc`, `primary_release_date.desc`, or `vote_count.desc`, they returned 4,738 unique titles. On 2026-10-12
  the default sort was exact. A list job must sort by title and refuse a list whose unique count differs from
  `total_results`.
- **The type filter is about the title, not the service.** `with_watch_monetization_types` matches a title with
  such an offer from any service in the country. Stores and mixed services therefore list titles they only rent:
  Apple TV Store, Google Play Movies, Amazon Video, and Fandango At Home each list 20,001 "subscription" movies in
  the United States. Pure stores must stay out of the watch list, and a list of a mixed service (YouTube, Prime
  Video) holds titles it only sells. The recheck of a changed title through the title endpoint stays the truth, as in
  the earlier research.
- **Lists of more than 10,000 titles** (page 500 is the last) need splitting by release year, as before. 197 lists
  report the cap.

### 3. Rechecking titles

A title request (`/{movie,tv}/{id}/watch/providers`, or the full details the queue fetches today) returns the offers
of every country at once. So the cost of a recheck follows the number of titles, not of countries.

Which titles get new offers was measured on the 22,304 offers created from 2026-10-13 to 2026-10-15. In those days
the 30-day cycle fetched a thirtieth of the catalogue a day, spread evenly over the id range, so the offers it finds
are a fair sample of arrivals in every country. Titles rechecked daily for members (the awaited titles) are in it,
but only 23 titles got new offers in more than one publication.

| Titles rechecked daily | Titles | New movie offers caught | New show offers caught |
|---|---:|---:|---:|
| Popularity 5 or more, or released 2025 or later | not counted | 40% | 77% |
| Popularity 2 or more, or released in the last 24 months | 298,062 | 65% | 92% |
| Popularity 1 or more, or released 2025 or later | about 650,000 | 88% | 96% |
| Had a subscription, free, or ads offer before (any country) | 326,831 | 94% | 81% |
| Offer anywhere, or popularity 2 or more, or the last 24 months | 538,676 | 99% | 100% |
| Whole catalogue | 1,494,178 | 100% | 100% |

- **The subset of 539,000 titles** is the one the earlier research found for the United States (525,000 then, 98%
  and 96%). It holds for every country.
- **Popular titles are not where most movie arrivals are.** Movies with popularity from 1 to 2 hold 27% of new movie
  offers. Library movies move between services all the time.
- **The cost on TMDB:** 539,000 requests a day, 16% of the limit, above the details flow's ceiling of 288,000. It
  needs a second fetch, of offers alone.
- **The cost on Crate** is what the earlier research measured: a recheck rewrites the title's evidence in every
  country, changed or not, about 9 million evidence rows (6.6 GB) a day for this subset. It needs the publication to
  skip titles whose offers did not change. That remains the largest part of the build.

### 4. Hybrids

Discover's cost follows entries; a recheck's follows titles. The cheap discover lists are the small ones, and many
arrivals land there, because a small service that adds a title often adds it in 50 countries at once (WeTV, Filmzie,
Bloodstream).

| Watched through discover every day | Requests a day | New offers in those lists |
|---|---:|---:|
| Every list | 457,959 | 100% |
| Every list except 10 free catalogues (Plex, Plex Channel, Tubi, JustWatch TV, Filmzie, Hoopla, Pluto TV, YouTube, Fawesome, Public Domain Movies) | 324,049 | 89% |
| 15 big brands in every country (Netflix and its ads tier, Prime Video and its ads tier, Disney+, HBO Max, Apple TV, Hulu, Peacock, Paramount+, Crunchyroll, MUBI) | 140,755 | 33% |
| Lists of up to 1,000 titles | 94,285 | 46% |
| The 15 brands and every list of up to 1,000 titles | 219,950 | 75% |
| The 15 brands and every list of up to 2,000 titles | 274,056 | 82% |
| More than 5,000 titles | 176,655 | 30% |

"New offers" are rows: one per title, country, service, and type. A title added to WeTV in 49 countries counts 49
times, which is right for pages per country and service.

What is not watched through discover keeps the 30-day cycle, or gets a weekly recheck.

### 5. What the 30-day cycle gives today

Since 2026-10-13 the details queue fetches every title once in 30 days, a thirtieth of the catalogue a day (about
50,000 titles), in four publications at 00:00, 06:00, 12:00, and 18:00 UTC. Each publication now writes 1,100 to
2,000 new subscription, free, and ads offers on 230 to 330 titles. Before, from 2026-10-02 to 2026-10-11, there
were about 1,000 a day.

| | 2026-10-02 to 10-11 (old queue) | 2026-10-13 to 10-15 (cycle) |
|---|---:|---:|
| New offers a day, all countries | 900 to 1,700 | 6,800 to 8,000 |
| New titles a day, United States (median) | 75 | 467 |
| New titles a day, Germany (median) | 20 | 106 |
| New titles a day, median country | not counted | 34 |

This covers every country and every service already. What it cannot do is date an arrival: a title is checked once
in 30 days, so an offer found today arrived at some point in the last 30 days, 15 on average. Until the first full
cycle ends on 2026-11-12, some offers are older still, because the titles were last checked during the catch-up of
late September.

### 6. New offers per country per day, and the limit of #456

`streaming_availability` has no subscription, free, or ads row created between 2026-07-17 and 2026-08-28; the 90 days
start with 45 rows on 2026-08-29. Ended offers are deleted, so these counts are offers that still exist.

| Days | New offers a day, all countries | What it was |
|---|---:|---|
| 2026-09-04 to 09-20 | 2,200 to 11,000; 23,816 on 09-14 | The old queue |
| 2026-09-21 | 162,165 | Catch-up |
| 2026-09-25 to 10-01 | 50,000 to 1,120,000 | Catch-up (1.1 million on 09-26) |
| 2026-10-02 to 10-11 | 900 to 1,700 | New titles and the priority path |
| 2026-10-12 | 5,975 | The first recheck of awaited titles |
| 2026-10-13 to 10-15 | 6,800 to 8,000 | The 30-day cycle |

Per country, measured in titles (as #456 counts), against the country's titles with such an offer:

- **Ordinary days:** median 0.04% of the catalogue, 99th percentile 0.26%, highest 1.1% (United States, 2026-09-14,
  itself a small catch-up of 23,816 offers worldwide).
- **Catch-up days:** every country's biggest catch-up day held at least 6% of its catalogue. 966 country days of the
  catch-up were above 1%.
- **The ratio:** in every country the biggest catch-up day was at least 45 times its biggest day under the cycle
  (lowest: Paraguay, Costa Rica, Guatemala, and the Dominican Republic at 45 to 47; United States 59).

So a day can be told apart without a country-wide limit. Two rules would have worked on every country and day
measured:

- **A share of the catalogue:** a country day with new titles above 1% of the country's titles is a catch-up. It
  flags 09-14 in the United States as well, which was a small catch-up.
- **A multiple of the usual:** a country day with more than 10 times the median of its previous 28 days is a
  catch-up. It does not flag the switch to the 30-day cycle (6 times in the United States), which brought late but
  real offers.

A catch-up day is then left out of "newly available", and every other day of that country still counts. Real
arrival days with many titles (the first of a month) were not observable: 2026-10-01 fell into the catch-up. A daily
check would show them, and the multiple-of-the-usual rule leaves room for 10 times an ordinary day.

**The limit today.** `readFirstSeen` keeps no times for a country with more than 20,000 titles newer than the launch
(2026-10-12, later the last 90 days). Under the cycle:

| Country | Titles counted since 2026-10-12 (on 10-15) | New titles a day | Crosses 20,000 |
|---|---:|---:|---|
| United States | 1,628 | 467 | about 2026-11-23 |
| Austria | 868 | 232 | about 2027-01-06 |
| Every other country | under 600 | under 180 | not within 90 days |

At three times the cycle's rate, 17 countries would cross it. Once arrivals are found daily, the steady rate is what
TMDB adds: the panel of finding 7 suggests about 200 titles a day in the United States, 18,000 in 90 days, right at
the limit. The earlier research's 1,000 a day compared TMDB with a stale Crate and overstated it.

### 7. Discover lists over the day

A panel of 60 lists (Netflix in 10 countries, Prime Video, Disney+, HBO Max, Hulu, Apple TV, Paramount+,
Crunchyroll, Shudder, MUBI, Zee5, and WeTV; 155,702 entries) was read in full 10 times from 2026-10-15 18:37 to
2026-10-16 12:58 UTC, about 7,800 requests each.

| From | To | Titles in | Titles out | What it was |
|---|---|---:|---:|---|
| 10-15 18:44 | 10-15 21:48 | 0 | 0 | Nothing |
| 10-15 21:48 | 10-16 00:49 | 0 | 2 | A paging miss (HBO Max Brazil returned 1,759 of 1,761) |
| 10-16 00:49 | 10-16 03:50 | 2 | 2 | The same miss, the other way round |
| 10-15 18:44 | 10-16 06:54 | 0 | 1 | The same miss |
| 10-15 18:44 | 10-16 12:58 | 50 | 16 | TMDB's refresh |

An hourly read of Netflix US (movies and shows) from 03:55 to 12:56 UTC on 2026-10-16 was unchanged until 10:56 and
in the middle of a change at 11:56.

- **TMDB changes its offers once a day, in one batch, at about 11:30 to 12:00 UTC.** Nothing changed in the 17 hours
  before it. A list read twice a day sees nothing a list read once a day does not, as long as it is read after the
  batch. TMDB serves discover with `Cache-Control: max-age` of 3.5 to 4 hours, so more frequent reads would mostly
  hit the cache anyway.
- **During the batch, paging is unreliable for an hour or more.** At 11:56 and 12:41, 10 and 26 of the 60 lists
  returned fewer unique titles than `total_results` when sorted by title. At 12:58, sorted by release date with a
  second pass by vote count where the first fell short, 58 of 60 were complete.
- **Which sort is stable changes from day to day.** On 2026-10-12 popularity was exact; on 2026-10-15 popularity
  missed 20% and title was exact; during the batch on 2026-10-16 title missed 0.5%, popularity 1.2%, and release
  date and vote count were exact. A list job must compare unique titles with `total_results`, fall back to a second
  sort, and refuse the list if both fall short.
- **A day's change is small.** 50 arrivals and 16 departures in 155,702 entries: 0.03% and 0.01%. Netflix US gained
  3 shows and 1 movie, Prime Video US 11 titles, Paramount+ US 3. Most arrivals were library titles (Longmire, Arrow,
  Orphan Black, The Graham Norton Show); two were released that week (Masterplan on Prime Video US, dated
  2026-10-16; The Storm on Netflix Germany, dated 2026-10-15).
- **This is lower than the earlier research's estimate** of 9 Netflix US arrivals a day, which compared TMDB with a
  stale Crate. Per list and day, TMDB's own change is a few titles. Across the 11,849 lists, at this panel's rate,
  that is in the order of 3,000 arrivals and 1,000 departures a day; the panel leans to big services, so that is a
  rough figure.

### 8. TMDB's delay and offers that end and return

**Delay.** The offers of 35 shows from 8 streaming networks with a first air date from 2026-10-01 to 2026-10-18
were read 16 times from 2026-10-15 18:31 to 2026-10-16 12:36 UTC.

| Premiered | Shows | With an offer in any country on 10-16 12:36 |
|---|---:|---:|
| 2026-10-01 to 10-13 | 24 | 19 (14 in the United States) |
| 2026-10-14 | 2 | 0 |
| 2026-10-15 | 3 | 1 (Crystal Lake, Peacock, in 5 countries but not the United States) |
| 2026-10-16 | 4 | 0 |

- **A new original is usually listed one to three days after its premiere, and some take longer or never appear.**
  TYSON (Netflix, 2026-10-13) was listed in 53 countries on 10-15 and in 131 after the batch of 10-16. Two Netflix
  shows of 10-15 and one of 10-16 had no offer by 12:36 on 10-16. Least Eligible Bachelor (Netflix India, 10-09,
  popularity 58) and Traffic Jam (Prime Video Italy, 10-01) had none after 7 and 15 days.
- **Movies were not measured.** The two dated arrivals in finding 7 were listed 0 and 1 day after their release
  date.
- So the day a page can show is the day of TMDB's batch: the arrival day at best, often one to three days later.

**Offers that end and return** could not be measured in one day. What was seen:

- **False ends and returns come from paging, not from TMDB.** The only "end and return" in 17 quiet hours was a
  paging miss of HBO Max Brazil. Without the completeness check, a list job would announce such titles as new.
- **Real ends are rare per day:** 16 in 155,702 entries.
- Crate cannot answer it: an ended offer's row is deleted, and the next one gets a new `created_at`. Measuring it
  needs stored lists from several weeks; a list job of option 1 to 4 would produce them.

### 9. New releases are missing from Crate for weeks

Of the 24 shows above that premiered from 2026-10-01 to 2026-10-13, TMDB lists 19 with offers; Crate has offers for
3 of them. East of Eden (Netflix, 2026-10-01, listed in 131 countries) has none in Crate: its details were last
fetched on 2026-09-25, before the premiere, and the 30-day cycle fetches it again when its second comes.

| Released in the last 30 days (2026-09-16 to 10-15) | Titles | With any offer in Crate |
|---|---:|---:|
| Shows (first air date) | 928 | 59 (6%) |
| Movies (release date) | 4,258 | 95 (2%) |

Many of these movies are theatrical releases that are not streaming yet, but the shows are mostly streaming
originals. A new title is fetched once when TMDB creates it, often weeks before its premiere, and then once in 30
days. **The arrivals people search for most ("new on Netflix") are the ones today's data misses.** A daily recheck of
the titles released in the last 30 days or due in the next 7 (about 7,000 titles, 0.2% of TMDB's limit) would close
that gap in every country, whatever option is chosen.

## Options

All requests are against TMDB's stated limit of about 40 a second, 3.4 million a day. Today's use is about 65,000 a
day (details cycle, new titles, awaited titles, episodes).

| | Requests a day | Countries | Arrivals with a day | The page can say | Load on Crate | Build |
|---|---:|---|---|---|---|---|
| **0. Today: the 30-day cycle** | 50,000 (live) | All | None, and new releases mostly missing | "Found in the last 30 days" | As now | None |
| **1. Discover every list** | 460,000 (13%) | All | All TMDB lists | The day, everywhere | Only titles that changed | Large |
| **2. Discover the 15 brands and every list up to 1,000** | 220,000 (6%) | All | 75% | The day on watched lists; "in the last 30 days" on the rest | Only titles that changed | Large |
| **3. Discover the 15 brands** | 141,000 (4%) | All | 33% | The day on 15 brands; "in the last 30 days" on the rest | Only titles that changed | Middle |
| **4. Discover the 12 largest countries** | 129,000 (4%) | 12 | 32% of all, every arrival there | The day in 12 countries; "in the last 30 days" elsewhere | Only titles that changed | Middle |
| **5. Recheck 539,000 titles daily** | 539,000 (16%) | All | 99% of movies, 100% of shows | The day, everywhere | 9 million evidence rows a day without the skip | Large |
| **6. Recheck popular and recent titles daily, the rest of the subset weekly** | 298,000 + 34,000 (10%) | All | 65% of movies, 92% of shows | The day for popular titles; "this week" for the rest | Needs the skip | Large |
| **7. Recheck 539,000 titles weekly** | 77,000 (2%) | All | None | "This week", everywhere | Needs the skip | Middle |

- **Countries** in option 4 can be any set; the 12 largest by pages are US, CA, GB, DE, AU, FR, MX, JP, AT, ES, BR,
  and CH. "32%" is their share of new offers since 2026-10-13.
- **"In the last 30 days"** depends on option 0 staying on for what is not watched. Every option keeps it.
- **The skip** is the change to the publication that leaves a title's evidence alone when its offers did not change,
  with a cheap record that it was checked. The earlier research described it.
- **Build sizes** compare with the awaited-titles change (a list in Mongo, a list job, a queue change, 21 tests,
  a doc): option 1 about three to four of those (the list job, paging and splits, storing and comparing 12,000 lists,
  the store exclusion, the scheduling of 4 to 5 hours of requests a day, monitoring); options 2 to 4 about three;
  options 5 and 6 about six (a second fetch of offers alone, the skip, load tests); option 7 about two.

## Recommendation

**Option 1 as the goal, reached through option 3, with the daily recheck of recent releases from the start.**

- **No country is left out at any step.** Every option keeps the 30-day cycle for what is not watched daily, so
  every country and service gets a page from day one. What grows is how many lists can say a day.
- **Start with the 15 brands everywhere (141,000 requests a day).** Those are the pages people search for, in every
  country, and the page per service is either daily or not: that is variation C of the prototype, which says it once
  per page. With the recheck of recent releases, the new originals of those brands show within one to three days of
  their premiere.
- **Then every list (460,000),** once the list job has run for a few weeks: its stored lists measure ends and
  returns, show whether TMDB tolerates the volume, and give real arrival rates for the 20,000 limit.
- **Discover over rechecks** because the requests are about the same for every country, and discover leaves the
  publication and the evidence alone: only titles that changed are rechecked. Rechecks (option 5) remain the fallback
  if discover's paging proves unreliable for weeks.
- **One read a day, after TMDB's batch.** Reading more often buys nothing.

## What every option needs

1. **Replace the 20,000 limit of #456 by a per-day rule** before 2026-11-23, whatever is chosen (finding 6).
2. **Recheck recent releases daily:** titles released in the last 30 days or due in the next 7, about 7,000 a day
   (finding 9). Without it, the page misses the new originals in every option that leaves them to the cycle.
3. **Start each watched list's look-back the day after its first list.** The first comparison of a list is against
   Crate, which finds the backlog of up to 30 days at once. That holds for every service and country added later.
4. **Read lists once a day, after TMDB's batch** (from about 13:30 UTC), check each against `total_results`, fall
   back to a second sort, and refuse a list that stays short (findings 2 and 7).
5. **Name what the page knows.** A day where a list or title is checked daily, a week where it is checked weekly,
   "in the last 30 days" elsewhere. The prototype of [#625](https://github.com/alp82/goodwatch-monorepo/issues/625)
   shows what that looks like.

## Not measured

- Arrival days with many titles, such as the first of a month (finding 6).
- TMDB's delay for movies, and for titles that are not originals of a streaming network.
- How often an offer ends and returns. It needs stored lists from several weeks (finding 8).
- Whether TMDB's batch time is the same every day. One batch was seen.
- Whether TMDB tolerates 4 to 5 hours a day at 27 to 40 requests a second. Today's runs of 10,663 and 3 × 7,800
  requests did not fail; refusals were retried and not counted.
- Arrival rates per day for a whole month under the cycle. Three days were available.
- The share of mixed-service list entries that are sale-only offers.
