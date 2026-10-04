# Cache identity for anonymous HTML

This page says which stored response a request may get. One rule serves the browser, the in-process page cache, and
a cache in front of the app. The code is `goodwatch-webapp/app/server/cache-identity.server.ts`. The decision is
[ADR 0005](adr/0005-cache-identity-for-anonymous-html.md).

The in-process page cache follows this page: see [page-cache.md](page-cache.md). No cache runs in front of the app
yet. It must follow this page too.

## The identity

A cache key is the full URL plus the identity. The identity has three parts.

| Part | Values | Where it comes from |
| --- | --- | --- |
| Audience | `anon` or `member` | The auth cookie. A request is a member when its `Cookie` header has a cookie named `sb-<ref>-auth-token` or `sb-<ref>-auth-token.<n>`. `<ref>` is the first label of the `SUPABASE_URL` hostname. The value doesn't matter: a forged or expired cookie still makes a member. |
| Country | Two uppercase letters | The `GW-Cache-Identity` request header. Without it: the region of the most preferred `Accept-Language` entry that has one (`de-DE` gives `DE`). Without that: `US`. |
| Language | Two or three lowercase letters | The `GW-Cache-Identity` request header. Without it: the language of the most preferred `Accept-Language` entry. Without that: `en`. |

- A member is never served from a shared cache and never stored in one.
- `US` is the only country fallback. Google crawls from the US without `Accept-Language`. The earlier `DE` fallback
  for Discover, the home page, and the root `locale` object is gone.
- A title page still prefers `?country=`, and a member's saved country, over the identity's country. The parameter
  is part of the URL, and the saved country only applies to members.

## How a cache learns the key

The key travels in one header, in both directions: `GW-Cache-Identity: anon;<COUNTRY>;<language>`, for example
`anon;US;en`. The value must match `^anon;[A-Z]{2};[a-z]{2,3}$`.

- **A front cache sends it.** It computes the value, overwrites whatever the client sent, and adds it to the request.
  The app then takes country and language from the header, ignores `Accept-Language`, and answers with
  `Vary: GW-Cache-Identity` and a shared `Cache-Control`.
- **The app states it.** Every anonymous cacheable response carries the key the app used in `GW-Cache-Identity`.
- **No header, no shared caching.** Plain `Vary` can't say "depends on whether one cookie exists". So a request
  without a valid header gets `private, max-age=0`: the app can't know that a cache on the way tells members from
  anonymous visitors. A cache that can't compute the key must not store, and this answer enforces it.
- The app ignores an invalid value. It also ignores the header on a request that has the auth cookie.

## Response headers

`applyCachePolicy` sets these on every HTML document and every `_data` response. The server entry calls it last, with
the final status.

