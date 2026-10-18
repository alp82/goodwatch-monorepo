# Best-of lists and the people list: names and design

Date: October 18, 2026. Stage 1 of the plan in [the internal links proposal](../internal-links-proposal.md) (B2 and P3): names, contents, and layouts for the owner to choose. Nothing ships yet.

**Decision (October 19, 2026):** the owner took every recommendation: the three addresses and headings, layout A for both lists and for people, GoodWatch score order, footer F1 with icons the page already draws, and a link from each hub. The prototype route is removed; the pages are `app/routes/$type.best.tsx` and `app/routes/people.tsx`.

The mockups are screenshots of a prototype route that uses the site's real components and real data: open [mockups.html](mockups.html), or run the prototype (see [How to run the prototype](#how-to-run-the-prototype)).

## Recommendation

| Page | Address | Title tag | Heading |
| --- | --- | --- | --- |
| Movies | `/movies/best` | The Best Movies of All Time, Ranked \| GoodWatch | The best movies of all time |
| Shows | `/shows/best` | The Best TV Shows of All Time, Ranked \| GoodWatch | The best TV shows of all time |
| People | `/people` | Popular Actors: Their Best Movies and TV Shows \| GoodWatch | Popular actors |

- **Titles:** layout A, ranked rows, 250 a page. It matches the "ranked" search intent, it's the lightest (about 21 KB of Brotli HTML a page), and it's what the internal links simulation measured.
- **People:** layout A, the person page's collaborator cards. Each card links up to four of the person's sitemap titles, so the page adds 116 more links into the cohort, for about 8 KB.
- **Footer:** F1, a fourth column "Best of", with icons the footer already draws. New icon shapes would cost about 0.5 KB on every page and leave the start page 6 bytes under its HTML line.
- **Order:** by GoodWatch score. That's what "best" promises. It brings some new releases high up, see [Order](#order).

## Names and addresses

- **`/movies/best` and `/shows/best`** sit under the hubs, next to `/movies/moods`, `/movies/streaming`, and `/movies/genres`. The breadcrumb reads Movies › Best movies. "best" isn't a category key (`mainHierarchy` has `moods`, `streaming`, and `genres`), and a route with the static segment `best` (`$type.best.tsx`) ranks above `$type.$category._index.tsx`, so nothing clashes. No redirect or proxy rule names these paths today.
- **`/people`** answers 404 today (the `$type` route rejects it). It pairs with `/person/<id>` the way `/movies` pairs with `/movie/<id>`.
- **Avoid "top".** `CONTEXT.md` lists "Top list" as a term to avoid (it means a share list). "Best" is also the word the genre pages already use ("Best drama movies") and the hubs use ("The best movies and where to stream them").
- **Not chosen:** `/best-movies` (keyword URL, outside the hub trail), `/movies/top-700` (the count can change, "top" clashes), `/people/popular` (a second segment with nothing beside it).
- **Search intent:** the hub already targets "best movies to stream". The list targets "best movies of all time", which is a different query, so the two pages don't compete.

### Copy

All copy stays true to the cohort: about 90% are the most-rated titles (core, kept indefinitely) and 10% are currently popular (attention, rotated at most 5% a month). It never claims "the 700 with the most ratings".

- **Intro (movies):** "700 well-known movies, ranked by GoodWatch score: the most-rated movies on GoodWatch, plus 70 that are popular right now. Updated monthly." The numbers come from the selection comment, so they follow the sitemap.
- **Meta description (movies):** "The 700 best-known movies, ranked by one score from IMDb, Rotten Tomatoes, Metacritic and TMDB. See every score and where to stream it." The score sources are the ones the How it works page names.
- **People:** all 30 sitemap people are actors today, so the page says "Popular actors" and "Each one starred in at least three of them". The selection also takes directors, so the copy is built from the departments: it says "actors and directors" only once a director is in the list.

## What each page lists

- **Exactly the sitemap cohort.** The server reads the committed sitemap files (`public/sitemaps/sitemap_movie_detail_0.xml`, `sitemap_show_detail_0.xml`, `sitemap_people.xml`) once at start: the `goodwatch-selection` comment for core and attention, the `<loc>` lines for addresses. Card fields come from Crate (one query by ID per type, cached).
- **In sync by construction.** The weekly Windmill job `f/seo/regenerate_sitemaps` commits the new sitemap files to `main`, and every push to `main` deploys. The deploy that changes the sitemap also changes the lists. No second selection runs anywhere.
- **Same addresses as the sitemap.** Each link uses the sitemap's own `<loc>` path, so a list link never needs a redirect, even if a title's slug changes later.
- **A stale title stays listed.** For example, *Titanic: Band of Courage* (45 catalog votes) is in the core. The list shows what the sitemap lists; fixing the selection fixes both. Titles that Crate no longer has are left out of the page.
- **Pagination (layout A):** `?page=2`, the same as category pages (`pagedUrl`, self canonical, `index, follow`). Movies have 3 pages (1-250, 251-500, 501-700) and shows 2. The page links are numbered ranges at the top and bottom. `robots.txt` doesn't block `/movies/*?`.
- **Sitemap:** add `/movies/best`, `/shows/best`, and `/people` to `sitemap_static.xml`. Later pages stay out of the sitemap; they're linked from page 1.
- **Hubs:** `/movies` and `/shows` link to their list under the heading. The proposal's simulation didn't need it, but it's one link and members find the list where they browse.

