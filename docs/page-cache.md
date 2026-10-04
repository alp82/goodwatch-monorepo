# The in-process page cache

The webapp keeps complete anonymous HTML pages in the memory of its Node process and answers repeated requests for
them without rendering. This page says how it decides, what its numbers are, how to turn it off, and what a cache in
front of the app must still do. The code is `goodwatch-webapp/app/server/page-cache.server.ts`. The decision is
[ADR 0007](adr/0007-in-process-page-cache.md). The rule for who may get a stored page is
[cache-identity.md](cache-identity.md). The measurements are in
[viral-spike-page-cache.md](benchmarks/viral-spike-page-cache.md).

## Why

A page render costs 14 to 63 ms of the process's one main thread, so one process renders about 20 title pages per
second. A stored page costs 0.5 to 0.8 ms. In a traffic spike, most requests ask for one or a few URLs. On a normal
day almost no URL repeats: crawlers walk about 240,000 different titles a day. So the cache stores only URLs that
repeat.

## Where it sits

```text
request -> browser gate -> static files -> page cache -> health endpoints -> Express -> Remix
```

- The cache wraps the HTTP server's request listeners, as the gate and the static file handler do. The server entry
  starts it before the static file handler, so static files never reach it.
- A stored page is answered before Express: no compression middleware, no request log line, no Remix request object.
- The gate starts with the first root loader call, so its place in the chain isn't fixed. The cache doesn't depend on
  it: it asks the gate's own function, `gateAnswer`, for every request. A request that the gate answers (a filtered
  person URL, or `/sign-in` and `/sign-up` with `redirectTo`, without the `gw_browser` cookie) is passed on untouched.
  It never reads the store, never fills it, and never counts toward admission.

## What a request goes through

1. **Not a page:** a method other than GET or HEAD, a path under `/api/`, `/og/`, `/assets/`, or `/health/`, a path
   whose last segment has a dot, or a `_data` request. The cache does nothing.
