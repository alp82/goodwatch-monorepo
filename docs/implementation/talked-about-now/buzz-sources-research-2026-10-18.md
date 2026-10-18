# Buzz sources research (2026-10-18)

Research for the "Hot on socials" ranking ([buzz-score.md](buzz-score.md)).
The ranking reads Wikipedia daily pageviews. Wikimedia has published nothing
after 2026-10-15, so on 2026-10-18 the page still shows 15 Oct. This note
looks at the delay itself, at other attention signals, and at ranking designs
that stay fresh when one source lags.

Method: official docs, terms, Phabricator tasks and direct requests on
2026-10-18. Claims carry a link. "Observed" means measured by this research
on 2026-10-18. "Unverified" means no primary source was found.

## Summary

The outage is not unusual. It is the fourth multi-day stall of the Wikimedia
pageview pipeline in 2026 (April, May, August, October). The three earlier
ones lasted 4 to 5 days, and each was fixed by backfill. The Wikimedia status
page does not cover analytics, and I found no mailing list notice for any of
them. A Wikipedia-only ranking will go stale every few months.

Most promising options, best first:

1. **Hourly pageview dumps as a first fallback.** Wikimedia publishes a file
   per hour, about 2 h 15 min after the hour ends. Summed over a UTC day they
   matched the API's daily `user` value exactly for four test articles
   (observed). They often keep running for a while when the API stalls: 11
   extra hours in May, one extra day in August, 19 extra hours now. They do not help
   when the whole pipeline stops, as it has now. Free, CC0, same article
   mapping we already have, about 5 minutes of download per day.
2. **A second, independent signal for the days when Wikipedia is down:
   Trakt `trending`** (people watching over the last 24 hours, with TMDB IDs).
   It is free with a client ID, and Trakt's API policy names "an app that
   displays public discovery information, such as trending titles" as a
   permitted use. It counts watching, not talking, and has a smaller audience.
3. **TMDB daily popularity lift.** No new vendor. TMDB's daily ID export
   files carry popularity for every title, are ready by 08:00 UTC, need no
   auth, and stay downloadable for 3 months. So we can backfill 90 days today
   and backtest at once. TMDB smooths the value with the previous day's
   score, so it reacts more slowly.
4. **Bluesky Jetstream mention counts.** Real-time, free, no auth for the live
   stream. It needs a collector that stays connected, and title matching is
   hard (the social matcher already does this work). Better as a secondary
   "being talked about" signal than as the main ranking.
5. **Wikipedia edit activity** (Action API revisions in the last 24 hours) as
   a weak proxy that does not depend on the pageview pipeline. Untested; needs
   a backtest against our 60-day history.

Not recommended: YouTube view velocity (the YouTube API policies forbid scores
built from API data without a special analytics amendment), Reddit (owner
removed it on 2026-10-14; new API access needs approval since November 2025),
Google Trends API (closed alpha), JustWatch, FlixPatrol and Reelgood charts
(paid partner contracts), IMDb MOVIEmeter and Letterboxd (no permitted access).

**Recommendation.** Keep Wikipedia lift as the main score. Add two things:

- An earlier schedule (from about 02:30 UTC instead of 08:00 UTC) and an
  hourly-dump collector. The schedule change alone gains up to 5 hours on a
  normal day. The collector gains less than an hour on a normal day, but it
  covers API-only stalls like the one in August.