### Order

| Order | First titles | 2025-2026 titles in the first 250 |
| --- | --- | --- |
| GoodWatch score (recommended) | *The Godfather*, *12 Angry Men*, *Seven Samurai*, *Schindler's List*, *Rear Window* | Movies 16 of 57, shows 8 of 8 |
| Ratings count | *The Dark Knight*, *The Shawshank Redemption*, *Inception*, *Fight Club*, *Interstellar* | Movies 0, shows 5 |

- Score order fits the heading. It also lifts popular new releases with early high scores: *Batman: Knightfall Part 1* (2026) is #40 with 89. A tie-breaker can't fix that; a floor of ratings for the ranked part could, but then the list isn't the whole cohort in one order.
- Ratings order reads as "most popular", not "best". With it, the heading would be "The most-loved movies of all time".
- Shows by score start with animation and nature (*Avatar: The Last Airbender*, *Gravity Falls*, *Death Note*, *Planet Earth*); *Breaking Bad* isn't in the first 10.

## Layouts

Every variant uses existing pieces only: the category grid's `MovieTvCard`, the Your scores row look (small poster, `ScoreRing`), the person page's collaborator card and portrait, people search's name block and known-for posters, and the site's breadcrumbs, headings, and chips.

### Movies and shows

| Variant | What it is | Pages | Brotli HTML (movies) | Brotli HTML (shows) |
| --- | --- | --- | ---: | ---: |
| A. Ranked rows | Rank, small poster, title, year and two genres, score ring. Two columns from 1024 px. | 3 + 2 | 21 KB a page | 20 KB a page |
| B. Poster grid by decade | The category grid's cards under decade headings, with a decade chip row. | 1 | 64 KB | 28 KB |
| C. Top 12, then a genre index | 12 cards, then every other title as a text link with its score, grouped by first genre, each group linking its genre page. | 1 | 51 KB | 23 KB |

- Sizes are the page's HTML minus the empty page shell, at Brotli quality 11, measured on the dev server with loader data trimmed to the fields the page draws.
- B is 1.7 MB of raw HTML for movies: 700 cards with their action frames. Cards after the first 12 skip rendering offscreen, but the DOM stays large. Don't use B for movies.
- A and C both link every title with plain `<a href>` in the server HTML. A one-page layout puts every title 2 clicks from the start page; with A, the 450 movies on pages 2 and 3 are 3 clicks away, as the simulation assumed.
- C also links every genre group to its genre page (18 of 18 movie groups, 9 of 10 show groups), but files each title under its first genre only: Action holds 148 movies, Documentary 1.

### People

| Variant | What it is | Brotli HTML |
| --- | --- | ---: |
| A. Cards (recommended) | Collaborator cards: portrait, name, role, up to four sitemap titles as text links and "+N more". | 7.7 KB |
| B. Portrait wall | Portraits at poster-card size, name and role. No title links. | 6.8 KB |
| C. Rows with posters | People search's banner look: portrait, name block with "See all titles", three known-for posters. | 8.5 KB |

### Footer

| Variant | Where | Start page cost |
| --- | --- | ---: |
| F1. A "Best of" column (recommended) | Fourth column between Explore and GoodWatch. Phones show two rows of two. | +30 B with existing icons, +511 B with a trophy and a people icon |
| F2. Inside Explore | After Movies and Shows; Explore grows to 8 links. | +18 B with existing icons |
| F3. Explore split | "Browse" (Movies, Shows, the three lists) and "For you" (Discover, Watch next, Taste). | about F1 |

- Link names: Best movies, Best TV shows, People. Captions (shown on hover): "The 700 best, ranked", "The 300 best, ranked", "Popular actors, all their titles".
- The start page sends 19,963 bytes of Brotli HTML against its 20,480-byte `html_bytes` line. Icons are inline SVG: a new shape costs about 0.25 KB, a repeated one almost nothing. Stage 2 runs `./bench.sh budget` for the footer change.

## The prototype

The screenshots came from a prototype route, `/prototype/best-of`, removed after the decision. Its code is in the commit that added this file (`app/routes/prototype.best-of.tsx`, `app/ui/prototype-best-of/variants.tsx`, `app/server/prototype-best-of.server.ts`). It ran on the dev server with a throwaway Valkey cluster, so nothing touched production Redis.

## Questions for the owner

1. **Names:** `/movies/best`, `/shows/best`, and `/people`, with the headings in the [Recommendation](#recommendation)?
2. **Title layout:** A (ranked rows, 3 and 2 pages), C (top 12 and a genre index, one page), or B for shows only?
3. **Order:** by GoodWatch score (new releases can rank high) or by ratings count (heading "most-loved")?
4. **People layout:** A (cards with title links), B (portrait wall), or C (rows with posters)?
5. **Footer:** F1, F2, or F3? Reuse the Movies and Shows icons for the two lists (about 30 bytes), or draw a trophy (about 0.5 KB on every page, close to the start page's line)?
6. **Hub links:** add a link to the list on `/movies` and `/shows`?

## What wasn't verified

- Production builds: the sizes come from the dev server. Remix's production HTML differs from dev only in the shell, which the sizes subtract.
- Lighthouse and `./bench.sh budget`: they apply to stage 2. The footer cost is an estimate made by inserting the column's markup into the live start page's HTML.