| Case | `Cache-Control` | `Vary` | `GW-Cache-Identity` |
| --- | --- | --- | --- |
| Anonymous, GET or HEAD, status 200, with a valid identity header | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` | `GW-Cache-Identity` | The key |
| Anonymous, GET or HEAD, status 200, no identity header | `private, max-age=0` | `Accept-Language` | The key |
| Anonymous public share list, status 200, with a valid identity header | `public, max-age=0, s-maxage=10, stale-while-revalidate=10` | `GW-Cache-Identity` | The key |
| Member | `private, no-store` | none | none |
| Any status other than 200: errors, not-found pages, error boundaries | `private, no-store` | none | none |
| A response that sets a cookie, a method other than GET or HEAD, or a route that says `private` or `no-store` (hidden share lists, search, settings) | `private, no-store` | none | none |
| A title page without its embedded related panel, genre links, or collection (a lookup ran out of its budget or failed) | `private, no-store` | none | none |
| Anonymous `_data` response of a loader that sets no `Cache-Control` | unchanged (none) | unchanged | none |

A route can shorten the shared policy. Public share lists without an identity header use the anonymous keyed policy
above. Hidden lists and all member views stay `private, no-store`.

Compression adds `Accept-Encoding` to `Vary`. No response of the app varies on `Cookie`, except the gate's 403 and
410, which are `private, no-store`.

### Errors, redirects, and the gate

- **Errors:** every 4xx and 5xx document is `private, no-store`. There is no negative caching: a missing title can
  appear with the next import, and no cache exists whose load a short lifetime would cut.
- **The gate:** the 403 check and the 410 for the old check page stay `private, no-store` with `Vary: Cookie`.
- **Redirects that depend on who asks** are `private, no-store`: `/taste` for visitors without a session, the list
  editor for non-owners, `/search` and `/discover/:type` under a preview flag, `/sign-in` and `/sign-up` with a return
  page, `/lists/mine`, `/wishlist`.
- **Redirects that are the same for everyone** carry no `Cache-Control`: the canonical title, person, and profile
  paths, `/tv/*`, `/living-room`. A cache may keep a 301 by its own default.

### Data endpoints

- Catalog data that is the same for every visitor, country, and language uses `PUBLIC_DATA_CACHE_CONTROL`
  (`public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400`) with no `Vary`. The URL alone is the key, and
  a member's request may be stored too. `/api/related` uses it. `/api/title-cast` and the OG images have their own
  public lifetimes.
- `/api/living-room/services` depends on the country only. With `?country=` it has no `Vary`. Without it, it varies
  on `GW-Cache-Identity` or `Accept-Language`, like a page.
- `/api/living-room/picks` goes through `applyCachePolicy`.
- Error responses of these endpoints are `no-store`.

## Cookies and parameters

| Input | Decision |
| --- | --- |
| Auth cookie `sb-<ref>-auth-token[.n]` | Makes the request a member. Never cacheable. |
| `gw_browser` | Not part of the key. An unfiltered page doesn't read it. The gate requires it for filtered person URLs and for `/sign-in` and `/sign-up` with `redirectTo`. A cache forwards `Cookie` on a miss, never stores the 403, and may serve a stored filtered 200 page to anyone. |
| Analytics cookies (`_ga*`, `ph_*`) | Irrelevant. The server doesn't read them. |
| `gw_recording_sample`, `gw_stale_chunk_reload` | Browser storage keys, not cookies. Irrelevant. |
| Feature flags (`REC_*`) | Environment variables. Preview users are members, so anonymous HTML doesn't depend on a visitor. A flag change needs a restart, and a purge of any page cache. |
| `?country=`, `?language=`, filters, `?tv=`, every other query parameter | Part of the URL, which is part of the key. |
| Tracking parameters (`utm_*`, `fbclid`, `gclid`, and the other click ids listed in [page-cache.md](page-cache.md)) | Not part of the key. The in-process page cache removes them from the request before the app sees it, because some pages copy the query string into links. No loader reads them. |
| `?_data=` | Remix's loader request. Same rule as the page. |
| A member's saved country and services | Members only. Never in an anonymous response. |
| `User-Agent` | Not part of the key. Two places read it. The gate and the person loader redirect a declared crawler away from filtered URLs, and those redirects aren't stored. A title page waits 1,000 ms for the related titles for a declared crawler and 150 ms for everyone else, so a page rendered for a browser can lack the embedded related panel (0.1% of movie pages in production). Such a page answers `private, no-store`, so no cache stores it. |

## Inventory

Measured on a local production build on October 4, 2026, before and after this change. "Anonymous" means no auth
cookie, with or without analytics cookies and `gw_browser`: both gave the same headers in every row. "Member" means
a request with the auth cookie. `Accept-Encoding` in `Vary` comes from compression and is left out.

| Response | Before: `Cache-Control` and `Vary` | After, no identity header | After, with `GW-Cache-Identity` |
| --- | --- | --- | --- |
| Home, anonymous | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200`, `Vary: Cookie, Accept-Language` | `private, max-age=0`, `Vary: Accept-Language` | Shared policy, `Vary: GW-Cache-Identity` |
| Title, person, Discover, category, static pages, sign-in, taste quiz, wishlist: anonymous | `max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400`, `Vary: Cookie, Accept-Language` | `private, max-age=0`, `Vary: Accept-Language` | Shared policy, `Vary: GW-Cache-Identity` |
| Filtered person page with `gw_browser`, anonymous | Same as a person page | Same as a person page | Same as a person page |
| Any page, member | `private, no-store`, `Vary: Cookie, Accept-Language` | `private, no-store` | `private, no-store` |
| Share list page, search page: everyone | `private, no-store` | `private, no-store` | `private, no-store` |
| Missing title or person, `/watch-next` and `/explorer` with the feature off (404): anonymous | The public title policy above, `Vary: Cookie, Accept-Language` | `private, no-store` | `private, no-store` |
| Missing list (404) | `private, no-store` | `private, no-store` | `private, no-store` |
| Unknown path (404) | none | `private, no-store` | `private, no-store` |
| Render error (500) | The page's public policy (seen in an earlier local run, not measured again) | `private, no-store` | `private, no-store` |
| Gate check (403) and old check page (410) | `private, no-store`, `Vary: Cookie` | unchanged | unchanged |
| Canonical 301 redirects | none | none | none |
| `/taste` to the quiz (302) | none | `private, no-store` | `private, no-store` |
| `/lists/mine` (302) | `private, no-store` | unchanged | unchanged |
| `_data` of the root loader, anonymous | The public title policy, `Vary: Cookie, Accept-Language` | `private, max-age=0`, `Vary: Accept-Language` | Shared policy, `Vary: GW-Cache-Identity` |
| `_data` of a page loader, anonymous | none | none | none |
| `_data` of a page loader, member | none | `private, no-store` | `private, no-store` |
| `_data` for a missing title (404) | none | `private, no-store` | `private, no-store` |
| `/api/related`, everyone | none | `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` | same |
| `/api/related` with bad parameters (400) | none | `no-store` | `no-store` |
| `/api/title-cast`, everyone | `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400` | unchanged | unchanged |
| `/api/living-room/services`, everyone | `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200`, `Vary: Accept-Language` | Shared policy, `Vary: Accept-Language` | Shared policy, `Vary: GW-Cache-Identity` |
| `/api/share-lists/titles` | `public, max-age=3600` | unchanged | unchanged |
| OG image (200) | `public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400` | unchanged | unchanged |
| OG image for a missing page (404) | `public, max-age=60` | `no-store` | `no-store` |
| Files from `public/` and `/assets/` | Set by the static file handler | unchanged | unchanged |

After this change (October 4, 2026), anonymous public share list pages use 10 seconds fresh and 10 seconds stale
with an identity header, or `private, max-age=0` with the identity key without it. Hidden lists and member views
stay `private, no-store`. The measured inventory above records the earlier behavior.

Where each header is set:

| Place | What it sets |
| --- | --- |
| `app/utils/auth.ts`, `getAuthFromRequest` | The root loader's `Cache-Control`: private with the auth cookie, the shared policy without. It only says whether the route allows sharing. |
| `app/utils/headers.ts`, `pageHeaders` | Every page's `headers` export. A child can shorten the shared lifetime but cannot replace the root's private policy. `Set-Cookie` or `private` anywhere forces `private, no-store`. |
| `app/entry.server.tsx` | `applyCachePolicy` on every document, with the final status, and on every `_data` response through `handleDataRequest`. This is the last word. |
| Route loaders | `private, no-store` on hidden share lists, member list views, search, settings, and member data. Anonymous public share lists use the 10 + 10 second policy. Their own public lifetimes on `/api/related`, `/api/title-cast`, and OG images. |
| `app/server/browser-gate.server.ts` | The 403, 410, and crawler 301, before Express and Remix. |
| `remix-serve` and the static file handler | Files from the client build. Compression adds `Vary: Accept-Encoding`. |

## What the in-process page cache does

The cache is described in [page-cache.md](page-cache.md). It keeps these rules:

1. It asks the identity for every request (`cacheIdentityOf`, the rule behind `cacheIdentity`). If `cacheable` is
   false (a member, or a method other than GET or HEAD), it doesn't look up and doesn't store.
2. The key is the URL without tracking parameters, plus `identity.key`, the `Host`, the build commit, and whether a
   front cache named the identity.
3. It stores a response only when `applyCachePolicy` returned `keyed` or `shared` for it. That excludes errors,
   redirects, responses that set a cookie, routes that say private, and incomplete title pages. Anonymous public share
   lists are eligible with a 10 + 10 second lifetime. Hidden lists and member views are excluded.
4. It sends a stored response with the headers it was stored with. A `keyed` response keeps `private, max-age=0`.
5. It takes the gate's decision again with the gate's own function, so a request without `gw_browser` for a gated URL
   never gets a stored page, whatever order the gate and the cache run in.
6. A deploy and a feature flag change restart the process, which empties the cache.

## What a front cache must do

1. Pass every request that has the auth cookie to the app, and never store its response.
2. For every other request, compute `anon;<COUNTRY>;<language>` and set it as `GW-Cache-Identity`. Overwrite a value
   that came from the client. How many country and language pairs get their own value is the cache's choice: the app
   renders for whatever valid value it receives.
3. Key on the URL and that header. `Vary: GW-Cache-Identity` on the response says the same.
4. Honor `private` and `no-store`. Never store a response without `s-maxage`, a response with `Set-Cookie`, or the
   gate's 403. Don't override that by URL or status.
5. On a miss, forward the request's `Cookie` header unchanged, so that the gate can tell a browser from a crawler.
6. A cache that can't compute the key must send no identity header. The app then answers `private`, and nothing is
   stored.

## Browsers

- HTML has `max-age=0`: a browser asks the server on every navigation and reload. Title pages sent `max-age=300`
  before.
- Member HTML is `no-store`. A browser never shows member HTML after sign-out, not even on Back.
- Back and Forward may show the browser's own copy of an anonymous page after sign-in, because history navigation
  doesn't revalidate. `AuthProvider` then sees the session and reloads the loader data. Before this change,
  `Vary: Cookie` made the browser fetch the page again in that case.

## Checks

- `app/server/cache-identity.test.ts` covers the rule, and asserts for every page route that a member's document is
  `private, no-store`, whatever the route allows.
- `node scripts/check-cache-headers.mjs <base-url> [--list <share list path>]` in `goodwatch-webapp` requests the
  landing routes of a running app as an anonymous visitor, with the identity header, and with a forged auth cookie,
  and fails on a broken rule.
- The metric queries are in [viral-spike-metrics.md](benchmarks/viral-spike-metrics.md): member responses and error
  responses with `cache_control="shared"` must stay empty.
