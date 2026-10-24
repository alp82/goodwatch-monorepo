# New on your services (#489 Part C)

The pages at `/new` list what arrived on the big streaming services, per country, in the last 14 days. Built for
[#489](https://github.com/alp82/goodwatch-monorepo/issues/489) Part C, child of map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365).

- Layout: variation D of the services-page prototype (branch `ghostex/3fbfaf5b`, `docs/prototypes/new-on-services/`).
- Wording and day-by-day section: variation A of [#625](https://github.com/alp82/goodwatch-monorepo/issues/625)
  (branch `prototype/arrival-dates`).

## Addresses

| Address | What it is | Search engines | Cache |
| --- | --- | --- | --- |
| `/new/us/netflix` | A service's page in a country | Listed once it has titles; `noindex, follow` while empty | Shared policy for visitors, keyed by country and language |
| `/new/us` | A country's page for every service | Same rule | Same |
| `/new/netflix` | The share link: 302 to `/new/<viewer's country>/netflix` | Not a page | `private, no-store` |
| `/new` | The member's own page: their saved country and services | Always `noindex, follow` | `private, no-store`; a visitor gets a 302 to `/new/<country>` |
| `/new/US`, `/new/US/netflix` | Capitals | 301 to the lower-case address | No `Cache-Control` (same for everyone) |
| `/new/zz`, `/new/us/tubi` | Unknown country or service | 404 | `private, no-store` |

The viewer's country is a member's saved country, or a visitor's country from the cache identity (`gw_loc`, then
`Accept-Language`, then `US`). The share button on a service page copies `/new/<service>`. A country's page opened from
another country shows a link to the same page for the viewer's own country, in the head of the page, with no popup.

## Which titles

The rules are in `goodwatch-webapp/app/domain/new-on-services.ts` and reuse Newly available
(`app/domain/newly-available.ts`, `app/server/availability-first-seen.server.ts`):

- A page reads `doc.availability_history` for its services in its country. Candidates are titles with a live open stay
  (`appeared_source <> 'backfill'`) whose landing day is in the window. The landing day is `appeared_on` for an exact
  stay and the UTC day of `observed_at` otherwise (`LANDED_DAY`, shared with #637).
- Every stay of those titles on those services is then read, backfilled ones included, so a title already on the
  service (a backfilled stay, the brand's other tier, an older stay that a return joins) is not an arrival.
  `firstSeenOf` and `landingOn` decide this, as for the Newly available signal. `firstSeenOf` now also says whether
  the landing day is exact, but only for readers that pass precision; the signal's output is unchanged.
- The window is today and the 13 days before (UTC), never before the launch day of Newly available (`launchTime()`,
  October 12, 2026, or `NEWLY_AVAILABLE_SINCE`). Until October 26 the window is therefore shorter, and the page says
  "in the last 13 days".
- A brand is one service: the ten brands of the daily list job (#682) are in
  `app/domain/new-on-services-brands.json` with their TMDB ids (Netflix 8 and 1796, Prime Video 9, 119, 2100 and 10, and
  so on). The sitemap generator reads the same file.
- On the member's page, a title one of their services carried before is not new, and a title that moved between two
  of their services is not new either (`landingOn` with all their services).
- Adult titles and titles the catalog lacks are left out.

## What a page says

- The ten best by GoodWatch score (rounded), then **Day by day**: exact days, the latest first ("Today", "Yesterday",
  "Thursday, October 22"), then the titles without a known day under **Also new**.
- A row says "New on Netflix today" or "on Thursday" where the day is exact, and only "New on Netflix" otherwise. No
  "this week" and no "last 30 days" anywhere.
- The line under the heading: "101 movies and shows in the last 13 days, 1 of them today." and an info icon with
  "Updated October 24": the latest `updated_at` of the brands' stays. Its `title` shows the time in UTC.
- A member's page, and any page for a member with titles they wait for (Want to See, or a show they are Watching or
  have On hold), leads with "<title> is now on <service>" instead of the heading, as in the prototype.
- Day by day shows the newest 240 titles (`DAY_LIMIT`). The United States page for every service had 581 on October
  25; the line then says that each service's page has the rest.

## Reads, caching and cost

`app/server/new-on-services.server.ts`:

| Read | Statements | Cache |
| --- | --- | --- |
| A page's titles | 1 candidate statement, then 1 per media type and 1,000 titles, in parallel; display fields through `getDisplayFields` (Valkey, 6 h); 1 adult check | `cached()` `new-on-services-titles-v1`, per country, services and UTC day, 30 minutes |
| The summary (links between pages, the update date, logos, country names) | 1 statement over all countries, `max(updated_at)`, logos, `getCountries` (cached a day) | `cached()` `new-on-services-summary-v1`, per UTC day, 60 minutes |
| The viewer | Member data and settings, both already cached | None |

The page cache stores a visitor's page for 30 minutes as for every other catalog page. Day words ("today") follow UTC,
so for up to 30 minutes after midnight a stored page can still call yesterday's arrivals "today".

Measured on October 25, 2026 from a development machine over the tunnel, through a SELECT-only proxy in front of the
production Crate (about 30 to 40 ms of the time per statement is the tunnel and the proxy):

| Read | Rows | Time |
| --- | --- | --- |
| Netflix US: candidates, then stays | 110 candidates, 225 stays, 101 titles listed (34 with an exact day) | 110 to 450 ms (Crate 22 to 82 ms per statement) |
| Prime Video US | 344 candidates, 704 stays | 300 to 370 ms |
| Every service US | 581 titles listed | 310 to 360 ms |
| Summary counts, all countries | 763 country and service groups | 200 to 540 ms (Crate 110 to 310 ms) |
| `max(updated_at)` of the brands | 1 | 110 to 200 ms (Crate 55 ms) |

A local production build (`remix-serve`, throwaway Valkey cluster, the same proxy):

| Request | Time |
| --- | --- |
| First page with an empty data cache (summary included) | 0.65 s (`/new/us/netflix`); 0.41 s (`/new/us`) |
| Another page, summary cached | 0.13 to 0.24 s |
| Warm data cache | 8 to 13 ms |
| Page cache hit | about 1 ms |
| `/new/netflix` redirect | 2 ms |

Sizes, Brotli: `/new/us/netflix` 30 KB, `/new/us` 43 KB, an empty page 15 KB (`/movies/best` is 42 KB). Layout shift
measured in Chromium: 0 on every visitor page, 0.0002 on the member page on a desktop.

## Sitemap

`goodwatch-webapp/scripts/sitemap_new.py` writes `sitemap_new.xml` with `/new/<country>/<service>` for every brand with
at least `MIN_TITLES` (3) candidates in its window, and `/new/<country>` when one of them qualifies. `lastmod` is the day
of the latest arrival. The count is of candidates, before the continuity rules, so the margin keeps a listed page
non-empty. The Windmill wrapper `f/seo/regenerate_sitemaps.py` leaves out a `/new` page that fails the live check, as it
does for profiles. `sitemap.xml` lists the file only when it has URLs.

On October 25, 2026 the selection gave **745 URLs** (136 country pages, 609 service pages) in 0.35 s. A sample of 60 of
them all answered 200, `index, follow`, with their own canonical address, on the local build.

The next weekly run adds `sitemap_new.xml` to the index, so the owner resubmits `https://goodwatch.app/sitemaps/sitemap.xml`
in Search Console after it lands (see `docs/sitemap.md`). The wrapper must be redeployed from `main` for the new file to
be part of the Windmill run.

## Tests

- `app/domain/new-on-services.test.ts`: the window, exact and unknown days, backfill, brands, continuity across
  services, ranking, day groups, words, addresses, the country offer, robots and copy.
- `app/server/new-on-services-read.test.ts`: the statements (no backfill candidate, the window, the brand's ids) and the
  rows turned into arrivals.
- `app/server/new-on-services-page.test.ts`: every address against faked reads: the share redirect (`private,
  no-store`), capitals, 404, noindex for an empty page, the offer, the day-by-day limit, and the member's page.
- `scripts/test_sitemap_new.py`, and two cases in `goodwatch-flows/tests/test_sitemap_regeneration.py`.

## Screenshots

`screenshots/<case>-<desktop|phone>.jpg`, at 1440 x 900 and 390 x 844 (phone first screens at 2x, whole phone pages scaled to 1x), taken on October 25, 2026 from a
local production build reading production through the SELECT-only proxy. `report.json` holds, per shot, the
redirect chain, robots tag, canonical address, layout shift and console errors.

| Case | Address |
| --- | --- |
| `us-netflix` | `/new/us/netflix`, whole page |
| `share-link-netflix-from-germany` | `/new/netflix` with `Accept-Language: de-DE`: 302 to `/new/de/netflix` |
| `member-new` | `/new`, signed in as the owner (Germany; Netflix, Prime Video, Disney Plus, HBO Max), whole page |
| `empty-de-hulu` | `/new/de/hulu`: empty, `noindex, follow`, whole page |
| `dark-us-netflix` | `/new/us/netflix` with `prefers-color-scheme: dark` |
| `us-netflix-from-germany-offer` | `/new/us/netflix` from Germany: the link to `/new/de/netflix` |
| `country-us-every-service` | `/new/us` |

The site has one dark theme, so the dark-mode shots look like the others. The signed-in shots log three React 421
errors; the same three appear on `/settings`, `/for-you` and `/` in the same local preview, so they come from the
preview's signed-in setup or the shared layout, not from this page.

## Where this departs from the prototypes

- The prototype ranked by score only. The page keeps that ranking for the top ten and adds #625's **Day by day**, newest
  first, which is where "newest first" lives. Titles without an exact day are grouped last under **Also new**.
- No "How fresh is this list?" section and no sentence about TMDB's delay: the info icon with the update date replaces
  them (owner decision on #625).
- The prototype's in-hero "Also landed" box used a backdrop blur; this one is a solid panel (60 fps rule).
- The prototype's "first week" box is gone: backfilled stays are never arrivals, so a service's backlog never shows.
- The services row links only to brands with titles in the country (and the current one). Services outside the ten
  brands have no page; on a member's page they still name their titles.
- `/new/us`, the country's page for every service, was in the prototype but not in the decisions; it is built and
  listed by the same rules.
- The OG image is the site's generic card (`/og/new/...`); a dedicated card is a follow-up.

## Not done

- No link to the pages from the navigation, My movies or My shows (open question 7 of the prototype).
- Opening `/new` doesn't clear the Newly available signal (open question 8).