2. **Bypass:** the gate answers it, the request has the auth cookie (`cacheIdentity` says it isn't cacheable), the URL
   is longer than 2,048 characters, or the process is shutting down. The response gets `GW-Page-Cache: bypass` and
   comes from the app.
3. **Hit:** a fresh stored page exists for the key. The cache sends it with `GW-Page-Cache: hit`.
4. **Stale:** the stored page is past its fresh time. The cache sends it with `GW-Page-Cache: stale` and starts one
   background render for the key.
5. **Miss:** the app renders the page, and the response says `GW-Page-Cache: miss`. If the URL repeats, the render is
   stored, and requests that arrive while it runs wait for it.

## Key

`<build commit> | <Host> | <path and query without tracking parameters> | <identity> | <who named the identity>`

- **Build commit:** `SOURCE_COMMIT`. A deploy starts a new process with an empty cache. The commit is in the key so
  that a later shared store can't serve another build's HTML.
- **Host:** the `Host` header, lowercase.
- **Path and query:** parsed the way Remix parses the request. Every parameter keeps its bytes and its place, so
  `?a=1&b=2` and `?b=2&a=1` are two entries.
- **Identity:** `identity.key` of `cacheIdentity`, for example `anon;US;en`.
- **Who named it:** a front cache with the `GW-Cache-Identity` header (the page is `shared`), or the app from
  `Accept-Language` (the page is `keyed` and stays `private, max-age=0`). The two are separate entries, because their
  `Cache-Control` and `Vary` differ.

### Tracking parameters

These parameters aren't part of the key, and the app doesn't see them on a request whose page may be stored:

`utm_*`, `gad_source`, `mc_cid`, `mc_eid`, `gclid`, `gclsrc`, `dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`,
`twclid`, `li_fat_id`, `igshid`, `ttclid`, `_ga`, `_gl`.

- No loader reads them. Discover's loader names `utm_*`, `fbclid`, and `gclid` only to ignore them. Analytics read
  them in the browser, from the address bar.
- Some pages copy the whole query string into links (Discover does). If the app saw the parameters, a stored page
  would carry one visitor's click id to every other visitor. So the cache removes them from the request before the
  app sees it.
- A redirect to a path on this site gets them back in its `Location`, so that the browser's analytics still see them
  after a redirect.
- A request with the auth cookie and a request that the gate answers keep their URL as it is.
- A gated URL stays gated: a person URL with only `?fbclid=...` and no `gw_browser` cookie still gets the gate's check.

## Admission

- A URL is stored on its second request within 60 seconds.
- The counters live in a map of at most 20,000 keys, each with a 60-second window. When the map is full, expired
  windows go first, then the oldest key.
- Why these numbers: in 14 minutes of production traffic on October 4, 2026 (6,695 page responses for 6,242
  different URLs), 97% of the URLs were requested once. A rule of two requests in 60 seconds admits 68 URLs (1.1%) and
  could answer 4.1% of the page requests. A window of 10 minutes admits 174 URLs and answers no more. A rule of three
  requests admits 15 URLs and answers 3.8%.

## What is stored

A response is stored only when all of these hold:

| Rule | Where it's enforced |
| --- | --- |
| The request has no auth cookie | `cacheIdentity`, before any lookup. A member's request never reaches the store, the counters, or a waiting line. |
| GET, status 200, `text/html` document | The server entry offers only a document render. `pageCacheWants` refuses any other method or status. |
| The applied policy is `keyed` or `shared` | The server entry passes the result of `applyCachePolicy`. A route that says `private` or `no-store` is never offered: hidden share lists, member views, search, settings. |
| No `Set-Cookie` | `applyCachePolicy` makes such a response private, and `pageCacheWants` checks again. |
| No render error | The server entry drops the offer when React reported an error or the abort timer fired. |
| The gate wouldn't answer the request | `gateAnswer`, before any lookup and again when the render is offered. |
| The page is complete | A title page without its embedded related panel answers `Cache-Control: no-store`. See below. |
| The URL repeated | The admission rule, checked when the render is offered. |
| At most 8 MB of HTML and 4 MB compressed | Checked before and after compression. |

- **Incomplete title pages:** a title page waits 150 ms for its related titles (1,000 ms for a declared crawler).
  When the lookup runs out of time or fails, the page has no embedded panel. The loader then answers
  `Cache-Control: no-store`, which the page headers turn into `private, no-store`. The page cache and a cache in front
  both follow it. The lookup keeps running and fills the data cache, so the next render is complete.
- **Share list pages** are stored only for anonymous visitors to a public list. Their lifetime is 10 seconds fresh
  and 10 more seconds stale. Hidden lists and member views send `private, no-store`.
- **The stored bytes:** the HTML compressed once with Brotli (quality 5) and once with gzip (level 6), on the thread
  pool, after the response of the render. The uncompressed HTML isn't kept. A client that accepts neither encoding
  gets the gzip copy decompressed on the thread pool.
- **The stored headers:** every header of the original response, plus `Accept-Encoding` in `Vary`, an `ETag`, and
  `Age`. A `keyed` page is replayed with `private, max-age=0` and `Vary: Accept-Language, Accept-Encoding`.
- **`ETag`:** from the HTML, with a suffix per encoding. `If-None-Match` answers 304. `HEAD` answers the headers.

## One render per key

- The first request for a URL is rendered by the app as before. While it runs, a second request for the same key
  waits for it, up to 3 seconds, and is answered from the store when the render is stored. A cold URL that 500
  clients ask for at once renders once.
- If the render turns out not to be storable, the waiting requests go to the app, and the key gets a pass period:
  nobody waits for that key for 5 seconds, doubling up to 5 minutes each time it fails again. A hidden share list page
  under load costs one probe per pass period and no waiting. A public list shares one render per key.
- At most 1,000 renders are tracked and at most 2,000 requests wait. Beyond that, requests go to the app.

## Lifetime

The default policy is `s-maxage=1800, stale-while-revalidate=7200`. A route can shorten its lifetime, including for
keyed pages whose final HTTP policy is private. Neither lifetime can exceed the defaults. Lifetime and `Age` count
from the start of the render request, including loader, render, and compression time. A render that finishes at or
after its stale deadline is not stored. The defaults give:

- **Fresh for 30 minutes.**
- **Stale for 2 more hours:** the stored page is served, and one background render per key refreshes it. At most two
  background renders run at once.
- **A failed refresh** (an error, a timeout of 15 seconds, or a page that isn't storable this time) keeps the stale
  page and pauses refreshes of that key for 30 seconds. A refresh that answers a redirect or a 404 deletes the page.
- **After 2.5 hours** without a successful refresh, the page is gone.
- `PAGE_CACHE_MAX_FRESH_SECONDS` caps the fresh time below the policy's.

Title data can be up to 24 hours old in the data cache. A stored page adds up to 30 minutes for a URL that keeps
getting requests, and up to 2.5 hours for the first request after a quiet period.

## Bounds

| Limit | Value | Setting |
| --- | --- | --- |
| Stored bytes (Brotli plus gzip plus 1 KB per page) | 128 MB | `PAGE_CACHE_MAX_BYTES` |
| Stored pages | 2,000 | `PAGE_CACHE_MAX_ENTRIES` |
| One page, compressed | 4 MB | |
| Admission counters | 20,000 keys | |

A movie page takes about 106 KB (47 KB Brotli, 59 KB gzip), so 128 MB holds about 1,200 title pages. The least
recently used page goes first. The process holds about 2.2 GB today, against a planned limit of 4 GB.

## Reset

- `resetPageCache(match)` deletes every stored page whose path matches, for all hosts, identities, and query strings,
  and stops renders in flight for those paths from storing.
- `resetListView` calls it for `/u/<handle>/lists/<id>` before and after the data reset. The first call cancels
  in-flight renders early. The second removes any page built while the old data was still readable.
- A reset reaches only its own process. With two instances, the other instance keeps its copy until the lifetime
  ends. The data cache's reset markers ([ADR 0006](adr/0006-reset-markers-for-the-data-cache.md)) make the data
  under a page correct in every process, but a stored page can't check a marker without a network read per hit.
- For share list pages, the 10 + 10 second lifetime bounds the old page in the other process. The reset clears only
  the writing process. There is no reset log or pub/sub.
- A deploy and a feature flag change restart the process, which empties the cache.

## Share list pages

The owner accepts at most 60 seconds of old anonymous HTML after an edit, hide, or delete, across all cache layers
and both webapp processes. Lifetimes provide the bound even when a reset is lost:

- **Layers:** each process has a page cache with 10 seconds fresh and 10 seconds stale, counted from the render's
  start. The view data cache in Valkey is shared by all processes, with 10 seconds fresh and 10 seconds stale.
  It has no in-process copy: every lookup reads Valkey. Crate supplies the rows.
- **Confirmed reset:** after `REFRESH TABLE`, the reset script deletes the value and writes a marker in one step in
  Valkey. Every subsequent lookup in every process misses the old value and reads Crate, or a new value read from
  Crate. A run that started before the reset cannot store because of the marker check, and later lookups cannot join
  it. A render that starts after the reset is correct in every process. The last old page leaves a store at most
  20 seconds after the reset. The writing process drops its pages at once.
- **Without a reset:** if Valkey did not confirm and the process exited, a timed-out write landed later, or someone
  changed rows by hand, the data is at most 20 seconds old plus the Crate read time. The page adds at most 20 seconds.
  The bound is **40 seconds plus the read time**. The 60-second target therefore leaves 20 seconds for that read.
- **Hidden and deleted lists:** an unlisted list answers `private, no-store` and is never stored. A deleted list
  answers 404 and is never stored. A background refresh that gets a 404 or redirect deletes the stored page.
  A refresh that gets a private 200 keeps the previously public stale page only until its 20-second deadline.
- **Members:** the owner and other members bypass the page cache and read the data cache, which the reset emptied.
  The owner sees the edit at once.
- **A cache in front:** it must honor `s-maxage=10, stale-while-revalidate=10` and the `Age` sent by the in-process
  cache. It then adds nothing beyond its own revalidation time. It is inside the 60-second target only if it counts
  `Age` and the read and revalidation times fit the remaining budget. No `stale-if-error` extends this lifetime.

Measured with two processes on one Valkey and requests every 0.1 seconds, three rounds each (see "Share list pages"
in [viral-spike-page-cache.md](benchmarks/viral-spike-page-cache.md)):

| Case | A member's request to either process | Last old anonymous page, either process |
| --- | --- | --- |
| The reset script runs | New page 0.1 seconds after the reset | 3.7 to 7.8 seconds after the reset |
| No reset | Old page until the data runs out | 23.7 to 27.3 seconds after the edit |

The reset reaches the other process with its next lookup, because the value is gone from Valkey. Under steady
traffic a stored page is replaced when its 10 fresh seconds end, so the old page leaves earlier than the bound.

## How to turn it off

Set `PAGE_CACHE=off` (or `0` or `false`) in the app's environment and restart. The app then doesn't install the
cache, and no response carries `GW-Page-Cache`. Without a restart there is no switch.

## Metrics

See "Page cache" in [viral-spike-metrics.md](benchmarks/viral-spike-metrics.md). The response header
`GW-Page-Cache` says `hit`, `stale`, `miss`, or `bypass` for every page request.

## What changes with two instances

- Each process has its own store. A hot URL renders once per instance.
- The balanced route's sticky cookie doesn't matter for anonymous pages: both instances store the same page for the
  same key and build.
- Resets are per process, as described above.

## What a cache in front must still do

The in-process cache removes the render. It doesn't remove the request: each hit still costs the proxy a connection
and the Node process about 0.5 ms. A cache in front must follow [cache-identity.md](cache-identity.md), and also:

- Send `GW-Cache-Identity`. Without it, the app answers `private, max-age=0` and the front cache stores nothing, while
  the in-process cache still answers from its own store.
- Key on the URL without the tracking parameters listed above, or accept one entry per click id. The app's answer is
  the same for all of them.
- Not store a response with `GW-Page-Cache: bypass`: it's a member's page or the gate's answer, and both say
  `private, no-store` anyway.
- Honor `Age` on a response from the in-process cache. Subtract it from the remaining lifetime instead of starting
  a new lifetime when the response arrives. Share list pages depend on this to stay within their staleness bound.
- Purge its own copies. `resetPageCache` doesn't reach it.
