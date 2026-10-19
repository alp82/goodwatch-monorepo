# Proposal: a small `/blog` and the streaming catalogue study

Written 2026-10-18 and revised 2026-10-19 with the owner's answers. The owner decided on 2026-10-18 that originals live on a small `/blog` on goodwatch.app and are cross-posted to dev.to with a canonical link back. The first post is a data study of the streaming catalogue per country; a critics-versus-audiences study comes later.

**Status, 2026-10-19:** built. `/blog`, `/blog/streaming-by-country-2026` and `/blog/rss.xml` exist, with the Ghibli headline the owner chose, sharpened after the hand checks: "Studio Ghibli's films stream in 129 countries. In Japan, just one does." (Grave of the Fireflies streams on Netflix in Japan, so "but not in Japan" was not quite true). How to run the study again: [`streaming-study.md`](streaming-study.md). Changes from this proposal: the CSV files are served from `/downloads/streaming-by-country-2026/`, because a folder under `public/blog/` turns `/blog` into a redirect to `/blog/`. Chile's and Colombia's biggest service is Movistar TV, a separate product from Spain's Movistar Plus+; the earlier draft folded the two together. The mockups in `streaming-study/` are the approved designs; the page draws the same charts from `app/ui/blog/`.

The rest of this file is the proposal as approved. Every number comes from read-only CrateDB queries and read-only TMDB API requests. Nothing was written to any GoodWatch database. The published study repeats the snapshot on its publication day, so the numbers will move a little.

Background reading: [`backlinks-research.md`](../research/discovery-search/backlinks-research.md) (moves 3 and 4, the blog question), [`05-linkable-assets-pr.md`](../research/discovery-search/backlinks/05-linkable-assets-pr.md) (study formats that earned links, licensing limits), [`07-dev-platforms.md`](../research/discovery-search/backlinks/07-dev-platforms.md) (dev.to canonical, blog option), [`sitemap.md`](../sitemap.md).

## Owner decisions

