# Proposal: a small `/blog` and the streaming catalogue study

Written 2026-10-18 for the owner decisions of the same day: originals live on a small `/blog` on goodwatch.app, are cross-posted to dev.to with a canonical link back, and the first post is a data study of the streaming catalogue per country. The critics-versus-audiences study comes later.

This is stage 1: a proposal, nothing built. Every number in it comes from read-only queries on CrateDB and read-only TMDB API requests made on 2026-10-18. Nothing was written to any GoodWatch database. The numbers are preliminary; the published study repeats the snapshot on its publication day.

Background reading: [`backlinks-research.md`](../research/discovery-search/backlinks-research.md) (moves 3, 4 and the blog question), [`05-linkable-assets-pr.md`](../research/discovery-search/backlinks/05-linkable-assets-pr.md) (study formats that earned links, licensing limits), [`07-dev-platforms.md`](../research/discovery-search/backlinks/07-dev-platforms.md) (dev.to canonical, blog option), [`sitemap.md`](../sitemap.md).

## Summary

- **The study:** "The best-rated movies and shows, country by country." It counts how many of the 1,000 best-rated movies and 500 best-rated shows stream on a subscription in each of 139 countries, how many subscriptions it takes to reach them, and how far Netflix's catalogue differs between countries.
- **Draft headline:** "Spain streams more of the world's best-rated movies than any other country."
- **Eight findings** are strong enough for a headline. The two with the widest reach: Studio Ghibli's films stream on Netflix in 129 countries but on no subscription in Japan, and Netflix France has 7,253 movies against 4,775 on Netflix US.
- **Data quality decides the method.** The stored availability is too stale and too generous for a study: only 73% of the top 1,000 movies had a provider check in the last 30 days, and stored offers list about 16% more countries than TMDB does today, even for titles checked hours ago. The study therefore reads TMDB's watch providers directly for its 1,500 titles on one date. That takes about 1,500 requests and writes nothing.
- **The blog:** `/blog` and `/blog/<slug>` as Remix routes, posts written in MDX compiled at build time, `BlogPosting`, `Dataset` and `BreadcrumbList` JSON-LD, a card from the existing `/og` renderer, an RSS feed at `/blog/rss.xml`, blog URLs in `sitemap_static.xml` with honest dates, and the footer's existing "Blog" link pointed at `/blog` instead of dev.to.
- **Twelve questions for the owner** are at the end. The ones that block building: the cohort rule, whether pay-TV apps count as subscriptions, MDX, and the CSV license.

## Part 1: the study

### What the study measures

The study takes a fixed list of well-known, highly rated titles and asks, for every country TMDB's watch-provider data covers: how many of them can a person stream there, and on what.

| Term | Definition in the study |
| --- | --- |
| Best-rated movies | The 1,000 released movies with the highest GoodWatch score among those with at least 50,000 IMDb votes, first released at least 180 days before the snapshot. Adult titles and titles TMDB has deleted are left out, and the next title fills the place. |
| Best-rated shows | The 500 shows chosen the same way, without talk, news, soap and reality shows. |
| On a subscription | TMDB lists a `flatrate` offer for the title in that country. Tiers and channels of one brand count once, by the same rule as the title page (`brandName(getShorterProviderLabel(name))` in `goodwatch-webapp/app/utils/streaming-links.ts`). |
| Free with ads | A `free` or `ads` offer on a service that isn't a library service. |
| With a library card | A `free` offer on Kanopy, Hoopla, Cineasterna, Filmstriben, filmfriend, Beamafilm, Filmoteket, or a similar public-library service. These are reported apart, because they need a library membership. |
| Subscriptions for half | The fewest subscriptions that together carry at least half of the list. Each step adds the service that brings the most titles not yet covered. |
| Larger markets | 56 countries chosen for size and for having their own streaming press. The CSV has all 139. |

Why these choices:

- **A 50,000 IMDb vote floor instead of GoodWatch's own vote count.** GoodWatch's count adds votes across sources, and a wrong Rotten Tomatoes match can carry it alone: "Taxi Driver" (2011, TMDB 744615) and "All You Need is Kill" (2014) have 64,000 and 73,000 votes that all come from the RT page of a different film. A TMDB vote floor would remove those, but it would also remove Sholay, 12th Fail, No Other Land, and 20 Days in Mariupol, which have few TMDB votes. The IMDb floor removes the bad matches without that bias. 4,685 movies and 717 shows qualify.
- **180 days since release** keeps films that are still in their cinema window, such as The Odyssey (2026), out of the "streams nowhere" list.
- **Movies and shows apart.** They behave differently (see finding 6), and one combined list would hide that.

### Data quality and freshness

The stored data has five problems that a published study can't carry. Each comes with what the study does about it.

1. **Provider checks paused for twelve days.** No title got a provider check (`tmdb_providers_updated_at`) from 2026-10-05 to 2026-10-16. Checks resumed on 2026-10-17. As a result, only 733 of the top 1,000 movies and 371 of the top 500 shows had a check in the last 30 days, which the glossary counts as unknown availability. Across the whole Netflix catalogue, 13,233 of the 21,445 movies stored as on Netflix somewhere had a check older than 90 days.
2. **Stored offers outlive TMDB's.** For 39 top movies checked in the last two days, the stored offers name 3,395 country-title pairs; TMDB's API lists 2,927 today, all of them stored. So the stored data lists about 16% more countries than TMDB does, even right after a check. Dune: Part Two, checked on 2026-10-18 at 21:21 UTC, still has Netflix in Bermuda and French Guiana. The cause is by design: `goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py` merges the API with the scraped TMDB pages, and a row survives until both sources confirm it's gone. For a random sample of 90 stale titles the excess was 35%. The stored Netflix US count is 5,815 movies; TMDB's discover endpoint says 4,775.
3. **Prices are in local currency.** `price_dollar` holds 59 in Denmark and 99 in Mexico for the same rental, and only about 57% of rent and buy offers have one. The study makes no price comparison. "Where a best-of title is cheapest to reach" becomes "how many subscriptions it takes" (finding 2).
4. **Bad title rows.** Besides the two wrong RT matches, a movie row "Rick and Morty" (TMDB 1780522) carries the show's 713,988 IMDb votes and has no release date. The release-date and IMDb-vote rules remove these. The cohort also contained one movie that TMDB has deleted (Utopia, 2013, TMDB 1668134), which is why the preliminary movie list has 999 titles.
5. **Services aren't all alike.** JustWatch lists pay-TV and telecom apps (Movistar Plus+, KPN, Magenta TV+, Molotov TV, fuboTV), small global services that list a few public-domain films in 138 countries (Bloodstream, Artify), and free library services. The study folds brand tiers, names the best service in each country, reports library and ad-supported offers apart, and states the service types in the methodology. Whether pay-TV apps count as subscriptions is an open question for the owner.

What this means for the method: **the study reads its own snapshot.** On publication day, a script reads `/movie/{id}/watch/providers` and `/tv/{id}/watch/providers` for the 1,500 titles from TMDB's API (with a cache-busting parameter, as in the #678 measurement), and `/discover/movie` and `/discover/tv` totals for Netflix per country. That's about 1,800 read-only requests, a few minutes at 10 requests a second. The cohort itself comes from a read-only CrateDB query the same day. The snapshot is the only source of the numbers, and its date is the study's date.

The preliminary numbers in this proposal come from such a snapshot, read on 2026-10-18 at 21:31 UTC.

Limits to state in the methodology:

- JustWatch tracks most, but not all, local services. A low count can mean that a country's pay-TV app isn't tracked. Israel's 172 is the clearest case to check before publication.
- Very small territories (Andorra, San Marino, French Guiana, Fiji) often show a neighbor's catalogue. They're in the CSV but not in the charts.
- One snapshot is one day. Catalogues change weekly, so every count has the snapshot date next to it.