- A labelled fallback ranking for days when Wikipedia has no data. Use a
  blend of Trakt watcher lift and TMDB popularity lift, with each title
  compared to its own recent baseline, not raw counts. Show the source and
  the day on the page ("Based on Trakt and TMDB, 18 Oct" versus "Based on
  Wikipedia reading, 15 Oct"). Never mix a stale Wikipedia day with a fresh
  fallback day in one list without saying so.

Backtest before shipping. TMDB can be tested now: replay the last 60 days
from the export files and measure how much a TMDB-lift top 20 overlaps the
Wikipedia top 20. Trakt documents no history, so start collecting its daily
lists now and test it after a few weeks.

## The Wikimedia delay

### What the docs promise

- The Analytics API loads data "at the end of the time span in question". It
  says loading "is usually done within a few hours, but can take 24 hours or
  more if there are problems". To hear about delays, the docs say to
  subscribe to the analytics mailing list.
  ([Troubleshooting](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/troubleshooting.html))
- The same page says a 404 can mean zero views or "data that hasn't been
  loaded", and the API "can't distinguish" the two. Our collector already
  treats absent days as unknown. Keep it that way.
- No service level is published for pageviews. The rate limits page points
  commercial users who need an "SLA" to Wikimedia Enterprise
  ([Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)).
  Whether Enterprise offers pageviews at all: unverified.

### What normally happens

- A community report says daily data for day D "usually show[s] up at
  03:00 UTC" on D+1.
  ([T441554](https://phabricator.wikimedia.org/T441554))
- Hourly dump files for October 2026 (380 files) appeared a median of
  2 h 15 min after the end of their hour. The 90th percentile was 2 h 37 min,
  and the worst was 10 h 48 min (observed in the
  [directory listing](https://dumps.wikimedia.org/other/pageviews/2026/2026-10/)).
  The file name is the end of the hour (see the check below). So day D is
  complete in the dumps at about 02:15 UTC on D+1.
- The daily `pageview_complete` files appeared at about 02:30 UTC the next
  day. Example: `pageviews-20261015-user.bz2` at 16-Oct 02:29 (observed in the
  [listing](https://dumps.wikimedia.org/other/pageview_complete/2026/2026-10/)).
- Our flow waits for the 08:00 UTC hourly run before it probes, so we add up to
  5 hours on top of Wikimedia's delay on a normal day.
  (`goodwatch-flows/windmill/f/buzz/daily.schedule.yaml`, `0 0 8-23 * * *`.)

### What is happening now (observed 2026-10-18, about 14:00 UTC)

| Product | Last data | Published at |
| --- | --- | --- |
| Analytics API, per-article and aggregate, en/de/fr/es | 2026-10-15 | not listed |
| Analytics API, `top` for 2026/10/16 | 404 "we do not have data" | |
| `pageview_complete` daily dumps | 2026-10-15 (user and automated) | 16-Oct 02:29 to 02:33 |
| Hourly `pageviews` dumps | hour `20261016-190000` | 16-Oct 21:15 |

So the hourly job kept running for 19 hours of 16 October (the file named
19:00 covers 18:00 to 19:00), then stopped. All language editions are
affected, so other Wikipedias are no fallback. The Wikipedia "featured" feed for 2026-10-17 has no `mostread`
block (observed), which fits, because "most read" comes from the same data.

[T441554](https://phabricator.wikimedia.org/T441554) ("Pageviews data may
occasionally come in later than usual") was opened 2026-10-18 01:57 UTC. It
was updated at 09:36 to say 17 October is also missing. As of this writing it
is "Open, Needs Triage". The [Wikimedia status
page](https://www.wikimediastatus.net/api/v2/summary.json) says "All Systems
Operational" and lists only Reading and Editing. It does not cover analytics.
I could not read the analytics list archive for October 2026 (the archive
page loads threads with JavaScript). No notice found: unverified.

### This keeps happening

| Task | Data missing | Fixed | Notes |
| --- | --- | --- | --- |
| [T423818](https://phabricator.wikimedia.org/T423818) | from 2026-04-17 | 2026-04-21 | "Cassandra jobs that have been failing for the past 3 (now 4) days" were backfilled. The reporter notes the status page showed all operational. |
| [T427171](https://phabricator.wikimedia.org/T427171) | from 2026-05-22 | 2026-05-26 | Last hourly file was `pageviews-20260522-110000`. "A failure on May 23rd which prevented pageview to flow during 3 days." |
| [T435038](https://phabricator.wikimedia.org/T435038) | from 2026-08-14 | 2026-08-19 | Hourly files for 14 Aug were complete, but the day never reached the API. Hourly files stopped at 15 Aug 05:00. Closed with "I don't know why". |
| [T441554](https://phabricator.wikimedia.org/T441554) | from 2026-10-16 | open | Hourly files stop at 16 Oct 19:00. |

In three of the four cases the hourly files ran longer than the daily API:
11 hours in May (inferred from the last file name), a full day in August, and
19 hours in October. In all four, everything came back with a
backfill. Our flow already handles that: once the days arrive, the next run
fills and publishes them as dated snapshots.

### Can we compute "yesterday" from the hourly dumps?

Yes. The sums match the API exactly. On a normal day this gains under an
hour over the API (about 02:15 versus about 03:00 UTC). Its value is in
outages where only the API stalls: it would have covered 14 August.

- Format: one gzipped text file per hour with
  `domain_code page_title count_views total_response_size`. `en` is desktop
  and `en.m` is mobile web. The dataset "filters out as many spiders and bots
  as we can detect".
  ([Wikitech: Pageviews](https://wikitech.wikimedia.org/wiki/Data_Platform/Data_Lake/Traffic/Pageviews))
  The page says the time in the file name "refers to the end of the
  aggregation period". The check below confirms this.
- Size: about 60 to 69 MB per hour, so about 1.6 GB per day (observed).
- Limits: dumps "are also rate limited and capped at 3 connections per-IP",
  and need a policy-compliant User-Agent.
  ([dumps.wikimedia.org](https://dumps.wikimedia.org/)) Streaming 25 hourly
  files one after another, decompressing and filtering on the fly, took
  305 seconds (observed). Nothing needs to be written to disk.
- License: CC0. ([Pageviews readme](https://dumps.wikimedia.org/other/pageviews/readme.html))

Check (observed 2026-10-18). I streamed the files named `20261015-000000`
through `20261016-000000`, kept the `en` and `en.m` lines for four articles,
and compared them with the API's `all-access` daily value for 2026-10-15.

| Article | Files `-01` to next `-00` (end-labelled day) | Files `-00` to `-23` | API `user` | API `all-agents` |
| --- | --- | --- | --- | --- |
| Breaking_Bad | 13,256 | 13,507 | 13,256 | 15,189 |
| The_Godfather | 5,249 | 5,261 | 5,249 | 6,061 |
| Wednesday_(TV_series) | 4,727 | 4,765 | 4,727 | 5,265 |
| Main_Page | 6,269,720 | 6,260,275 | 6,269,720 | 18,117,811 |

The end-labelled sums equal the API `user` values exactly. So the hourly
files are the `user` agent type, `en` plus `en.m` covers `all-access` for
these articles, and a day made from dumps can go straight into the existing
baseline. Four articles on one day is a small sample. Repeat it for a week
and more titles before relying on it.

Design notes for a collector:

- Run hourly. Stream each new file, keep only lines for our mapped articles
  (`en` and `en.m` lines with the same article titles the API calls use), and
  store per-hour counts. Delete nothing upstream, keep nothing else.
- Call a day complete only when all 24 files exist (`D-010000` through
  `D+1-000000`). Then the existing scorer can use it with no formula change.
  Record the source per day (`api` or `hourly_dump`), and let a later API
  value replace the dump value if they ever differ.
- Absent lines mean zero views for that hour only if the file exists. A
  missing file is unknown, as with API 404s today.
- The mobile app traffic question is open: the check matched exactly, so
  either app views are inside `en.m` or these articles had none. Unverified.

### Nowcasting a partial day

On 2026-10-18 we have 19 of 24 hours for 16 October. We could scale the
partial sum by the share those hours usually carry (from the same title's
history, or from the project total). This is a guess with a known error. It
is fine for an internal signal. I would not publish a nowcast as
"yesterday's views" on the page. Unverified: how stable the hourly share is
for single articles. Article traffic around a premiere can be very peaky.

### EventStreams and edit activity

- [EventStreams](https://wikitech.wikimedia.org/wiki/Event_Platform/EventStreams_HTTP_Service)
  is a public Server-Sent Events feed of changes (`recentchange`,
  `revision-create` and others). It has no pageview stream. It supports
  "timestamp based historical consumption" since 2018, so a batch job can
  read back over a window instead of staying connected. The retention window
  is not stated on that page: unverified.
- A simpler route is the Action API. For each mapped article, ask for
  revisions in the last 24 hours. About 600 requests a day sits well under the
  200 requests per minute allowed for a client with a compliant User-Agent.
  ([Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits))
- Is edit activity a usable proxy? Unverified. Editors update cast lists,
  box office figures and episode tables around a release, so edits likely
  rise with attention. But many very popular titles get few edits, and edit
  wars or vandalism add noise. Test it against our 60 days of pageviews
  before using it. At best it can tell us "something is happening to this
  title" when pageviews are missing.

### Rate limits and terms for the Wikimedia sources

- Analytics API data is CC0. A User-Agent with contact details is required.
  ([Access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html))
- Since 2026, unauthenticated requests with a compliant User-Agent get
  200 requests per minute. Requests with no identification get 10 per minute.
  Keep 3 or fewer concurrent requests.
  ([Rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits))
  Our collector is sequential with a 0.5 s pause, so it stays under this.

## Source comparison

Latency is the time from the activity to the data being readable by us.
"Display" is whether showing a ranking derived from the data on a public site
with ads or a business purpose looks allowed.

| Source | Signal | Latency | Movie / show coverage | Cost and auth | Display on our page | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| Wikipedia daily API (current) | Article reads | ~3 h normal; 4 to 5 day outages in 2026 | Good for titles with an en article | Free, User-Agent | CC0, allowed | Done |
| Wikipedia hourly dumps | Article reads per hour, equals API `user` | ~2 h 15 min after each hour | Same | Free, 3 connections, ~1.6 GB/day, ~5 min | CC0, allowed | Medium |
| Wikipedia edits | Edit count | Seconds | Same, sparse | Free, User-Agent | CC BY-SA content, counts are facts | Low to medium |
| TMDB trending day | TMDB rank over a day | Daily (exact refresh time not documented) | Very good | Already have key | Already used; TMDB terms apply | Done (stored) |
| TMDB popularity | Smoothed daily score | Daily export file by 08:00 UTC; 3 months kept | Very good | Free file, no auth | Already used; TMDB terms apply | Low |
| Trakt trending | Watchers in last 24 h | Near real time | Good, TMDB IDs included | Free client ID, 500 GET per 5 min | Listed as permitted use; branding guide applies | Low |
| Trakt watched / played (daily) | Unique watchers per day | Daily snapshot | Good | Same | Same | Low |
| Bluesky Jetstream | Posts that mention a title | Seconds | Uneven, English-heavy, matching is hard | Free live stream, no auth | Developer guidelines apply; show counts, not posts | High |
| Mastodon trends | Trending links, tags, posts per instance | Periodic | Thin | Free, public | Already used for posts | Done |
| YouTube Data API | Trailer view counts | Minutes | Good for new releases | Free, 10,000 units/day | Raw counts only; derived scores not allowed | Low (but blocked by policy) |
| Google Trends API | Search interest | Unknown | Very good | Closed alpha, apply | Unknown | Blocked |
| Google Trends RSS | 10 top searches per country | Hourly-ish | Rarely about titles | Free, no auth | No license given | Low, low value |
| Reddit | Posts, comments, votes | Minutes | Good | Approval needed since Nov 2025 | Commercial terms | Removed by owner |
| Netflix Top 10 | Weekly views per title | Weekly, Tuesday after the week | Netflix only | Free TSV | Already used as a hint | Done |
| JustWatch Streaming Charts | Daily rank on JustWatch | Daily | Very good | Partner contract | Only with contract and attribution links | Blocked |
| FlixPatrol | Platform top 10 aggregates | Daily | Very good | Paid, from $9.99/month | Terms not found | Medium, paid |
| IMDb datasets | Ratings and vote counts | Daily | Very good | Free, non-commercial only | Non-commercial; no MOVIEmeter | Done (episodes) |
| Letterboxd | Popular this week | n/a | Movies | API by application only | Not granted for this use | Blocked |
| Box office (BFI UK weekend) | Weekend gross | Weekly | UK cinema releases only | Free PDF | Unverified | Medium |

## Per-source notes

### TMDB

- Popularity for movies uses the "number of votes for the day", views,
  favourites, watchlist additions, release date, total votes and the
  "previous days score". For shows, the release date is replaced by the next
  or last episode air date. TMDB calls it a "lifetime" score that is
  "calculated quite differently than trending". Trending uses "much shorter"
  daily and weekly windows.
  ([Popularity and Trending](https://developer.themoviedb.org/docs/popularity-and-trending))
- The docs do not say when trending or popularity refresh. Third parties
  report a daily refresh: unverified. We can measure it ourselves, because
  `doc.buzz_trending` stores each daily capture.
- Rate limits are "somewhere in the 40 requests per second range".
  ([Rate limiting](https://developer.themoviedb.org/docs/rate-limiting))
- Terms: cached data may be kept no longer than six months, and the TMDB logo
  and a "not endorsed" notice are required. A revenue-generating site counts as
  commercial use, which needs a separate agreement.
  ([API terms](https://www.themoviedb.org/api-terms-of-use)) This applies to
  GoodWatch already. It is not new to the buzz work, but worth knowing.
- Mapping: native TMDB IDs. No work.
- History: the same page says "daily file exports include popularity values
  starting April 28, 2017". The exports are the daily ID files
  ([Daily ID exports](https://developer.themoviedb.org/docs/daily-id-exports)).
  Each line has `id`, `original_title` and `popularity`. "The export job runs
  every day starting at around 7:00 AM UTC, and all files are available by
  8:00 AM UTC." There is "currently no authentication". Files "are only made
  available for 3 months". The 2026-10-17 movie file is 28 MB gzipped, and
  the 2026-08-01 file still downloads (observed).
- This means we can backfill about 90 days of daily popularity for every
  title today, with no API calls. That makes a TMDB backtest against our
  Wikipedia history possible right away.
- How to use it: compute `popularity_today / mean(popularity, last 28 days)`
  per title, like the Wikipedia lift. Because popularity carries the previous
  day's score, expect slower and smaller lifts. Trending rank alone is not a
  lift, because it already mixes in absolute size.

### Trakt

- `GET /movies/trending` and `/shows/trending` return "the most watched
  movies over the last 24 hours", ordered by `watchers`. Each item carries
  `ids.tmdb`. The response also has an `X-Trending-User-Count` header.
  ([trakt-api contract](https://github.com/trakt/trakt-api/blob/master/projects/api/src/contracts/movies/index.ts),
  [legacy docs](https://trakt.docs.apiary.io/))
- `/movies/watched/{period}` with `daily` gives unique watchers for the day.
  `/anticipated` counts lists. `/hot` exists but its meaning is not
  documented ("currently hot on Trakt").
- `/movies/{id}/watching` gives people watching right now for one title.
- Limits: 500 GET calls per 5 minutes for an unauthenticated client ID per
  public IP (lowered from 1,000, guide updated 2026-10-13).
  ([Rate limits](https://github.com/trakt/trakt-api/blob/master/projects/developer/src/lib/guides/rate-limiting.md))
  One daily pass over a few pages of trending plus the watched lists is a
  few dozen calls.
- Terms: the API use policy lists "An app that displays public discovery
  information, such as trending titles" as permitted. It forbids
  "Redistributing Trakt data as a feed or dataset that other services use to
  populate their own catalogs, rankings" and bulk mirroring.
  ([API use policy](https://github.com/trakt/trakt-api/blob/master/projects/developer/src/lib/guides/api-use-policy.md))
  A ranking on our own page fits the permitted case. An open GoodWatch MCP or
  API that re-serves Trakt counts to other services may not. Creating an app
  needs a verified GitHub account, and apps unused for 30 days are deleted.
  ([Create an app](https://github.com/trakt/trakt-api/blob/master/projects/developer/src/lib/guides/create-an-app.md))
  Follow the [branding guide](https://app.trakt.tv/branding) when we credit
  Trakt.
- Caveats: Trakt users skew toward people who track what they watch, often
  with media-server scrobbling. It measures watching, which trails the
  conversation for new trailers or announcements. Counts are small for
  niche titles, so use a floor like the Wikipedia one.

### YouTube Data API

- Quota: 10,000 units per day by default. Reading a list of videos usually
  costs 1 unit, so view counts for 50 videos cost 1 unit.
  ([Getting started](https://developers.google.com/youtube/v3/getting-started))
- Policy blocker: API clients "must not ... access or use API Data to create
  new or derived data or metrics". The example forbids "a score that factors
  in likes, total views, or any other API Data". Statistics from public data
  must not be stored "for more than 30 days".
  ([Developer policies](https://developers.google.com/youtube/terms/developer-policies))
- An amendment allows some derived metrics for audited developers whose
  "API Service must reflect an analytics use case on YouTube".
  ([Derived metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy))
  GoodWatch is not an analytics tool for YouTube, so this does not fit.
- Conclusion: we may show a trailer with its current YouTube view count. We
  should not feed view velocity into the buzz score.

### Google Trends

- The official API is an alpha. "We're now accepting applications for alpha
  testers", with priority for developers "that know what they want to do".
  It offers five years of data and daily aggregation, and values are not
  scaled to 0 to 100.
  ([Trends API](https://developers.google.com/search/apis/trends))
- Terms, pricing and latency for the alpha are not public: unverified.
- The "trending now" RSS feed (`trends.google.com/trending/rss?geo=US`)
  returned 10 items, mostly sports, on 2026-10-18 (observed). Too coarse for
  titles.
- Option: apply for the alpha with a concrete use case. It would be the best
  single attention signal if granted, since search interest covers everyone,
  not just Wikipedia readers.

### Reddit

- The owner removed Reddit from the social launch on 2026-10-14
  ([social.md](social.md)).
- Since 2025-11-11, "self-service access to Reddit's public data API" is
  closed and new developers "will need to request approval"
  ([r/redditdev announcement](https://www.reddit.com/r/redditdev/comments/1oug31u/),
  read through a mirror because reddit.com blocked the fetch). Listed for
  completeness only.

### Bluesky and Mastodon

- Jetstream streams Bluesky records as JSON over one WebSocket. "No
  authentication is required for the live tail", and Bluesky's public
  instances "serve the full network".
  ([Jetstream docs](https://bsky.network/docs/jetstream/))
- Replay and snapshots of history need an API key and are metered in bytes.
  ([Network Replay](https://bsky.network/docs/jetstream-replay))
  The live stream "is not metered". A daily batch job could use replay
  instead of a long-running process. The key process and quotas: unverified.
- Bluesky's [developer guidelines](https://bsky.network/docs/developer-guidelines)
  require honoring deletions. Counting mentions and storing only counts and
  post IDs keeps this simple. We already purge deleted posts in the social
  flow.
- Matching is the real cost. A plain title search fails on titles like
  "Wednesday" or "Him". Precise options: links to official trailers (our
  YouTube video ID crosswalk), links to TMDB, IMDb or Letterboxd pages, and
  hashtags. The existing social matcher uses an LLM in a batch job, which is
  allowed (no query-time LLM). Running every Bluesky post through it is not
  cheap. Prefilter by the candidate pool's names first.
- Mastodon trends are per instance and "periodically recalculated", and tags
  cover "the past week".
  ([Trends API](https://docs.joinmastodon.org/methods/trends/)) We already
  read three instances. Too thin to rank by.

### Streaming charts

- JustWatch: the Streaming Charts API gives a daily, weekly and monthly rank
  per title with rank changes. Access needs a contract and a partner token,
  and every rank must link to the JustWatch title page.
  ([JustWatch API docs](https://apis.justwatch.com/docs/api/)) Pricing is not
  public.
- FlixPatrol: "Access to the FlixPatrol API is a paid service". Plans start at
  $9.99 per month; Premium is $49 per month with 1,000 calls per month.
  ([FlixPatrol premium](https://flixpatrol.com/about/premium)) Display terms
  not found: unverified. Its data is itself an aggregate of platform top 10
  rows.
- Reelgood: not researched in depth. No public self-serve API found:
  unverified.
- Netflix Top 10: we already read
  `https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv`. It is weekly
  and becomes usable on the Tuesday after the week ends
  ([buzz-score.md](buzz-score.md)). Too slow for a daily ranking, good as a
  reason hint, as now.
- Other services: no official per-title daily data was found for Disney+,
  Max, Prime Video or Apple TV: unverified.

### IMDb and Letterboxd

- IMDb non-commercial datasets are seven daily files (`title.basics`,
  `title.ratings` and others). None holds popularity or MOVIEmeter. Use is
  "for personal and non-commercial use".
  ([IMDb datasets](https://data.imdb.com/non-commercial-datasets/)) The daily
  `numVotes` delta could be a slow attention signal, but the license makes it
  a poor base for a public ranking.
- Letterboxd: API access is by application. The page says Letterboxd is not
  granting access for "data analysis, visualization or recommendation"
  projects, among others. (Read through search results because
  [letterboxd.com/api-beta](https://letterboxd.com/api-beta/) returned 403 to
  the fetcher.)

### Box office

- No free official daily box office API was found: unverified. The BFI
  publishes weekly UK weekend figures for the top 15 films as PDF reports.
  ([BFI weekend box office](https://www.bfi.org.uk/industry-data-insights/weekend-box-office-figures))
  Weekly and UK-only. Useful as a reason hint for cinema releases, not as a
  daily signal.

### Others seen in passing

- TVmaze is CC BY-SA with at least 20 calls per 10 seconds. It documents no
  popularity or trending field.
  ([TVmaze API](https://www.tvmaze.com/api))
- Simkl publishes "most watched" lists as static JSON. Its docs moved to
  `api.simkl.org`; details and terms: unverified.

## Possible ranking designs

### A. Keep Wikipedia, publish sooner, tolerate short stalls

- Start the schedule at about 02:30 UTC, not 08:00 UTC, so we read the day
  when it appears. This is a one-line change and the largest gain on a
  normal day.
- Add the hourly-dump collector. Score yesterday as soon as the file named
  `D+1-000000` lands (about 02:15 UTC), or when the API has the day,
  whichever comes first.
- Effect: fresher on normal days, and partial cover for outages like
  August's. No help in outages like October's, where the hourly files stop
  too.

### B. Fallback chain with a labelled source

When Wikipedia has no data for yesterday:

1. Use hourly dumps if all 24 files for yesterday exist.
2. Otherwise build a fallback list from Trakt and TMDB lift for yesterday.
3. Otherwise keep the last published list and say its date.

Each snapshot keeps `source` and `day`. The page heading stays "Hot on
socials", and the subline says what the list is based on. Example: "From
Trakt watchers and TMDB activity, 18 Oct. Wikipedia data is delayed." When
Wikipedia catches up, the next run publishes the real Wikipedia day and
`current` uses it only if it is the same or a newer day; it never moves backwards.

Keep the snapshots separate by formula version, as the code already does
with `formula_version`. Owner decision (2026-10-18): replace the preferred fallback day with Wikipedia,
while retaining immutable source/formula snapshot copies. API and dumps both
beat other fallback sources for the same day. See buzz-score.md for the alias
and migration contract.

### C. Blended score every day

Combine several lifts into one score, so no single source decides the list.

- Normalize per title. For each source, compute
  `lift = value_today / max(mean28, floor)`, then take `log(lift)`. Per-title
  baselines remove the size difference between sources (Wikipedia reads in
  thousands, Trakt watchers in tens).
- Combine with fixed weights, for example 0.6 Wikipedia, 0.25 Trakt,
  0.15 TMDB. When a source is missing for a title or a day, drop it and
  renormalize the weights. Show which sources counted.
- Require the absolute floors per source (as the Wikipedia formula does with
  1,000 views and +500 over the mean), so tiny counts cannot produce huge
  lifts.
- Rank-based fusion (sum of reciprocal ranks per source) is an alternative
  that needs no calibration. It ignores how big a spike is.
- Risk: the list changes character. Today it says "reading attention". A
  blend says "attention across sources". Both the page copy and the
  `source` field must say which.

### D. Nowcast from partial data

- Scale partial hourly sums to a full day using the title's usual hourly
  shape. Useful to rank internally, or to pick candidates for a fallback.
- Do not present a nowcast as measured views. If shown at all, label it as
  an estimate.

### Freshness on the page

- Always show the scored day and the source. Today's payload already has
  `day` and `source`.
- When the list is more than one day behind, say why in plain words:
  "Wikipedia has not published reading figures since 15 Oct."
- Do not hide the row when it is stale. The owner rejected a label as the
  only fix, but a label is still needed alongside any fallback.

### Cost check against the owner's limits

All options are batch jobs in Windmill. None needs an LLM at query time.
Hourly dumps cost bandwidth (about 1.6 GB per day) and a little CPU. Trakt
and TMDB cost a few dozen requests per day. Bluesky counting is the only
option that needs a long-running process or a metered replay key.

## Open questions

1. The hourly sums matched the API exactly for four articles on one day.
   Does that hold for 50 titles over a week, including titles with heavy app
   traffic?
2. How well does a TMDB-lift list agree with the Wikipedia list on normal
   days? Backtest over the 60 days we hold, using the export files. Trakt
   history must be collected going forward, because no history parameter is
   documented for trending or watched lists (unverified beyond the docs).
3. When does TMDB refresh `trending/day`, and which day does the 08:00 UTC
   export's popularity describe? Measure from `doc.buzz_trending` captures
   and consecutive export files.
4. Resolved by owner (2026-10-18): Wikipedia replaces the preferred fallback
   for the same day; retain both source snapshots and never regress `current`.
5. Is Trakt's "permitted: displays public discovery information" enough, or
   should we email support@trakt.tv to confirm a blended score on a public
   page? The policy invites that for unclear cases.
6. Should we apply for the Google Trends API alpha? It costs an application
   and some feedback work. Terms are unknown until granted.
7. Do we want a GoodWatch page that says "Hot on socials" if the main source
   is Wikipedia reading plus Trakt watching? The heading may need to match
   the source.
8. Is Wikipedia edit count worth a backtest, or should we drop it?