| Question | Decision (2026-10-19) |
| --- | --- |
| Which titles | Every title that meets the rule, not a top cut: at least 50,000 IMDb votes, first released at least 180 days ago, movies and shows apart. A best-rated cut is shown only as a secondary view. |
| Pay-TV apps (Movistar Plus+, KPN, Magenta TV+, Lepsi TV, fuboTV) | Count as subscriptions, with a footnote. |
| Small global services (Bloodstream, Artify) | Don't count. The finding about century-old films is dropped. |
| Data source | A direct, read-only TMDB read on publication day, not the stored offers. |
| Charts | Each answers one plain question, with the question as its title and a one-sentence answer under it. Readable at 390 px. The "subscriptions to reach half" chart is dropped. |
| Headline | Chosen after the new numbers (proposal in [Headline, outline and pitch](#headline-outline-and-pitch)). |
| CSV | CC BY 4.0, a per-country file and a per-title file. |
| Posts | MDX, compiled at build time. |
| Author in structured data | The organization GoodWatch, not a person. |
| Footer | The "Blog" link moves from dev.to to `/blog`. |

## Summary

- **The study:** "Where can you stream the movies everyone knows?" It counts how many of 4,683 well-known movies and 717 well-known shows stream in each of 139 countries, and on which services.
- **Proposed headline:** "Americans can stream more of the movies everyone knows than anyone else, just not on Netflix."
- **Seven findings.** The two with the widest reach: Netflix US has fewer of these movies than Netflix in 49 of 54 other larger markets, and Studio Ghibli's 17 films stream on Netflix in 129 countries but on no subscription in Japan.
- **Four charts**, each a ranked bar chart that answers one question about "your country".
- **Cost of the data:** 5,402 TMDB requests for the titles plus 262 for Netflix's catalogue totals, about 5 minutes. No writes.
- **The blog plan is unchanged** apart from the owner's choices. A few questions remain at the end; none blocks building.

## Part 1: the study

### Which titles it counts

| List | Rule | Size (2026-10-18) |
| --- | --- | --- |
| Well-known movies (the base) | At least 50,000 IMDb votes, status Released, first released at least 180 days before the snapshot, not adult, with a GoodWatch score and a poster. Titles TMDB has deleted are left out. | 4,683 (4,685 matched; 2 deleted on TMDB) |
| Well-known shows (the base) | The same rule, without talk, news, soap and reality shows. | 717 |
| Best-rated cut (secondary) | The 1,000 movies and 250 shows from the base with the highest GoodWatch score. | 1,000 and 250 |

Why the IMDb vote rule: GoodWatch's own vote count adds votes across sources, and a wrong Rotten Tomatoes match can carry it alone. For example, "Taxi Driver" (2011, TMDB 744615) gets 64,000 votes from another film's RT page. A TMDB vote floor would also remove films such as Sholay and No Other Land, which have few TMDB votes. The IMDb floor removes the bad matches without that bias. The 180 days keep films still in cinemas, such as The Odyssey (2026), out of the "streams nowhere" list.

What the base list is like, to state in the methodology: 3,078 of the 4,683 movies (66%) have the US as their first production country, because IMDb's voters skew toward US films. That helps the US in finding 1. The best-rated cut shows the effect: there, Spain leads (finding 1).

### How it counts

| Term | Meaning |
| --- | --- |
| On a subscription | TMDB lists a `flatrate` offer in that country. Tiers and channels of one brand count once, by the title page's rule (`brandName(getShorterProviderLabel(name))` in `goodwatch-webapp/app/utils/streaming-links.ts`). Pay-TV apps count, with a footnote. |
| Not counted | Bloodstream, Artify, Artiflix and Cultpix: services listed in 100 or more countries that carry 1 to 15 of these titles. Sun Nxt (6 titles in 120 countries) stays, because it's a large Indian service. |
| Free with ads | A `free` or `ads` offer on a service that isn't a library service. |
| With a library card | A free offer on Kanopy, Hoopla, Cineasterna, Filmstriben, filmfriend, Beamafilm, Filmoteket or a similar public-library service. |
| Biggest service | The service with the most of the titles in that country. |
| Larger markets | 56 countries chosen for size and for having their own streaming press. Both CSV files cover all 139. |

### Data source and cost

On publication day, a script reads, read-only:

1. The base lists from CrateDB, with one query each.
2. `/movie/{id}/watch/providers` and `/tv/{id}/watch/providers` from TMDB's API for every title: 5,402 requests. The requests carry a cache-busting parameter, as in the #678 measurement.
3. `/discover/movie` and `/discover/tv` totals for Netflix in each of its 131 countries: 262 requests.

At 6 parallel requests, the 2026-10-18 snapshot took 4 minutes 43 seconds and was read at 23:33 UTC. The snapshot is the only source of the numbers, and its date is the study's date.

### Data quality behind that choice

The stored availability can't carry a published study:

1. **Provider checks paused for twelve days.** No title got a provider check (`tmdb_providers_updated_at`) from 2026-10-05 to 2026-10-16; checks resumed on 2026-10-17. Only 733 of the best-rated 1,000 movies had a check in the last 30 days.
2. **Stored offers outlive TMDB's.** For 39 movies checked in the last two days, the stored offers name 3,395 country-title pairs; TMDB lists 2,927, all of them stored. That's about 16% too many, even right after a check. Dune: Part Two, checked at 21:21 UTC on 2026-10-18, still has Netflix in Bermuda. The cause: `goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py` merges the API with scraped TMDB pages and keeps a row until both stop listing it. Stored, Netflix US has 5,815 movies; TMDB says 4,775.
3. **Prices are in local currency.** `price_dollar` holds 59 in Denmark and 99 in Mexico for the same rental, and about 43% of rent and buy offers have none. The study compares no prices.
4. **Bad title rows.** Besides wrong RT matches, a movie row "Rick and Morty" (TMDB 1780522) carries the show's IMDb votes. The release-date and IMDb rules remove these rows.

Limits for the methodology:

- JustWatch tracks most, but not all, local services. A low count can mean that a pay-TV app isn't tracked; Israel's count is the first to check.
- Very small territories (Andorra, San Marino, French Guiana) often show a neighbor's catalogue. They're in the CSV files but not in the charts.
- One snapshot is one day. Every number appears with its date.

### Findings

From the 2026-10-18 snapshot of 4,683 movies and 717 shows in 139 countries.

1. **The US can stream the most of these movies; Spain the most of the best-rated ones.** 3,478 of the 4,683 movies (74%) are on a subscription in the US, ahead of Chile (3,400), Japan (3,361), Colombia (3,331) and Australia (3,321). The fewest among larger markets: Ukraine (633), Israel (725) and Pakistan (788). In the best-rated 1,000, Spain leads with 757, ahead of the US (714), Japan (713) and the UK (702).
2. **Netflix US has fewer of them than almost any other Netflix.** Netflix Switzerland carries 799 of the 4,683 movies and Netflix US 548, fewer than Netflix in 49 of the 54 other larger markets. Across Netflix's whole catalogue, Netflix France has 7,253 movies and Netflix US 4,775, 83rd of 131 Netflix countries. For shows it's the other way round: Netflix US ranks 9th. Of the 2,027 movies on Netflix somewhere, 214 are on Netflix in all 131 countries and 374 in only one.
3. **In some countries, one subscription carries 2 in 5 of these movies; in the US, about 1 in 7.** Chile's Movistar Plus+ has 1,924 and Japan's U-NEXT 1,863. Next are Lepsi TV in Czechia (1,700), Kinopoisk in Russia (1,218) and Watcha in South Korea (1,108). The biggest service in the US, Prime Video, has 639; in the UK, Prime Video has 751; in Germany, Disney+ has 769.
4. **Studio Ghibli streams in 129 countries, but not in Japan.** All 17 Ghibli films in the list are on Netflix in 129 countries and on HBO Max in the US. In Japan, none of them is on a subscription. Of the 75 films made in Japan (by first production country), 61 stream on a subscription in the US and 47 in Japan.
5. **Indian films are both the most and the least streamable.** They're 3% of the list (136 movies) but 14% of the 315 movies the six big global services carry in 130 or more countries (44 movies), and 13% of the 54 movies on no subscription anywhere (7 movies, including Like Stars on Earth, Lagaan and Lage Raho Munna Bhai). The widest of the best-rated: Kabhi Khushi Kabhie Gham and Shrek, on a big service in 136 countries.
6. **For shows, Netflix is the biggest service almost everywhere.** It carries the most of the 717 shows in 55 of the 56 larger markets (Russia: Kinopoisk). For movies, it's the biggest in 26. Shows also spread more evenly: 659 in the US, about 600 in western Europe, 198 in Russia.
7. **North America has the most to watch for free.** In the US, 1,575 of the movies stream free with ads, and 1,010 with a library card through Kanopy or Hoopla. Canada has 927 and 389, the UK 825 free with ads. Nordic libraries carry the most outside North America: 500 in Norway, 469 in Sweden, 462 in Denmark. Russia has 1,286 free with ads, which needs a hand check.

Almost everything can be rented: 4,604 of the 4,683 movies (98%) can be streamed in the US one way or another.

Before publication, each finding gets a hand check on the services' own sites for two countries or more. Check first: U-NEXT and Movistar Plus+ counts, Ghibli in Japan, Russia's free services, Israel's low count, and where Like Stars on Earth and Lagaan can be rented.

### Hand checks (2026-10-19)

The checks of 2026-10-19 compared the snapshot with a live TMDB re-read, JustWatch's own pages, U-NEXT's title and search pages, Movistar TV Chile's public catalogue API, and press releases. The post was changed where the evidence called for it.

| Finding | Verdict | Evidence | Change in the post |
| --- | --- | --- | --- |
| Ghibli on Netflix in 129 countries, HBO Max in the US | Confirmed | A live TMDB re-read matched the snapshot. Netflix's press release of 2020-01-20 licensed 21 films "globally excluding the US, Canada and Japan"; Canada followed in June 2020. Warner Bros. Discovery renewed the US deal with GKIDS in March 2024. | "129 countries" is explained: the countries in our data where JustWatch tracks Netflix, minus the US and Japan. Netflix itself operates in more than 190. |
| None of the 17 streams in Japan | Confirmed, with an exception | No offer of any kind in TMDB or JustWatch Japan ("can't be streamed in Japan", 81 Japanese services checked); U-NEXT's search has none. But Grave of the Fireflies, an 18th Ghibli film in the list whose rights are with Shinchosha, has been on Netflix in Japan since 2025-07-15 (Netflix Japan press release, 2025-05-14). | The post names the exception. It doesn't say Ghibli refuses to stream in Japan: no statement by Ghibli was found. |
| U-NEXT carries 1,863 | Confirmed as a floor | 25 of 25 sampled titles are included on U-NEXT's own pages. Of 10 titles the data says aren't, 4 are included: JustWatch misses some. U-NEXT's press release of 2025-11-26 says it has Japan's largest included catalogue. | "The most of any streaming service with its own library"; the real number is probably higher. |
| Chile's Movistar TV carries 1,924 | The number reproduces, but it isn't one library | About 97% of the film items in Movistar TV's own catalogue API (10,000-item sample) are Prime Video, Disney+, HBO Max and Paramount+ titles shown inside the app, sold as add-ons. 1,204 of the 1,924 are also on Disney+, Prime Video or HBO Max in Chile. | Pay-TV apps still count (owner decision). The chart's answer leads with U-NEXT, and its note and the text say what Movistar TV's count holds. The name is Movistar TV, not Spain's Movistar Plus+. |
| Israel's 725 | A coverage gap and a real effect | JustWatch tracks 39 services in Israel but not Disney+ (in Israel since 2022, about 670 of these movies elsewhere), yes, HOT, Cellcom TV or Partner TV. Netflix Israel's catalogue is also small: 513, against a median of 606. | The text says so. |

Not verified: Netflix availability outside Germany (its pages show only the visitor's region), a 2026 renewal of the Ghibli licences, the end of the HBO Max US deal, Movistar TV's catalogue beyond 10,000 items, and the film libraries of the Israeli pay-TV services. The full notes, with every source URL and date, are in [`streaming-study/hand-checks.md`](streaming-study/hand-checks.md).

### Charts

Four charts. Each has a plain question as its title and a one-sentence answer, and each is a ranked bar chart of countries. They're drawn as SVG in the page's server HTML, 358 units wide, so a 390 px phone with 16 px gutters shows them at full size: 12 px country names, 11.5 px values. On wider screens they stop at 448 px. They use the site's tokens: the gray-950 surface, amber-600 bars (validated against the dark surface), gray-500 for context bars, gray-100 to gray-400 text in Gabarito. They work without JavaScript, have a `<title>` and `<desc>`, give every bar a native tooltip, and are each followed by a "Show the numbers" table with every country.

| Chart | Question | Answer under it | Mockup |
| --- | --- | --- | --- |
| 1 | How many of these movies can you stream in your country? | The United States leads with 3,478 of the 4,683, about 3 in 4. In Ukraine it's 633, about 1 in 7. | [`chart-1-movies-by-country.svg`](streaming-study/chart-1-movies-by-country.svg), all 56 larger markets |
| 2 | If you kept only one subscription, how many of these movies would you get? | In Chile and Japan, one service carries about 2 in 5 of them. In the US, the biggest one has 639, about 1 in 7. | [`chart-2-one-subscription.svg`](streaming-study/chart-2-one-subscription.svg), 18 countries, each bar labeled with its service |
| 3 | How many of these movies are on Netflix in your country? | Netflix Switzerland has 799. Netflix US has 548. That's fewer than Netflix in 49 of the 54 other countries we looked at. | [`chart-3-netflix.svg`](streaming-study/chart-3-netflix.svg), 19 countries, the US highlighted |
| 4 | How many of these shows can you stream in your country? | Most of the 717 are easy to find: 659 in the US, about 600 in western Europe. Russia has 198. | [`chart-4-shows-by-country.svg`](streaming-study/chart-4-shows-by-country.svg), 17 countries |

Chart 2 replaces the "subscriptions to reach half" chart. It asks the same question in a form anyone can answer: if you could keep one service, how many of these movies would it give you? The bar is the number of movies on the biggest service, and the service's name sits under the country.

Charts 2 to 4 show the highest and lowest countries plus the US, the UK, Germany, France, Japan, India and Brazil. Each says so in its note, and the table lists every country. Findings 4, 5 and 7 work better as short lists and sentences with links to the title pages they name than as charts. Those links are what the study does for discovery.

### Downloadable CSV files

Both files are under CC BY 4.0, with the TMDB and JustWatch credits in the file's description on the page. They hold counts only: no IMDb, Rotten Tomatoes or Metacritic scores, and no services per title.

- [`draft-goodwatch-streaming-by-country-2026.csv`](streaming-study/draft-goodwatch-streaming-by-country-2026.csv): one row per country (139 rows). Columns: `country_code`, `country`, `movies_in_study`, `movies_on_subscription`, `movies_free_with_ads`, `movies_with_library_card`, `movies_to_rent_or_buy`, `movies_any_way`, `biggest_movie_service`, `biggest_movie_service_movies`, `movies_on_netflix`, `best_rated_1000_on_subscription`, the same for shows, `netflix_catalogue_movies`, `netflix_catalogue_shows`, `snapshot_date`.
- [`draft-goodwatch-streaming-by-title-2026.csv`](streaming-study/draft-goodwatch-streaming-by-title-2026.csv): one row per title (5,400 rows). Columns: `tmdb_id`, `type`, `title`, `year`, `countries_on_subscription`, `countries_on_netflix`, `countries_free_with_ads`, `countries_with_library_card`, `countries_to_rent_or_buy`, `countries_any_way`, `snapshot_date`.

### Credits and terms

The page carries the TMDB logo and "This product uses the TMDB API but is not endorsed or certified by TMDB", a JustWatch credit for the streaming data, and "Information courtesy of IMDb (https://www.imdb.com). Used with permission.", because IMDb vote counts select the titles. No ads, affiliate links or sponsorship. A "How to cite" line gives the title, "GoodWatch, 2026" and the URL.

The raw TMDB snapshot stays out of the public repo. TMDB's terms limit caching to six months, and the raw snapshot is JustWatch's offer data. The repo keeps the script and the counts.

### Headline, outline and pitch

**Headline (proposed):** "Americans can stream more of the movies everyone knows than anyone else, just not on Netflix."

It pairs finding 1 with finding 2, a surprise a US reader can check against their own Netflix. Alternatives:

- "Studio Ghibli streams in 129 countries, but not in Japan" (the widest audience, but only one finding)
- "Spain streams the most of the world's best-rated movies" (true for the best-rated cut, not the base)

**Slug:** `/blog/streaming-by-country-2026`. The year lets the 2027 edition sit next to it.

**Outline:**

1. Kicker "Data study", headline, "GoodWatch" and the date, a two-sentence lead.
2. Key findings: five bullets and a stat row (the `<dl>` from `about.tsx`).
3. How many of these movies can you stream in your country? (chart 1)
4. If you kept only one subscription (chart 2)
5. Netflix isn't the same everywhere (chart 3, the catalogue totals)
6. Studio Ghibli: everywhere but Japan
7. Indian films: the most and least streamable, with links
8. Shows (chart 4)
9. Free with ads, and with a library card
10. The best-rated 1,000: the same count for the top of the list
11. How we counted: titles, snapshot date, sources, definitions, exclusions, limits, the pay-TV footnote
12. Download the data, how to cite, credits

**Pitch:** one finding per writer, with their country's numbers and the snapshot date. No link request, no mass mailing.

| Beat | Lead finding | Writers to research |
| --- | --- | --- |
| Netflix trackers | Netflix US against Switzerland and France | What's on Netflix |
| US cord-cutting | One subscription gets 1 in 7; 1,575 free with ads, 1,010 with a library card | Cord Cutters News, The Streamable |
| Spanish and Latin American press | Spain first among the best-rated; Movistar Plus+ in Chile and Colombia | Xataka, Hipertextual |
| Anime and Japan | Ghibli in 129 countries but not Japan | Anime news sites, Japan-focused English press |
| Indian film press | Most and least streamable | Indian entertainment desks |
| Data and statistics sites | The two CSV files | Statistics roundups that cite What's on Netflix today |

The research's sequence applies: publish, wait until URL Inspection shows the post indexed, then cross-post to dev.to and pitch.

## Part 2: the blog

The code map behind this part was taken from the repo on 2026-10-18. The file names are real.

### Routes

| URL | Route file | What it is |
| --- | --- | --- |
| `/blog` | `goodwatch-webapp/app/routes/blog._index.tsx` | The list of posts, newest first |
| `/blog/<slug>` | `goodwatch-webapp/app/routes/blog.$slug.tsx` | One post. An unknown slug answers 404 |
| `/blog/rss.xml` | `goodwatch-webapp/app/routes/blog.rss[.]xml.ts` | RSS 2.0 feed, a resource route like `sitemap[.]xml.ts` |
| `/blog/<slug>/<file>.csv` | `goodwatch-webapp/public/blog/<slug>/` | The study's CSV files |

Static `blog.*` routes outrank `$type._index.tsx` and `$type.$category._index.tsx`, which would otherwise catch `/blog` and `/blog/<slug>`. A route test checks this.

### How posts are written

Each post is `goodwatch-webapp/app/content/blog/<slug>/post.mdx`, with an exported `meta` object (title, description, slug, published, updated, kind, og copy). `@mdx-js/rollup` and `remark-gfm` compile it in the Vite build; nothing new runs in the browser. A registry, `app/content/blog/posts.ts`, lists the posts through `import.meta.glob`, and `blog.$slug.tsx` loads only the matching post's module.

- **Charts are components.** `<Chart name="movies-by-country" />` renders the SVG from the study's data file during the server render, with the site's classes.
- **dev.to export.** `scripts/blog-to-devto.mjs` turns a post into dev.to Markdown. It replaces each chart with a PNG drawn by the resvg already in the repo, and makes every link absolute.
- **No runtime cost.** The output is ordinary React in the post's own route chunk. Nothing reaches the app shell, the footer or any landing surface, so the `./bench.sh budget` lines don't move.

### Page layout

The post reuses `about.tsx`'s structure and no new visual language:

- One `max-w-2xl` column, the `Kicker` from `app/ui/info-page.tsx`, `about.tsx`'s h1 and lead classes, and `privacy.tsx`'s h2 and h3 classes for long sections.
- The `about.tsx` stat `<dl>` for key findings, and the card style (`rounded-2xl bg-white/[0.04] ring-1 ring-white/10`) for figures.
- Inline links in `font-semibold text-amber-500 hover:text-amber-400`.
- `Credits` from `app/ui/about/AboutParts.tsx` for the data-source footer, and `Breadcrumbs` from `app/ui/nav/Breadcrumbs.tsx` (Home, Blog, post).

The `prose` classes some pages use do nothing (there's no typography plugin), so MDX elements map to these classes through a component map in `app/ui/blog/`.

### Meta, canonical and structured data

- **Meta:** `buildMeta` from `app/utils/meta.ts` with `url: https://goodwatch.app/blog/<slug>`: title, description, self-canonical, `index, follow`, Open Graph and Twitter tags. `buildMeta` gains an article option that sets `og:type` to `article` and adds `article:published_time` and `article:modified_time`.
- **No hreflang:** the site has no locale URLs, and the post is English only.
- **JSON-LD**, through the replace pattern of `_index.tsx` and `person.$personKey.tsx`:
  - `BlogPosting` with `headline`, `description`, `datePublished`, `dateModified`, `image` (the OG card) and `mainEntityOfPage`. `author` and `publisher` both point at the existing Organization `https://goodwatch.app/#organization`, and `isPartOf` at `#website`.
  - `Dataset` for the study, with both CSV files as `DataDownload` entries, `license` (CC BY 4.0), `temporalCoverage` (the snapshot date), `spatialCoverage`, `creator` (the organization) and `isBasedOn` naming TMDB and JustWatch. That makes the study eligible for Google Dataset Search.
  - `BreadcrumbList` from `breadcrumbJsonLd` in `app/ui/nav/breadcrumb-trail.ts`.
- **OG image:** `/blog` and `/blog/<slug>` entries in `STATIC_PAGE_COPY` (`app/ui/og-image/copy.ts`), so the existing `BandCard` draws a 1200x630 card with tag "Data study", the headline and one finding. `/og/blog/<slug>.jpg` already reaches `og.$first.$second.tsx`. New keys need no `CACHE_PREFIX` bump.

### Sitemap and the weekly job

- **Blog URLs go into `sitemap_static.xml`, with dates.** `create_sitemaps.py` reads `goodwatch-webapp/app/content/blog/posts.json` (slug, published, updated), which a test checks against the MDX `meta` exports. A post's `<lastmod>` is its `updated` date, which is evidence of a visible change, as `docs/sitemap.md` requires. Other static entries stay undated.
- **No new sitemap file.** A `sitemap_blog.xml` would change the index (and need a Search Console resubmission), and an empty one fails the URL check.
- **Windmill:** `posts.json` joins `SOURCE_FILES` in `goodwatch-flows/windmill/f/seo/regenerate_sitemaps.py`, and the wrapper is redeployed with the generator change. The URL checker needs no change.
- **Timing:** the weekly run is Saturday at 03:00 UTC. For the study, the owner also requests indexing in URL Inspection on publication day.

### Footer, RSS and the CSV files

- **Footer:** the "Blog" entry in `FOOTER_COLUMNS` (`app/ui/footer/links.tsx`) changes from `https://dev.to/t/goodwatch` to `/blog`, with the same label and icon. The dev.to link stays on the About page (`FIND_US` in `AboutParts.tsx`) as "dev.to".
- **RSS:** one item per post with title, link, guid, `pubDate`, description, and the full post as `content:encoded`, so dev.to's RSS import can bring a post in as a draft with its canonical set. The `<link rel="alternate" type="application/rss+xml">` goes on blog pages only.
- **CSV:** `csv` isn't in the content types of `app/server/static-files.server.ts`, so a `.csv` in `public/` falls through to Express today. Add `csv` (`text/csv; charset=utf-8`, the one-hour policy) there and to `scripts/precompress.mjs`. The links use the `download` attribute.

### Page cache and performance

- An anonymous blog page is stored by the page cache like any other page, once it re-exports `pageHeaders`.
- The post isn't one of the six surfaces in `goodwatch-benchmark/urls/budget.json`. The build runs Lighthouse on it once, and `./bench.sh budget` runs before merge to show the six didn't change.
- Two traps from the code map: a small module shared by the footer and a blog route would be pulled into the `shell` chunk (Vite rule 3), so the footer imports nothing from `app/content/blog/`. The chart components stay in the post's chunk.

### dev.to cross-post

1. Publish on goodwatch.app.
2. Request indexing in URL Inspection, and wait until it shows the post indexed.
3. Export with `scripts/blog-to-devto.mjs`, paste into dev.to, and set "Canonical URL" to the goodwatch.app post.

## Build plan for stage 2

| Step | Work | Size |
| --- | --- | --- |
| 1 | Blog plumbing: routes, MDX build, registry, layout components, meta and JSON-LD, OG copy, RSS, footer link, CSV content type, tests | 1.5 days |
| 2 | Sitemap: `posts.json`, generator change, tests, Windmill `SOURCE_FILES`, `docs/sitemap.md` | Half a day |
| 3 | Study script in `goodwatch-webapp/scripts/streaming-study/` (base lists, TMDB snapshot, analysis, CSV and data files), with unit tests for brand folding and exclusions | 1 day |
| 4 | Chart components, tables, the post text, hand checks of the findings | 1.5 days |
| 5 | Lighthouse, `./bench.sh budget`, sitemap check, dev.to export | Half a day |

About five days in total. Publishing (the deploy, URL Inspection, dev.to and the pitches) stays with the owner.

## Open questions

None of these blocks stage 2.

1. **Headline:** the proposed one, Ghibli, or Spain and the best-rated cut?
2. **TMDB terms:** the backlinks research leaves open whether GoodWatch's use of TMDB needs a written agreement. Does that question hold back a public study page?
3. **Stored availability:** the 16% overcount and the twelve-day pause in provider checks affect title pages too. Should they get their own ticket?
4. **Countries:** are the 56 larger markets the right set for chart 1, with all 139 in the CSV files?
