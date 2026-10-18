# Internal links for the sitemap cohort

Date: October 18, 2026. Proposal only: no code was changed.

The sitemap lists a stable cohort of 1,000 titles (700 movies, 300 shows) and 30 people. An SEO specialist advised that the most valuable pages need enough internal links ("votes"). This report measures today's link graph as a crawler without JavaScript sees it, simulates changes, and recommends a short plan.

## Recommendation

Build three things, in this order:

1. **Best-of lists and a people list, linked from the footer.** Two plain, paginated lists of the sitemap titles (most-voted first) and one list of the 30 sitemap people. This is the only change that links every sitemap title and person from a non-title page and puts all of them within three clicks of the start page.
2. **A visible genre row on title pages.** Eight sitemap titles of the page's first genre, picked with a seeded hash so that the links spread evenly. It takes the titles with zero or one inbound link from 31 to 2 and doubles the median inbound count, for about 0.1 to 0.3 KB of compressed HTML.
3. **Sort category pages and their hubs by vote count instead of TMDB popularity.** It adds 200 sitemap titles to category pages 1 and 2, but changes what those pages feel like, so it needs the owner's decision.

Together, the simulation gives: all 1,000 titles and 30 people reachable, no title deeper than three clicks, one title with fewer than two inbound links (31 today), median inbound links 24 (12 today), and every title linked from at least one non-title page (734 today).

The lists work as soon as Google fetches one page that carries the footer. The genre row works only as fast as Google fetches title pages, at about 1.4 pages a day today, so its effect builds slowly. That is why the lists come first.

Don't change the start page (its HTML is at its byte budget, and the effect is small), and don't trim cast or related links (they hurt members for a modest gain). Treat a related-map change as a later option.

## How the graph was measured

- **Crawl.** A crawler fetched the live site's server HTML as Googlebot would without JavaScript: a Googlebot user agent, no cookies, no `Accept-Language` (so the site answers in English for the US, like for Googlebot), `robots.txt` rules applied, `nofollow` respected, redirects followed as separate requests, and only `<a href>` links counted (links inside scripts and loader data don't count). It made 1,500 requests at most one per 1.1 seconds, plus 2 retries, and cached every response.
- **Order.** First, a breadth-first crawl from `/` of every page that isn't a title or person page (hubs, all 81 category leaves, their page 2, static pages), plus the titles that the start page links. Then all 1,000 sitemap titles and 30 people. Then, with the remaining budget, the shallowest other title pages. In total, 1,496 pages answered: 1,271 title pages, 35 person pages, 81 category leaves, 81 category second pages, 8 hubs, the start page, and 19 other pages.
- **Metrics.** *Depth* is the number of clicks from `/` in the crawled graph. *Inbound links* counts the distinct crawled pages, reachable from `/`, that link to a page. *PageRank share* is the part of a plain internal PageRank (damping 0.85) that lands on sitemap titles. Treat it as a relative measure between scenarios only.
- **Simulation models.** Category pages and hubs were rebuilt from a read-only copy of their database query. That copy reproduces all 162 crawled category pages and all hubs exactly. The related map's links were rebuilt from read-only Qdrant queries with the page's own filter. These match 1,258 of 1,266 crawled title pages within 4 of 64 titles (823 exactly); the rest come from day-old cached neighborhoods. The related-map scenarios use this model as their baseline, which gives the same results as the measured graph to within one title.
- The crawl scripts and cached responses stay outside the repository.

### Limits of the measurement

- The crawl fetched every page at depth 1, 850 of the 2,153 pages at depth 2, and 556 of the 23,758 pages at depth 3. Uncrawled pages at depth 2 are mostly other title pages, and their links are unknown. Therefore a depth of 3 or more is an upper bound, and the 11 titles that no crawled page links to may still be linked from title pages outside the sitemap.
- Inbound counts include links between sitemap title pages, because the crawl fetched all of them. That is 65% of today's inbound links to sitemap titles. Google sees those links only after it crawls the linking title page, so links from hubs, category pages, and the start page count earlier. The "Linked from a non-title page" column measures that.
- 80,448 of the 90,689 title links are the related map's hidden copy (see [the related map](#r3-to-r5-the-related-map)). The crawl counts them like visible links, but Google may give hidden links less weight. If it does, today's inbound counts are lower than reported, and visible lists and rows count for more.
- Category pages after page 1 answer with a self canonical and `index, follow`, so their links count.