### Proposed findings

Numbers are from the 2026-10-18 snapshot: 999 movies and 500 shows in 139 countries.

1. **Spain streams the most of the best-rated movies.** 761 of the 999 are on a subscription in Spain, ahead of Japan (721), the United States (715), the United Kingdom (707), Brazil (694) and Germany (692). Among the 56 larger markets, Ukraine (158), Pakistan (162) and Israel (172) have the fewest. Spain's lead comes from Movistar Plus+ (248) and Filmin (another large film catalogue) on top of the global services.
2. **Two subscriptions reach half the list in Japan; five in the United States.** Japan's U-NEXT alone carries 444 of the 999 movies, more than any single service in any country. Next come Watcha in South Korea (333), Lepsi TV in Czechia (305) and Movistar Plus+ in Chile (296). In the US the best single service, HBO Max, carries 147, and it takes five subscriptions to reach half. The UK and Germany need six, France seven. In 29 of the 56 larger markets, India among them, no number of subscriptions reaches half.
3. **Netflix is a different service in every country.** Netflix France lists 7,253 movies and Netflix US 4,775; the US ranks 43rd of 55 countries read. Of the 999 best-rated movies, Netflix South Korea carries 169 and Netflix US 92. Only 40 of them are on Netflix in all 131 Netflix countries, and 93 are on Netflix in one country only.
4. **Studio Ghibli streams in 129 countries, but not in Japan.** Fifteen Ghibli films, from Spirited Away to The Boy and the Heron, are on Netflix in 129 countries and on HBO Max in the US. In Japan none of them is on a subscription. Of the 45 best-rated films made in Japan (by first production country), 42 stream on a subscription in the US and 28 in Japan. Grave of the Fireflies, a Ghibli film whose rights sit with a different company, is on Netflix in Japan too.
5. **Indian cinema is the most and the least streamable.** On the six big global services, the most widely streamed best-rated movies are Kabhi Khushi Kabhie Gham and Shrek (136 countries each), and four of the top ten are Indian (with Sardar Udham, Dil Chahta Hai and Dangal). At the same time, 5 of the 13 best-rated movies that stream on a subscription nowhere are Indian: Like Stars on Earth, Lagaan, Lage Raho Munna Bhai, Udaan and Special 26. The other eight include Sling Blade and Happiness.
6. **For shows, Netflix leads almost everywhere; for movies, local services do.** Netflix is the best single subscription for the best-rated shows in 55 of the 56 larger markets (Russia: Kinopoisk), but for movies in only 17. Shows also spread more evenly: the US gets 465 of the 500 on a subscription, most of western and northern Europe 400 to 440, and the lowest larger markets are Russia (155) and Ukraine (186).
7. **North America streams the most for free.** In the US, 356 of the 999 movies stream free with ads, and another 258 with a library card through Kanopy or Hoopla. Canada follows with 258 and 121. Nordic libraries carry a similar share: 209 in Sweden, 206 in Denmark, 189 in Norway. Outside North America, the ad-supported count tops out at 207 (Russia) and 179 (the UK).
8. **The most widely streamable best-rated movies are a century old.** Nosferatu, The Cabinet of Dr. Caligari, Un Chien Andalou and Freaks are on a subscription in 138 countries, through small global services that carry public-domain films. This finding is a candidate, not a recommendation: it depends on how the study treats those services.

Before publication, each finding gets a hand check on the services' own sites for at least two countries. The checks to do first: Plex's free catalogue in the US, U-NEXT's count in Japan, Ghibli in Japan, and the Indian titles that stream nowhere (the snapshot lists a rent or buy offer for Like Stars on Earth and Lagaan in one country each; confirm where).

### Charts

Three charts, drawn as SVG in the page's server HTML. They use the site's tokens: the gray-950 surface, amber-600 marks (validated against the dark surface for lightness, contrast and color-vision separation), a gray-500 de-emphasis color, and gray-100 to gray-400 text in Gabarito. They work without JavaScript, each has a `<title>` and `<desc>`, every mark has a `<title>` for a native tooltip, and each is followed by a `<details>` "Show the numbers" table.

