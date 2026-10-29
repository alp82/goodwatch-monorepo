# Review edge caching and Cloudflare

Research date: October 29, 2026. Scope: [#784](https://github.com/alp82/goodwatch-monorepo/issues/784), ticket `cf`. This is a proposal, not an accepted architecture decision. No deployment, Cloudflare setting, DNS record, firewall, or production data changed.

## Recommendation

Keep the Free zone and proceed in this order. These are recommendations for the owner; no settings were changed.

1. **Enable Smart Tiered Cache on the zone now.** It is free and helps the existing static host independently of HTML proxying. Measured cold static edge fills take roughly 350–1,100 ms; hashed entry files change after every deploy, making those URLs cold again. An upper tier can reuse a fill across lower tiers. Optionally warm the new entry files after deployment; warming one location does not populate every edge. [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/).
2. **Proxy `goodwatch.app` with caching off, without a Worker.** First obtain the owner's acceptance of the whole-site outage dependency in [proposed ADR 0013](../adr/0013-proxy-site-through-cloudflare.md). Bypass caching for this hostname and preserve the static-host rules. Validate protocol, IP forwarding and rollback behavior before proceeding.
3. **Add the Worker and identity-keyed anonymous HTML caching.** Use Workers Paid, the origin's `Cloudflare-CDN-Cache-Control` policy, and a deployment purge step. Complete the identity hardening, static-fallback and runtime gates below before enabling storage. Start with query-free catalog documents; keep auth, MCP, APIs, loader requests and declared crawlers outside the shared cache. Do not buy Pro just for cache keys.
4. **For members, stop at phase 2 at the edge.** The Worker always bypasses their responses. The existing navigation cache remains the lever for fast member page changes.

Do not proxy TMDB pictures yet.

Proxying reduces the distance to the browser's TLS endpoint. A cache hit also removes the trip to Germany. Members and misses still need Germany, and a proxy can make a nearby visitor slower. This cannot promise instant loads everywhere: uncached rendering, member data, JavaScript execution, images, and network loss remain. Preserve the existing navigation cache for fast member page changes.

The owner must accept a new whole-site outage dependency. This conflicts with the failure isolation chosen in [ADR 0010](../adr/0010-static-hostname-with-server-side-fallback.md): the static hostname's automatic fallback cannot recover a document connection that fails at Cloudflare. Accept proposed ADR 0013 before phase 2; this document does not supersede ADR 0010.

## Evidence and limits

Read [cache identity](../cache-identity.md), [page cache](../page-cache.md), [navigation cache](../navigation-cache.md), [static assets](../static-assets.md), [serving architecture](../serving-architecture.md), ADRs 0005, 0007 and 0010, the navigation benchmark, and the benchmark instructions. The original runner measurements used sequential GETs with one second between samples; the supplied Globalping results also include static CSS HEAD probes. No application server or browser was started.

### Today's measured path

Three samples per URL on October 29, 2026, from this runner. Each `curl` process established a new HTTPS connection, negotiated HTTP/2, and downloaded the response without executing scripts. The static response reported `CF-Cache-Status: HIT` and the Frankfurt (`FRA`) edge. This does not locate the runner precisely or represent overseas visitors.

| URL | TTFB samples, ms | Median TTFB, ms | Median TLS established, ms | Median response complete, ms |
| --- | --- | --- | --- | --- |
| `https://goodwatch.app/` | 69, 84, 118 | 84 | 60 | 337 |
| `https://static.goodwatch.app/assets/tailwind-7NhRX5oA.css` | 88, 86, 88 | 88 | 47 | 135 |
| Same asset at `https://goodwatch.app` | 76, 82, 75 | 76 | 53 | 464 |

The document returned `private, max-age=0`, `Vary: Accept-Language`, and `GW-Cache-Identity: anon;US;en`. The asset returned `public, max-age=31536000, immutable`. Asset completion times include bytes and transfer encoding; they are not an HTML hit comparison. Here the CDN asset's median TTFB was 12 ms slower than the origin asset. These nine samples establish neither a regional distribution nor a percentile.

Requested remote measurement: GET to `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`, with `strategy=mobile&category=performance`, for the document and static asset. Both returned **HTTP 429 RESOURCE_EXHAUSTED**, with the anonymous project's daily quota set to zero. No `server-response-time` audit was returned. Raw timing and error records remain in `~/.cache/gw-perf/scratch-cf/`; they contain no committed infrastructure addresses. The [PSI API](https://developers.google.com/speed/docs/insights/rest/v5/pagespeedapi/runpagespeed) has no region-selection parameter, so even a successful audit would not establish US and Asia independently. A CSS URL also cannot substitute for a page Lighthouse audit.

Obtain a quota-enabled PSI project for the requested audit. Before running a successful PSI browser scan, resolve the GET-only constraint: page scripts can issue POSTs. Use controlled remote browsers with an outbound GET-only filter for reproducible regional comparisons, or obtain separate authorization for normal browser traffic. Do not replay writes or run load tests.

### Measured regional latency

Globalping probes on October 29, 2026 measured the origin movie document (`/movie/603-the-matrix`) and the cold static manifest (`/manifest.webmanifest`). Values are medians of three probes per region, supplied in `~/.cache/gw-perf/scratch-orch/findings.md` and the [#784 measurement comment](https://github.com/alp82/goodwatch-monorepo/issues/784). These are network probes, not browser or Lighthouse results.

| Region | Origin connect + TLS + first byte, ms | Origin first byte after TLS, ms | Cold static manifest connect + TLS + first byte, ms |
| --- | --- | --- | --- |
| Germany | 117 | 93 | 110 |
| New York | 289 | 96 | 345 |
| Los Angeles (California) | 464 | 152 | 551 |
| São Paulo (Brazil) | 595 | 198 | 559 |
| Tokyo (Japan) | 860 | 289 | 794 |
| Singapore | 591 | 195 | 543 |
| Sydney (Australia) | 798 | 265 | 959 |
| Mumbai (India) | 433 | 142 | 491 |

Origin first byte after TLS ranges from **93 to 289 ms**. Most overseas cost is connection setup to Germany: subtracting that column from the total gives 193 ms in New York, 312 ms in Los Angeles and 571 ms in Tokyo. The after-TLS interval still includes request transit and origin processing; it is not pure render time.

Separate static CSS HEAD probes, repeated three seconds apart, measured **350–1,121 ms** on cold edges (approximately 350–1,100 ms) and **9–30 ms** on warm edges. Cold results reported MISS or coalesced HIT; the second round reported HIT. A HIT label alone does not prove a warm, immediate response. These static timings demonstrate the warm/cold gap, not a measured HTML Worker hit. Cold fills can be slower than going directly to Germany. New hashed build URLs restart that cost after every deploy, which makes free Smart Tiered Cache the first action and entry-file warming an optional complement.

Secondary planning model: with origin processing `S`, client-to-Germany RTT `R`, client-to-edge RTT `E` and lookup `L`, new TCP/TLS connections give approximately `3R+S` direct, `3E+L` on an edge hit and `3E+R+S` on a miss with a reused upstream connection. A new upstream connection adds setup time. This model excludes DNS, download and rendering; use the measured table above for regional evidence. Long-tail URLs and locale fragmentation still require actual hit-ratio measurement.

## Request behavior after proxying

| Request | Proposed behavior | Benefit and required check |
| --- | --- | --- |
| Anonymous HTML | Worker computes the effective locale before CDN lookup. Cache only allowlisted successful catalog documents with the app's shared policy. | Near-edge hits; miss still renders in Germany. Home and query URLs enter a later phase after equivalence checks. |
| Member HTML | Bypass before lookup whenever an auth cookie is present, including empty values and chunks. Retain `private, no-store`. | Local TLS endpoint and upstream connection reuse only. Never share a member response. |
| Remix `?_data=` | Bypass initially, including anonymous requests. Root data can carry identity policy, but most leaf responses have no explicit HTTP caching contract. | Later allowlist complete catalog JSON by URL, route ID and identity. Never assume document policy applies to a leaf loader. |
| API POSTs | Pass method, body, cookies and status unchanged; no cache. | Limits and rate-limit identity can change. Never replay a mutation to test it. |
| MCP, OAuth, `.well-known`, auth APIs | Pass through; no challenges, cache or transformations. Preserve redirects, `WWW-Authenticate`, CORS and cookies. | Test stream negotiation, bearer auth, discovery, PKCE, callback and logout on isolated services. The Worker prototype does not cache these paths. |
| Streaming HTML | Stream origin response without reading or rewriting its body. | CDN fills may receive the complete stream later; first-byte delivery must stay streaming. |
| SSE and WebSocket | Bypass. Keep heartbeats and reconnect behavior. | Cloudflare supports WebSockets, but deployments can interrupt connections; clients must reconnect. Test SSE buffering and idle behavior. [WebSockets](https://developers.cloudflare.com/network/websockets/). |
| OG images | Bypass in phase 3 initially. Later cache only audited public cards by full URL and explicit origin policy. | Existing catalog OG policy is one day in the browser, seven days shared, plus a day stale. Private lists and errors must stay excluded. |
| Sitemaps and robots | Bypass initially. Later give sitemap GETs a short explicit TTL and purge after updates; keep robots under owner control. | Faster crawler reads without delaying removals. No blanket XML caching rule. |
| 103 Early Hints | Treat as a rollout gate, not transparent pass-through. | Existing Traefik hints vary with device/AVIF and remembered hero. Cloudflare harvests final `Link` headers, ignores query strings in its hint key, and may emit before auth or Worker execution. Use only stable public hints; confirm phone/desktop, CORS mode and deploy hashes. [Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/). |
| HTTP/3 | Enable browser-to-edge HTTP/3. | All plans support it. It does not enable HTTP/3 to the origin. Browser discovery and UDP availability govern first use. [HTTP/3](https://developers.cloudflare.com/speed/optimization/protocol/http3/). |
| Connections to `static` | Both hosts terminate at nearby Cloudflare edges. | Cross-host coalescing is possible only when browser, certificate, addresses and credential partition permit it. Do not promise a single connection: existing CORS and non-CORS image paths may keep separate connections. Verify with browser network traces. |

Cloudflare currently documents a **125-second proxy read timeout**, not the ticket's historical 100 seconds, and a 30-second proxy write timeout. Free/Pro upload limit is 100 MB. Workers do not remove the upstream limits merely by streaming. Use asynchronous jobs for long work and heartbeat streams well inside idle limits. [Connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Features, plans and costs

Cloudflare's zone subscription and Workers subscription are separate. Free costs $0; Pro costs $20/month billed annually or $25/month billed monthly. Pro does not include Workers Paid. [Zone pricing](https://www.cloudflare.com/plans/).

| Feature | Free zone | Pro zone | Workers Paid and fit |
| --- | --- | --- | --- |
| Cache Rules | 10 | 25 | Not a zone upgrade; both plans suffice for this proposal. [Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/). |
| Custom keys with chosen cookies or arbitrary headers | Enterprise feature | Enterprise feature | `cf.cacheKey` also needs Enterprise. Do not purchase Pro for it. Selected header values have further restrictions. [Cache keys](https://developers.cloudflare.com/cache/how-to/cache-keys/). |
| Explicit response `Vary` handling | Available when configured | Same | Worker subrequest `cf.vary` config is the useful alternative. See below. |
| Worker gateway | Workers Free allowance possible | Same | Paid recommended to avoid a daily availability ceiling. |
| Cache API (`caches.default`) | Available through Workers | Same | Per data center; no Tiered Cache or automatic SWR/SIE. Avoid for this design. [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/). |
| Native Worker `fetch` cache | CDN cache | Same | Supports the CDN path and Tiered Cache, with computed identity supplied before lookup. |
| New Workers Cache | Separate mechanism | Same | Can answer before Worker execution. Leave disabled: an identity computed inside the Worker cannot protect a preceding lookup. [Workers Cache](https://developers.cloudflare.com/workers/cache/). |
| Tiered Cache | Smart topology available | Same | Native fetch can use it; Cache API cannot. Enable free Smart topology in phase 1; paid Smart Shield features are separate. [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/). |
| Smart Placement | Availability depends on current product entitlement | Same | Leave default edge placement. Backend-near placement is for heavy upstream work, not a small identity gateway. [Placement](https://developers.cloudflare.com/workers/configuration/placement/). |
| Argo / Smart Shield | Optional paid service | Optional paid service | Helps misses, not cache lookup latency. Current packaging starts at $5/month; confirm transfer pricing at checkout. [Plans](https://www.cloudflare.com/plans/), [Smart Shield](https://developers.cloudflare.com/smart-shield/get-started/). |
| Early Hints, HTTP/3, 0-RTT | Available | Same | Enable HTTP/3; gate hints; keep 0-RTT off pending replay review. |
| Compression | gzip/Brotli; configurable Zstd | Same | Keep content compression, inspect actual `Content-Encoding`. Do not change the app's rendering. [Compression](https://developers.cloudflare.com/speed/optimization/content/compression/). |
| Polish | Unavailable | Included | Compresses images and can serve WebP; no general resizing/AVIF replacement. [Polish](https://developers.cloudflare.com/images/polish/). |

### Vary no longer requires Enterprise

The statement that Cloudflare ignores most `Vary` values remains true **by default**, but current docs provide configurable `Vary` handling on all plans. Arbitrary Enterprise custom cache keys are a different feature. Explicit `passthrough` for `gw-cache-identity` keys on the raw bounded value. Set the default to `bypass`, normalize `accept-encoding`, and bypass responses with unexpected dimensions. Header configuration names must be lowercase; `cf-*` names and several proxy headers are forbidden. Never key raw `Cookie` or raw `Accept-Language`: those fragment the cache and do not reproduce the app's negotiation. [Vary](https://developers.cloudflare.com/cache/concepts/vary/), [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/#vary).

The prototype uses `fetch(request, {cf: {cacheEverything: true, vary: ...}})`. `cf.vary` overrides zone Vary settings for that subrequest and requires a matching origin `Vary` response header. It excludes non-200 statuses using negative status TTLs and never forces a positive TTL. Validate that this recently added feature exists in the actual account and runtime before enabling caching; unsupported or ignored configuration is a release blocker, not permission to fall back to URL-only caching. [Request API](https://developers.cloudflare.com/workers/runtime-apis/request/#the-cfvary-property).

Enterprise custom keys can include chosen cookie values or cookie presence, except Cloudflare `__cf*` cookies. They cannot include raw `Cookie` as a header dimension. Restricted header keys (`accept`, `accept-charset`, `accept-encoding`, `accept-datetime`, `accept-language`, `referer`, `user-agent`) require one to ten selected values and use case-sensitive substring matching. Custom headers can use full values. Free/Pro still allow cookie predicates to bypass caching; that does not grant selected-cookie cache keys. Explicit `Vary: Cookie` passthrough is likewise different and would key the full header, so this proposal avoids it. [Custom key restrictions](https://developers.cloudflare.com/cache/how-to/cache-keys/).

### Limits and budget

Workers Free allows 100,000 requests/day and 10 ms CPU per invocation. Workers Paid starts at $5/month with 10 million monthly requests and 30 million CPU milliseconds, then $0.30/million requests and $0.02/million CPU milliseconds. At 15 million invocations and 7 ms average CPU, the illustrative monthly cost is `$5 + $1.50 + $1.50 = $8`. A route on the whole hostname also counts bypass traffic; this is not just the number of HTML hits. Exclude bandwidth add-ons and image services from that example. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Both plans allow 128 MB memory per isolate. Paid default CPU is 30 seconds, configurable to 300 seconds; set a much smaller application budget. Network wait does not count as CPU. Free/Pro cacheable objects have a 512 MB ceiling, not reserved cache capacity. Cached entries may be evicted early; there is no promised resident catalog size. No body buffering belongs in this gateway. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [cache retention](https://developers.cloudflare.com/cache/concepts/retention-vs-freshness/).

Keep Rocket Loader, Speed Brain, HTML rewriting, Cloudflare Fonts and automatic speculative loading off during this work. The application already controls module order, fonts, preloads and navigation prefetch. Mirage retired in September 2025; Auto Minify and the old Brotli toggle/API were deprecated in 2024. Do not look for obsolete switches or enable replacements automatically. [Mirage](https://developers.cloudflare.com/speed/optimization/images/mirage/), [API deprecations](https://developers.cloudflare.com/fundamentals/api/reference/deprecations/).

## Design and origin prerequisites

Source: [`goodwatch-edge/worker.ts`](../../goodwatch-edge/worker.ts). The configuration has no route, disables previews and `workers.dev`, and defaults `ENABLE_CACHE=false`. It imports the real app identity function rather than maintaining a second negotiation implementation. `nodejs_compat` supplies `process.env`; configure the same public `SUPABASE_URL` value as the origin for exact project-cookie matching. Never copy the production `.env`. Unknown cookie names also bypass, including other projects' auth cookies. Reviewed Cloudflare operational cookies are allowlisted so bot management, clearance, load balancing and waiting-room cookies do not silently disable caching. Cloudflare Access authentication cookies remain excluded. [Cloudflare cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/). The Worker adds `GW-Edge: hit|miss|bypass-<reason>` after native fetch without consuming the body. HIT, STALE, UPDATING and REVALIDATED map to hit; MISS and EXPIRED map to miss. Other or absent CDN statuses report `bypass-origin-policy`. Request bypasses report bounded reasons such as identity, cookie, query or disabled, without cookie values or URLs. Use these outcomes to measure hit ratio alongside native status and latency; they do not prove a warm hit.

Phase 3 initially admits only query-free movie, show, person, Discover, people, hot-on-socials and blog HTML GETs. It preserves cookies on misses, strips the supplied identity even on bypass, computes country/language from validated `gw_loc` or `Accept-Language`, and injects the result before native CDN lookup. It never uses Cloudflare geolocation for the identity: changing from browser-region negotiation to IP geography would change content and violate equivalence. Keep full query bytes and all semantic parameters when expanding later; tracking removal must match the origin and remove tracking before rendering, not just from the key.

The origin remains the final sharing authority: successful anonymous responses require the shared policy, matching identity and `Vary`; `Set-Cookie`, incomplete pages, errors, members and private routes prevent storage. Origin Cache Control is mandatory and enabled by default on Free/Pro. Never force cache TTLs or strip cookies to make a response eligible. [Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/).

Phase 2 needs no Worker and keeps caching off. Before phase 3, implement these three changes:

1. **Harden identity header trust at the caching cut-over.** `cacheIdentityOf` accepts a valid anonymous identity header, and its tests explicitly verify overrides. Without a shared cache in front, a forged header yields a public response that nothing stores; this is not a blocker for the current direct path or the proxy-only phase with caching off. At the phase 3 cut-over, the Worker overwrites it, but a direct-origin caller can still inject it. Harden that boundary before enabling shared storage. Strip it at public origin ingress unless an edge-authenticated request supplied it. Use authenticated origin access or a validated edge credential; Cloudflare address ranges alone identify the network, not this zone. Keep direct-origin requests functional with ordinary browser negotiation for DNS-only rollback. Do not trust an arbitrary forwarded header or disclose the credential.
2. **Define Cloudflare stale behavior explicitly.** Current Cloudflare docs say `s-maxage` implies revalidation and prevents serving stale. The app's `s-maxage=1800, stale-while-revalidate=7200` therefore does not by itself promise edge SWR. On **shared responses only**, emit `Cloudflare-CDN-Cache-Control: public, max-age=1800, stale-while-revalidate=7200, stale-if-error=86400` before CDN fetch caching. Derive shorter lifetimes from `pageLifetime`; never put this on private, unset, incomplete, cookie-setting or non-200 responses. Preserve the current browser `Cache-Control: ... max-age=0` and identity `Vary`. Retain a bounded stale-if-error window for shared catalog pages: Cloudflare uses it for origin 5xx errors, while a 404 replaces the stale entry rather than extending removed content. Verify the negative-status bypass interaction in the runtime test. Removal still needs a purge so a fresh entry or an SWR response cannot delay it. A Worker response edit after `fetch()` is too late to control that fetch's cache fill. [Stale control](https://developers.cloudflare.com/cache/concepts/cache-control/#revalidation), [CDN-specific policy](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/).

3. **Preserve static-host fallback semantics.** The origin page cache keys on its selected asset base; a CDN entry keyed only on URL and locale cannot notice a later switch to origin assets. Even while the HTML edge works, a partial static-host outage can leave cached documents pointing at failed assets for their entire lifetime. Before enabling HTML caching, connect asset-mode transitions to an edge invalidation or version mechanism, or have the owner explicitly accept loss of the automatic fallback for cached HTML and amend ADR 0010. A manual purge runbook alone does not preserve the existing unattended fallback. This prototype does not implement that signal.

The app's existing page cache also retains stale HTML. CDN freshness must account for upstream `Age`, not restart a complete lifetime on every origin-cache hit. Verify age propagation and expiry with controlled timestamps, including upstream stale answers. If it resets age, shorten edge TTL or fix the origin contract before rollout. No cross-isolate locking, cache purge automation or deploy generation is implemented in this prototype.

## Downsides and mitigations

| Risk | Concrete effect | Mitigation and gate |
| --- | --- | --- |
| Whole-site outage dependency | Cloudflare failure can block HTML, members, APIs and MCP. Static fallback cannot help. | Owner accepts risk; rehearse DNS-only rollback. Keep public origin certificate valid and direct serving functional. |
| Lost client IP | Rate limits can collapse users onto edge addresses, or trust a forged first `X-Forwarded-For` entry. | Worker replaces XFF with edge-provided `CF-Connecting-IP`. Configure Traefik `forwardedHeaders.trustedIPs` narrowly, never `insecure=true`; normalize/sanitize headers on direct ingress too. App auth currently trusts XFF; several quota modules take its first entry. Verify proxy trust and logs without exposing addresses. [Cloudflare headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [Traefik](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/). |
| Geo mismatch | `CF-IPCountry` differs from the current browser preference contract. | Keep geography out of identity. Review analytics separately. |
| Auth leakage | Cache-everything could answer a member from anonymous data or retain private content. | Request-time auth/unknown-cookie/Authorization bypass; origin `private, no-store`; no positive TTL override. Test both request orders and all cookie chunks. |
| Poisoned identity or variants | Raw client identity or omitted query dimensions can cross locale/content boundaries. | Overwrite header, secure origin ingress, explicit Vary passthrough, query bypass initially, exact host/path allowlist. Reject release if two locales ever share an entry. |
| Crawlers blocked or altered | Bot challenges, AI blocks or managed robots can hide pages and MCP tools. | Keep Bot Fight Mode off initially; it cannot be skipped by WAF rules. Allow verified search bots; make AI policy explicit. Leave AI Labyrinth, blanket AI blocking and managed robots off pending owner decision. Never allow solely by a spoofable UA string. [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/), [bot settings](https://developers.cloudflare.com/api/resources/bot_management/). |
| Canonical crawler divergence | Current app keys canonical crawler rendering separately and suppresses shared policy for bots. | Worker uses the same `isbot` dependency and bypasses crawlers before lookup. Verify HTML equivalence and status codes. |
| Stale deployment or removed data | Old documents reference old chunks; deletion/reset markers do not invalidate edge HTML. | Coordinated purge, old chunk retention, short TTLs for mutable content; no list/profile caching initially. Keep bounded stale-on-5xx availability for shared catalog pages; purge removals promptly. |
| New limits | Large imports, slow OAuth/MCP, idle SSE may fail. | Audit known maximum bodies/durations, isolated streaming tests and reconnects. Do not increase timeouts by assuming Workers bypass origin proxy limits. |
| Early Hints regression | Wrong phone hero, obsolete asset hashes, private link disclosure or missed 103. | Compare traces before enabling hints; generic public links only; test query collisions and deploy rollover. |
| 0-RTT replay | GET callbacks and other nominal reads may have effects. | Keep off until GET/HEAD/OPTIONS replay safety is established. Cloudflare excludes POST but not every state-changing GET. [0-RTT](https://developers.cloudflare.com/speed/optimization/protocol/0-rtt-connection-resumption/). |
| Privacy and processing location | TLS terminates at Cloudflare; it processes request URLs, IPs, auth cookies and bodies, including bypassed traffic. | Review DPA, disclosure and retention. Avoid cookie/body logs, tokens in query strings and personalized cache tags. A bypass is not a privacy bypass. [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/). |
| Static-host fallback delayed | A cached document retains the old static asset base after an origin probe switches modes. | Automated edge invalidation/versioning tied to asset mode, or explicit owner acceptance of changed ADR 0010 behavior; release blocker otherwise. |
| Lower hit ratio or extra hops | Long-tail pages, locales and bots still hit Germany. | Measure by region/audience; retain local page cache; enable free Smart Tiered Cache first and measure cold fills. |

## Pictures

**No to a blanket Free/Pro CDN proxy today. Conditional yes to a paid Images experiment after license review and measurement.** TMDB already delivers pictures through its own CDN. Reusing `static.goodwatch.app` can save a connection, but introduces another dependency and may worsen a cold miss. It cannot be assumed to improve LCP.

TMDB's current public agreement, updated October 20, 2023, limits API content caching to six months (section 1C), reserves derivative rights (1A), requires a separate agreement for commercial use (2A), and requires deletion of cached content after termination (1D). This is not proof that GoodWatch's accepted agreement permits proxying, recompression or AVIF conversion. The owner must confirm the applicable license and rights to images before changing delivery. Read via an ordinary GET because the research browser was blocked by robots. [TMDB API terms](https://www.themoviedb.org/api-terms-of-use), [TMDB FAQ and attribution](https://developer.themoviedb.org/docs/faq).

Cloudflare's CDN terms reserve restrictions on disproportionate picture delivery unless covered by specific paid services. Pro alone is not a general image-CDN license. The terms identify paid Developer Platform, Images and Stream services; Workers Paid may be an eligible service, but neither Free Workers nor a Worker proxy should be presented as an unlimited image-delivery loophole. Confirm the intended usage with Cloudflare if relying on a Workers-only arrangement. [Application Services terms](https://www.cloudflare.com/service-specific-terms-application-services/).

Cloudflare Images remote transformations support resizing and `format=auto` for AVIF/WebP. Free includes 5,000 unique transformations/month, then new transformations fail rather than incur automatic overage. Paid includes 5,000 then charges $0.50 per 1,000; 100,000 unique source/parameter transformations would be $47.50. Remote transformations do not incur hosted-image storage/delivery fees. Hosted Images separately costs $5 per 100,000 stored images and $1 per 100,000 deliveries. Restrict sizes: every source/size combination can consume a transformation. [Images pricing](https://developers.cloudflare.com/images/pricing/).

A permitted trial should allowlist TMDB image paths and a few responsive widths on `static`, reject arbitrary URLs and redirects, strip cookies, bound object sizes, preserve CORS, set a short explicit TTL, and support immediate takedown/purge. Do not request image resizing through the existing static file-only origin router without a separate route. Preserve existing `gw-cors=1`, responsive widths and Early Hints URLs consistently. Compare visual quality, image bytes, LCP and cold misses against direct TMDB. Use application-owned images first if licensing remains unclear.

## Other cache layers

Keep browser documents at `max-age=0` and member data at `private, no-store`. Raising document freshness would add a browser cache that cannot be centrally purged or reliably partitioned by the server's computed locale. The [navigation cache](../navigation-cache.md) already keeps identity-scoped catalog data for 60-second forward navigation and up to ten minutes of history, invalidates on writes/auth/locale changes, and refreshes stale history in the background. Preserve that behavior.

Anonymous `_data` SWR is a separate follow-up. Audit each loader for complete, anonymous, locale-correct JSON and explicit cache policy. Key by the full URL including `_data`, country and language; bypass members and preserve `X-Incomplete-Page`. Avoid browser `public, max-age` on root data: auth can change while its URL stays the same. Do not add a second broad browser SWR mechanism that bypasses the navigation cache's invalidation rules.

Do not add a service worker for this ticket. It can cache an app shell and offer offline reads, but creates a persistent auth/locale/deploy cache, complicates streaming and logout across tabs, and can replay writes. It needs its own lifecycle and privacy design; it is not needed to use the CDN.

Speculation Rules prerender can make a likely next **document navigation** appear instant in Chrome. It does not prerender a Remix client-side route transition. Consider a later conservative, same-origin catalog-only trial after idle, with Data Saver/memory limits and activation-aware analytics. Exclude member, OAuth, My shows and stateful GET routes; hidden prerenders execute scripts and may send writes. Do not compete with current intent-based loader/module prefetch. [Chrome next-page guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/performance/improve-next-page-load-performance), [prerender behavior](https://developer.chrome.com/docs/web-platform/prerender-pages).

Static source search found no first-party `unload` or `beforeunload` handlers in `goodwatch-webapp/app`; that does not prove third-party runtime eligibility. Member documents use `private, no-store`. Modern Chrome can admit some `no-store` pages into bfcache, but cookie changes, no-store fetches and certain connections can evict them, with a shorter lifetime. Do not weaken member privacy headers merely to obtain bfcache. Test DevTools' bfcache report and `pageshow.persisted` on isolated guest/member sessions, including logout and account switches; retain the existing pageshow auth synchronization. [Chrome no-store policy](https://developer.chrome.com/docs/web-platform/bfcache-ccns), [DevTools bfcache test](https://developer.chrome.com/docs/devtools/application/back-forward-cache/).

## Owner rollout settings

These are proposed future actions. Nothing below was applied. Dashboard labels follow current documentation and may move.

### Phase 1: Improve the existing static host

Enable **Caching > Tiered Cache > Smart Tiered Cache** on the Free zone. Keep the existing static rules and automatic origin fallback. Optionally warm a bounded list of the deployed build's entry CSS and JavaScript files after deployment. Compare cold fills and origin traffic; do not assume warming reaches every lower tier. Leave paid Argo/Smart Shield add-ons off until measurements justify them.

### Phase 2: Proxy without caching or a Worker

After owner acceptance of proposed ADR 0013, record the current configuration privately and prepare DNS-only rollback. Confirm direct-origin TLS and the active edge certificate. Change only the site's DNS record to **Proxied**, keep its target, and select **Full (strict)**. Add a hostname-scoped cache bypass for `goodwatch.app`, remove conflicting overrides, and keep the static-host rules. No Worker route is needed. Preserve browser cache headers.

Configure trusted Cloudflare client-IP forwarding at ingress before the comparison; the phase 3 Worker cannot fix phase 2 IP handling. Validate redirects, OAuth, MCP, SSE, WebSockets, large requests and timeouts on isolated services. Keep **HTTP/2** and **HTTP/3** enabled, **0-RTT** off, and upstream keep-alive. Keep Rocket Loader, Speed Brain and Early Hints off during the first comparison. Review existing security rules so OAuth, APIs and verified crawlers remain usable. Keep Bot Fight Mode and Under Attack Mode off for the trial; leave AI blocking, AI Labyrinth and managed robots pending owner policy. Preserve existing security protections.

### Phase 3: Cache anonymous catalog documents

Complete the identity, CDN-specific stale-policy, asset-fallback and purge gates. Configure the reviewed Worker as a **zone route** `goodwatch.app/*`, with `ENABLE_CACHE=false`, `nodejs_compat` and only the public Supabase URL needed for cookie matching. Use Workers Paid; leave Smart Placement and pre-Worker Workers Cache off. Fail closed while header trust depends on Worker sanitation.

Replace the phase 2 hostname bypass only when the nonproduction integration checks pass. Audit all matching Cache Rules so none override Worker eligibility or private origin policy. The Worker controls caching and Vary on its subrequests. Keep Browser Cache TTL at **Respect Existing Headers** and Always Online off. Deploy the origin's `Cloudflare-CDN-Cache-Control` policy and the coordinated deploy purge step, then enable query-free catalog caching with `ENABLE_CACHE=true`. Observe `GW-Edge`, native cache status, errors and latency. Expanding home, queries, loader data, OG images or sitemaps needs its own inventory and tests.

### Phase 4: Keep member acceleration in the navigation cache

Members receive only phase 2's connection/proxy behavior. Keep member HTML and data private and outside shared edge storage. Improve subsequent member page changes through the existing [navigation cache](../navigation-cache.md).

## Validation, invalidation and rollback

Run the following without production writes:

- Unit tests: `node --test goodwatch-edge/worker.test.ts goodwatch-webapp/app/server/cache-identity.test.ts`. Result here: **23 passed**. Fixtures port the app's locale and auth cases and are checked against both entry points; saved locales, malformed/duplicate cookies, spoofed identity, member chunks, bots, conditional requests and protocol bypasses are covered.
- Bundle: `goodwatch-webapp/node_modules/.bin/esbuild goodwatch-edge/worker.ts --bundle --platform=browser --format=esm --outfile="$HOME/.cache/gw-perf/scratch-cf/worker-bundle.js"`. Result here: **17.1 KiB**, without body rewriting or Node database imports. The isolated TypeScript check also passed. These checks do not prove Cloudflare runtime caching.
- On an isolated origin with synthetic data and loopback-only endpoints, test origin/cache hit ordering for US/en, DE/de, saved `gw_loc`, cookies with empty auth values and numeric chunks, Authorization, errors, redirects, Set-Cookie and incomplete pages. Assert distinct bodies and cache entries, never a shared member response. Revalidation must not replace a public entry with private data. Test native `cf.vary`, negative status TTLs, default unknown-Vary bypass and ignored-configuration detection on a nonproduction Cloudflare test zone before rollout.
- Check streaming first byte, no accidental buffering, failed upstream refresh, age accounting, TTL expiry and concurrent misses. Compare browser/crawler HTML with `goodwatch-benchmark/html-equivalence/run.sh`, plus mobile/desktop Early Hints, CORS and current build hashes. Use `env -i`, explicit empty keys, loopback endpoints, blocked egress and disabled background jobs for any future local server. No production `.env`.
- Obtain regional cold/warm connection traces from Europe, US and Asia on the isolated setup. After owner approval, perform at most two concurrent production GETs, without load or browser writes. Track TTFB by region, hit/miss, locale and audience, plus errors and incomplete pages. Do not infer Lighthouse/SEO improvement from these unit tests.

**Purge contract before caching is enabled:** make the owner-approved deployment procedure purge all cached variants of changed HTML after all instances serve the new build. Keep old hashed assets available for at least the document stale horizon. An early purge while old instances remain can refill old HTML. Whole-zone purge is a conservative fallback and also chills static assets. Verify current purge rate limits; current docs state that purge by URL removes all configured Vary variants. Verify this behavior for the identity header in the test zone and distinguish it from Enterprise custom cache keys, which have separate header requirements. Use URL purge for this Vary design, with whole-cache purge as a tested fallback. `cache.delete` is not a global purge. [Vary purge behavior](https://developers.cloudflare.com/cache/concepts/vary/), [custom key purge](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-cache-key/).

For data changes, map catalog URLs and their variants to the same owner-operated purge mechanism, including removal/privacy changes. Existing Redis reset markers and per-process `resetPageCache` do not reach the edge. If reliable purge is unavailable, use much shorter edge lifetimes and do not cache sensitive or rapidly mutable resources. Lists/profiles stay bypassed in this design.

**Fast rollback:** set `ENABLE_CACHE=false` or remove the Worker route if the problem is cache-specific and Cloudflare is reachable. Purge cached HTML variants after fixing the cause. For a proxy outage or broad behavior regression, change the site's DNS record back to **DNS only**, leaving `static` and its automatic server fallback intact. DNS propagation and cached edge addresses make this a minutes-scale recovery, not instantaneous failover. Keep direct-origin TLS and ingress available; an origin restricted to Cloudflare-only access must be safely reopened as part of the prepared rollback. If the Cloudflare dashboard/API is down, the toggle may be unavailable. DNS-only is a fast operational option, not an independent availability guarantee.

No Cloudflare runtime, real member session, regional browser, data-change purge, HTML-equivalence server or PSI audit could be verified in this research-only task. The supplied Worker is reviewable design code with tests, not ready-to-enable infrastructure.

## Owner decisions

1. Accept the whole-site Cloudflare dependency, or retain DNS-only HTML and its current failure isolation?
2. Approve Workers Paid and a monthly spend/CPU alert threshold, or accept the Free daily cap for a nonproduction trial only?
3. Assign the origin trust/IP changes, Cloudflare-specific stale policy, asset-fallback coherence and deploy/data purge contract before rollout.
4. Choose anonymous catalog freshness and stale/error tolerance. Initial proposal: 30 minutes fresh, up to two hours background revalidation, up to one day stale on origin 5xx; shorter lifetimes for mutable data.
5. Decide which AI crawlers may read the site and whether any automated robots changes are acceptable.
6. Confirm TMDB commercial and transformation rights and a paid image budget before a picture experiment.
7. Provide quota-enabled PSI access and a safe, region-controlled measurement route; approve Smart Shield/Argo only after those measurements justify it.
