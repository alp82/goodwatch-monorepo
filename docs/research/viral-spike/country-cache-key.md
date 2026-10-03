# Country handling in the page cache key

Research for [#243](https://github.com/alp82/goodwatch-monorepo/issues/243), part of the map [#237](https://github.com/alp82/goodwatch-monorepo/issues/237) "Serve a viral traffic spike". It unblocks the decision in [#248](https://github.com/alp82/goodwatch-monorepo/issues/248).

Date of all observations: 2026-10-03. Code references are relative to `goodwatch-webapp/app` at commit `70006d01`.

## Summary

- Every anonymous HTML page sends `Vary: Cookie, Accept-Language`. A shared cache that honors `Vary` stores one copy per distinct raw `Accept-Language` string.
- Only two page types need the country to render: title pages (about 5% of the HTML differs) and Discover (about 10% to 15% differs). Home and person pages differ by four characters, in a `locale` object that the root loader embeds in every page.
- The share list page also renders per country, but it is `private, no-store` today.
- The code has two different country fallbacks: `US` for title pages and `DE` for everything else.
- Recommendation: serve one country-neutral page per URL (option a). Load the per-country parts from a small endpoint that has the country in its URL. Use a short country list at the cache layer (option b) only as the fallback if the prototype in #248 shows that the client-loaded streaming section is not acceptable.
- Under a spike on a few URLs, every option reaches a high hit ratio over the hour. The options differ in how many origin renders the cold start needs, in how the long tail behaves, and in which cache products can run them.

## What the code does today

### Headers

| Fact | Source |
| --- | --- |
| The root loader sets `Vary: Cookie, Accept-Language` on every HTML response. | `utils/auth.ts`, line 10 |
| Without an auth cookie: `max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400`. With one: `private, no-store`. | `utils/auth.ts`, lines 15 to 19 |
| Child routes inherit both headers through `pageHeaders`. A `Set-Cookie` or `private` anywhere forces `private, no-store`. | `utils/headers.ts` |
| Home overrides the guest policy: `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200`. | `server/living-room/data.server.ts`, line 9, and `routes/_index.tsx` |
| OG images send `public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400` and no `Vary` on language. | `server/og-image/og-image-route.server.ts`, line 38 |

Production confirms the headers. A request to `https://goodwatch.app/movie/603-the-matrix` returns `vary: Cookie, Accept-Language, Accept-Encoding` and the cache policy above.

### Two country resolvers with different fallbacks

| Resolver | Order | Fallback | Used by |
| --- | --- | --- | --- |
| `resolveCountry` in `server/country.server.ts` | `?country=`, then the member's saved `country_default`, then the first `Accept-Language` entry that has a region | `US` | `movie.$movieKey.tsx`, `show.$showKey.tsx`, `u.$handle.lists.$id.tsx` |
| `getLocaleFromRequest` in `utils/locale.ts` | The region of the first `Accept-Language` entry only | `DE` | `root.tsx`, `viewer.server.ts` (Discover, Explorer, Watch next, and their APIs), `living-room.server.ts`, `taste.quiz.tsx`, `utils/discover.ts`, `api.smart-titles.ts`, `api.living-room.services.ts` |

Consequences, checked against production:

- A request without `Accept-Language`, which is how Googlebot crawls, gets US streaming offers on a title page and `"country":"DE"` in the root `locale` object of the same page.
- `/discover` without `Accept-Language` renders German service logos (`"searchScope":{"country":"DE"}`).
- `Accept-Language: en` (no region) behaves like no header.

A third method exists for onboarding only: `routes/api.guess-country.tsx` calls `ipapi.co` with the client IP, then falls back to `Accept-Language`, then to `US`.

Members: `resolveCountry` and `getMemberViewerContext` prefer the saved `country_default`. Member responses are `private, no-store`, so they do not enter the shared cache.

### Where anonymous server-rendered output depends on country or language

The measurements compare production responses for `Accept-Language: en-US,en;q=0.9` and `de-DE,de;q=0.9`.

| Surface | Depends on country? | What differs | Measured difference |
| --- | --- | --- | --- |
| Title details (`/movie/*`, `/show/*`) | Yes | Age rating badge in the header (`R` or `16`). Country flag and offer tiles in the hero "Where to watch" block. The "Where can I stream" and "What is it rated" answers, as visible text and in the `FAQPage` structured data. The loader JSON: `streaming_availabilities`, `streaming_services`, `releases`, `age_certifications`, `translations`, `alternative_titles`. | 22,179 of 442,609 characters (5.0%) in 177 blocks |
| Discover (`/discover`) | Yes | Streaming service logos on each title card, in the markup and in the loader JSON. The root `locale`. | 23,067 of 156,845 characters (14.7%) for US, 9.2% for DE |
| Home (`/`) | No | Only the root `locale` object. The loader comment says the guest HTML "stays the same for everyone". Picks load after first paint from `/api/living-room/picks`. | 4 characters |
| Person (`/person/*`) | No | Only the root `locale` object. The loader never reads the country. | 4 characters |
| Share list (`/u/<handle>/lists/<id>`) | Yes | Offers per title for the resolved country. | Not measured. The page is `private, no-store` and no public list URL was at hand. |
| OG images (`/og/*.png`) | No | Title images load details with a fixed `country: "US"`, `language: "en"`. | Not applicable |
| Category pages (`/$type/$category`) | Language only | `buildDiscoverParams` passes `locale.language` into the discover query. The country is empty unless `?country=` is set. | Not measured |
| Taste quiz (`/taste/quiz`) | Yes | `getSmartTitlesForGuest` receives the locale. | Not measured |
| Explorer, Watch next | Yes, but uncached | Both return `private, no-store`. | Not applicable |
| Static pages (about, privacy, how it works, sign-in) | No | Only the root `locale` object. | Not measured, inferred from the root loader |

Details that matter for the options:

- The root `locale` object is read in one place on the client: `ui/filter/sections/SectionStreaming.tsx`, as the default country when `localStorage` has none. It is the only reason home, person, and static pages vary at all.
- Title pages also embed two `dataUpdatedAt` timestamps, so two renders are never byte-identical. This does not affect caching.
- The title page is canonical to the bare URL (`<link rel="canonical" href="https://goodwatch.app/movie/603-the-matrix"/>`), and `<html lang="en">` is fixed. The page text is English for every country.
- `?country=XX` already works as an explicit override on title pages. The client already switches to it when `localStorage` holds a different country than the server guessed (`routes/movie.$movieKey.tsx`, lines 106 to 114).
- The hero offer grid has a fixed height by design: "Offer tiles in a fixed number of rows so switching offer type or country never changes the height" (`ui/details/hero/WhereToWatch.tsx`).
- The details query is cached in Redis per `(id, country, language)` for 30 minutes (`server/details.server.ts`).
- The Matrix has offers in 129 countries (`streaming_country_codes` in the production payload). Embedding every country in one page is not practical: the offer links alone are about 1 KB each.
- `robots.txt` disallows `/api/` and `/discover?`.

### Why raw `Accept-Language` is a bad key

- RFC 9111 section 4.1 requires the header values of the stored and the new request to match. A cache may normalize, but only "in a way that is known to have identical semantics". An absent header only matches an absent header. Source: [RFC 9111, section 4.1](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.1).
- Varnish documents the effect: it "will keep two copies of a page if one of them was created for 'en-us, en-uk' and the other for 'en-us,en-uk'", and "it is therefore crucial to normalize the headers the backends varies on". Source: [Varnish, "Achieving a high hitrate"](https://www.varnish.org/docs/users-guide/increasing-your-hitrate/).
- The app only reads one thing from the header: the region of the first entry that has one. `de-DE,de;q=0.9,en;q=0.8` and `de-DE` produce the same page but different cache entries.
- The header describes language, not location. A visitor in Germany with an English (US) browser gets US offers. How often that happens for GoodWatch visitors is not measured.

Not verified: the number of distinct `Accept-Language` values that GoodWatch receives. No access log was sampled. Fastly reported about 8,000 distinct `User-Agent` strings in 100,000 requests as a comparable high-cardinality header, but gave no number for `Accept-Language`. Source: [Fastly, "Best practices for using the Vary header"](https://www.fastly.com/blog/best-practices-using-vary-header).

## External facts

### Google Search

- Googlebot's default IP addresses "appear to be based in the USA", and "the crawler sends HTTP requests without setting `Accept-Language` in the request header". Google recommends "separate locale URL configurations" with `hreflang` annotations for locale-adaptive content. Source: [Google, "How Google crawls locale-adaptive pages"](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages).
- Cloaking is "presenting different content to users and search engines with the intent to manipulate search rankings and mislead users". Source: [Google, spam policies](https://developers.google.com/search/docs/essentials/spam-policies). Serving Googlebot the same page that a US visitor gets is not cloaking under this definition. The locale-adaptive page says to treat Googlebot like any other visitor from its location.
- Google indexes the rendered HTML after running JavaScript, but rendering is queued and "not all bots can run JavaScript". Source: [Google, JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- In Google's renderer, "Local Storage and Session Storage data are cleared across page loads. HTTP Cookies are cleared across page loads." Source: [Google, "Fix Search-related JavaScript problems"](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript).
- `hreflang` covers "small regional variations with similar content, in a single language". Both pages must link to each other, or "the tags will be ignored". Source: [Google, localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).

Not verified: a Google statement that `Vary: Accept-Language` itself helps or hurts ranking. None was found.

### Core Web Vitals

- Good LCP is 2.5 seconds or less at the 75th percentile. "A high TTFB can make achieving a 2.5 second LCP challenging". The LCP resource "should be discoverable from the HTML source". Source: [web.dev, "Optimize LCP"](https://web.dev/articles/optimize-lcp).
- Good CLS is 0.1 or less at the 75th percentile. "Avoid inserting new content without a user interaction", or reserve the space with `min-height` or a placeholder. Source: [web.dev, "Optimize CLS"](https://web.dev/articles/optimize-cls).

### Cache products

| Product | Fact | Source |
| --- | --- | --- |
| Cloudflare | "The Cloudflare CDN does not cache HTML or JSON by default." | [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) |
| Cloudflare | "By default, Cloudflare does not consider vary values in caching decisions." The exceptions are `Accept-Encoding`, Vary for images, and the Cache Rules Vary setting. | [Cache-Control](https://developers.cloudflare.com/cache/concepts/cache-control/) |
| Cloudflare | The Cache Rules Vary setting is on all plans. It can `normalize` `Accept-Language` against an allowlist of up to 20 languages, `passthrough` the raw value, or `bypass` the cache. The documented example normalizes `en-US, fr;q=0.8` and `fr;q=0.8, en-GB` to the same value `en,fr`. | [Vary](https://developers.cloudflare.com/cache/concepts/vary/), [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/#vary) |
| Cloudflare | Custom cache keys on headers, cookies, or user features (device type, country, language) are Enterprise only. | [Cache keys](https://developers.cloudflare.com/cache/how-to/cache-keys/) |
| Cloudflare | `CF-IPCountry` holds the visitor's two-letter country code, `XX` when unknown, `T1` for Tor. | [HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/) |
| Cloudflare | Snippets are not on the Free plan. Workers Free allows 100,000 requests per day. Workers Paid starts at 5 USD per month with 10 million requests included. | [Snippets](https://developers.cloudflare.com/rules/snippets/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Cloudflare | "Do not use `s-maxage` with `stale-while-revalidate`." `s-maxage` implies `proxy-revalidate`, so Cloudflare does not serve stale content. | [Cache-Control](https://developers.cloudflare.com/cache/concepts/cache-control/), [Revalidation](https://developers.cloudflare.com/cache/concepts/revalidation/) |
| Varnish | Supports `esi:include`, `esi:remove`, and `<!--esi ... -->`. "Content substitution based on variables and cookies is not implemented." | [Varnish, ESI](https://www.varnish.org/docs/users-guide/esi/) |
| Varnish | The docs give a VCL example that rewrites `Accept-Language` to one of a short list before lookup. Concurrent backend requests for the same object are coalesced. | [Varnish, hit rate](https://www.varnish.org/docs/users-guide/increasing-your-hitrate/) |
| nginx | `proxy_cache_key` accepts any variables. nginx honors `Vary` since 1.7.7 and can ignore it with `proxy_ignore_headers`. A response with `Set-Cookie` is not cached. `proxy_cache_lock` and `proxy_cache_background_update` exist. | [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) |
| Caddy | HTTP caching needs the separate `cache-handler` module (Souin). Its key options include `headers` and `disable_vary`. | [caddyserver/cache-handler](https://github.com/caddyserver/cache-handler) |
| MaxMind GeoLite2 | Free with an account and license key. Users "must delete GeoLite databases within 30 days of a new release". "IP geolocation is inherently imprecise." | [MaxMind, GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/) |

Not verified:

- Whether Cloudflare's `Accept-Language` allowlist can keep region subtags (`en-US` and `en-GB` as separate values). The documented example drops them. If it always drops them, this feature cannot carry the country.
- A GeoIP module for Caddy, and the nginx `geoip2` module. Both are third-party and were not reviewed.
- DB-IP Lite license terms and accuracy.
- Country-level accuracy numbers for any GeoIP database.

### How comparable sites handle it

Observed with one or two `curl` requests per URL from a German IP address, with a desktop Chrome user agent.

| Site | Observation | Pattern |
| --- | --- | --- |
| JustWatch | Title URLs carry the country: `/us/movie/the-matrix`, `/de/Film/Matrix`. Each has its own canonical and 24 `hreflang` alternates. Headers: `cache-control: public, max-age=0, s-maxage=3600`, `vary: Accept-Encoding`. A second request returned `age: 19` and `x-cdn-cache-status: hit`. `Accept-Language` did not change the response. The root `/` returned `x-cache-key-region: DE`. | Country in the URL (e). The root uses a geo cache key (c). |
| Letterboxd | `/film/the-matrix/` sends `cache-control: s-maxage=300`, `vary: Accept-Encoding`, `content-language: en-US`. The HTML contains a fragment URL: `/csi/film/the-matrix/availability/?esiAllowUser=true&esiAllowCountry=true`, next to other `csi-*` hooks for reviews and lists. | One neutral page, availability as a separate fragment (a or d). |
| TMDB | `/movie/603-the-matrix` returned `content-language: de-DE` and a German page for `Accept-Language: de-DE`, with `vary: accept-encoding` only and `x-cache: Miss from cloudfront`. It set a `preferences` cookie with `"locale":"de-DE","country_code":"DE"`. The page has 52 `hreflang` alternates of the form `?language=xx-XX`. Offers live on a separate URL, `/watch?locale=DE`. | Locale-adaptive default URL, uncached in this observation, with language and country in the URL for alternates (e). |
| IMDb | The request returned `202` with an empty body and `cache-control: no-store` (a bot challenge). | Could not observe. |

Not verified:

- Whether the Letterboxd fragment is assembled at the edge or fetched by the browser. The direct request returned `403`. The page was `cf-cache-status: DYNAMIC` in this observation.
- Whether TMDB caches anonymous HTML at all. Both observed responses were misses with `Set-Cookie`.

## Options

### How to read the hit ratio numbers

The numbers come from a simple model, not from a measurement. Assumptions: 500 requests per second for one hour (1.8 million requests) on three URLs, a 30 minute freshness lifetime, stale content served while one refresh runs. Each variant of each URL then costs one blocking origin render when cold and about two background refreshes per hour.

| Option | Variants per URL | Blocking renders for three URLs | Hit ratio over the hour |
| --- | --- | --- | --- |
| Today, raw `Accept-Language` | Unknown, likely thousands | Thousands | Above 98% in the model, but the cold start hits the single origin process with a burst |
| (a) Country-neutral page | 1 | 3 | Above 99.99% |
| (b) Short country list | List size plus one, for example 21 | About 63 | Above 99.99% |
| (c) Geo header, every country | Up to about 250, mostly the top 20 to 30 | Up to about 750 | Above 99.9% |
| (d) Edge includes | 1 for the page, one per country for the fragment | 3 pages plus cheap fragments | Above 99.99% |
| (e) Country in the URL | 1 per URL, but one URL per country | Same as (b) or (c) | Same as (b) or (c) |

Two things matter more than the hourly ratio:

- **Cold start.** The origin is one `remix-serve` process. Title pages took 0.2 to 0.4 seconds to first byte from outside in this test. The fewer variants, the fewer renders compete at the start of the spike. Without request coalescing at the cache, each cold variant can also stampede.
- **Long tail.** A title page that gets a few requests per hour only hits the cache when the same variant was requested within the lifetime. With raw `Accept-Language`, that is close to never. With one variant, any earlier visit warms it.

### (a) One country-neutral page, availability loaded on the client

The HTML is the same for every anonymous visitor. The browser picks the country (from `localStorage`, then `navigator.languages`) and requests the per-country parts from an endpoint with the country in its URL, for example `/title-availability/movie/603/DE`. That endpoint is cacheable by URL alone.

- **Hit ratio:** the best of all options. One variant per URL. `Vary` shrinks to `Cookie` (plus `Accept-Encoding`). Works with any cache, including Cloudflare's default behavior and browser caches.
- **SEO:** Googlebot gets the neutral page. What it indexes depends on a sub-decision:
  - *Skeleton:* the HTML has no offers. Google only sees them if its renderer runs the script and can fetch the endpoint. Today `robots.txt` disallows `/api/`, so the endpoint must live elsewhere. The country-specific FAQ answer leaves the structured data.
  - *US default:* the HTML carries the US offers, which is what Googlebot gets today. The client replaces them for other countries. Nothing changes for Google.
- **LCP:** better through a lower time to first byte. The poster and backdrop do not depend on the country. Not verified: that the LCP element on title pages is the poster or backdrop.
- **Layout shift:** the hero offer grid already has a fixed height. The age rating badge (`R` or `16`) and the FAQ answers change width or length. The FAQ sits below the fold. The badge needs reserved width or a country-neutral default.
- **Complexity:** medium, in the front end only. Title pages: split the loader data, add the endpoint, render the hero tiles and two FAQ answers from client data. Discover: render cards without service logos first. The browser already asks again with the guest's stored country (`ui/discover/useDiscoverBrowse.ts`). Home, person, and static pages: remove the `locale` object from the root loader, which is a few lines.
- **Risk:** with the US default, visitors from other countries see US offers until the script runs, unless an inline script hides them before first paint.
- **Seen at:** Letterboxd.

### (b) Normalize to a short country list at the cache layer

The cache layer maps `Accept-Language` to one token from an allowlist (for example 20 countries plus `other`) and uses it as the key. The origin varies on that token, not on the raw header.

- **Hit ratio:** high. Variants equal the list size.
- **SEO:** unchanged. Googlebot sends no header and gets the fallback variant, like a visitor without a regional language. Not cloaking.
- **LCP and layout shift:** unchanged markup, no shift. Time to first byte improves on hits.
- **Complexity:** low in the app (read the token in the two resolvers, fix the fallback). At the cache layer it depends on the product:
  - Varnish or nginx: a few lines (`map` or VCL), documented.
  - Cloudflare: the Vary setting normalizes languages on all plans, but whether it keeps the region is not verified. A custom key is Enterprise only. A Worker can do it on the paid Workers plan.
  - Caddy `cache-handler`: can add a header to the key. Normalizing first needs a request header rewrite. Not tested.
- **Risk:** visitors outside the list get the fallback country, and must switch by hand. The mapping keeps the weakness of `Accept-Language` as a location signal.
- **Seen at:** none of the observed sites.

### (c) Geo header as the cache key

The cache layer derives the country from the client IP (`CF-IPCountry`, or a local GeoIP database) and keys on it.

- **Hit ratio:** high for the head, lower than (b) unless the country is also bucketed to an allowlist.
- **SEO:** Googlebot crawls mostly from US addresses and gets the US variant, as today. Google states it also crawls from other countries and expects the same treatment as a local visitor.
- **LCP and layout shift:** as in (b).
- **Complexity:** medium to high. On Cloudflare, the header is free but keying on it is Enterprise only, or needs a Worker. Self-hosted, it needs a GeoIP database, a module in the proxy, a license key, and an update job (GeoLite2 must be refreshed within 30 days of each release).
- **Benefit beyond caching:** IP location is a better country signal than language for visitors with an English browser abroad. The app's own onboarding already prefers IP over language (`api.guess-country.tsx`).
- **Seen at:** JustWatch, on the root page only.

### (d) Edge-side includes

The cache stores a neutral page with an include tag and one fragment per country, and assembles them.

- **Hit ratio:** like (a).
- **SEO, LCP, layout shift:** like (b). The visitor and Googlebot get complete HTML.
- **Complexity:** high. Only Varnish offers it among the self-hosted candidates, and Varnish does not substitute variables or cookies, so the country must come from (b) or (c) anyway. Cloudflare needs a Worker. Remix serializes the loader data into the page for hydration, so the fragment would have to replace both the markup and the matching JSON, or React reports a hydration mismatch. This last point is analysis, not a tested result.
- **Seen at:** possibly Letterboxd (`esiAllowCountry` in the fragment URL). Not verified.

### (e) Country in the URL

Each country gets its own URL, as a path prefix (`/de/movie/603-the-matrix`) or as the existing `?country=DE` parameter.

- **Hit ratio:** each URL has one variant. A spike on a shared link hits one URL, so the ratio is high, but every visitor sees the country of the person who shared the link unless the client corrects it. That correction is option (a).
- **SEO:** the approach Google recommends for locale-adaptive content, with `hreflang` and return links. It is the only option that lets a page rank for "where to watch X" per country. It multiplies the URL count by the number of countries and needs sitemap and canonical work. The indexing investigation of 2026-09-24 found almost no indexed pages, so this is a product decision of its own.
- **LCP and layout shift:** no shift.
- **Complexity:** high as a path prefix (routes, links, sitemaps, redirects). Low as the query parameter that exists today, which stays canonical to the bare URL and adds no SEO value.
- **Seen at:** JustWatch, TMDB.

## Recommendation

Use option (a), in two steps, and keep (b) as the fallback.

1. **Make the pages that do not need the country neutral now.** Remove `locale` from the root loader, read `navigator.languages` on the client where `SectionStreaming` needs a default, and drop `Accept-Language` from `Vary` on home, person, and static pages. This covers two of the four landing surfaces in the map (home, person) with a few lines and no visible change.
2. **Move the per-country parts of title pages, Discover, and the share list to the client.** Serve them from a cacheable endpoint with the country in the URL, outside `/api/`. Then drop `Accept-Language` from `Vary` everywhere.

Reasons:

- It gives one variant per URL, which is the best cold start for a single origin process and the only option that also fixes the long tail.
- It does not depend on the cache product. The map has not chosen one, and the low-cost Cloudflare plans cannot key on country.
- The code is already close: the hero grid has a fixed height, the client already switches country from `localStorage`, and the new Discover already refetches in the browser.
- Letterboxd serves its film pages the same way, as far as the response shows.

Use (b) if the prototype in #248 shows that the streaming section loading after the page is not acceptable. It keeps full server rendering and needs a self-hosted cache (Varnish or nginx) or a paid Worker.

Do not use (c) or (d) as the cache key design: they add a GeoIP dependency or edge assembly without a better result for the spike. Treat (e) as a path prefix as a separate SEO project, not as part of this map.

## Open decisions for the owner

1. **What does the neutral title page contain for streaming?** A skeleton, or the US offers as a default that the client replaces. The US default keeps today's Google result. The skeleton is simpler and never shows wrong offers.
2. **Is a visible swap acceptable?** Offers that appear or change shortly after first paint, in a fixed-height block. #248 names a prototype for this.
3. **Which fallback country?** `US` and `DE` are both in the code today. Under (a), the fallback only matters for the default and for visitors without a usable browser language.
4. **How does the client pick the country?** `localStorage`, then `navigator.languages`, or an IP lookup. An IP lookup is more accurate and adds a request.
5. **Does Google need to see offers and the country-specific FAQ answer?** If yes, the endpoint must be crawlable and the default must be server-rendered. If no, the skeleton is enough.
6. **Is the share list part of this?** It renders offers per country and is the primary spike scenario, but it is uncached today for other reasons.
7. **If (b): which countries are on the list, and which cache product?** The list should come from real traffic data.

## Not verified

- The number of distinct `Accept-Language` values and the country distribution of GoodWatch visitors. No access log or analytics export was sampled.
- The LCP element on title pages on mobile, and any lab or field CLS number. No Lighthouse run was made.
- The hit ratios. They come from the model above, not from a benchmark.
- Whether Cloudflare's `Accept-Language` normalization keeps region subtags.
- How Letterboxd assembles its availability fragment, and whether TMDB caches anonymous HTML.
- IMDb's behavior. The request was challenged.
- Country differences on the share list, category, and taste quiz pages. They follow from the code and were not measured.
- One request to `/discover` with `Accept-Language: en-US` timed out after 40 seconds during this research. A retry answered in 0.3 seconds. The cause is unknown.

## Findings outside the question

- **Two fallback countries.** `utils/locale.ts` falls back to `DE`, `server/country.server.ts` to `US`. Googlebot sees German service logos on Discover and US offers on title pages.
- **`s-maxage` with `stale-while-revalidate`.** The current policy combines both. Cloudflare documents that it then never serves stale content. Other caches may differ. This affects the choice of cache layer and the "served stale while a refresh runs" trade-off in the map.
- **`Vary: Cookie` on Cloudflare.** Cloudflare ignores `Vary` by default, including `Cookie`. Member responses are safe because they are `private, no-store`, but a member could receive cached guest HTML unless a rule bypasses the cache when the auth cookie is present.
- **`robots.txt` disallows `/api/`.** Any client-loaded content that Google should index must come from another path.
- **`api.guess-country` calls `ipapi.co` per request.** The limits of that service were not checked.
