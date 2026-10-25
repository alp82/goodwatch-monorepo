# New on your services (#489 Part C)

The pages at `/new` list what arrived on the big streaming services, per country, in the last 14 days. Built for
[#489](https://github.com/alp82/goodwatch-monorepo/issues/489) Part C, child of map
[#365](https://github.com/alp82/goodwatch-monorepo/issues/365).

- Layout: the landing-page design the owner picked from the services-page prototype (branch `ghostex/3fbfaf5b`,
  `docs/prototypes/new-on-services/`).
- Wording and day-by-day section: the "a day per arrival" design of
  [#625](https://github.com/alp82/goodwatch-monorepo/issues/625) (branch `prototype/arrival-dates`).

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
  October 12, 2026, or `NEWLY_AVAILABLE_SINCE`). A landing day after today is never listed.
- A brand is one service: the ten brands of the daily list job (#682) are in
  `app/domain/new-on-services-brands.json` with their TMDB ids (Netflix 8 and 1796, Amazon Prime Video 9, 119, 2100 and
  10, and so on). Slugs follow the streaming category pages (`netflix`, `amazon-prime`, `disney-plus`); names follow the
  site's copy and title pages ("Amazon Prime Video", "Disney+", "Paramount+", "Apple TV").
- One read per country gives every brand's page and the country's page (`countryArrivalsOf`): a brand's landing
  depends only on that brand's stays, so each list is what the page alone would read. On the country's page a title
  another brand carried before is not new.
- On the member's page, a title one of their services carried before is not new, and a title that moved between two
  of their services is not new either (`landingOn` with all their services).
- Adult titles, titles the catalog lacks, and titles without a name are left out. A title the import has not
  finished can lack a name.

## What a page says

- The ten best by GoodWatch score (rounded), then **Day by day**: exact days, the latest first ("Today", "Yesterday",
  "Thursday, October 22"), then the titles without a known day under **Also new**.
- Day by day uses the site's browse poster card (`ui/MovieTvCard.tsx`): the score pill (GoodWatch score, the viewer's
  score, one state icon), the logos of the viewer's own services with the one the title arrived on leading and ringed
  (`newOn`), and the title actions (a panel on hover, tiles over the art after a first tap on a touch screen). The pill,
  the logos and the actions read the viewer on the client, so a visitor's HTML is the same for everyone. Four cards
  across on a phone (the S card: one number, no logos), 6.5 rem from `sm` and 7 rem from `lg` (the M card). The name
  goes under each card. The ranked top ten stays a list.
- A title the catalog has no poster for shows the placeholder of the site's card grids
  (`app/img/poster-placeholder.png`, as in `ui/Poster.tsx`), and goes after every title with a poster: in the top ten,
  in each day and under Also new. On October 25, Netflix US had 4 such titles out of 101 (all shows with 0 or 1 votes
  and no poster or backdrop in `movie`/`show`), Amazon Prime Video US 21 of 340.
- A row says "New on Netflix today" or "on Thursday" where the day is exact, and only "New on Netflix" otherwise. No
  "this week" and no "last 30 days" anywhere.
- The line under the heading: "101 movies and shows in the last 14 days, 1 of them today." and an info icon with
  "Updated October 24": the latest `updated_at` of the brands' stays. Its `title` shows the time in UTC.
- A member's page, and any page for a member with titles they wait for (Want to See, or a show they are Watching or
  have On hold), leads with "<title> is now on <service>" instead of the heading, as in the prototype.
- Day by day shows the newest 240 titles (`DAY_LIMIT`). The United States page for every service had 581 on October
  25; the line then says that each service's page has the rest.

## Reads, caching and cost

`app/server/new-on-services.server.ts`:

| Read | Statements | Cache |
| --- | --- | --- |
| A country's arrivals: every brand's page and the country's page | 1 candidate statement, then 1 per media type and 1,000 titles, in parallel; display fields through `getDisplayFields` (Valkey, 6 h); 1 adult check | `cached()` `new-on-services-country-v1`, per country and UTC day, 30 minutes |
| The links: every page with titles, with its count and latest day | 1 statement for the countries with any candidate, then the country entries above, 4 at a time | `cached()` `new-on-services-links-v1`, per UTC day, 60 minutes |
| A member's titles | The same read for their services | `cached()` `new-on-services-member-v1`, per country, services and UTC day, 30 minutes |
| The meta: update date and logos | `max(updated_at)` of the brands, logos | `cached()` `new-on-services-meta-v1`, per UTC day, 60 minutes |
| The viewer | Member data and settings, both already cached | None |

**One count for pages, links and the sitemap.** The links between pages (the services row, other countries) and the
sitemap use the lengths of the lists the country entries hold, the same lists the pages show. So a linked page or a
listed page has titles; on October 25 all 862 pages of the index answered `index, follow` with exactly the counted
number of titles. Building the links for every country costs about 415 statements and 12 s of Crate time (6 s wall from
the development machine) once per hour. A page waits 300 ms for them (`LINKS_BUDGET_MS`); past that it renders
without the services row and the other countries, answers `Cache-Control: no-store` as an incomplete page, and the
links finish in the background. That happens once per UTC day, right after midnight, and after a deploy.

The country entries (30 minutes) and the links (60 minutes) refresh apart, so for up to an hour a link can count a
page that has lost its last title since. The sitemap's minimum of 3 titles and the Windmill leave-out step cover it.

Visitor pages get the root's shared policy (`s-maxage=1800, stale-while-revalidate=7200`). Day words ("today") follow
UTC, so for up to about 2.5 hours after midnight a stored page can still list the 15th day back and call yesterday's
arrivals "today".

Measured on October 25, 2026 from a development machine over the tunnel, through a SELECT-only proxy in front of the
production Crate (about 30 to 40 ms of the time per statement is the tunnel and the proxy):

| Read | Rows | Time |
| --- | --- | --- |
| Netflix US: candidates, then stays | 110 candidates, 225 stays, 101 titles listed (34 with an exact day) | 110 to 450 ms (Crate 22 to 82 ms per statement) |
| Every brand in the US, one read | 581 titles on the country's page | 310 to 360 ms |
| The links, every country | 138 countries, 862 pages, 4,002 distinct titles, 415 statements | 5.8 s wall, 12.2 s Crate |
| `max(updated_at)` of the brands | 1 | 110 to 200 ms (Crate 55 ms) |

A local production build (`remix-serve`, throwaway Valkey cluster, the same proxy):

| Request | Time |
| --- | --- |
| First page with an empty data cache (links not ready: incomplete, `no-store`) | 0.60 s (`/new/us/netflix`); 0.31 s (`/new/de/netflix`) |
| Warm data cache, with links | 6 to 31 ms |
| Page cache hit | about 1 ms |
| `/new/netflix` redirect | 2 ms |
| `/api/new-on-services/pages`, warm | 3 ms, 53 KB |

Sizes, Brotli: `/new/us/netflix` 30 KB, `/new/us` 43 KB, an empty page 15 KB (`/movies/best` is 42 KB). Layout shift
measured in Chromium: 0 on every visitor page, 0.0002 on the member page on a desktop.

## Sitemap

`goodwatch-webapp/scripts/sitemap_new.py` reads `https://goodwatch.app/api/new-on-services/pages`, the site's own list
of pages with titles, and writes `sitemap_new.xml` with every page that has at least `MIN_TITLES` (3) titles. `lastmod`
is the day of the latest arrival. The Python side restates no rule (window, launch day, backfill, continuity, adult
titles), so `make sitemaps` too lists only pages that have titles when it runs. The Windmill wrapper
`f/seo/regenerate_sitemaps.py` leaves out a `/new` page that fails the live check (its titles aged out at midnight), as
it does for profiles. `sitemap.xml` lists the file only when it has URLs.

On October 25, 2026 the index listed 862 pages with titles; the selection gave **745 URLs** (136 country pages, 609
service pages).

The next weekly run adds `sitemap_new.xml` to the index, so the owner resubmits `https://goodwatch.app/sitemaps/sitemap.xml`
in Search Console after it lands (see `docs/sitemap.md`). The wrapper must be redeployed from `main` for the new file to
be part of the Windmill run, and the webapp must be deployed first so that the index exists.

## Tests

- `app/domain/new-on-services.test.ts`: the window, exact and unknown days, future days, backfill, brands and their
  slugs and names, continuity across services, one read per country, ranking, posters, day groups, words, addresses,
  the country offer, robots and copy.
- `app/server/new-on-services-read.test.ts`: the statements (no backfill candidate, the window, the brand's ids) and the
  rows turned into arrivals.
- `app/server/new-on-services-page.test.ts`: every address against faked reads: the share redirect (`private,
  no-store`), capitals, 404, noindex for an empty page, the offer, the day-by-day limit, the member's page, links that
  count exactly what each page lists, the incomplete page, and the pages index.
- `app/utils/country-article.test.ts`: country names with "the", shared with the Discord cards.
- `scripts/test_sitemap_new.py`, and `goodwatch-flows/tests/test_sitemap_regeneration.py` (its URL count now comes from
  the generator's own lists).

## Screenshots

`screenshots/<case>-<desktop|phone>.jpg`, at 1440 x 900 and 390 x 844 (phone first screens at 2x, whole phone pages scaled to 1x), taken on October 25, 2026 from a
local production build reading production through the SELECT-only proxy. `report.json` holds, per shot, the
redirect chain, robots tag, canonical address, layout shift and console errors.

| Case | Address |
| --- | --- |
| `us-netflix` | `/new/us/netflix`, whole page |
| `share-link-netflix-from-germany` | `/new/netflix` with `Accept-Language: de-DE`: 302 to `/new/de/netflix` |
| `member-new` | `/new`, signed in as the owner (Germany; Netflix, Amazon Prime Video, Disney+, HBO Max), whole page |
| `empty-de-hulu` | `/new/de/hulu`: empty, `noindex, follow`, whole page |
| `dark-us-netflix` | `/new/us/netflix` with `prefers-color-scheme: dark` |
| `us-netflix-from-germany-offer` | `/new/us/netflix` from Germany: the link to `/new/de/netflix` |
| `country-us-every-service` | `/new/us` |
| `first-screen-us-netflix` | `/new/us/netflix`, the first screen of a real load, no scrolling |

`header-check.json` measures, on real loads of `/new/us/netflix`, `/new/de/hulu` and `/new/us` (desktop and phone,
at load and after scrolling down and back up), where the fixed site header ends and where the breadcrumb and the
heading start: the header ends at 64 to 65 px, the breadcrumb starts at 80 px and the heading at 120 px, so nothing is
covered. A full-page capture draws fixed elements where the last scroll left them; for the whole-page shots the header
is pinned to the top of the document during the capture. `report-visitor.json` is the latest visitor run;
`report.json` and the `member-new` shots are from the earlier run with the signed-in preview, before the poster
placeholder.

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