| Chart | Mockup | Form |
| --- | --- | --- |
| Movies on a subscription in 56 larger markets | [`chart-1-movies-by-country.svg`](streaming-study/chart-1-movies-by-country.svg) | Ranked horizontal bars, value at each tip |
| Subscriptions needed, six countries | [`chart-2-subscriptions-needed.svg`](streaming-study/chart-2-subscriptions-needed.svg) | Small multiples: titles reached with 1 to 10 subscriptions, best service named |
| Netflix's movie catalogue by country | [`chart-3-netflix-catalogue.svg`](streaming-study/chart-3-netflix-catalogue.svg) | Ranked bars, the US highlighted |

Findings 4 to 8 work better as short lists with links to the title pages they name than as charts. Those links are what the study does for discovery: every title it names links to its GoodWatch page. A "key findings" stat row (the `<dl>` from `about.tsx`) sits above the first chart.

Mobile: the mockups are drawn at 440 to 452 units wide, so at a 343 px column their 11 px labels render at about 8.5 px. The built charts switch to a narrower layout below 480 px (fewer gridlines, shorter labels), the same SVG with a CSS media query and no script.

### Downloadable CSV

[`draft-goodwatch-streaming-catalogue-2026.csv`](streaming-study/draft-goodwatch-streaming-catalogue-2026.csv) has one row per country (139 rows) with these columns:

`country_code`, `country`, `movies_in_study`, `movies_on_subscription`, `movies_free_with_ads`, `movies_with_library_card`, `movies_to_rent_or_buy`, `movies_any_way`, `best_movie_service`, `best_movie_service_movies`, `subscriptions_for_half_of_movies`, `shows_in_study`, `shows_on_subscription`, `shows_free_with_ads`, `shows_with_library_card`, `shows_to_rent_or_buy`, `best_show_service`, `best_show_service_shows`, `netflix_movies_in_country`, `netflix_shows_in_country`, `snapshot_date`.

It holds counts only. No scores from IMDb, Rotten Tomatoes or Metacritic, and no per-title rows, so it stays clear of the "don't offer their data for download" rule in the backlinks research. The Netflix totals are filled for the 56 larger markets; the published file fills all of them.

### Credits and terms

The study page carries the TMDB logo and "This product uses the TMDB API but is not endorsed or certified by TMDB", a JustWatch credit for the streaming data, and "Information courtesy of IMDb (https://www.imdb.com). Used with permission.", because the IMDb vote count selects the titles. No ads, affiliate links or sponsorship. A "How to cite" line gives the title, "GoodWatch, 2026" and the URL.

The raw TMDB snapshot stays out of the public repo. The repo keeps the script and the aggregates. TMDB's terms limit caching to six months, and a raw snapshot would republish JustWatch's offer data.

### Headline, outline and pitch

**Headline:** "Spain streams more of the world's best-rated movies than any other country."

Alternatives, depending on the lead finding the owner prefers:

- "Two subscriptions in Japan, five in the US: what it takes to stream the best-rated movies in 56 countries"
- "Netflix France has half again as many movies as Netflix US"

**Slug:** `/blog/streaming-catalogue-by-country-2026`. The year in the slug lets the 2027 edition sit next to it, as the research recommends for a repeat study.

**Outline:**

1. Kicker "Data study", headline, byline and date, a two-sentence lead.
2. Key findings: five bullets and the stat row.
3. Where the best-rated movies stream (chart 1, table).
4. How many subscriptions it takes (chart 2).
5. Netflix isn't one catalogue (chart 3).
6. Studio Ghibli: everywhere but Japan.
7. Everywhere and nowhere: the widest and the missing titles, with links.
8. Shows: Netflix almost everywhere.
9. Free with ads, and with a library card.
10. How we counted: cohort, snapshot date, sources, definitions, exclusions, limits.
11. Download the data, how to cite, credits.

