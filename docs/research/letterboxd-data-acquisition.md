# Letterboxd scores: acquisition research

Researched: 2026-11-01. Scope: adding a Letterboxd score and number of ratings to GoodWatch title pages; optional aggregate distribution and other useful fields. No review text, member profiles, or production crawler changes.

## Recommendation

**The most effective technical route is one ordinary movie-page request per refresh, parsing its JSON-LD `aggregateRating`.** It contains the weighted score and exact rating count together; no browser rendering, review pagination, or separate statistics request is needed. Start with movies, resolve identity through IMDb, and cache the canonical Letterboxd URL. This worked in the small live sample below. [Observed source page](https://letterboxd.com/film/inception/)

Letterboxd expressly answers yes to displaying/embedding ratings and points to page JSON-LD and an iframe option. However, this is not an explicit specification for a catalog-wide storage/republication feed. Its October 2026 terms prohibit exporting others’ content unless expressly permitted. **Distinguish the documented display use from bulk acquisition/storage scope; do not assume either that all rating display is forbidden or that public HTML grants unrestricted reuse.** Clarify a production feed’s permitted scope if needed. [First-party display guidance](https://letterboxd.zendesk.com/hc/en-us/articles/17815623056911-Can-I-display-or-embed-Letterboxd-ratings-on-my-site-or-app), [terms §6.8](https://letterboxd.com/legal/terms-of-use/)

Do not make official API approval the dependency for an initial design: access is by application, and the current policy excludes recommendation and data-analysis projects. GoodWatch appears to fall within that exclusion; an exception must not be presumed. No one was contacted during this research. [API access policy](https://letterboxd.com/api-beta/)

## Options compared

| Route | Useful data | Assessment |
| --- | --- | --- |
| Movie-page JSON-LD | Weighted rating, exact rating count, canonical URL; identity links elsewhere in the same HTML | Best technical fit for the requested badge; observed working without login. |
| Official partner API | Structured score, counts and histogram | Strong data contract if approved; application restrictions make availability uncertain. |
| Public CSI histogram fragment | Candidate ten-bin histogram | Advertised by page HTML, but returned a Cloudflare challenge in our probe. Optional and unverified as an extraction source. |
| Official ratings iframe | Title, ratings chart and weighted average, hosted by Letterboxd | Documented display alternative; does not supply GoodWatch’s stored score columns. Exact embed setup was not validated. |
| Member CSV export/RSS | The member’s own activity | Separate user-import concern; not a feed of global aggregate scores. |
| Third-party scraper or dataset | Depends on provider | No licensed, current first-party bulk feed was established. Adds another dependency without resolving source access rights or freshness. |

Evidence: [movie page](https://letterboxd.com/film/inception/), [official API docs](https://api-docs.letterboxd.com/), [display guidance](https://letterboxd.zendesk.com/hc/en-us/articles/17815623056911-Can-I-display-or-embed-Letterboxd-ratings-on-my-site-or-app), [account-data alternatives](https://letterboxd.com/api-beta/). CSI viability is a live observation, detailed below; the third-party assessment is an architectural judgment, not a claim that no provider exists.

## What to collect

### Required fields: already available together

Observed on the public Inception page:

```json
{
  "url": "https://letterboxd.com/film/inception/",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.24,
    "ratingCount": 4570122,
    "bestRating": 5,
    "worstRating": 0.5
  }
}
```

This is an excerpt of a single response, not a fixture promising future values. `ratingCount` is the requested number of votes; use its integer, rather than abbreviated counts displayed elsewhere. `reviewCount` is a different field and is unnecessary for this feature. The same response carried `x-letterboxd-identifier: 1skk` and links to TMDB movie `27205` and IMDb `tt1375666`. [Observed HTML and JSON-LD](https://letterboxd.com/film/inception/)

Store the raw score on the native five-star scale and the source’s scale metadata. For GoodWatch’s percentage-like representation, `4.24 × 20 = 84.8`; preserve precision before any presentation rounding. This normalization is a proposed GoodWatch convention, not a different Letterboxd metric.

The score is weighted, not the arithmetic mean of the histogram. Letterboxd considers the latest rating per member and keeps its weighting algorithm private. A histogram therefore cannot reproduce the official score. [Letterboxd’s explanation](https://letterboxd.com/journal/the-score-new-weighted-average-ratings/)

### Optional aggregates

The official API documents `rating`, `counts.ratings`, and `ratingsHistogram` with half-star bins from 0.5 through 5. Its counts also include watches, likes, fans, lists and reviews; fans means members choosing the movie as a favorite. The page response header provides a Letterboxd ID (LID). `/films` accepts up to 100 identity filters including `tmdb:` and `imdb:` IDs. The old `/film/{id}` and `/film/{id}/statistics` endpoints are deprecated in favor of `/production/` and `/statistics`; replacement operation details were not exposed in the inspected public documentation. Confirm the current partner contract if access is granted. No usable published numeric request quota was found. [Official API reference](https://api-docs.letterboxd.com/)

Suggested priority, if permitted and available:

1. Canonical URL and source LID: identity, attribution and resilience when slugs change.
2. Ten integer rating-bin counts: useful for a distribution chart and locally derived disagreement measures. Label derived statistics as GoodWatch calculations; keep the official weighted score separately.
3. Watch, like and favorite counts: potentially useful popularity/enthusiasm signals, but only if there is a product use for them. They must not be substituted for rating votes.

Do not add extra fetches for these in version one. Ordinary metadata such as cast, synopsis, runtime and images is already supplied to Letterboxd by TMDB, so recrawling it would duplicate GoodWatch’s existing upstream. [Film-data provenance](https://letterboxd.com/about/film-data/)

## Identity and coverage

The official FAQ documents redirects from `/imdb/{ttID}` and `/tmdb/{movieID}`. TV-backed entries require the TMDB `/tv` suffix because numeric IDs alone do not distinguish movies from shows. The same FAQ says returning TV shows are not generally supported; selected limited series, TV movies and exceptions exist. Treat Letterboxd as a movie source initially, with unsupported shows distinct from failed requests. [Identity links and coverage FAQ](https://letterboxd.com/about/faq/?s=pin+content)

**Prefer IMDb lookup where GoodWatch has an IMDb ID.** Persist the final canonical URL, verify the returned IMDb/TMDB links and media type, then refresh the cached URL directly. Avoid title-slug guessing and broad name searches. The IMDb redirect worked in the live sample. These are implementation recommendations based on the observed identity links.

The TMDB shortcut has a side effect: Letterboxd says it force-imports an absent movie before redirecting. It is therefore unsuitable as a blind read-only existence test across the entire catalog. Use it only deliberately, or obtain a read-only mapping mechanism through an authorized API/feed. This study used its documented example for an already-existing movie. [Official import-shortcut behavior](https://letterboxd.com/about/film-data/)

When a source entry is merged, removed, changes slug, or loses a published average, preserve the distinction among no match, no public score and temporary fetch failure. A missing aggregate is not score zero.

## Live verification and limits

Anonymous Python `requests.get`, no authentication, special browser impersonation, proxy rotation, CAPTCHA solving, or challenge bypass. One small sample on 2026-11-01; these results do not establish production success rates.

| URL | Observed result |
| --- | --- |
| `https://letterboxd.com/film/inception/` | HTTP 200, 312,908 bytes; JSON-LD score and count parsed successfully; LID header present. |
| `https://letterboxd.com/imdb/tt1375666/` | Redirected to the canonical Inception page, HTTP 200. |
| `https://letterboxd.com/tmdb/27205` | HTTP 403, Cloudflare challenge. |
| `https://letterboxd.com/csi/film/inception/rating-histogram/` | HTTP 403, Cloudflare challenge; page HTML references this path via `data-src`. No bin counts verified. |
| `https://letterboxd.com/csi/film/inception/stats/` | HTTP 403, Cloudflare challenge. Its response schema was not verified. |

The final four requests were dispatched in a tiny concurrent research batch. No retries or alternate challenge-bypass methods followed. In production, stop the site’s pending work on a challenge, rather than treating a blocked endpoint as a missing score.

`robots.txt` has broad exclusions for named AI data crawlers and path exclusions for other crawlers. It is not an API quota or a data-use license. A successful movie page and blocked fragment on the same host demonstrate why fragment access should not be a dependency of the core score. [Current robots rules](https://letterboxd.com/robots.txt)

The display-support article could not be opened directly due to a challenge; its full short article text was available through the search index, dated September 30, 2026. Its JSON-LD guidance is independently corroborated by the live movie response and [public FAQ](https://letterboxd.com/faq/). This report has not established blanket bulk-republication permission, an authorized commercial data reseller, official API credentials, a production-safe request rate, complete catalog coverage, or successful histogram extraction.

## Fit with the existing crawling pipeline

Proposed design; no implementation performed:

- Add a separate Letterboxd source collection, for example `letterboxd_movie_rating`, with TMDB/IMDb identity, LID, canonical URL, raw `/5` score, normalized score, exact vote count, fetch/parse timestamps, outcome and `next_crawl_at`. Histogram and engagement counts remain nullable. Record the extraction method/version for debugging.
- Reuse the known-URL validation, leases, popularity-first scheduling and negative-cache patterns in [critic_sites/crawl.py](../../goodwatch-flows/windmill/f/critic_sites/crawl.py). Differentiate transport blocks from negative matches; keep last good data on temporary failures.
- Reuse the shared per-site pacing and stop behavior in [critic_sites/polite_http.py](../../goodwatch-flows/windmill/f/critic_sites/polite_http.py). The existing starting policy is one request per two seconds with an honest GoodWatchBot identifier. This is an internal limit, not a rate approved by Letterboxd. Count redirect hops in the request budget.
- Include changed Letterboxd IDs in [all_ratings.py](../../goodwatch-flows/windmill/f/sync/copy/all_ratings.py), then publish dedicated fields through [crate_models.py](../../goodwatch-flows/windmill/f/sync/models/crate_models.py). Source-only updates must trigger publication even when TMDB/IMDb scores have not changed.
- Adding a source badge and including Letterboxd in the combined GoodWatch score are separate product decisions. Do not silently change aggregate weights, vote semantics or discovery ordering while adding ingestion.

Request budget estimates, excluding retries and occasional remapping:

| Work | Approximate HTTP requests |
| --- | --- |
| Seed N titles through an IMDb redirect | About `2N` (lookup hop plus destination page); the destination already provides score/count. |
| Refresh N cached canonical URLs | `N`. |
| Add separate histogram refresh for all N | Another `N`, if the endpoint is available and permitted. |

At the existing internal two-second spacing, 100,000 direct refreshes would require at least about 55.6 hours of continuous request slots; two-hop seeding would double that. These are arithmetic planning estimates, not throughput commitments. Prioritize visible/popular movies, use slower refresh for old/low-traffic titles, and avoid a full daily recrawl. Keep score/count from the same response; separately fetched histogram totals can lag because of caches.

For a prototype parser, the logical recipe is: resolve and validate identity → obtain the movie HTML → locate `application/ld+json` → remove the observed CDATA comment wrappers → parse JSON → select the movie’s `aggregateRating` → validate score/count and scale → upsert the source record. Parse failures and missing fields must remain explicit outcomes. A later implementation should verify several movies, unrated/upcoming titles, a redirect/merge, low-count titles, and challenge responses before estimating catalog-wide coverage.
