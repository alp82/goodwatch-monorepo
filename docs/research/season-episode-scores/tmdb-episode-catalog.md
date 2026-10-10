# TMDB episode catalog: what the API offers for crawling and refreshing episodes

Research date: 2026-10-06. Status: findings and a recommended design, not an approved implementation plan. Answers [issue #367](https://github.com/alp82/goodwatch-monorepo/issues/367). It builds on [existing-data.md](existing-data.md), [external-sources.md](external-sources.md) and [score-apis-and-grids.md](score-apis-and-grids.md) and repeats nothing from them except where a number changed.

Method: TMDB's developer docs, API terms, contribution bible and one staff forum thread, plus about 280 live `GET` requests to `api.themoviedb.org/3` with the existing TMDB key, and 15 read-only aggregate queries on the production Crate `show`, `season` and `imdb_episode` tables. Nothing was written anywhere. Every claim carries one of three labels:

- **documented**: stated by TMDB in the linked page.
- **observed**: seen in live responses on 2026-10-06, not stated in the docs. It can change without notice.
- **unconfirmed**: not established by either.

Scope: the episode catalog that the member-facing Episode list needs (terms Episode list, Regular episode, Special, Seen, Caught up, Next episode in `CONTEXT.md`, and [ADR 0008](../../adr/0008-one-row-per-watch.md), both still uncommitted on `main` on this date). Episode scores are out of scope; they are covered by the sibling notes.

## Summary

1. **One request carries 20 seasons.** `GET /tv/{id}?append_to_response=season/0,season/1,…` returns every listed season with its full episode array. The limit is 20 appended items per request (observed error text; the docs name no number). A season is never paginated: a 1,464-episode season came back whole in 462 KB of JSON.
2. **The episode object has every field the Episode list needs**: `id`, `show_id`, `season_number`, `episode_number`, `name`, `overview`, `air_date` (a date, no time, no time zone), `runtime`, `still_path`, `episode_type`, `production_code`, `vote_average`, `vote_count`, plus `crew` and `guest_stars`.
3. **`episode_type` has three observed values**: `standard`, `mid_season`, `finale`. TMDB documents none of them. `finale` does not say whether it ends the season or the series.
4. **Episode ids are not permanent.** TMDB staff: "Episodes can be deleted and re-added (which would be a new id)", and a deleted id is never reused. Season plus episode number is the address TMDB itself uses, and that can change too when editors renumber. Storing both, as ADR 0008 does, is the right call.
5. **The change feed can drive the daily refresh.** `/tv/changes` lists every show changed in a window of up to 14 days, 100 per page. Season and episode edits create an entry at show level (documented). About 2,900 shows change per day across all of TMDB.
6. **TMDB's `status` does not tell whether a show is airing.** "Returning Series" is used "from the premiere to the very last episode" and covers 96,142 of 233,582 catalog shows. "Still airing" has to be computed from episode dates, `next_episode_to_air` and the `finale` mark.
7. **How far ahead episodes are listed depends on the release model.** Streaming seasons are listed in full with a marked finale (7 weeks ahead in the sample). Weekly network shows list about 3 to 4 weeks ahead and no finale.
8. **Budget.** Initial crawl: about 216,000 requests, roughly 1.8 hours at the 33 requests per second measured earlier. Daily: about 13,000 requests, roughly 7 minutes.
9. **External ids are not in the season payload.** They are available 20 episodes per request through an undocumented nested append, or one at a time. A reverse lookup by IMDb or TVDB episode id works and returns the TMDB episode.
10. **Row count: about 6.7 million**, of which about 109,000 are specials. Specials are stored.

## 1. Season endpoint and `append_to_response`

**Batching.** "The movie, TV show, TV season, TV episode and person detail methods all support a query parameter called `append_to_response`" (documented, [append-to-response](https://developer.themoviedb.org/docs/append-to-response)). The docs page gives no maximum. Live, 20 appended items returned 200 and 21 returned HTTP 400, `status_code` 27, "Too many append to response objects: The maximum number of remote calls is 20." (observed, same result as in external-sources.md).

- `season/0` (specials) is a valid append and counts toward the 20 (observed).
- A season number that does not exist is left out of the response without an error when appended; the direct call `GET /tv/1396/season/9` returns 404 with `status_code` 34 (observed).
- The existing details fetch already uses 11 of the 20 slots (`f/tmdb_api/tmdb_fetch_details_from_api/fetch.py`), so only 9 seasons would fit into that call.
- A season is returned whole. Doraemon season 1 (`/tv/65733/season/1`) returned 1,464 episodes in one 462 KB JSON response (observed). The largest season in Crate has 4,829 episodes.

**Season object.** Direct call `GET /tv/{id}/season/{n}`: `_id`, `id`, `air_date`, `name`, `overview`, `poster_path`, `season_number`, `vote_average`, `networks`, `episodes` (observed; fields documented in [tv-season-details](https://developer.themoviedb.org/reference/tv-season-details)). **The appended form has no integer `id`**, only the string `_id` (observed). The integer season id is in the show's `seasons[]` array, which the appended call returns anyway.

**Episode object** (observed on `/tv/1396/season/1`, field list documented in [tv-season-details](https://developer.themoviedb.org/reference/tv-season-details)):

| Field | Type | Notes from live data |
| --- | --- | --- |
| `id` | integer | TMDB episode id. Unique among episodes, not across media types (section 2) |
| `show_id` | integer | Present on every one of 4,743 sampled episodes. Absent from the standalone episode-details response |
| `season_number`, `episode_number` | integer | Numbers are unique within a season in the sample, but **not contiguous**: Doraemon season 1 has 1,464 episodes numbered up to 1,466, and the array is not in air-date order |
| `name`, `overview` | string | In the request language, English by default |
| `air_date` | string `YYYY-MM-DD` or `null` | Date only. 68 of 4,743 sampled episodes had `null`, mostly specials |
| `runtime` | integer or `null` | Minutes. `null` on 468 of 4,743, and on most unaired episodes |
| `still_path` | string or `null` | |
| `episode_type` | string | `standard`, `mid_season`, `finale` |
| `production_code` | string | Empty string on every Breaking Bad episode; rarely filled |
| `vote_average`, `vote_count` | number, integer | |
| `crew`, `guest_stars` | arrays | The bulk of the payload; not needed for the catalog |

**`episode_type`.** In 4,743 episodes of the 60 top-rated shows: 4,555 `standard`, 166 `finale`, 22 `mid_season`, no other value (observed). The OpenAPI reference only gives the example "standard" ([tv-season-details](https://developer.themoviedb.org/reference/tv-season-details)), and the contribution bible's Episodes page has no section on episode types ([bible, Episodes](https://www.themoviedb.org/bible/tv/59f743289251416e71000037)). So the meanings below are read off the data:

- `finale`: the last episode of a season. 162 of 166 were the last entry of their season array; 4 were not. Every regular season of the ended or canceled shows on the first top-rated page carried one (21 of 21). Whether a finale is a season or a series finale is not in the field (unconfirmed how the website derives its label).
- `mid_season`: the last episode before a break inside a season, for example Breaking Bad season 5 episode 8 of 16.
- `standard`: everything else, including every special sampled.
- A premiere value was not seen. Coverage of `finale` across the long tail is unconfirmed; the sample is popular shows only.

## 2. Stability of episode and season ids

**Episode ids change when an episode is deleted and added again** (documented by staff). Travis Bell, TMDB, in [this support thread](https://www.themoviedb.org/talk/552e997ac3a36804cd0013ab) (2015): "Episodes can be deleted and re-added (which would be a new id)", "you can only query by the combination 'season number' and 'episode number'", "The id is only useful when tracking changes via the changes API", and "Once an object has been deleted the ID is never reused". Ids are unique within a media type only, so an episode id can equal a show id.

Live data shows this happening inside old seasons (observed): Breaking Bad season 2 episodes 3 to 13 have ids 62094 to 62104, but episodes 1 and 2 have 972873 and 972874, so those two were re-created later. Its specials 7 to 9 have ids above 1,836,000.

**There is no lookup by episode id.** The only episode endpoints are addressed by show, season number and episode number; the id works only on `/tv/episode/{id}/changes` (documented, same thread, and the [reference](https://developer.themoviedb.org/reference/tv-episode-changes-by-id)). To find where a known id now lives, the show's seasons must be fetched and searched.

**Renumbering and moving.** The bible requires that "Episodes should be added exactly as they first aired on the original network (title, date, order, season)" and that "The first episode of a season is always '1' not '0'" ([bible, Episodes](https://www.themoviedb.org/bible/tv/59f743289251416e71000037)), and editors fix entries that break this. Whether an episode keeps its id when an editor changes its number or moves it to another season is **unconfirmed**. The configuration endpoint lists `episode_number` and `season_number` among the change keys (observed, `/configuration`), which suggests an in-place edit exists, but no TMDB statement says which path editors use.

**Season ids.** The repo already assumes a season can come back under a new id: `delete_stale_seasons` in `f/sync/copy/tmdb_details.py` deletes season rows whose id TMDB no longer lists. No TMDB statement on season id stability was found (unconfirmed). Merged seasons were not observed.

**Specials.** "The special season is always Season 0. Special episodes are any episodes that did not originally air as part of a regular, usually numbered season." It holds "Blooper episodes, recap episodes, preview episodes, best of episodes, live TV specials, (un)aired pilots, unaired or blacklisted episodes" and "Web specials, OVAs and spin-off webseries" ([bible, Seasons](https://www.themoviedb.org/bible/tv/59f73eb49251416e71000026)). Episodes released as "Episode 0" also go there ([bible, Episodes](https://www.themoviedb.org/bible/tv/59f743289251416e71000037)). In the API, season 0 is an ordinary season named "Specials" with `season_number: 0`; its episodes often have no air date and are not in air order (observed). This matches the glossary: a Special is an episode outside the numbered seasons.

**Episode groups** are alternative orderings of the same episodes: original air date, absolute, DVD, digital, story arc, production, TV (documented, [tv-episode-group-details](https://developer.themoviedb.org/reference/tv-episode-group-details)). A group entry carries the same episode `id` together with its canonical `season_number` and `episode_number` and an `order` inside the group (observed). Naruto Shippūden has 8 groups, Breaking Bad 1, Rick and Morty none. They do not matter for the catalog, because the Episode list uses TMDB's default numbering. They may matter for imports: a source that numbers by TVDB or absolute order will not match TMDB's season and number, and a group named "TVDB Order" or "Absolute" is a ready-made mapping where one exists. That belongs to the import research.

## 3. Change tracking

| Endpoint | Returns | Window | Pages |
| --- | --- | --- | --- |
| `GET /tv/changes` | Ids of shows changed in the window (`id`, `adult`) | Default last 24 hours, up to 14 days per query | 100 per page; page 501 is rejected, so 50,000 ids per query |
| `GET /tv/{id}/changes` | The show's change entries by key | Same | `page` accepted |
| `GET /tv/season/{season_id}/changes` | The season's entries; key `episode` names changed episodes | Same | `page` accepted |
| `GET /tv/episode/{episode_id}/changes` | Field-level entries: `name`, `overview`, `runtime`, `images`, `crew`, … | Same | |

Sources: "These endpoints will return a list of items that have been changed in the past 24 hours (by default but can be extended to 14 days)" ([tracking-content-changes](https://developer.themoviedb.org/docs/tracking-content-changes)); "You can query this method up to 14 days at a time", "100 items are returned per page" ([changes-tv-list](https://developer.themoviedb.org/reference/changes-tv-list)); [tv-series-changes](https://developer.themoviedb.org/reference/tv-series-changes), [tv-season-changes-by-id](https://developer.themoviedb.org/reference/tv-season-changes-by-id), [tv-episode-changes-by-id](https://developer.themoviedb.org/reference/tv-episode-changes-by-id).

**Episode edits surface at show level** (documented): "TV show changes are a little different than movie changes in that there are some edits on seasons and episodes that will create a top level change entry at the show level" ([tv-series-changes](https://developer.themoviedb.org/reference/tv-series-changes)). Observed on MobLand (`247718`): the show's changes had 17 `season` entries in 14 days, each `{"season_id": 528409, "season_number": 2}`; the season's changes had 28 `episode` entries, each `{"episode_id": …, "episode_number": …}`; the episode's changes showed the runtime going 43, 46, 48 over three days.

**Volumes** (observed): 2,910 shows changed in the 24 hours to 2026-10-06 (30 pages), 17,469 in 14 days (175 pages). Those are all TMDB shows, not only the ones in the GoodWatch catalog. In a sample of 40 of that day's shows, 11 had a `season` entry and 7 had nothing but a `season` entry, so episode-only edits do put a show on the list. A range longer than 14 days returns HTTP 422, "Invalid date range: Should be a range no longer than 14 days." A window in August returned results, so the 14 days limit the span of one query and not how far back it may start (how far back history goes is unconfirmed).

**Two gaps.**

- 14 of the 40 sampled shows were on the day's list but returned no entries from `/tv/{id}/changes` for the same dates. The reason is unconfirmed (a different window boundary, or change types the per-show endpoint does not expose). The list is therefore the reliable signal; the per-show call is not a safe filter.
- "some edits on seasons and episodes" is TMDB's wording. Nothing says that every episode edit creates a show-level entry. A deleted show is not on the list either; the details fetch finds it through the 404 it already handles.

**Answer:** yes, `/tv/changes` can drive a daily refresh of only the shows that changed, at 30 list requests a day. It should not be the only trigger; section 7 keeps a 30-day sweep behind it. The daily ID export has no season or episode file ([daily-id-exports](https://developer.themoviedb.org/docs/daily-id-exports)).

## 4. Telling that a season is still airing

**Show-level fields** ([tv-series-details](https://developer.themoviedb.org/reference/tv-series-details); the reference gives types but no descriptions):

- `status`. The bible defines "Returning Series: status we use from the premiere to the very last episode of a series. It basically means that the series will return... tomorrow, next week, in two months, in a year", "Ended: the series is over and the end was planned in advance", "Cancelled: cancelled by the network", "In Production: a new series is greenlighted and/or the production has started, but it is not yet released", and Pilot ([bible, Primary Facts](https://www.themoviedb.org/bible/tv)). The API spells it `Canceled` and also returns `Planned` (observed). So `Returning Series` means "not ended", not "on air now". It is also the default nobody corrects: Crate has 96,142 Returning Series shows, and only 3,402 of them aired anything in the last 90 days.
- `in_production`: in Crate it is `true` for exactly the Returning Series, In Production, Planned and Pilot shows and `false` for Ended and Canceled (observed). It adds nothing to `status`.
- `next_episode_to_air`: an episode object or `null`. It was set on every currently airing show sampled and `null` on Breaking Bad. It is the earliest listed episode dated today or later (observed: Ted Lasso's was dated 2026-10-06, the day of the check).
- `last_episode_to_air`: the latest episode dated before that, with its `episode_type`. A show between seasons has `last_episode_to_air.episode_type = finale` and a `next_episode_to_air` in the next season (observed on Law & Order: SVU and NCIS).
- `/tv/on_the_air` lists "TV shows that air in the next 7 days" ([reference](https://developer.themoviedb.org/reference/tv-series-on-the-air-list)): 1,646 shows on 2026-10-06. `/tv/airing_today`: 456.

**How far ahead unaired episodes are listed** (observed on 2026-10-06, latest season of each show):

| Show | Listed | Still to air | Furthest date | Finale marked |
| --- | --- | --- | --- | --- |
| MobLand S2 (streaming, weekly) | 10 | 7 | 2026-11-20, 6.5 weeks | yes |
| American Horror Story S13 | 13 | 7 | 2026-10-29 | yes |
| Slow Horses S6 | 6 | 3 | 2026-10-21 | yes |
| Ted Lasso S4 | 10 | 0 (last one airs today) | | yes |
| Law & Order: SVU S28, Law & Order S26, Chicago Fire S15, Chicago P.D. S14 | 4 | 4 | 2026-10-28 or 29, 3 weeks | no |
| NCIS S24 | 4 | 3 | 2026-10-27 | no |
| FBI S9 | 2 | 1 | 2026-10-12 | no |
| Saturday Night Live S52 | 9 | 7 | 2026-12-19, 10.5 weeks | no |
| The Daily Show S31 | 126 | 14 | 2026-11-05 | no |
| Coronation Street S67 | 192 | 9 | 2026-10-16 | no |
| Running Man S1 (one season since 2010) | 825 | 4 | 2026-11-01 | no |

- A streaming season is listed in full once its schedule is announced, with the finale marked.
- A weekly network season grows a few episodes at a time, about 3 to 4 weeks ahead, and has no finale until the end is announced. Its listed episode count is not the season's length.
- Unaired episodes usually have no runtime yet.
- The bible forbids invented dates: "No guessed air dates please!", and "Blank episodes (with a missing title and/or air date) should be avoided", with an exception for upcoming premieres ([bible, Episodes](https://www.themoviedb.org/bible/tv/59f743289251416e71000037)). So a listed future date is an announced one, and a gap in the schedule simply shows as no future episode.
- Shows not yet released exist with one placeholder episode years ahead (first air dates 2027 to 2043 in the sample) and status Planned, In Production or even Returning Series.

**`air_date` has no time and no time zone.** It is the original network's date. "Aired" can only be decided to the day.

## 5. Rate limits, terms and request budget

**Rate limit.** "As of December 16, 2019, we have disabled the original API rate limiting (40 requests every 10 seconds.)", "we do still have some upper limits to help mitigate needlessly high bulk scraping. They sit somewhere in the 40 requests per second range", "respect the `429` if you receive one" ([rate-limiting](https://developer.themoviedb.org/docs/rate-limiting)). Whether the limit counts per key or per IP is not stated. The benchmark in score-apis-and-grids.md ran 33 requests per second at concurrency 8 without a 429. No `x-ratelimit` header is sent (observed).

**Terms** ([API terms of use](https://www.themoviedb.org/api-terms-of-use), last updated 2023-10-20):

- Caching: it is prohibited to "Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs." A 30-day refresh keeps every live row well inside that. Rows kept for removed episodes need an expiry (section 7).
- Attribution: "You must use the TMDB logo to identify Your use of TMDB, the TMDB APIs, or TMDB Content", less prominent than the product's own, and "You must place the following notice prominently in or on Your Application: 'This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.'" The footer shows the TMDB logo (`goodwatch-webapp/app/ui/Footer.tsx`); a search of `goodwatch-webapp/app` for the notice sentence found nothing.
- Commercial use needs a separate agreement. The terms count as commercial, among others, using TMDB for "driving traffic or generating revenue for a website" including from advertising, and revenue-generating sites that recommend movies or shows. This is not new with episodes: the catalog GoodWatch already holds falls under the same clause. It is an owner question, not something this note can settle.
- Nothing in the terms limits row counts. 6.7 million episode rows are the same kind of use as the 1.6 million titles already stored.

**Catalog size** (Crate, 2026-10-06; these differ from the 2026-09-25 figures in existing-data.md, and the difference was not investigated):

| | |
| --- | --- |
| Shows | 233,582 |
| Shows with at least one season row | 214,568 |
| Shows with no season | 19,369 (20,821 with `number_of_episodes` 0 or null) |
| Season rows | 400,926, of which 12,794 are specials and 23,729 list no episode |
| Episodes, sum of `season.episode_count` | 6,717,445, of which 108,701 are specials |
| Shows with more than 20 season rows | 1,275 |
| Returning Series that aired in the last 90 days | 3,402 |
| Shows that aired in the last 30 days | 1,463 |

**Initial crawl.** One request per 20 listed seasons, asking for the season numbers the stored `seasons[]` names (numbers are not always 1 to n): `sum(ceil(seasons / 20))` = **216,259 requests**. Shows without a season need none. At 33 requests per second that is 1.8 hours, at 20 per second 3.0 hours. Transfer is a few GB of JSON, less than a tenth of that gzipped (score-apis-and-grids.md).

**Daily refresh.**

| Part | Requests per day |
| --- | --- |
| `/tv/changes`, last 24 to 48 hours | 30 to 60 |
| Refetch the changed shows that are in the catalog | at most about 2,900 |
| Refetch shows with an episode due or just aired (section 7) | about 1,500 to 3,400, largely the same shows as above |
| 30-day sweep, 216,259 / 30 | about 7,200 |
| **Total** | **about 13,000, 7 minutes at 33 per second** |

## 6. External ids per episode

- `GET /tv/{id}/season/{n}/episode/{e}/external_ids` returns `id`, `imdb_id`, `tvdb_id`, `tvrage_id`, `freebase_mid`, `freebase_id`, `wikidata_id` (documented, [tv-episode-external-ids](https://developer.themoviedb.org/reference/tv-episode-external-ids)). Breaking Bad S1E1: `tt0959621`, TVDB `349232` (observed).
- **They are not part of the season payload.** `append_to_response=external_ids` on a season returns the season's own ids, which have no `imdb_id` (observed). `episode/1/external_ids` appended to a season call is ignored (observed).
- **A nested append on the show call works**: `GET /tv/1396?append_to_response=season/1/episode/1/external_ids` returned that episode's ids under the key `season/1/episode/1/external_ids` (observed, not documented). That is 20 episodes per request, and those slots compete with the 20 season slots. All 6.7 million episodes would take about 336,000 requests, roughly 2.8 hours at 33 per second, on top of the episode crawl.
- **Reverse lookup works**: `GET /find/tt0959621?external_source=imdb_id` and `GET /find/349232?external_source=tvdb_id` both returned `tv_episode_results` with the episode `id`, `show_id`, `season_number` and `episode_number` (observed). One request resolves one imported episode.
- IMDb episode ids for 844,466 episodes of 41,579 shows are already in Crate `imdb_episode`, in IMDb's numbering.
- How many TMDB episodes have an `imdb_id` or `tvdb_id` at all is unconfirmed; it was checked on one episode.

For imports this means: a source that gives a TMDB episode id or season plus number matches the catalog directly. A source that gives only a TVDB or IMDb episode id can be resolved through `/find` at import time without storing external ids for the whole catalog.

## 7. Proposed catalog design

A recommendation with reasons. It changes two points of the `episode` table proposed in existing-data.md: the key and the handling of removed episodes.

### Crate table `episode`

```python
# The episodes of every show in TMDB's numbering (Episode list), one row per TMDB episode.
# Season 0 holds the specials. One show's list is one routed read.
"episode": {
    "columns": {
        "show_id": "INTEGER",
        "tmdb_id": "INTEGER",            # TMDB episode id
        "season_tmdb_id": "INTEGER",     # season.tmdb_id
        "season_number": "INTEGER",      # 0 = special
        "episode_number": "INTEGER",
        "name": "TEXT",
        "air_date": "TIMESTAMP",         # midnight UTC of TMDB's date, NULL when unknown
        "runtime": "INTEGER",
        "still_path": "TEXT",
        "episode_type": "TEXT",          # standard, mid_season, finale
        "tmdb_user_score_original": "DOUBLE",
        "tmdb_user_score_rating_count": "INTEGER",
        "imdb_id": "TEXT",               # NULL until an import or backfill resolves it
        "tvdb_id": "INTEGER",
        "removed_at": "TIMESTAMP",       # set when TMDB no longer lists the episode
        "created_at": "TIMESTAMP",
        "updated_at": "TIMESTAMP",
    },
    "primary_key": ["show_id", "tmdb_id"],
    "clustered_by": "show_id",
    "shards": 6,
},
```

- **Name `episode`**, next to `season`, as existing-data.md proposed. `imdb_episode` stays what it is: IMDb's numbering for the episode grid.
- **Key `(show_id, tmdb_id)`, clustered by `show_id`**, the same shape as `imdb_episode` (`show_id`, `imdb_episode_id`). Crate requires the routing column in the key. The episode id is the key, not season and number, because a member's watch stores the id: a renumbered episode is then an update of two columns, and the watch still points at it. With `(show_id, season_number, episode_number)` as key, every renumbering would be a delete and an insert, and the row a watch points at would silently become a different episode.
- **6 shards**, like the other per-show tables. About 6.7 million narrow rows.
- **`overview` is left out.** The list needs names, dates and stills. It can be added later, because init adds missing columns. Translations are left out for the same reason.
- **Score columns** use the `show` table's names and cost nothing, since the values arrive with the episode.
- **`air_date` as `TIMESTAMP`** follows `season.air_date`.
- **Specials are stored**, as `season_number = 0`. A special can be watched; it never counts toward Seen, Caught up or Next episode. A regular episode is `season_number > 0`.
- Add **`show.episodes_updated_at TIMESTAMP`**, following the `*_updated_at` columns the table already has. It separates "crawled, TMDB lists no episodes" from "not crawled yet".

**Row count: about 6.72 million, 6.61 million regular episodes and 0.11 million specials.**

### Mongo side

- A collection **`tmdb_tv_season_details`**, one document per `(tmdb_id, season_number)`, unique index on that pair, holding the season payload with each episode's `crew` and `guest_stars` removed. Those two arrays are most of the bytes and nothing planned reads them; with them a long-running daily show could approach the 16 MB document limit, without them the 1,464-episode season is under 0.5 MB.
- Crawl state per show, not per season, because one request fetches a whole show: `episodes_selected_at`, `episodes_updated_at`, `episodes_failed_at` on `tmdb_tv_details`, with an index on `episodes_selected_at`, so the existing reserve-then-fetch pattern in `f/data_source/common.py` applies unchanged.
- A separate fetch job, not more appends on the existing details call. That call has 9 free slots, its flow is already close to its time limits ([tmdb-details-failures.md](tmdb-details-failures.md)), and episodes need their own cadence.
- A small state document with the time of the last successful `/tv/changes` run.

### Refresh cadence

1. **Daily, from the change feed.** Read `/tv/changes` from the last successful run to now (overlap by a day; the 14-day window lets the job catch up after an outage of up to 13 days). Refetch the episodes of every listed show that is in the catalog. Do not filter through `/tv/{id}/changes`: it costs a request per show, the same as the refetch, and it returned nothing for a third of the sample.
2. **Daily, airing shows, as a safety net.** Refetch shows whose stored `next_episode_to_air.air_date` lies between yesterday and 7 days ahead, or whose `last_air_date` is within the last 14 days. This catches schedule changes the feed might miss. An episode turning from unaired to aired needs no refetch at all, because that is computed from the date.
3. **Every 30 days, everything else**, on the existing `STALE_AFTER_DAYS = 30` cycle. It bounds the damage of a missed change and keeps every row far younger than the 6 months the terms allow.
4. A priority title (`f/priority/publish.py`) fetches its episodes with its details.

### Removed and renumbered episodes

A refetch returns all seasons of a show, so the copy step compares the full set of episode ids for that show.

- **Id still listed, numbers changed:** update the row. Watches follow, because they hold the id. The season and number stored on the watch are now stale and should be read from the catalog when the id resolves.
- **Id no longer listed:** set `removed_at` instead of deleting, so a watch that points at it can still show a name. Delete the row after 180 days at the latest, to stay inside the caching clause; the watch keeps its own season and number.
- **A removed id's watch:** ADR 0008 says a watch whose episode is gone is kept and does not count. TMDB's own position is that season plus number is the durable address and a re-added episode gets a new id. Recommendation: when a watch's id is removed and the show has exactly one live episode with the watch's season and number, count the watch for that episode. Otherwise a routine delete-and-re-add by a TMDB editor would undo members' progress. This goes one step beyond the ADR and needs the owner's decision.
- **Safety, as in `delete_stale_seasons`:** mark episodes removed only when every season request for the show succeeded and the payload lists at least one season. A failed or partial fetch changes nothing.
- **A show deleted on TMDB** keeps its episode rows until the existing deletion propagation removes the show.

### Shows with no episodes

19,369 shows list no season and 23,729 seasons list no episode. They get no request (the stored details already say so) and no rows; `episodes_updated_at` is still set, so "no episodes" is a known state. Their Episode list is empty, and such a show can only be marked Seen as a whole, with no episode watches behind it. When TMDB adds a season, the change feed or the 30-day sweep brings the show into the catalog.

### How "aired" and "season still airing" are computed

Both are computed when read, from `episode` rows and `show.status`. Neither is stored, because both change with the calendar and not with a crawl.

- **Aired:** `removed_at IS NULL AND air_date IS NOT NULL AND air_date <= today (UTC)`. An episode without a date is not aired. TMDB gives a date without a time, so this is right to the day: an evening broadcast in the Americas counts as aired some hours early. The alternative, `air_date < today`, is never early and up to a day late. The first is recommended, since a member who has just watched an episode must be able to mark it.
- **Season still airing:** the show's highest-numbered regular season that has at least one aired or dated episode, when the show's status is not Ended or Canceled, and one of:
  - it has an episode that has not aired, or
  - its last aired episode is not a `finale` and aired within the last 45 days.

  The first clause covers every season with announced episodes. The second covers weekly network seasons in the gap before TMDB lists the next episodes; 45 days spans a winter break without keeping a finished, unmarked season open for long. A season whose last listed episode is an aired `finale` is over. Earlier seasons are never airing.
- **Caught up** then is: status Watching, every aired regular episode watched, and the latest season still airing. **Next episode** is the earliest aired regular episode without a watch, ordered by season and episode number, not by air date, because air dates are missing or out of order in places.

## Unconfirmed, and what would settle it

- **What `finale` and `mid_season` mean officially**, and how well the long tail is marked. Settle: ask on TMDB's support forum; measure coverage on the full crawl.
- **Whether renumbering or moving an episode keeps its id.** Settle: after a few weeks of crawling, count ids whose numbers changed against ids that vanished while a new id took the same number.
- **Whether season ids survive renumbering or merging.**
- **Whether every episode edit reaches `/tv/changes`**, and why a third of the listed shows return an empty per-show change list. Settle: compare the feed against the 30-day sweep's actual differences.
- **Whether the rate limit counts per key or per IP**, which matters when the episode job runs beside the details and streaming jobs.
- **Coverage of `imdb_id` and `tvdb_id` on episodes**, and whether the nested external-ids append is supported or accidental.
- **The 45-day gap in the still-airing rule** is a judgment, not a measurement.
- **Commercial-use standing under TMDB's terms** and the missing notice sentence: owner questions that predate this work.
- **Why the catalog counts moved since 2026-09-25** (233,582 shows now, 246,636 then; 6.48 million episodes by `number_of_episodes` now, 5.74 million then).