**Pitch angle for writers:** one finding per writer, each with its country's numbers and the snapshot date. No link request, no mass mailing.

| Beat | Finding to lead with | Examples of writers to research |
| --- | --- | --- |
| Spanish tech and streaming press | Spain first, Movistar Plus+ and Filmin | Xataka, Hipertextual |
| Netflix trackers | France against the US, 40 titles on Netflix everywhere | What's on Netflix |
| US cord-cutting | Five subscriptions for half, 356 free with ads, 258 with a library card | Cord Cutters News, The Streamable |
| Anime and Japan | Ghibli in 129 countries but not Japan | Anime news sites, Japan-focused English press |
| Indian film press | Most and least streamable at once | Indian entertainment desks |
| Data and statistics sites | The CSV | Statistics roundups that cite What's on Netflix today |

The research's channel sequence applies: publish, wait until URL Inspection shows the post indexed, then cross-post to dev.to and pitch.

## Part 2: the blog

The code map behind this part was taken from the repo on 2026-10-18. The file names are real.

### Routes

| URL | Route file | What it is |
| --- | --- | --- |
| `/blog` | `goodwatch-webapp/app/routes/blog._index.tsx` | The list of posts: title, date, summary, newest first |
| `/blog/<slug>` | `goodwatch-webapp/app/routes/blog.$slug.tsx` | One post. An unknown slug answers 404 |
| `/blog/rss.xml` | `goodwatch-webapp/app/routes/blog.rss[.]xml.ts` | RSS 2.0 feed, a resource route like `sitemap[.]xml.ts` |
| `/blog/<slug>/<file>.csv` | `goodwatch-webapp/public/blog/<slug>/` | The study's CSV as a static file |

Static `blog.*` routes outrank `$type._index.tsx` and `$type.$category._index.tsx`, which would otherwise catch `/blog` and `/blog/<slug>`. The build checks this with a route test.

### How posts are written

**Recommendation: MDX, compiled at build time.** Each post is `goodwatch-webapp/app/content/blog/<slug>/post.mdx` with an exported `meta` object (title, description, slug, published, updated, author, kind, og copy). A registry module, `app/content/blog/posts.ts`, lists the posts from their `meta` exports through `import.meta.glob`, and `blog.$slug.tsx` loads only the matching post's module.

Why MDX:

- **dev.to wants Markdown.** An MDX post is Markdown plus a few components. A small script, `scripts/blog-to-devto.mjs`, turns it into the dev.to Markdown: it replaces each chart component with a PNG of the chart (rendered with the resvg already in the repo) and keeps every link absolute. Writing in TSX would mean converting by hand every time.
- **Charts are components.** `<Chart name="movies-by-country" />` renders the SVG from the study's data file at render time, with the site's classes. No chart files to keep in step with the data.
- **No runtime cost.** `@mdx-js/rollup` (and `remark-gfm` for tables) runs in the Vite build only. The output is ordinary React in the post's own route chunk. Nothing new reaches the app shell, the footer or any landing surface, so the `./bench.sh budget` lines don't move. The webapp has no Markdown dependency today.

The alternative is TSX posts like `about.tsx`, with no new dependency, at the cost of a hand-made dev.to copy. It works for one or two posts.

### Page layout

The post reuses `about.tsx`'s structure and no new visual language:

- One `max-w-2xl` column, the `Kicker` from `app/ui/info-page.tsx`, `about.tsx`'s h1 and lead classes, and `privacy.tsx`'s h2 and h3 classes for long sections.
- `CreatorChip` from `app/ui/about/AboutParts.tsx` as the byline, with the date.
- The `about.tsx` stat `<dl>` for key findings, and the card style (`rounded-2xl bg-white/[0.04] ring-1 ring-white/10`) for figures.
- Inline links in `font-semibold text-amber-500 hover:text-amber-400`.
- `Credits` from `AboutParts.tsx` for the data-source footer.
- `Breadcrumbs` from `app/ui/nav/Breadcrumbs.tsx`: Home, Blog, post.

