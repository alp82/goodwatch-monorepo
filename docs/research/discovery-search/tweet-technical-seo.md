# GoodWatch technical SEO: checklist audit

Audit date: October 27, 2026. Research and proposals only. No application code, deployment, DNS, Search Console configuration, or other account was changed.

## Findings

Keep `goodwatch.app`. There is no evidence that its extension, length, or brand name causes the indexing problem. The live fixed sample already has server-rendered content, HTTPS, a single preferred host, one H1, no missing image alt attributes, and self canonicals. The best-of lists now link all 1,000 sitemap titles; rebuilding that work would not address a missing technical prerequisite.

The material performance finding comes from real visitors: the origin's 75th-percentile LCP is **2.566 seconds** and INP is **205 ms**, just outside the good thresholds. Local lab LCP was faster under the conditions stated below; the lab scores are not field measurements. These observations do not establish the cause of the index record's one-page result. The wider link crawl found one duplicate movie/show title and three public-profile orphan candidates; neither establishes a sitewide indexing cause. The evidence, limits, and proposed work are below.

**Verdicts:** *Already done* means verified in the stated scope; *Applies* identifies proposed work; *Doesn't apply* rejects an unsuitable checklist prescription; *Owner action* requires an account/UI action. Effort estimates are implementation time, not promised indexing gains.

## Scope and method