## Today's link graph

The following table shows reach and depth for the sitemap cohort today.

| Cohort | Reachable from `/` | Depth 1 | Depth 2 | Depth 3 | Depth 4+ | Not linked from crawled pages | Inbound median | Inbound 0 or 1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 titles | 989 | 12 | 481 | 452 | 44 | 11 | 12 | 31 |
| 30 people | 30 | 0 | 7 | 23 | 0 | 0 | 9 | 0 |

- **Depth.** The median sitemap title is 3 clicks from the start page: start page, a hub such as `/movies/moods`, then a category page or a hub's sample row.
- **Weak titles.** 266 titles have no link from any non-title page, and 59 have two or fewer inbound links. The 11 titles that no crawled page links to are *Drive* (2011), *Home Alone*, *The Help*, *Sweeney Todd*, *The Theory of Everything*, *Titanic: Band of Courage*, *Grave of the Fireflies*, *Moulin Rouge!*, *Baby Reindeer*, *The Heroes* (2008), and *The Day of the Jackal* (2024). Only the sitemap points Google at them.
- **People.** Sitemap people are linked only from title pages: 266 links from sitemap titles, 15 from other titles, and 22 from other person pages. No hub, category, or start-page link reaches them.

### Where the title links point

Pages reachable from `/` carry 90,689 title links, and 18.8% of them point at sitemap titles. The following table shows the share per page section.

| Section | Links to sitemap titles | All title links | Share |
| --- | ---: | ---: | ---: |
| Start page | 12 | 16 | 75% |
| Hubs (8 per category leaf) | 276 | 464 | 59% |
| Category page 1 | 1,590 | 3,240 | 49% |
| Category page 2 | 878 | 3,145 | 28% |
| Other pages (Discover, Explorer, static) | 320 | 552 | 58% |
| Person filmographies | 381 | 1,644 | 23% |
| Title pages, "Titles like" | 13,181 | 80,448 | 16% |
| Title pages, other links | 455 | 1,180 | 39% |

Title pages dominate: each links 64 related titles and about 33 people. The 30 sitemap people's pages link 254 of their 337 sitemap-title credits; the rest sit behind "show more" links that `robots.txt` blocks (`/person/*?`).

### Which titles soak up links

Outside the sitemap, the most-linked titles are fingerprint neighbors of the cohort's superhero, animation, and science fiction titles. 99% of the links into the top 25 come from "Titles like" lists. All of them have far fewer votes than the sitemap core needs.

| Title | Inbound links | Votes | Score |
| --- | ---: | ---: | ---: |
| *Your Friendly Neighborhood Spider-Man* (show, 2025) | 93 | 21,612 | 78 |
| *Trollhunters: Tales of Arcadia* (show, 2016) | 91 | 24,530 | 78 |
| *Krrish 3* (movie, 2013) | 90 | 30,094 | 66 |
| *Ben 10* (show, 2005) | 86 | 39,874 | 83 |
| *Teenage Mutant Ninja Turtles: Mutant Mayhem* (movie, 2023) | 86 | 90,382 | 78 |
| *Superman: The Animated Series* (show, 1996) | 85 | 20,737 | 85 |
| *Ben 10: Ultimate Alien* (show, 2010) | 85 | 16,798 | 80 |
| *My Hero Academia: Two Heroes* (movie, 2018) | 84 | 17,963 | 89 |
| *Justice League Unlimited* (show, 2004) | 82 | 27,647 | 85 |
| *Star Wars: Skeleton Crew* (show, 2024) | 81 | 48,346 | 76 |

The median sitemap title has 12 inbound links, so these titles get about seven times as many. This is the "hub" effect of nearest-neighbor lists: some titles sit close to many others in fingerprint space. It is a product question as well as an SEO one (*Krrish 3*, scored 66, appears in 90 related lists). None of the proposals below remove these links. A per-title cap on appearances in related lists is a possible follow-up.

### Other observations