The `prose` classes some pages use do nothing (there's no typography plugin), so the MDX components map to these explicit classes through an `MDXProvider` component map in `app/ui/blog/`.

### Meta, canonical and structured data

- **Meta:** `buildMeta` from `app/utils/meta.ts` with a `PageMeta` whose `url` is `https://goodwatch.app/blog/<slug>`. That gives the title, description, self-canonical, `index, follow`, Open Graph and Twitter tags. `buildMeta` gains an article option that sets `og:type` to `article` and adds `article:published_time` and `article:modified_time`; today it always emits `website` for pages that aren't titles.
- **No hreflang:** the site emits none, has no locale URLs, and the post is English only.
- **JSON-LD**, through the replace pattern `_index.tsx` and `person.$personKey.tsx` already use:
  - `BlogPosting` with `headline`, `description`, `datePublished`, `dateModified`, `author` (a `Person` named Alper Ortac with the `CREATOR_URL` link), `publisher` and `isPartOf` pointing at the existing `https://goodwatch.app/#organization` and `#website` ids, `image` (the OG card), and `mainEntityOfPage`.
  - `Dataset` for the study, with `distribution` (the CSV as a `DataDownload`), `temporalCoverage` (the snapshot date), `spatialCoverage`, `creator`, `license`, and `isBasedOn` naming TMDB and JustWatch. That makes the study eligible for Google Dataset Search, one more way for it to be found.
  - `BreadcrumbList` from `breadcrumbJsonLd` in `app/ui/nav/breadcrumb-trail.ts`.
- **OG image:** add `/blog` and `/blog/<slug>` entries to `STATIC_PAGE_COPY` in `app/ui/og-image/copy.ts`, so the existing `BandCard` draws a 1200x630 card with tag "Data study", the headline and one finding. `/og/blog/<slug>.jpg` already reaches `og.$first.$second.tsx`. Today every blog path would get the home card. New keys need no `CACHE_PREFIX` bump.

### Sitemap and the weekly job

- **Blog URLs go into `sitemap_static.xml`, with dates.** `create_sitemaps.py` reads a small `goodwatch-webapp/app/content/blog/posts.json` (slug, published, updated), which the build checks against the MDX `meta` exports. `/blog` and each post are added to the static URL set. A post's `<lastmod>` is its `updated` date, which is evidence of a visible change, so it meets the dating rule in `docs/sitemap.md`. Static entries stay undated.
- **No new sitemap file.** A `sitemap_blog.xml` would change the index (and need a Search Console resubmission), and an empty one fails the URL check. The static set avoids both.
- **Windmill:** `goodwatch-flows/windmill/f/seo/regenerate_sitemaps.py` downloads a fixed `SOURCE_FILES` list from one pinned `main` revision. `posts.json` joins that list. The wrapper redeploy goes with the generator change, as `docs/sitemap.md` already describes for other generator changes. The URL checker covers the new URLs with no change: a 200, a self-canonical and no `noindex`.
- **Timing:** the weekly run is Saturday at 03:00 UTC. A post published midweek reaches the sitemap that Saturday; for the study, the owner requests indexing in URL Inspection on publication day.

### Footer, RSS and the CSV file

- **Footer:** `FOOTER_COLUMNS` in `app/ui/footer/links.tsx` already has "Blog" with the `NewspaperIcon`, pointing to `https://dev.to/t/goodwatch`. It changes to the internal `/blog`. The dev.to link stays on the About page (`FIND_US` in `AboutParts.tsx`), renamed "dev.to". The label and icon don't change, so the footer's bytes on every page stay the same.
- **RSS:** RSS 2.0 with one item per post: title, link, guid, `pubDate`, description, and the full post as `content:encoded` (rendered on the server). With full content, dev.to's RSS import can bring a post in as a draft with its canonical already set. `<link rel="alternate" type="application/rss+xml">` goes on `/blog` and the posts only, not on every page.
- **CSV:** `csv` isn't in the content types of `app/server/static-files.server.ts`, so today a `.csv` in `public/` falls through to Express. Add `csv` (`text/csv; charset=utf-8`, the one-hour policy) there and to `scripts/precompress.mjs`. The link uses the `download` attribute.

### Page cache and performance

- An anonymous blog page is stored by the page cache like any other page, once it re-exports `pageHeaders`.
- The post is a new surface, not one of the six that `goodwatch-benchmark/urls/budget.json` measures. The build runs Lighthouse on it once, and `./bench.sh budget` runs before merge to show that the six existing surfaces didn't change.
- Two traps from the code map: a small module shared by the footer and a blog route would be pulled into the `shell` chunk (Vite rule 3), so the footer keeps importing nothing from `app/content/blog/`. And the chart components stay in the post's chunk, not in a shared helper.

### dev.to cross-post

1. Publish on goodwatch.app.
2. Request indexing in URL Inspection, and wait until it shows the post indexed.
3. Run `scripts/blog-to-devto.mjs`, paste the Markdown into dev.to, and set "Canonical URL" to the goodwatch.app post. Add four tags.
4. The dev.to copy links the goodwatch.app pages it discusses.

## Build plan for stage 2

| Step | Work | Size |
| --- | --- | --- |
| 1 | Blog plumbing: routes, MDX build, registry, layout components, meta and JSON-LD, OG copy, RSS, footer link, CSV content type, route and meta tests | 1.5 days |
| 2 | Sitemap: `posts.json`, generator change, tests, Windmill wrapper `SOURCE_FILES`, `docs/sitemap.md` | Half a day |
| 3 | Study script in `goodwatch-webapp/scripts/streaming-study/` (cohort query, TMDB snapshot, analysis, CSV and data file), with unit tests for the brand folding and the set cover | 1 day |
| 4 | Chart components, tables, mobile layout, the post text, hand checks of the findings | 1.5 days |
| 5 | Lighthouse, `./bench.sh budget`, sitemap check, dev.to export | Half a day |

About five days in total. Publishing (the deploy, URL Inspection, dev.to and the pitches) stays with the owner.

## Questions for the owner

1. **Cohort:** are the 1,000 best-rated movies (GoodWatch score, at least 50,000 IMDb votes, released at least 180 days before) and the 500 best-rated shows by the same rule the right list?
2. **Pay-TV apps:** do Movistar Plus+, KPN, Magenta TV+, Molotov TV and fuboTV count as subscriptions? The proposal counts them and says so. Without them, Spain's best service becomes Filmin (208) and its count drops.
3. **Small global services:** do Bloodstream, Artify and similar services count? Counting them makes finding 8 possible; leaving them out makes the "everywhere" list Kabhi Khushi Kabhie Gham and Shrek.
4. **Snapshot source:** is a direct, read-only TMDB read on publication day the right source, rather than the stored availability?
5. **TMDB terms:** the backlinks research leaves open whether GoodWatch's use of TMDB needs a written agreement. Does that question hold back a study page, which cites TMDB and JustWatch data?
6. **MDX:** is a build-time MDX dependency acceptable, or should posts be TSX?
7. **CSV license:** may the CSV carry CC BY 4.0 for GoodWatch's counts, with the TMDB and JustWatch credits? Should a second file list the 1,500 titles with their country counts (no scores)?
8. **Headline:** Spain first, Japan and the US, or Netflix France?
9. **Byline:** may the `BlogPosting` and `Dataset` name Alper Ortac as author?
10. **Footer:** should "Blog" in the footer point at `/blog` and dev.to move to the About page?
11. **Countries:** are the 56 larger markets the right chart set, with all 139 in the CSV?
12. **Stored availability:** finding 2 of the data-quality section (stored offers list about 16% more countries than TMDB) affects title pages too. Should it get its own ticket?