- Read the [index record](index-record.md) and its CSVs, [sitemap audit](sitemap-audit.md), [internal-links proposal](internal-links-proposal.md), [title Q&A proposal](title-qa-proposal.md), both backlink research rounds and their channel reports, and [listings kit](../../launch/listings-kit.md). Read [map #347](https://github.com/alp82/goodwatch-monorepo/issues/347), issues #348–#359, and [#667 including its decision and submission log](https://github.com/alp82/goodwatch-monorepo/issues/667). Completed changes and the owner's parked work are not proposed again.
- Source snapshot: `2acc43ba4f230188179ddbf558ed9924b792466c`, the worktree's HEAD and `origin/main` when the audit began. HTTP results describe the live deployment, not an inference from that source.
- Fixed sample: **24 URLs**, listed below. The smaller-audience title specimens are entries 621 and 651 in the movie sitemap and 221 and 256 in the show sitemap; these are lower positions in the vote-led cohort, not measured search-volume bands. The exact URLs stay fixed throughout this audit.
- Fresh unauthenticated GETs used the desktop Googlebot user agent, no cookies, and no `Accept-Language`. Parsed the **final** HTTP response after any `103 Early Hints`. Counted document `<head><title>`, not SVG `<title>` accessibility labels. Main content excludes scripts, styles, templates and global navigation; serialized loader JSON does not count as content.
- Reused the October 18 proposal's graph rules: server HTML only, actual `<a href>` anchors, same-origin URL normalization, fragments removed, query strings retained, robots exclusions and `nofollow` respected, redirects recorded separately, and reachability measured from `/`. The proposal does not identify its cache directory; its old responses were not found in the available scratch/cache locations. This audit therefore creates a fresh cache at `/tmp/gw-tech-seo-20261027/`. The refresh allows at most two crawl starts per second, with at most two requests in flight, rather than the earlier 1.1-second interval; it is not a load test.
- Fetched every current sitemap URL and every robots-allowed internal destination linked directly from the fixed sample. Also fetched all best-of pagination pages and the people list, so the current title cohort's link coverage is measured rather than inferred from the implementation. The final graph counts and exceptions appear below.
- Chromium checked all 24 pages at **320 × 844 and 390 × 844**, then all 24 with JavaScript disabled. These are browser-emulation checks, not physical iPhone or Android tests.
- Queried Search Analytics once, read-only, for query × page over **September 27–October 24**. Made **zero URL Inspection calls**; this audit does not consume the inspection quota or repeat the indexing thread's investigation.
- Kept raw HTML, public-profile addresses, API payloads, screenshots and temporary collection scripts outside the public repository. Profile results below use counts, not member handles or concrete profile paths.

### Fixed sample

Every row returned HTTP 200, had exactly one nonempty document title, description, H1 and absolute self canonical, and rendered content without JavaScript. The blog's intentional noindex is the exception to index eligibility. All 24 titles and all 24 descriptions are unique within this sample.

| URL | Kind | Document title | H1 | Index eligibility |
| --- | --- | --- | --- | --- |
| `/` | Start | GoodWatch - Find movies and TV shows to watch | GoodWatch finds your next movie or show | Indexable |
| `/movies` | Hub | Best Movies and Where to Stream Them &#124; GoodWatch | The best movies and where to stream them | Indexable |
| `/shows` | Hub | Best TV Shows and Where to Stream Them &#124; GoodWatch | The best TV shows and where to stream them | Indexable |
| `/discover` | Hub | Discover &#124; GoodWatch | Discover | Indexable |
| `/movies/moods/scary` | Category | Scary Movies: Where to Stream Them &#124; Moods &#124; GoodWatch | Scary movies | Indexable |
| `/movies/moods/mind-bending` | Category | Mind Bending Movies: Where to Stream Them &#124; Moods &#124; GoodWatch | Mind-bending movies | Indexable |
| `/movies/genres/science-fiction` | Category | Science Fiction Movies: Where to Stream Them &#124; Genres &#124; GoodWatch | Best science fiction movies | Indexable |
| `/shows/genres/crime` | Category | Crime TV Shows: Where to Stream Them &#124; Genres &#124; GoodWatch | Best crime TV shows | Indexable |
| `/movies/streaming/netflix` | Category | Netflix Movies: Where to Stream Them &#124; Streaming &#124; GoodWatch | Movies on Netflix | Indexable |
| `/movies/best` | Best-of list | The Best Movies of All Time, Ranked &#124; GoodWatch | The best movies of all time | Indexable |
| `/movie/155-the-dark-knight` | Movie | The Dark Knight (2008): Where to Stream and Ratings &#124; GoodWatch | The Dark Knight | Indexable |
| `/movie/157336-interstellar` | Movie | Interstellar (2014): Where to Stream and Ratings &#124; GoodWatch | Interstellar | Indexable |
| `/movie/603-the-matrix` | Movie | The Matrix (1999): Where to Stream and Ratings &#124; GoodWatch | The Matrix | Indexable |
| `/movie/2454-the-chronicles-of-narnia-prince-caspian` | Movie | The Chronicles of Narnia: Prince Caspian (2008): Where to Stream and Ratings &#124; GoodWatch | The Chronicles of Narnia: Prince Caspian | Indexable |
| `/movie/866398-the-beekeeper` | Movie | The Beekeeper (2024): Where to Stream and Ratings &#124; GoodWatch | The Beekeeper | Indexable |
| `/show/1396-breaking-bad` | Show | Breaking Bad (2008): Where to Stream and Ratings &#124; GoodWatch | Breaking Bad | Indexable |
| `/show/1399-game-of-thrones` | Show | Game of Thrones (2011): Where to Stream and Ratings &#124; GoodWatch | Game of Thrones | Indexable |
| `/show/108978-reacher` | Show | Reacher (2022): Where to Stream and Ratings &#124; GoodWatch | Reacher | Indexable |
| `/show/21510-white-collar` | Show | White Collar (2009): Where to Stream and Ratings &#124; GoodWatch | White Collar | Indexable |
| `/show/157065-the-fall-of-the-house-of-usher` | Show | The Fall of the House of Usher (2023): Where to Stream and Ratings &#124; GoodWatch | The Fall of the House of Usher | Indexable |
| `/person/976-jason-statham` | Person | Jason Statham: Movies and TV Shows &#124; GoodWatch | Jason Statham | Indexable |
| `/person/31-tom-hanks` | Person | Tom Hanks: Movies and TV Shows &#124; GoodWatch | Tom Hanks | Indexable |
| `/person/16851-josh-brolin` | Person | Josh Brolin: Movies and TV Shows &#124; GoodWatch | Josh Brolin | Indexable |
| `/blog` | Blog | Blog &#124; GoodWatch | Studies and notes | Noindex |

## Domain names

These recommendations concern an **existing domain**, not a new-domain purchase. Only maintaining a single preferred host requires ongoing technical enforcement. None of the naming suggestions justifies a migration.

| Point | Status | Evidence | Fix | Effort |
| --- | --- | --- | --- | --- |
| Use `.com`, `.org`, `.dev`, `.ai` or `.io` | Doesn't apply | GoodWatch already uses `.app`. Google says generic TLD choice does not determine Search performance. [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). | Keep `.app`; a move would add URL migration work without an evidenced ranking benefit. | None |
| Use keyword-like naming | Doesn't apply | `goodwatch` is a relevant brand for deciding what to watch. Google says domain keywords alone have little ranking effect. The current domain already earns branded search traffic. | Keep the brand; explain the product in page copy and titles. | None |
| Maximum 14 letters | Already done | `goodwatch` has nine letters; the whole hostname has 13 characters including the dot. The tweet's cutoff is a branding heuristic, not a documented indexing requirement. | None. | None |
| No hyphens or underscores in the domain | Already done | `goodwatch.app` has neither. Hyphens in readable page slugs are appropriate and are a different issue. | None. | None |
| One topic per domain | Already done | Movies, TV shows, ratings, streaming and discovery are one coherent product topic. | Keep the existing scope; do not split movies, shows or the blog onto new domains for this checklist. | None |
| Pick www or non-www | Already done | Non-www HTTPS is preferred. All nine alternative-host/protocol checks across `/`, `/movies` and `/movie/157336-interstellar` returned one permanent 301 to the matching HTTPS non-www address, then 200. Query preservation also passed. | Retain these proxy redirects and canonical/internal-link consistency. | None |

## Tech SEO

Each row covers a checklist point. More detailed measurements follow the table.

| Point | Status | Evidence | Fix | Effort |
| --- | --- | --- | --- | --- |
| Render HTML for bots | Already done | All 24 sample responses contain headings and substantive content outside scripts; all 24 work as readable documents with JavaScript disabled. Ratings, synopsis, streaming information, filmographies and initial result lists are present. | Preserve SSR for primary content and anchors. No prerendering service is needed for this finding. | None |
| Drop the URL into Claude/Codex and ask for a technical check | Already done | This report supplies live GETs, browser checks, metadata comparisons, a link graph, Lighthouse and first-party CrUX evidence. | Treat an AI answer as an audit aid, not proof of Google's actual fetch/render/index state. [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). | None |
| HTTPS on | Already done | All sample URLs use HTTPS, certificate verification passed, and HTTP variants redirect permanently to HTTPS. Browser checks reported no page runtime errors. | Retain HTTPS and certificate renewal. | None |
| Mobile-friendly | Already done within browser scope | 48 rendered checks: no document-level horizontal overflow at either width, one H1, and no runtime errors. Lighthouse mobile accessibility scores were 92, 96 and 92; those scores are not a complete accessibility or mobile usability certification. | No mobile SEO layout bug established. Physical-device checks remain a validation follow-up. | 15–30 minutes owner QA if desired |
| Fast enough; PageSpeed Insights | Applies; remote API result unavailable | All six PSI API requests returned HTTP 429 `RESOURCE_EXHAUSTED` for daily query quota. Six separate local Lighthouse runs scored 98–100 for performance. CrUX shows a small real-user performance gap. See the performance section. | **Code work:** investigate field LCP and INP before changing assets or bundles; prioritize measured traces. Do not recalibrate the existing performance budget. | Half a day investigation; fixes depend on traces |
| GSC Web Vitals should be green | Owner action | Public CrUX is not all green: origin LCP 2.566 s and INP 205 ms need improvement; CLS 0.02 is good. This read-only API does not expose GSC's URL-group report. | Open Search Console → Experience → Core Web Vitals → Mobile and Desktop → Open report; record affected URL groups, metric and last update. Start validation only after a verified fix. | 15–30 minutes |
| Short, stable URLs | Already done | Hubs and categories have readable paths. Title/person routes use a stable TMDB ID plus readable slug; no random token appears in the fixed sample. A long film name can naturally make a longer path. | Retain established URLs. Do not remove IDs or rename working slugs to shorten them mechanically. [URL guidance](https://developers.google.com/search/docs/crawling-indexing/url-structure). | None |
| URL slug matches meta title and H1 | Already done semantically | `interstellar` → “Interstellar (2014)…” → “Interstellar”; `science-fiction` → “Science Fiction Movies…” → “Best science fiction movies”; `netflix` → “Netflix Movies…” → “Movies on Netflix”. | Semantic agreement is sufficient; punctuation, capitalization and word order need not be identical. | None |
| No random strings | Already done | Numeric IDs identify the catalog entity and are accompanied by descriptive slugs. They are not arbitrary tracking identifiers. | None. | None |
| One H1 per page | Already done | Exactly one H1 on every sample page. The count is a useful convention, not Google's indexing eligibility rule. [Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). | Preserve the headings already added to hubs and categories. | None |
| Unique title and meta description per page | Already done in sample and sitemap; Applies to one extra title pair | No duplicates or missing fields among the 24 sample pages. All 1,435 sitemap pages have unique titles and unique descriptions. The wider link crawl found a movie/show title collision for Space: 1999; six category pagination sequences also repeat metadata, which Google allows. | **Code work:** disambiguate movie/show entities in the detail-title template; retain valid pagination metadata. See F2. | 30–60 minutes |
| Alt text on images that matter | Applies as a small title-poster improvement; other sample checks already done | Every sampled `<img>` has an `alt` attribute. Portraits and meaningful start-page artwork have text alternatives. Hero posters use empty alt inside explicitly named buttons: this names the control accessibly but does not supply image alt metadata. Redundant backdrops, flags and same-link thumbnails correctly use empty alt. | **Code work:** consider descriptive alt on the title hero poster for image search, while preserving empty decorative alternatives. Expected effect is small and image-specific. [Google image guidance](https://developers.google.com/search/docs/appearance/google-images). | 30–60 minutes including review |
| Canonical on each indexable page, without query strings | Already done; query-free rule needs a pagination exception | All 23 eligible sample URLs have one self canonical. `/blog` also self-canonicalizes while noindex. All 1,435 sitemap pages and all 2,437 eligible fetched HTML pages have exactly one absolute self canonical, including valid pagination queries. | Keep base canonicals for tracking/filter views; preserve `?page=N` when pagination has distinct results. Google's pagination guidance calls for self canonicals on later pages. | None |
| Fix 404s | Already done within crawl scope | Fabricated missing route and missing title ID return genuine 404s. All 1,598 robots-allowed internal destinations from the sample were checked: 1,597 answered 200 and one redirected to a 200 page. No linked 404 or 5xx remained after retries. | None established. Keep transient fetch failures visible in monitoring rather than relabeling them as missing pages. | None |
| Fix redirect chains | Already done within crawl scope | Host/protocol variants, the old `/tv/1396-breaking-bad` route, a wrong Interstellar slug, and `/sitemap.xml` each reach their correct destination in one hop. The only redirect destination linked from the sample was `/search`, a single 301 to `/discover`; no chain or loop was found. | No chain repair needed. Linking directly to `/discover` where a plain browse destination is intended is optional housekeeping. | None required |
| No orphan pages | Already done for titles, people, categories and release pages; Applies to profile candidates | Every one of the 1,000 sitemap titles has an inbound link from a reachable non-title page; all 30 selected people are linked from `/people`. Of 1,435 sitemap URLs, 1,432 are reachable in the measured graph; the three public profiles have no inbound link from a reachable fetched page. | **Code work + owner decision:** provide intended public-profile discovery, or hold this cohort until such a surface exists. See F1. | Half a day, or 30–60 minutes to hold the cohort |
| `robots.txt` exists and allows public pages | Already done | Live file returns 200 and declares the HTTPS sitemap index. All 24 sample URLs and all 1,435 current sitemap URLs are allowed. Rules block API/redirect utilities and query-based Discover/person views, not the canonical public pages. | Keep selective rules. Do not block a page in robots to try to make its `noindex` effective; Google must fetch it to see that tag. [Noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing). | None |

### Host, protocol and error responses

| Request | First response | Destination | Redirect hops |
| --- | --- | --- | ---: |
| `http://goodwatch.app/` | 301 | `https://goodwatch.app/` → 200 | 1 |
| `http://www.goodwatch.app/` | 301 | `https://goodwatch.app/` → 200 | 1 |
| `https://www.goodwatch.app/` | 301 | `https://goodwatch.app/` → 200 | 1 |
| The same three variants for `/movies` | 301 each | `https://goodwatch.app/movies` → 200 | 1 each |
| The same three variants for `/movie/157336-interstellar` | 301 each | Matching non-www HTTPS title → 200 | 1 each |
| `http://www.goodwatch.app/movies?utm_source=seo-audit` | 301 | Matching HTTPS path and query → 200 | 1 |
| `/movie/157336-wrong-slug` | 301 | `/movie/157336-interstellar` → 200 | 1 |
| `/tv/1396-breaking-bad` | 301 | `/show/1396-breaking-bad` → 200 | 1 |
| `/sitemap.xml` | 301 | `/sitemaps/sitemap.xml` → 200 | 1 |
| `/seo-audit-definitely-missing-20261027` | 404 | No redirect | 0 |
| `/movie/0-seo-audit-missing` | 404 | No redirect | 0 |

A correctly returning 404 for an invented missing path is a pass, not a broken internal link. Combining an obsolete path with an obsolete host may involve two independent normalizations; the one-hop host checks above use current canonical paths.

### Performance: remote API, local lab and real visitors

The requested PSI API matrix was `/`, `/movies/best` and `/movie/157336-interstellar`, each with `strategy=mobile` and `strategy=desktop`. All six calls to `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` failed with HTTP 429 and a daily-quota error. The public PSI web UI also returned 429 on its report RPC; its generic “Unable to resolve” message is not independent evidence of a DNS failure. These are **missing remote measurements**, not scores of zero. An additional unauthenticated probe failed the same way. No account, quota or API configuration was changed.

Local fallback: Lighthouse **13.4.1**, fresh browser contexts against the live public site, one run per page/device, default simulated throttling. Mobile used 150 ms RTT, 1,638.4 Kbit/s throughput and 4× CPU slowdown; desktop used the desktop preset. These results are **not PSI-hosted runs** and are not real-user measurements.

| Page | Device | Performance | FCP | LCP | Total blocking time | CLS | SEO |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Mobile | 100 | 1.1 s | 1.2 s | 50 ms | 0 | 100 |
| `/` | Desktop | 100 | 0.3 s | 0.5 s | 0 ms | 0 | 100 |
| `/movies/best` | Mobile | 98 | 1.3 s | 2.3 s | 40 ms | 0 | 100 |
| `/movies/best` | Desktop | 100 | 0.5 s | 0.8 s | 0 ms | 0 | 100 |
| `/movie/157336-interstellar` | Mobile | 98 | 1.7 s | 1.7 s | 10 ms | 0.002 | 100 |
| `/movie/157336-interstellar` | Desktop | 99 | 0.7 s | 0.8 s | 0 ms | 0 | 100 |

Google's public **CrUX History API**, requested by [CrUX Vis](https://cruxvis.withgoogle.com/#/?view=cwvsummary&url=https%3A%2F%2Fgoodwatch.app&identifier=origin), supplies a different picture. The latest returned collection window is **September 27–October 24, 2026**. The available records aggregate **all devices**; requests for separate phone, desktop and tablet records returned `NOT_FOUND`.

| Field-data scope | LCP p75 | INP p75 | CLS p75 | Result |
| --- | ---: | ---: | ---: | --- |
| Origin `https://goodwatch.app` | 2.566 s | 205 ms | 0.02 | LCP and INP need improvement; CLS good |
| URL `https://goodwatch.app/` | 2.627 s | Not available | 0.01 | LCP needs improvement; CLS good; full CWV assessment unavailable |
| URL `/movies/best` | Not available | Not available | Not available | No URL-level record; origin data is not a page-specific pass |
| URL `/movie/157336-interstellar` | Not available | Not available | Not available | No URL-level record; origin data is not a page-specific pass |

[Good thresholds](https://web.dev/articles/vitals) are LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1. The combined-device origin record does not establish whether either GSC device group fails. Its 66 ms LCP gap and 5 ms INP gap in one rolling window do not establish a regression. Missing field data is not a pass or failure. A local low TBT does not establish field INP. Google explains [PSI's lab and field distinction](https://developer.chrome.com/docs/crux/guides/pagespeed-insights) and [CrUX eligibility](https://developer.chrome.com/docs/crux/methodology).

The lab runs identify possible follow-up areas, not proven causes of the field gap: about **57–60 KiB unused JavaScript**, image delivery opportunities on the start page, and an LCP discovery opportunity on Interstellar. Inspect actual field traces before editing [room artwork](../../../goodwatch-webapp/app/ui/living-room/tv/room-art.ts), [title hero images](../../../goodwatch-webapp/app/ui/details/hero/Trailer.tsx), [best-of thumbnails](../../../goodwatch-webapp/app/ui/best-lists/RankedTitles.tsx), or shared script loading. Keep the performance budget unchanged as the owner requested. A green performance score does not certify that Google will index a page.

**Owner action for remote PSI:** use an existing project with the PageSpeed Insights API enabled and available quota, then run the six URL/strategy combinations above with its API key. Store the key outside the repository and supply it privately to the request. No key is needed in this report. Record `fetchTime`, strategy, Lighthouse version, performance metrics, and whether any field record is URL-level or origin-level. Separately review GSC's Mobile and Desktop Core Web Vitals URL groups.

### Metadata and canonicals across the current sitemap

The live index contains **seven child sitemaps and 1,435 distinct page URLs**, rather than the older five-child/1,128-page scope. Every listed URL eventually answered 200, allowed Googlebot, lacked noindex restrictions, had exactly one nonempty document title and description, and had an absolute self canonical. No duplicate sitemap locations, titles or descriptions were found.

| Sitemap group | URLs checked | Missing title / description | Duplicate title / description groups within full sitemap set | Non-self or missing canonical |
| --- | ---: | ---: | ---: | ---: |
| Static | 15 | 0 / 0 | 0 / 0 | 0 |
| Categories | 87 | 0 / 0 | 0 / 0 | 0 |
| Movies | 700 | 0 / 0 | 0 / 0 | 0 |
| Shows | 300 | 0 / 0 | 0 / 0 | 0 |
| People | 30 | 0 / 0 | 0 / 0 | 0 |
| Public profiles, addresses withheld | 3 | 0 / 0 | 0 / 0 | 0 |
| Country/service release pages | 300 | 0 / 0 | 0 / 0 | 0 |
| **Total** | **1,435** | **0 / 0** | **0 / 0** | **0** |

The wider crawl has **2,437 index-eligible HTML responses**: each has exactly one H1 and one absolute self canonical. “Eligible” here means HTTP 200 without a fetched noindex instruction; it does not mean Google has accepted the page. Intentionally noindex settings/taste pages are excluded from this assertion.

Outside both the fixed sample and sitemap, two linked URLs have the exact title **“Space: 1999 (1975): Where to Stream and Ratings | GoodWatch”**: `/movie/542499-space-1999` and `/show/134-space-1999`. Both return 200, have the H1 “Space: 1999”, declare separate self canonicals, and have different movie/series descriptions. This is one real title-template collision, not evidence of a sitewide duplication problem. See F2.

The other repeated metadata belongs to **six category pagination sequences**: the five fixed-sample leaves plus the supplementary drama pagination check. Page 2 self-canonicalizes and lists different results. Google explicitly allows the same title and description within a paginated sequence; do not count these as unrelated-page duplicates. [Pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

The largest successful HTML document was `/movies/moods`, **1,677,875 uncompressed bytes**; no fetched document exceeded the 2 MB limit used by the project's sitemap checker. This is document size, not compressed transfer size.

### Images and the first-image shortcut

The fixed sample contains **2,283 image tags in server markup**, including fallback/responsive copies. This is not a count of downloaded images. **Zero lack an `alt` attribute.** Empty alt is deliberate in many places and is not the same as missing alt.

| First image / meaningful image | Live evidence | Verdict |
| --- | --- | --- |
| Start-page room artwork | First image describes the room, including its colors and furniture. | Already done |
| `/discover` and the five category leaves | First poster names its title, for example “Grey's Anatomy” or “The Odyssey”. | Already done |
| `/movies`, `/shows` | First tile backdrop uses `alt=""`; the same link has a visible category label. | Already done; decorative/redundant |
| `/movies/best` | First small poster uses `alt=""`; its link also contains the title and year. | Already done; avoid repeating the same accessible link name |
| Ten title pages | First image is a decorative country flag with empty alt; the poster has empty alt inside a button named, for example, “Poster for Interstellar. Show it full screen”. | First-image rule already handled; optional descriptive poster alt would add image-search metadata, not fix an unnamed control |
| Three person pages | First background image has empty alt; the portrait identifies the person and the H1 names them. | Already done |
| `/blog` | First image belongs to shared page chrome and is decorative; no published article image exists in this empty/noindex index. | Doesn't apply to a first article image yet |

The tweet gives the first image no special Google status. What matters is whether an image conveys information and whether its link already has an accessible name. See [Google's image alternatives guidance](https://developers.google.com/style/images).

### Internal links, 404s, chains and orphan candidates

The cache contains **2,456 distinct requested URLs**: 2,453 from the core crawl and three supplemental checks (`/settings`, drama page 2, and an unlinked `/pages` probe). These include XML/robots responses and the deliberate probe, not 2,456 indexable pages. The HTML graph reaches 2,442 fetched destinations from `/` and discovers 50,453 normalized, robots-allowed URLs in total. The latter is a bounded discovery count, not a claim that Google crawled or indexed 50,453 pages.

| Sitemap group | URLs | Reachable from `/` | No inbound anchor from a reachable fetched page | Maximum measured click depth |
| --- | ---: | ---: | ---: | ---: |
| Static | 15 | 15 | 0 | 2 |
| Categories | 87 | 87 | 0 | 2 |
| Movies | 700 | 700 | 0 | 3 |
| Shows | 300 | 300 | 0 | 3 |
| People | 30 | 30 | 0 | 2 |
| Public profiles, addresses withheld | 3 | 0 | 3 | Unknown |
| Country/service release pages | 300 | 300 | 0 | 3 |
| **Total** | **1,435** | **1,432** | **3** | **3 for reachable sitemap pages** |

All 1,000 titles have an inbound link from a reachable **non-title page**. This does not rely on hidden related-map anchors: `/movies/best` and its pages 2–3 cover all 700 movies; `/shows/best` and page 2 cover all 300 shows; `/people` covers all 30 selected people. The footer links the entry pages. The October 18 report's 11 title orphan candidates are not a current missing-links task.

The fixed sample links **1,636 distinct internal destinations** after removing fragments and respecting anchor nofollow. Of those, **38 query-based Discover views** are excluded by robots; no fetch was made for those excluded URLs. All **1,598 allowed destinations** were fetched. Final outcomes were 1,597 HTTP 200s and the single `/search` → `/discover` 301 → 200. No linked 404, redirect loop, multiple-hop chain or persistent 5xx was found. The supplementary, unlinked `/pages` probe returned a genuine 404; that does not make it a broken site link.

**Transient failures and speed limits:** nine initial requests failed without a final HTTP response; the collector used a 25-second request limit. All nine returned 200 on retry. Successful HTML fetches had a median end-to-end duration of **0.494 s**, a 95th percentile of **1.898 s**, and a maximum of **11.438 s**; five exceeded 5 s. These measurements include connection and transfer time and are not server render time or Core Web Vitals. Independent rechecks of the slow specimens returned 200 more quickly. This warrants observation of reproducible cold-request delays, not a claim that the existing title dependency deadline has failed.

**Graph limit:** pages outside this fetched set may link the three profile candidates, and may shorten measured depths. A sitemap-only fetch does not itself create an inbound link, and links from an unreachable source do not count as reachability from `/`. No external streaming/provider destinations were audited. Keep the existing bounded sitemap and useful catalog links; this graph does not justify expanding the submitted inventory.

## Quick 5-minute on-page checks

| Point | Status | Evidence | Fix | Effort |
| --- | --- | --- | --- | --- |
| Target keyword in the first 60 title characters | Already done for descriptive sample titles; Applies to `/discover` clarity | Titles lead with the entity/category: “Interstellar (2014)…”, “Scary Movies…” and “The Best Movies of All Time…”. `/discover` only says “Discover &#124; GoodWatch”. Google has no 60-character title limit; truncation depends on display width. [Title links](https://developers.google.com/search/docs/appearance/title-link). | **Content work:** use “Discover Movies and TV Shows &#124; GoodWatch” for the bare discovery hub. Keep long film names intact rather than truncating a proper name to meet 60 characters. | 30–60 minutes including review |
| Main query in H1 | Already done for entity/category pages; Applies to `/discover` clarity | H1s name their film, person or category. The homepage H1 already names GoodWatch. The 28-day Search Analytics query returned 24 query/page rows, all on `/`; the leading term was “goodwatch app” (324 impressions, 10 clicks). There are no returned query/page rows for these title/category pages on which to justify exact-query rewrites. | **Content work:** consider “Discover movies and TV shows” for the bare hub H1, retaining its search control behavior and adjusting wrapping at narrow widths. Do not stuff “movies like…” into every title H1 or copy homepage queries across unindexed pages. Broader title-page intent remains with #355/#356 and their indexing gate. | Included in the same 30–60 minutes |
| Add alt text to the first image | Already done where informative; Doesn't apply where decorative | First-image and meaningful-image checks above distinguish descriptions from deliberately empty alternatives. No sampled image lacks an alt attribute. | None. Do not add keyword text to decorative artwork solely to satisfy the shortcut. | None |

The `/discover` proposal is a clarity improvement, not a demonstrated indexing blocker or a measured high-volume keyword opportunity. Its long, generic description could be shortened to describe filtering movies and shows on GoodWatch, but it is not an exact duplicate within the fixed sample.

## Fixes to make

No confirmed sitewide indexing blocker has been found. The concrete title collision and bounded profile-discovery gap are listed separately below. Empty decorative alt, long proper titles, pagination query strings, and genuine 404s for invented URLs are not bugs.

### F1: reconcile public-profile discovery with sitemap inclusion

**Finding:** all three currently sitemap-listed public profiles are HTTP 200, `index, follow`, self-canonical, and substantive (about 2,198–4,532 characters of body text outside global navigation). None has a non-self inbound anchor from a reachable fetched page in this graph. They are **candidate internal orphans within this crawl**, not proven unlinked everywhere on the site. External links or uncrawled internal pages may still make them discoverable to Google.

**Proposed fix:** give the already-eligible public cohort a useful server-rendered entry point from a reachable public page. Reuse the existing privacy/visibility and consent eligibility checks; do not hard-code member handles into source or expose private accounts. Add a public surface only if it is useful to members. Otherwise, hold this small profile cohort out of the sitemap until there is an intended route to it. Do not change the 1,000-title cohort, actor `/people` list, or private share-list policy as part of this fix.

**Where:** `goodwatch-webapp/scripts/sitemap_profiles.py` and `goodwatch-webapp/scripts/create_sitemaps.py` if holding the cohort; otherwise a proposed `goodwatch-webapp/app/routes/members.tsx` and `goodwatch-webapp/app/server/profile/public-members.server.ts`, linked through `goodwatch-webapp/app/ui/footer/links.tsx`. Reuse eligibility from `goodwatch-webapp/app/server/profile/page.server.ts` rather than independently widening visibility.

**Type / effort / effect:** code work with an owner product decision; about half a day for a small discovery surface, or 30–60 minutes to hold the cohort. The immediate scope is three profiles, so the expected effect on the main movie/show indexing problem is small.

### F2: disambiguate the movie and show detail-title template

**Finding:** `/movie/542499-space-1999` and `/show/134-space-1999` both return the title “Space: 1999 (1975): Where to Stream and Ratings | GoodWatch”. Both are outside the current sitemap, but linked from the sample. Their descriptions distinguish a movie from a series; the title pattern uses only name and year, so it cannot distinguish this pair.

**Proposed fix:** include the media type in `detailsPageMeta`'s title pattern, for example “Space: 1999 (1975) Movie: Ratings and Streaming | GoodWatch” versus “Space: 1999 (1975) TV Show: Ratings and Streaming | GoodWatch”. Review the wording on ordinary and long-name titles before applying a consistent pattern. Keep URLs, self canonicals and the proper-name H1s. No evidence here supports merging or redirecting the two catalog entities.

**Where:** `goodwatch-webapp/app/utils/detailsMeta.ts`, `detailsPageMeta`. **Type / effort / effect:** code work; 30–60 minutes including review and targeted metadata verification. It resolves a demonstrated collision and improves entity clarity; it is not an explanation for the sitemap cohort's indexing problem.

### Improvements that are not established indexing bugs

- **Investigate field LCP/INP and response outliers:** half a day of code investigation. Inspect end-to-end traces and the existing deadline boundaries before proposing a patch. The 3-second essential-title dependency deadline and 503/Retry-After behavior already exist in `goodwatch-webapp/app/server/title-page-budget.ts`; do not rebuild them. Potential follow-up locations are `app/ui/living-room/tv/room-art.ts`, `app/ui/details/hero/Trailer.tsx`, the movie/show route loaders, and shared script loading, only if measurements identify them. The small CrUX threshold gaps do not by themselves establish a regression or a cause of non-indexing.
- **Clarify the bare Discover hub:** content work, 30–60 minutes. Set a descriptive title in `goodwatch-webapp/app/routes/discover.($type).tsx` and consider an equivalent H1 in `goodwatch-webapp/app/ui/discover/DiscoverHeading.tsx`. Preserve its search-button behavior and check wrapping on narrow screens. This is editorial clarity, not a missing-H1 repair.
- **Consider descriptive title-poster alt:** code work, 30–60 minutes, in `goodwatch-webapp/app/ui/details/hero/Trailer.tsx`, `HeroPoster`. For example, add “Poster for Interstellar” to the image while keeping the existing named control. This can add image-search context; it does not fix an unnamed button or establish a general indexing benefit. Leave decorative backdrops, flags and redundant list thumbnails empty.

Any later change to landing-page images, styles or scripts must run the existing `./bench.sh budget` check as required by `goodwatch-webapp/AGENTS.md`. This audit changes none of them and proposes no budget recalibration.

## Ranked proposals

Ranked by plausible scope of effect on indexed/visited pages, with uncertainty explicit. These are limited follow-ups, not five established reasons for the indexing problem. None should delay the separate indexing investigation or repeat work that is already live.

| Rank | Work | Type | Effort | Expected effect |
| ---: | --- | --- | --- | --- |
| 1 | Investigate field LCP/INP and repeatable slow responses before selecting a fix | Code work | Half a day to diagnose | Broad visitor-experience scope; possible crawl-efficiency benefit if an application delay is reproduced. No evidence yet that this explains Google's indexing decisions. |
| 2 | Reconcile the three public profile orphan candidates with an intended discovery surface | Code work + owner decision | Half a day, or 30–60 minutes to hold the cohort | Directly addresses internal discovery for three URLs; little expected effect on the existing 1,000 linked titles. |
| 3 | Disambiguate movie/show detail titles with the same name and year | Code work | 30–60 minutes | Fixes the demonstrated Space: 1999 collision; both URLs are outside the current sitemap, so immediate scope is limited. |
| 4 | Give `/discover` a descriptive title and consider matching H1 wording | Content work | 30–60 minutes | Small clarity/relevance improvement for one hub; no measured non-branded demand or indexing uplift established. |
| 5 | Complete the six remote PSI runs when quota is available and record GSC's device-specific CWV groups | Owner work | 15–30 minutes setup/review plus run time | Closes a measurement gap and targets future performance work; no indexing effect from measurement alone. |

Hero-poster alt is a further optional, low-impact image-search improvement, below these five.

Keep the current domain, permanent host redirects, stable title URLs, SSR, hub H1s, breadcrumbs, canonicals, selected sitemap cohort and best-of/people lists. Do not migrate domains, strip pagination queries, buy another SEO service, or create large new landing-page inventories to satisfy this checklist.

## Limits and owner follow-up

- A Googlebot user-agent simulation is not verified Googlebot or Google's rendering service. This audit establishes what an anonymous client receives, not why Google decides against indexing it.
- The latest committed October 24 inspection sample still has one indexed URL, five crawled/currently not indexed and 44 unknown. That is a **50-URL sample**, not a count of all live sitemap pages. This technical audit does not attribute that outcome to domain naming, headings, performance, or orphans without evidence.
- Nine initial transport failures recovered on retry. The crawl is bounded to the sample, current sitemap and direct sample destinations; it is not a complete crawl of the 50,453 discovered URLs. Public profiles remain candidate orphans within this graph, not proven unlinked across the entire site.
- No physical-device test, authenticated-member audit, Search Console Web Vitals UI review, proxy/configuration inspection or performance-budget run was performed. No application implementation changed, so application tests and a budget rebaseline were not called for.
- Owner follow-up: record GSC's Mobile/Desktop affected groups. If an existing PSI-enabled project has quota, use it for the missing six API runs. No domain migration or infrastructure decision is needed from this audit.

## Owner decisions to record

- Choose whether eligible public profiles should have a useful public discovery surface, or whether their sitemap cohort should wait until one exists. This decision affects three profiles and should not delay movie/show indexing work.
- Confirm whether an existing PSI-enabled project with quota is available for the six remote measurements. Without one, retain the explicitly labeled local Lighthouse and public CrUX evidence; no quota or API configuration change was made.