- No crawled title page is over Google's 2 MB fetch limit. The largest was 1.3 MB (*The Tonight Show Starring Johnny Carson*).
- Six responses took longer than 5 seconds, and five of them longer than 20 seconds. Two title pages (*Captain Phillips* and *Don't Trust the B---- in Apartment 23*) timed out at 90 seconds and answered quickly on retry. Google lowers its crawl rate when a site answers slowly, so slow uncached title renders are worth a separate look.
- *Titanic: Band of Courage* (movie 298952, a 2013 documentary) is in the sitemap core, but the catalog now gives it 45 votes, far below the 5,000 the selection requires. It is also one of the 11 titles no crawled page links to. Check that title's catalog record and the next weekly selection run.
- The start page sends about 22 KB of Brotli HTML to Googlebot. At Brotli quality 11, it compresses to 19.9 KB against the 20 KB `html_bytes` line in `goodwatch-benchmark/urls/budget.json`.

## Proposals and simulated effects

The following table shows each scenario's effect on the 1,000 sitemap titles. "Depth 4+ or not linked" combines titles deeper than three clicks with titles that no crawled page links to.

| Scenario | Reachable | Depth 1-2 | Depth 3 | Depth 4+ or not linked | Inbound median | 0-1 inbound | Linked from a non-title page | Sitemap share of title links | PageRank share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Today (measured) | 989 | 493 | 452 | 55 | 12 | 31 | 734 | 18.8% | 3.36% |
| C1 Categories list sitemap titles first | 996 | 527 | 442 | 31 | 13 | 10 | 935 | 20.2% | 3.48% |
| C2 Categories: 20 of 40 from the sitemap | 993 | 527 | 430 | 43 | 12 | 19 | 804 | 19.2% | 3.39% |
| C3 Categories and hubs sorted by votes | 994 | 502 | 467 | 31 | 13 | 16 | 885 | 20.0% | 3.49% |
| R5 Related map promotes up to 16 sitemap titles from the nearest 160 | 995 | 523 | 447 | 30 | 17 | 16 | 734 | 24.9% | 3.54% |
| R3 Related map adds the 16 nearest sitemap titles | 997 | 572 | 417 | 11 | 26 | 5 | 734 | 35.7% | 3.90% |
| R4 Related map trimmed to 32, sitemap titles promoted | 996 | 563 | 417 | 20 | 24 | 10 | 734 | 61.4% | 4.72% |
| T1 Title pages link 12 people, not 33 | 989 | 493 | 450 | 57 | 12 | 31 | 734 | 18.8% | 5.55% |
| G1 Title pages: 8-title genre row | 998 | 552 | 446 | 2 | 22 | 2 | 734 | 26.8% | 3.62% |
| B2 Best-of lists, linked from the footer | 1,000 | 705 | 295 | 0 | 13 | 11 | 1,000 | 19.6% | 3.51% |
| P3 People list, linked from the footer | 989 | 493 | 461 | 46 | 12 | 31 | 734 | 18.8% | 3.34% |
| H2 Start page: 24 more titles | 989 | 586 | 372 | 42 | 12 | 31 | 734 | 18.9% | 3.38% |
| **Plan: B2 + P3 + G1 + C3** | **1,000** | **691** | **309** | **0** | **24** | **1** | **1,000** | **28.5%** | **3.86%** |
| Plan + R5 | 1,000 | 704 | 296 | 0 | 29 | 1 | 1,000 | 34.0% | 4.06% |

The following table shows the effect on the 30 sitemap people.

| Scenario | Reachable | Depth 2 | Depth 3 | Inbound median | PageRank share |
| --- | ---: | ---: | ---: | ---: | ---: |
| Today (measured) | 30 | 7 | 23 | 9 | 0.09% |
| P3 People list, linked from the footer | 30 | 30 | 0 | 10 | 0.18% |
| T1 Title pages link 12 people, not 33 | 30 | 7 | 23 | 9 | 0.14% |
| H2 Start page: 24 more titles | 30 | 13 | 17 | 9 | 0.09% |
| **Plan: B2 + P3 + G1 + C3** | **30** | **30** | **0** | **10** | **0.17%** |

PageRank shares move little in every scenario. About 35,000 URLs sit within six clicks of the start page, and the 1,000 sitemap titles are a small part of them. Internal links can reorder the site's own weight; they can't create the outside demand that sets Google's overall crawl rate.

### B2 and P3: best-of lists and a people list

**What.** New indexable pages that list the sitemap cohort in plain HTML:

- A movies list with the 700 sitemap movies and a shows list with the 300 sitemap shows, most-voted first, 250 per page, with numbered page links (movies: 3 pages, shows: 2 pages).
- One people list with the 30 sitemap people.
- Footer links to the movies list, the shows list, and the people list on every page. The movies and shows hubs can link them too.

The cohort comes from the `goodwatch-selection` comment in the committed sitemap XML, which ships with every deploy. Core members stay indefinitely and attention members change at most 5% a month, so these links are stable.

**Effect.** Every title and person reachable, none deeper than 3 clicks, every title linked from a non-title page. People move from depth 3 to depth 2. Inbound counts barely move, because each list page adds only one link per title. Linking the lists from the start page alone gives the same depths; the footer only spreads more weight to them.

**Members.** A "most-loved movies" list is a useful page on its own. Keep the page copy about the list, not about the sitemap, and keep it true: the cohort is the most-rated titles plus 10% currently popular ones that change monthly, so say "most-rated and currently popular movies, updated monthly" rather than "the 700 movies with the most ratings".

**HTML size.** About 5 KB of Brotli HTML for 250 text rows, plus the page shell. Small posters must load lazily. The footer links add about 40 bytes to every page, which no budget line notices.

**Effort.** About 1 to 1.5 days: two routes (or one with a media type), a list component, canonical and pagination handling like the category pages, footer links in `app/ui/footer/links.tsx`, and the five new URLs in `sitemap_static.xml`. Run `./bench.sh budget` for the footer change.

### G1: a genre row on title pages

**What.** A visible row on every title page, such as "More drama movies", with 8 sitemap titles of the page's first genre and media type. A seeded hash of the page and candidate picks them (`seededRandom*`, per `goodwatch-webapp/AGENTS.md`), so every title gets about the same number of links, and the row is stable between renders and caches. Show the eight by vote count, and leave out titles that the page already links. Because the pick is spread rather than ranked, don't call the row "top".

Some first genres have few sitemap titles: for movies, Family has 7, War 5, Western 4, History 3, Music 3, and Documentary 1; for shows, Family and Kids have none. Fill a short row from the page's second genre, then from all sitemap titles of the media type. The simulation didn't apply that fallback, so its rows for those genres are short.

**Effect.** The strongest lever on weak titles: 0-1 inbound links drop from 31 to 2, and the median rises from 12 to 22. Depth 4+ drops from 55 to 2 titles. It works on every title page, including the long tail outside the sitemap that Google may crawl first.

**Members.** A small, honest row (it says "top drama", not "similar"), next to the genre breadcrumb or after the related map. It doesn't touch the related map.

**HTML size.** +114 to +268 bytes of Brotli HTML for eight text links on the two title pages the budget measures (*The Matrix* at about 50.5 KB, *Breaking Bad* at about 52.3 KB, against 60 and 65.5 KB lines). It needs about the same again if the loader also carries the titles as data. Posters, if any, must load lazily below the fold.

**Effort.** About 1 day: a server helper that maps genre and media to the sitemap titles (from the same selection comment and the title snapshot), the row component, and a `./bench.sh budget` run for the title lines.

### C1 to C3: what category pages list

**Today.** Each category leaf lists 40 titles per page by TMDB popularity: score at least 40, at least 1,000 votes, and the category's filter (`app/server/discover.server.ts:732`). Each hub shows the first 8 of each leaf (`app/ui/explore/MovieTvList.tsx:28`). Only page 1 of a leaf is one click from its hub; page 2 needs the single "next page" link.

**Effect.** Category page 1 already lists many sitemap titles: 21 of 40 for scary movies, 32 for drama movies, 36 for drama shows, 27 for Netflix movies. Across all leaves, pages 1 and 2 show 670 distinct sitemap titles today. They would show 870 with C3 and 923 with C1. 999 of the 1,000 sitemap titles already appear in some category's list (within its first 4,000 titles), only deeper.

- **C3, sort by vote count**, is the variant to consider. "Best scary movies" then means the most-rated scary movies, which matches the page titles. It favors established titles, and new releases appear later. The simulation sorted each leaf's 4,000 most popular titles by votes; a real vote sort over the whole filtered set can also bring up older, less popular titles.
- **C1, sitemap titles first**, ranks by an SEO list instead of a product rule. Don't build it.
- **C2, 20 of 40 from the sitemap**, keeps half of the popularity order but does less than C3 for weak titles.

**HTML size.** None: the same 40 cards, other titles.

**Effort.** About half a day: a vote-count sort in `discover.server.ts` (the SQL order and the merge sort), set for category leaves and hubs. The discover cache key follows the parameters.

### R3 to R5: the related map

The 64 "Titles like" links are a hidden copy of the related map: "Out of sight and out of the tab order: the map shows the same titles" (`app/ui/related-map/engine.ts:342`). Any change to these links must change the visible map the same way. Changing only the hidden links would serve crawlers links that members can't see.

- **R5** builds the map from the nearest 160 titles and promotes sitemap titles among them, until the first 64 hold 16, replacing the farthest other titles. It changes 984 of 1,266 title pages, by 5.7 titles on average. The promoted titles' median similarity is 0.943, compared with 0.947 for the titles they replace. The 64th-nearest title is at 0.944.
- **R3** adds the 16 nearest sitemap titles at any distance. It does more for weak titles, but the 16th-nearest sitemap title is at 0.940, so it moves the map further from "most alike".
- **R4** trims the map's links to 32. It raises the sitemap share of title links to 61%, but halves what the map offers.

R5 does less than G1 for weak titles (16 vs 2 titles with 0-1 inbound links), costs more (pack builder, a cache name bump, the cohort set inside the map code), and changes a feature that members use for discovery. Revisit it after G1, if inbound counts still look thin.

### Changes not recommended

- **H1 and H2, more start-page titles.** 12 text links add about 240 bytes of Brotli HTML and 24 add about 460, before loader data, against about 540 bytes of headroom. They move 12 or 24 titles to depth 1 and change little else.
- **T1, linking only 12 people per title page** (plus any sitemap person further down the cast). It raises the cohort's PageRank share the most (3.36% to 5.55%), because each title page passes weight to 33 person pages. But members lose links to most of the cast, and inbound counts don't change.
- **Filling person pages with every sitemap credit.** 254 of the people's 337 sitemap-title credits are already linked. Adding the other 83 changes nothing that this report measures.

## Ranked plan

1. **B2 and P3: best-of lists and the people list, with footer links.** About 1.5 days. Every title and person reachable from a non-title page within three clicks.
2. **G1: the genre row on title pages.** About 1 day. Weak titles drop from 31 to 2, and the median inbound count roughly doubles.
3. **C3: vote-count sort for category pages and hubs,** if the owner accepts the change in feel. About half a day.
4. **Measure again** after Google has fetched the changed pages: repeat this crawl, and compare the fixed Search Console sample in `index-record.md` (discovered, crawled, and indexed titles) over at least four weekly runs.
5. **Later, if needed:** R5 on the related map, and a cap on how often one title appears in related lists.

## Decisions for the owner

1. **Best-of lists:** approve the pages, their names, and their addresses (for example, `/movies/best`, `/shows/best`, and a people list), and the footer links. They list exactly the sitemap cohort, sorted by votes.
2. **Genre row on title pages:** approve a visible eight-title row, its wording, and its place on the page (text links or small lazy posters).
3. **Category order:** sort category pages and hubs by vote count, keep TMDB popularity, or mix (C2).
4. **Related map:** leave it as is for now (recommended), or allow R5 later.

## What wasn't verified

- How Google itself crawls and renders the site. The crawl only imitated Googlebot without JavaScript, from one location, on October 18, 2026.
- Links on the 1,303 uncrawled pages at depth 2 and on deeper pages: depths of 3 or more are upper bounds.
- That more internal links lead to more crawling or indexing. That is the specialist's hypothesis; this report only measures and simulates the links.
- The simulated pages and rows themselves: none were built, so no `./bench.sh budget` or Lighthouse run applies yet. HTML sizes are estimates made by inserting sample markup into cached pages.
- PageRank shares treat uncrawled pages as passing their weight evenly to every page. Use them only to compare scenarios.
