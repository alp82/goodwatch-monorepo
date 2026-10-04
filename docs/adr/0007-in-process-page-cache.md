---
status: accepted
---

# Cache rendered anonymous pages in the webapp process

The webapp keeps complete anonymous HTML documents in the memory of its Node process and answers repeated requests
for them before Express and Remix. Decided on October 4, 2026, as part of the map "Serve a viral traffic spike". How
it works, with its numbers: [page-cache.md](../page-cache.md). Who may get a stored page:
[ADR 0005](0005-cache-identity-for-anonymous-html.md).

A warm title page costs about 41 ms of the process's one main thread, so one process renders about 20 title pages
per second. The map's destination is 500 page views per second, mostly for one or a few URLs. The owner ordered the
work from the inside out: caches below the request level come before a cache in front.

## Choices

- **Inside the process, before Express.** A hit costs one map lookup and one write: 0.5 to 0.8 ms of main-thread
  time, against 14 to 63 ms for a render. One process answers one hot URL more than 1,300 times per second.
- **The cache identity is the only rule for who may use it.** A request with the auth cookie never reads, writes,
  counts, or waits. The cache takes the gate's decision again with the gate's own function, so that the order of the
  wrappers can't matter.
- **The page's own `Cache-Control` decides what is stored.** Only a 200 document with the `keyed` or `shared` policy
  is stored. Share list pages are private today and aren't stored. A title page that left out its related panel or
  an extra answers `no-store`, so no cache keeps the gap.
- **Only repeated URLs are stored:** the second request within 60 seconds. In production, 97% of page URLs are
  requested once in 14 minutes, and this rule admits 1.1% of them.
- **Tracking parameters aren't in the key, and the app doesn't see them.** `utm_*`, `fbclid`, `gclid`, and the other
  click ids differ per visitor on exactly the URL that goes viral. Some pages copy the query string into links, so
  the app must not render with them: one visitor's click id would reach everyone.
- **One render per key.** Requests for a repeated URL wait for the render in flight instead of rendering. A stale
  page is served while one background render replaces it.
- **Lifetime from the response's policy:** 30 minutes fresh, 2 more hours stale while a refresh runs.
- **Bounded:** 128 MB and 2,000 pages, least recently used first.
- **The app's own render fills the store.** The server entry hands the finished HTML to the cache. The stored bytes
  are that render, compressed once per encoding on the thread pool.
- **No Redis tier.** See below.

Rejected:

- **A second tier in Valkey.** It would save one render per instance and URL after a deploy: about 50 ms of
  main-thread time, once. It would cost a network read on the first request of every URL, about 106 KB per page in a
  cluster that is near its memory limit, and a reset path across processes. With two instances, a deploy costs two
  renders per hot URL without it.
- **Storing every page.** The long tail is 240,000 titles a day at about 106 KB each: 25 GB a day for pages that
  nobody asks for twice.
- **Rendering stored pages from a synthetic request without cookies.** It would prove that nothing from the visitor
  is in the page, but it runs a GET a second time, which isn't safe for every route (a sign-in callback).
- **Negative caching** of 404 pages and redirects: ADR 0005 already says no.

## Consequences

- A hit skips Express, so it writes no request log line. The metrics count it with its route.
- A deploy empties the cache. Each instance renders a hot URL once after it starts.
- A reset reaches only the process that gets the write. Nothing that is stored today has a reset path. Before share
  list pages become cacheable, they need a short lifetime of their own or a reset that reaches every process.
  [ADR 0006](0006-reset-markers-for-the-data-cache.md) guards the data cache with markers in Valkey, which a stored
  page can't check without a network read per hit.
- A stored title page carries the time of its render in the related panel's query state. The client treats that data
  as never stale, so it doesn't request the panel again.
- A page for a visitor who arrives with tracking parameters is rendered without them. Links that copy the query
  string don't carry them. The browser's address bar and analytics still do.
- A cache in front still has to be built for the request rate itself: each hit costs the proxy a connection and the
  process about half a millisecond.
- `PAGE_CACHE=off` and a restart turn it off.

Evidence: the resolution of the ticket "Cache rendered anonymous pages in the process for repeated URLs", and
[viral-spike-page-cache.md](../benchmarks/viral-spike-page-cache.md).
