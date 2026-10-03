# Page cache layers, hosted and self-hosted

Researched 2026-10-03 for [Research: page cache layers, hosted and self-hosted](https://github.com/alp82/goodwatch-monorepo/issues/242), a child of [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237). It feeds [Choose the page cache layer](https://github.com/alp82/goodwatch-monorepo/issues/253).

Scope: public vendor docs, pricing pages, status pages, post-mortems, and project docs. No accounts were created and no configuration was changed. Nothing here was load tested.

## How to read this document

- Each claim links to the page that owns it.
- **Unverified** means no primary source confirmed the claim. Treat it as a hypothesis to test.
- **Inference** means reasoning from a quoted behaviour, not a vendor statement.
- Prices are list prices on 2026-10-03.

## Answer

Put a self-hosted Varnish cache between Coolify's proxy and the app. It is the only option that honours the headers the app already sends, costs nothing, and has no third party in the request path. One spare core serves the target load many times over.

Self-hosting cannot do two things: absorb an application-layer attack larger than the host, and serve far-away visitors from a nearby location. A hosted CDN in front covers both. If the owner wants that cover, Bunny.net is the best fit: about 1 USD per month, DNS stays at Namecheap, and a DNS change turns it off. Cloudflare Free absorbs more for less money, but it takes over DNS, it ignores two of the app's current headers, and it had two global outages in the last 12 months that would have taken the site down.

The origin cache is worth building in every case. A CDN caches per location, so a spike from many regions still sends many misses to the origin. The origin cache collapses those into one render.

One finding applies to every option: the app's `Vary: Cookie, Accept-Language` header prevents effective caching everywhere. See [What the app must change first](#what-the-app-must-change-first).

## Facts about the site that shape the answer

Measured on 2026-10-03 and 2026-10-04 with `curl` against production.

| Fact | Value | Consequence |
| --- | --- | --- |
| DNS host | Namecheap (`dns1.registrar-servers.com`), A record TTL 1800 s | A DNS bypass takes up to 30 minutes unless the TTL is lowered first. |
| Hostname | Apex `goodwatch.app`, and `www` on the same address | Bunny has no apex address. Fastly's apex addresses need a paid plan. |
| Home HTML | 16 KB with Brotli | |
| Title page HTML | 60 KB with Brotli | 500 requests per second is 30 MB/s, or 240 Mbit/s, or 108 GB per hour. |
| OG image | 650 KB to 720 KB PNG, `s-maxage=604800` | Large for a link preview. Only preview bots fetch it, not browsers. |
| Anonymous HTML headers | `Cache-Control: max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400` on title pages. The home page sends `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200`. | The two routes differ. The ticket text describes the home page variant. |
| `Vary` | `Cookie, Accept-Language, Accept-Encoding` | See the next section. |
| `Set-Cookie` on anonymous HTML | None seen on the home page | Good. Every cache refuses or mishandles responses that set cookies. |
| Country | `resolveCountry` in `goodwatch-webapp/app/server/country.server.ts` reads the region of `Accept-Language` (`de-DE` gives `DE`), then falls back to `US` | The cached HTML differs by country. |
| Auth cookie | `sb-<ref>-auth-token`, also chunked as `sb-<ref>-auth-token.0`, set in `goodwatch-webapp/app/utils/auth.ts` | The bypass rule must match a prefix, not an exact name. |
| Other cookies | PostHog and gtag run in `root.tsx`, and a browser-check cookie exists | Anonymous visitors carry cookies, so `Vary: Cookie` splits the cache per visitor. |

## What the app must change first

`Vary: Cookie` tells a cache to store one copy per distinct `Cookie` header. Analytics cookies are unique per visitor, so a cache that honours `Vary` gets a hit rate near zero. A cache that ignores `Vary` serves one visitor's country to everyone.

Every layer in this document needs the same three rules. Where the rules live differs per layer.

1. **Bypass on the auth cookie.** A request that carries a cookie whose name starts with `sb-` and contains `-auth-token` goes to the app and is never stored.
2. **Drop all other cookies from the cache key.** Either the cache strips the `Cookie` header on anonymous requests, or the app stops sending `Vary: Cookie` on anonymous HTML.
3. **Reduce `Accept-Language` to what the page uses.** The page uses one thing: a two-letter country. The cache key must contain that country, not the raw header. Alternatively the cached HTML becomes country neutral and the client fills in the country.

Rule 3 decides which hosted options work. Cloudflare Free and Pro cannot put a country in the cache key, so they need country-neutral HTML. Varnish, nginx, Fastly, and Bunny can key on a country.

## Comparison

| | Varnish (self-hosted) | nginx `proxy_cache` (self-hosted) | Cloudflare Free | Cloudflare Pro | Bunny.net | Fastly free account |
| --- | --- | --- | --- | --- | --- | --- |
| Caches HTML with today's headers | Yes, reads `s-maxage` | Yes, reads `s-maxage` (source code, not docs) | No. Needs a cache rule. | Same as Free | No. Needs a setting or an edge rule. | Yes |
| Real `stale-while-revalidate` | Yes, from the header | Yes, with `proxy_cache_background_update` | Yes, but not with `s-maxage` | Same as Free | Yes, as a zone setting. Header support unverified. | Yes, from the header |
| Real `stale-if-error` | Yes, with a few lines of VCL | Yes, from the header | Yes, but not with `s-maxage` | Same as Free | Yes, as a zone setting | Yes, needs VCL for origin errors |
| Purge by URL | Yes | Third-party module, or delete the file | Yes | Yes | Yes, API only | Yes, about 150 ms |
| Purge by tag | `xkey` module, presence in the image unverified | No | Yes, 5 requests per minute | Yes, 5 per second | Yes, `CDN-Tag` | Yes, `Surrogate-Key` |
| Cookie bypass | VCL | `map` on `$http_cookie` | Cache rule, no regex | Same as Free | Vary by cookie. Bypass rule has a pitfall. | VCL. Availability on the free account unverified. |
| Honours origin `Vary` | Yes | Yes | No, except through the cache rule setting | Same as Free | Probably no (unverified) | Yes |
| Country in the cache key | Yes, from the normalised header | Yes, in `proxy_cache_key` | No | No | Yes, vary by country | Yes, in VCL |
| Country header to the app | No, needs a GeoIP database | Third-party module and a database | `CF-IPCountry` | `CF-IPCountry` | `CDN-RequestCountryCode` | `client.geo.country_code` |
| Attack absorption | Host capacity only. Hetzner filters network floods. | Same | Unmetered, layers 3 to 7 | Same, plus configurable bot rules | Shield Basic free, 25 million requests | Layers 3 and 4 free. Layer 7 is a paid add-on. |
| Stays up when the vendor is down | Not applicable | Not applicable | No. Bypass needs the Cloudflare dashboard or API. | Same | Yes, after a DNS change at Namecheap | Yes, after a DNS change at Namecheap |
| Cost for the spike | 0 | 0 | 0 | 20 USD per month, billed yearly | About 1 USD | About 1 to 2 USD, if apex works |
| Monthly cost at rest | 0 | 0 | 0 | 20 to 25 USD | 1 USD minimum | 0 |

## Self-hosted options

### Varnish

Recommended origin cache.

**Project state.** The original open source project is now called Vinyl Cache. "Varnish Cache" is now Varnish Software's distribution of it, still under the BSD 2-clause licence. The official Docker image `varnish` ships the Varnish Software distribution, version 9.1.0. Sources: [vinyl-cache.org](https://vinyl-cache.org/), [On Vinyl Cache and Varnish Cache](https://vinyl-cache.org/organization/on_vinyl_cache_and_varnish_cache.html), [varnish.org](https://www.varnish.org/), [Docker Hub](https://hub.docker.com/_/varnish). No official Vinyl image was found (unverified).

**HTML caching.** The time to live comes from "Cache-Control s-maxage or max-age directives", in that order. [VCL variables](https://vinyl-cache.org/docs/trunk/reference/vcl-var.html)

**Stale-while-revalidate.** Native. `beresp.grace` defaults to the "Cache-Control stale-while-revalidate directive". Grace serves the stale object "while Vinyl Cache fetches a new version of the object". Today's header maps to 30 minutes fresh and 2 hours of grace with no configuration. [VCL variables](https://vinyl-cache.org/docs/trunk/reference/vcl-var.html), [Grace mode](https://vinyl-cache.org/docs/trunk/users-guide/vcl-grace.html)

**Stale-if-error.** The docs do not mention the directive. The documented pattern is a long grace, a short `req.grace` while the backend is healthy, and `return (abandon)` when a background fetch returns a 5xx. [Grace mode](https://vinyl-cache.org/docs/trunk/users-guide/vcl-grace.html)

**Stampede protection.** Built in. "Vinyl Cache will send one request to the backend and place the others on hold." This covers the missing lock in the `cached()` helper for full pages. [Grace mode](https://vinyl-cache.org/docs/trunk/users-guide/vcl-grace.html)

**Cookies.** The default is the opposite of what the site needs: "if the client sends a Cookie header, vinyld will bypass the cache". The docs give the VCL to strip cookies. The site needs about 20 lines: pass when the auth cookie is present, otherwise remove the `Cookie` header. [Increasing your hit rate](https://vinyl-cache.org/docs/trunk/users-guide/increasing-your-hitrate.html)

**Vary.** Honoured. The docs say it is "crucial to normalize the headers the backends varies on" and show an `Accept-Language` example. The site rewrites the header to the two-letter country before lookup. [Increasing your hit rate](https://vinyl-cache.org/docs/trunk/users-guide/increasing-your-hitrate.html)

**Purge.** `PURGE` by URL removes the object "along with its variants". Bans remove by pattern. Tags need the `xkey` module from [varnish-modules](https://github.com/varnish/varnish-modules). Whether the official image includes `xkey` is unverified. [Purging](https://vinyl-cache.org/docs/trunk/users-guide/purging.html)

**Geo.** None built in. The normalised `Accept-Language` country replaces it.

**Memory.** The image defaults to 100 MB. Overhead is about 1 KB per object, and real memory use can be two to four times the configured size. 256 MB to 1 GB covers the hot pages and OG images (inference). [Storage backends](https://vinyl-cache.org/docs/trunk/users-guide/storage-backends.html)

**Effort.** One container, one VCL file, and a purge call from the app or from Windmill. The cache is per instance and empties on restart.

### nginx proxy_cache

A sound second choice. More directives, weaker purge.

- **TTL.** The docs name `X-Accel-Expires`, `Expires`, and `Cache-Control`. They do not mention `s-maxage`, but the [source](https://github.com/nginx/nginx/blob/master/src/http/ngx_http_upstream.c) reads it before `max-age`.
- **Stale serving.** Both extensions work from the header since 1.11.10. `proxy_cache_background_update` makes the refresh asynchronous. `proxy_cache_use_stale` adds `error`, `timeout`, and `http_5xx` cases.
- **Stampede protection.** `proxy_cache_lock`, off by default.
- **Cookies.** `proxy_cache_bypass` and `proxy_no_cache` take a variable. A `map` with a regex on `$http_cookie` handles the dynamic cookie name (inference, standard pattern).
- **Vary.** Honoured since 1.7.7, so `Vary: Cookie` fragments the cache. Use `proxy_ignore_headers Vary` and an explicit `proxy_cache_key`.
- **Purge.** `proxy_cache_purge` is "available as part of our commercial subscription". The maintained open source route is the [nginx-modules fork of ngx_cache_purge](https://github.com/nginx-modules/ngx_cache_purge), which needs a custom build. There is no tag purge.
- **Geo.** [ngx_http_geoip2_module](https://github.com/leev/ngx_http_geoip2_module), third party, needs a MaxMind database.

Source for all directives: [ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

### Caddy with cache-handler (Souin)

Works, but it is the riskiest self-hosted choice.

- It claims RFC 7234 compliance with `Vary`, request coalescing, and stale directives. The [source](https://github.com/darkweak/souin/blob/master/pkg/middleware/middleware.go) confirms a background revalidation goroutine and `singleflight` coalescing.
- Purge by surrogate key through the Souin API.
- No cookie bypass directive was found (unverified). A Caddy matcher would skip the handler.
- Since v1.7.0 only an in-memory store is built in. Other stores come from [darkweak/storages](https://github.com/darkweak/storages).
- It needs a custom `xcaddy` build. Coolify's Caddy proxy is `lucaslorentz/caddy-docker-proxy`, so the site would need a custom proxy image and a proxy switch for the whole server. [cache-handler](https://github.com/caddyserver/cache-handler), [Coolify Caddy overview](https://coolify.io/docs/core/networking/proxy/caddy/overview)
- Maturity: cache-handler is at v0.17.0. Souin has 73 open issues and appears to have one maintainer (maintainer count unverified). [Souin](https://github.com/darkweak/souin)

### Traefik

Not credible for this job.

- Traefik open source has no cache middleware. [Middleware list](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/overview/)
- The HTTP cache middleware belongs to the commercial [Traefik Hub API Gateway](https://doc.traefik.io/traefik-hub/api-gateway/reference/routing/http/middlewares/ref-httpcache).
- The [Souin plugin](https://plugins.traefik.io/plugins/6294728cffc0cd18356a97c2/souin) runs in Traefik's embedded Go interpreter. Traefik warns to "exercise caution when adding new plugins to production". Souin's README warns that Traefik's interpreter often breaks dependencies. [Extend Traefik](https://doc.traefik.io/traefik/extend/extend-traefik/)
- The plugin would run inside the proxy that serves every other workload on the host.

### Others

| Option | Verdict | Source |
| --- | --- | --- |
| HAProxy cache | No. It is "designed to perform cache on small objects" and only handles `Vary` on `accept-encoding`, `referer`, and `origin`. | [HAProxy configuration](https://docs.haproxy.org/3.2/configuration.html) |
| Apache Traffic Server | A full cache, but heavy for one site. Native `stale-while-revalidate` is unverified. | [Cache basics](https://docs.trafficserver.apache.org/en/latest/admin-guide/configuration/cache-basics.en.html) |
| Pingora | A Rust framework, not a server. Its cache integration "should be considered experimental". | [Pingora](https://github.com/cloudflare/pingora) |
| Squid | Not researched. | |
| HTML cached in Redis by the app | Every request still reaches the Node event loop. It protects the databases, not the process (inference, no source). | |

### How it fits into Coolify

Coolify documents no caching feature. The clean layout needs no proxy changes (inference from the docs):

1. Deploy one Docker Compose resource with two services, `varnish` and `web`.
2. Assign the domain to the `varnish` service only.
3. Point Varnish's backend at `web:3000`.

Traefik terminates TLS, Varnish caches, and the app renders. Coolify states that compose services "can reach one another by service name and internal port". [Docker Compose builds](https://coolify.io/docs/applications/builds/docker-compose)

The cache can also run on a spare host and proxy to abio over the private network. That moves TLS and cache load off the shared host. It needs a Coolify proxy on that host.

### What self-hosting achieves with the available hosts

- **Throughput.** F5's benchmark shows nginx serving 54,684 requests per second of 10 KB files and 33,125 of 100 KB files on one core over plain HTTP. 500 requests per second of 60 KB is about 1 to 2 percent of one core. The benchmark uses static files on lab hardware, not a proxy cache on a shared host. No per-core figure for Varnish was found (unverified). [NGINX performance tests](https://blog.nginx.org/blog/testing-the-performance-of-nginx-and-nginx-plus-web-servers)
- **TLS is the real cost.** The same benchmark shows 428 new HTTPS connections per second per core with RSA 2048. Keep-alive, HTTP/2, and elliptic curve certificates lower this. In this stack Traefik pays the cost, and no primary numbers for Traefik were found (unverified).
- **Bandwidth.** 240 Mbit/s at peak, 108 GB for the hour. Hetzner dedicated servers have "a dedicated 1 GBit uplink by default and with it unlimited traffic". Cloud servers include 20 TB in the EU. Which product abio is on was not checked. [Hetzner traffic](https://docs.hetzner.com/robot/general/traffic/)
- **Attacks.** Hetzner's free DDoS protection names network and transport floods only. It does not claim HTTP flood protection (inference from omission). [Hetzner DDoS protection](https://www.hetzner.com/unternehmen/ddos-schutz/)
- **Reach.** One region. Visitors in Asia or the Americas pay the full round trip to Germany.

## Hosted options

### Cloudflare Free and Pro

**HTML caching.** Off by default: "The Cloudflare CDN does not cache HTML or JSON by default." A cache rule with "Eligible for cache" turns it on. Free has 10 cache rules, Pro has 25. PNG is cached by default. [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/), [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)

**Stale-while-revalidate.** Real and asynchronous: "Revalidation is fully asynchronous." But today's header disables it: "`s-maxage` implies `proxy-revalidate` semantics, so shared caches cannot serve stale content." Cloudflare's advice is to send `max-age` with `stale-while-revalidate` and set the edge TTL in a cache rule. Whether an edge TTL override keeps the stale directives is ambiguous in the docs (unverified, needs a test). [Revalidation](https://developers.cloudflare.com/cache/concepts/revalidation/)

**Stale-if-error.** Supported for 500, 502, 503, and 504, with the same `s-maxage` exclusion. Always Online disables both stale directives, so keep it off. [Cache-Control](https://developers.cloudflare.com/cache/concepts/cache-control/), [Always Online](https://developers.cloudflare.com/cache/how-to/always-online/)

**Purge.** URL, hostname, tag, prefix, and everything, on all plans. Tag and prefix purges are limited to 5 requests per minute on Free and 5 per second on Pro. [Purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/)

**Cookie bypass.** Cache rule expressions can read `http.cookie`, and Cloudflare publishes a bypass-on-cookie example. No page states that this works on Free (unverified, inferred from the absence of a plan note). The regex operator needs Business, so the rule uses two `contains` checks. A response with `Set-Cookie` is not cached. [Bypass cache on cookie](https://developers.cloudflare.com/cache/how-to/cache-rules/examples/bypass-cache-on-cookie/), [Operators](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/), [Cache behavior](https://developers.cloudflare.com/cache/concepts/cache-behavior/)

**Vary.** Ignored by default. A cache rule Vary setting exists on all plans. It can normalise `Accept-Language`, but normalisation strips "region variants", which is the part GoodWatch uses for the country. Custom cache keys by header, cookie, or country are Enterprise only. Result: on Free or Pro, cached HTML must be country neutral. [Vary](https://developers.cloudflare.com/cache/concepts/vary/), [Cache keys](https://developers.cloudflare.com/cache/how-to/cache-keys/)

**Geo.** `CF-IPCountry` reaches the origin on all plans. It cannot enter the cache key on Free or Pro. [IP geolocation](https://developers.cloudflare.com/network/ip-geolocation/)

**Bots and attacks.** "Standard, unmetered DDoS protection (layers 3-7)" on every plan. Free has one rate limiting rule, Pro has two. Bot Fight Mode on Free applies to the whole domain and cannot be skipped by rules, so it can challenge link preview bots. Leave it off. Pro's Super Bot Fight Mode can allow verified bots and skip paths. Whether each preview bot is on the verified list is unverified. [DDoS protection](https://developers.cloudflare.com/ddos-protection/), [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/), [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)

**Cache shape.** Each data centre has its own cache. Smart Tiered Cache is free and makes one upper tier the only one that contacts the origin. [Tiered Cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/)

**Limits.** No bandwidth or request cap was found, and no explicit "unmetered" statement either (unverified). The terms allow Cloudflare to limit sites that serve "a disproportionate percentage of pictures, audio files, or other large files". HTML plus OG images is ordinary use (inference). The published SLA starts at Business. [Service-specific terms](https://www.cloudflare.com/service-specific-terms-application-services/), [Plans](https://www.cloudflare.com/plans/)

**Cost.** Free is 0 USD. Pro is 20 USD per month billed yearly, or 25 USD billed monthly. [Plans](https://www.cloudflare.com/plans/)

**Outages that would have hit a proxied Free or Pro site.**

| Date | Duration | What broke | Source |
| --- | --- | --- | --- |
| 2025-11-18 | About 5 h 46 min, 11:20 to 17:06 UTC | A bad Bot Management file crashed the core proxy. Global 5xx. | [Post-mortem](https://blog.cloudflare.com/18-november-2025-outage/) |
| 2025-12-05 | About 25 min | A WAF change hit a proxy bug. About 28 percent of HTTP traffic got 500s. | [Post-mortem](https://blog.cloudflare.com/5-december-2025-outage/) |
| 2026-10-02 | About 11 min | "CDN experiencing increase in errors", marked critical. No post-mortem found. | [Status incident](https://www.cloudflarestatus.com/incidents/2xnmsnv8yv5x) |

Other incidents in the period did not stop cached pages: R2 on [2025-02-06](https://blog.cloudflare.com/cloudflare-incident-on-february-6-2025/) and [2025-03-21](https://blog.cloudflare.com/cloudflare-incident-march-21-2025/), Workers KV on [2025-06-12](https://blog.cloudflare.com/cloudflare-service-outage-june-12-2025/), the 1.1.1.1 resolver on [2025-07-14](https://blog.cloudflare.com/cloudflare-1-1-1-1-incident-on-july-14-2025/), the dashboard and API on [2025-09-12](https://blog.cloudflare.com/deep-dive-into-cloudflares-sept-12-dashboard-and-api-outage/), a route leak on [2026-01-22](https://blog.cloudflare.com/route-leak-incident-january-22-2026/), and customer-owned prefixes on [2026-02-20](https://blog.cloudflare.com/cloudflare-outage-february-20-2026/). The status page API only reaches back to 2026-09-16, so status-only incidents between March and September 2026 are unverified.

**Bypass during an outage.** This is the weak point.

- Free and Pro require Cloudflare as the authoritative DNS. Keeping DNS elsewhere "is only available to customers on a Business or Enterprise plan". [Partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/)
- The bypass is a switch of the record to DNS only, through Cloudflare's dashboard or API. Proxied records have a fixed 300 second TTL. [Proxy status](https://developers.cloudflare.com/dns/proxy-status/), [TTL](https://developers.cloudflare.com/dns/manage-dns-records/reference/ttl/)
- On 2025-11-18 "most users were unable to log in due to Turnstile being unavailable on the login page". Whether the DNS API kept working with an existing token is unverified.
- The last resort is to move the nameservers back to Namecheap. That is slow, and it is an inference, not a documented procedure.

### Bunny.net

**HTML caching.** Bunny "follows the origin's `Cache-Control` header". Smart Cache excludes `text/html`, so turn it off or add an edge rule. Whether Bunny prefers `s-maxage` over `max-age` is unverified. [Smart Cache](https://bunny.net/docs/cdn/smart-cache)

**Stale serving.** Real, but set per pull zone, not by header: "use stale cache while cache is updating" and "while the origin is offline", plus background update. Logs show `UPDATING` and `STALE`. Whether Bunny reads the two directives from the header is unverified, and so is how long it keeps stale objects. [Pull zone API](https://bunny.net/docs/api-reference/core/pull-zone/update-pull-zone), [Logging](https://bunny.net/docs/cdn/logging)

**Purge.** URL, prefix, tag through the `CDN-Tag` header, and full zone. URL purges are API only. About 300 URL or tag purges per minute. [Purge cache](https://bunny.net/docs/cdn/purge-cache)

**Cookie bypass.** There is a pitfall. An edge rule that sets cache time 0 bypasses the cache only "if we don't already have the content cached", so a member could receive the cached anonymous page. The safer route is Vary Cache by cookie on the auth cookie name, so members get their own key and `private, no-store` keeps the response out (inference, needs a test with chunked cookie names). Whether Bunny caches responses with `Set-Cookie` is unverified. [Edge rule ordering](https://bunny.net/docs/cdn/edge-rules/ordering), [Vary Cache](https://bunny.net/docs/cdn/vary-cache)

**Vary.** Bunny uses its own Vary Cache settings: query string, country, hostname, device, cookie, and request headers. It probably ignores the origin `Vary` header (unverified). Query strings are ignored by default, so enable query string vary. Vary by country matches the page's needs, but it "disables individual URL cache purging". [Vary Cache](https://bunny.net/docs/cdn/vary-cache)

**Geo.** `CDN-RequestCountryCode` on every origin request. [Request headers to origin](https://bunny.net/docs/cdn/request-headers-to-origin)

**Bots and attacks.** Shield Basic is free: WAF rules, two rate limit rules, 25 million requests, and "full DDoS protection". [Bunny Shield](https://bunny.net/shield/), [Shield pricing](https://bunny.net/docs/shield/pricing)

**Cost.** 0.01 USD per GB in Europe and North America, no request fees, 1 USD monthly minimum, 14 day trial. The spike costs about 1.10 USD for 108 GB in Europe and North America. A spend limit is available. Origin Shield is free. [CDN pricing](https://bunny.net/pricing/cdn/), [Origin Shield](https://bunny.net/docs/cdn/performance/origin-shield)

**Outages.** From [status.bunny.net](https://status.bunny.net/):

| Date | Duration | What broke |
| --- | --- | --- |
| 2024-10-14 | About 2 h | [Increase in 502 error rates](https://status.bunny.net/incidents/w27fdxvd3wbf) |
| 2024-10-22 | 15 min | [502 errors returned globally](https://status.bunny.net/incidents/p9zvs8ql9146) |
| 2024-11-11 | 70 min | [502 errors returned globally](https://status.bunny.net/incidents/zggwc6h7tcdt) |
| 2025-11-07 | About 3 h 20 min | [Increased CDN response times in some regions](https://status.bunny.net/incidents/76hml3t1rtch) |
| 2025-11-23 to 2025-11-27 | About 3.5 days | [Bunny DNS intermittent resolution issues](https://status.bunny.net/incidents/l8grfvyw59fy) |
| 2026-05-21 | About 1 h 40 min | [The bunny.net domain was suspended by a registrar](https://status.bunny.net/incidents/j1syhng2crfy). Dashboard, API, and Bunny DNS failed. CDN delivery stayed up. |
| 2026-05-26 | About 28 h | [CDN configuration sync delays](https://status.bunny.net/incidents/87c8m8v8bhl8) |

Bunny has had no outage of Cloudflare's size in the period, but it has more medium ones, and its DNS product is the weakest part.

**Bypass.** DNS stays at Namecheap. Repoint the record at the origin there. The origin keeps its own certificate through Coolify, so the bypass needs no Bunny system.

**Apex.** "There is no stable anycast IP that can be used with A records." The options are an ALIAS record at the DNS host, Bunny DNS, or serving from `www` with an apex redirect. Whether Namecheap's ALIAS record works for this is unverified. Moving DNS to Bunny gives up the independent bypass. [Custom hostname](https://bunny.net/docs/cdn/custom-hostname)

### Fastly

**HTML caching.** Works with today's headers. Fastly caches by status code and reads `s-maxage`. `private` passes. Responses with `Set-Cookie` are not stored. [Cache freshness](https://www.fastly.com/documentation/guides/concepts/edge-state/cache/cache-freshness/)

**Stale serving.** Reads both directives from the origin header. Serving stale on an origin 5xx needs `return(deliver_stale)` in VCL. "If the SWR window is longer than or equal to the SIE window, the SIE behavior will never take effect", which the title page header satisfies. [Stale content](https://www.fastly.com/documentation/guides/concepts/edge-state/cache/stale/)

**Purge.** URL, `Surrogate-Key`, and all, in about 150 ms. [Purging](https://www.fastly.com/documentation/guides/concepts/edge-state/cache/purging/)

**Cookie bypass and Vary.** Both in VCL. Fastly honours `Vary` and advises normalising before varying. Whether custom VCL is included in the free account is unverified. [Vary best practices](https://www.fastly.com/blog/best-practices-using-vary-header)

**Geo.** `client.geo.country_code` in VCL. [Geolocation variables](https://www.fastly.com/documentation/reference/vcl/variables/geolocation/client-geo-country-code/)

**Bots and attacks.** The free account includes unlimited layer 3 and 4 mitigation. Layer 7 protection is an add-on billed per request. At 1.8 million requests it would cost about 130 USD, so leave it off. [Free developer accounts](https://www.fastly.com/blog/its-free-instant-and-yours-fastlys-free-developer-accounts-are-here), [Fastly DDoS Protection](https://docs.fastly.com/products/fastly-ddos-protection)

**Cost.** The free account includes 100 GB and 1 million requests per month. Overage is billed automatically, not throttled: 0.12 USD per GB in Europe and North America and 0.01 USD per 10,000 requests. The spike is 1.8 million requests and 108 GB, so about 1 USD for the 8 GB over, plus 0.80 USD for requests. A credit card is required. [Pricing](https://www.fastly.com/pricing), [Account types](https://www.fastly.com/documentation/guides/account-info/billing/account-types/)

**Outages.** [2026-04-16](https://www.fastlystatus.com/incident/378455), 1 h 16 min of elevated errors across most locations. The 2025-06-12 Google Cloud incident hit Fastly's control plane, not delivery. The status history could not be enumerated, so this list is incomplete (unverified). For context, the [2021-06-08 outage](https://www.fastly.com/blog/summary-of-june-8-outage) made 85 percent of the network return errors for about 49 minutes.

**Bypass.** DNS stays at Namecheap, same as Bunny.

**Apex.** Fastly's anycast addresses for apex domains require "one of Fastly's paid plans". Whether a free account with a card counts is unverified. This decides whether Fastly can serve `goodwatch.app` at all. [Apex domains](https://www.fastly.com/documentation/guides/full-site-delivery/domains-and-origins/using-fastly-with-apex-domains)

**Effort.** Highest of the hosted options: a VCL service with custom code for cookies, `Vary`, and stale delivery.

### Other hosted options, briefly

| Option | Free tier | HTML and stale support | Source |
| --- | --- | --- | --- |
| Amazon CloudFront flat-rate Free plan | 0 USD, 1 million requests and 100 GB, "no overage charges". The first spike up to three times the allowance does not affect service. Includes WAF and DDoS protection. | Reads `s-maxage`, `stale-while-revalidate`, and `stale-if-error` from the origin. | [Pricing](https://aws.amazon.com/cloudfront/pricing/), [Flat-rate plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html), [Expiration](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) |
| Gcore | 1 TB per month included, then 0.01 EUR per GB. Request allowance unverified. | Unverified. | [Gcore pricing](https://gcore.com/pricing/edge-network) |
| KeyCDN | None. 0.04 USD per GB, 49 USD minimum payment. | Unverified. | [KeyCDN pricing](https://www.keycdn.com/pricing) |

CloudFront was outside the ticket's list and was not researched for cookie bypass, apex handling, or outages. Its free plan reads the app's headers as they are, which makes it worth a second look if Bunny fails its tests.

## The two-layer shape

```
visitor -> [optional CDN] -> Traefik (TLS) -> Varnish -> remix-serve
```

**What each layer does.**

| Job | Origin cache | CDN in front |
| --- | --- | --- |
| Collapse a stampede into one render | Yes | Only per location |
| Serve stale when the app is slow or down | Yes | Yes |
| Keep the site up when the host is down | No | Yes, for cached pages, while stale windows last |
| Absorb an HTTP flood | No | Yes |
| Cut latency for far-away visitors | No | Yes |
| Take TLS handshakes off the host | No | Yes |
| Work when the CDN vendor is down | Yes | No |

**Why both.** The CDN alone leaves the origin exposed to one miss per location, to every cache-busting query string, and to the full load the moment the CDN is bypassed. With the origin cache in place, a DNS bypass during a CDN outage lands on a layer that already handles 500 requests per second.

**Rules for running two layers.**

- Keep one source of truth for the TTL: the app's headers. Both layers read them.
- Total staleness adds up. A page can be up to one TTL old at the origin cache and one more at the CDN. With `s-maxage=1800` that stays far inside the accepted 24 hours.
- Purge the origin cache first, then the CDN.
- The auth cookie bypass must exist in both layers. Test that member HTML never enters either.
- Forward the CDN's country header and let Varnish use it for the cache key. Fall back to the `Accept-Language` country when the header is missing, so the bypass path keeps working.
- Lock the origin to the CDN's addresses only if the bypass is not needed. The bypass needs the origin open.

## Recommendation

1. **Build the origin cache with Varnish.** It is free, it reads today's headers, it adds stampede protection, and it does not depend on any vendor. Start on abio next to the app in one compose resource. Move it to a spare host if the baseline shows that TLS or cache load hurts abio.
2. **Fix the cache key in the app and the VCL together.** Bypass on the auth cookie, strip other cookies, and key on the two-letter country.
3. **Run the benchmark against the origin cache alone.** The numbers suggest one host meets 500 requests per second with a large margin. If the benchmark agrees, the CDN is insurance, not a requirement.
4. **Add Bunny.net in front only if the owner wants attack absorption or global latency.** It fits the budget, keeps DNS at Namecheap, and a DNS change removes it. Verify the unverified items in a trial first: `s-maxage` handling, member bypass, and the apex record.
5. **Do not choose Cloudflare Free as the only layer.** It gives the most absorption for no money. It also needs country-neutral HTML, different headers, and a move of DNS to the vendor whose outages the owner wants to avoid. If the owner accepts those, pair it with the origin cache and a tested bypass script.
6. **Skip Fastly, Souin, the Traefik plugin, and HAProxy.** Fastly has the best semantics but an unresolved apex restriction and the most configuration. The others are immature or unfit.

## Open decisions for the owner

- **CDN or no CDN.** Is an HTTP flood or a global audience a real concern for the first spike, or is the origin cache enough until the benchmark says otherwise?
- **Dependence on a hosted vendor.** Is a CDN acceptable when DNS stays at Namecheap and a record change removes it? That is the Bunny and Fastly shape, and not the Cloudflare Free shape.
- **Country in cached HTML.** Keep the country in the page and in the cache key, or make the HTML country neutral and fill in the country on the client? The second choice raises the hit rate and makes every CDN usable.
- **Where the cache runs.** On abio, or on a spare host in front of abio. Waits for the baseline.
- **Apex or `www`.** Bunny and Fastly are simpler on `www`. A canonical host change affects SEO and needs redirects.
- **Purge model.** TTL only, purge by URL from the data pipelines, or tags. With 30 minute TTLs and 24 hours of accepted staleness, TTL only may be enough.
- **DNS TTL.** Lower the 1800 second TTL at Namecheap so that any future switch takes minutes.

## Not verified

- Load behaviour of any option. Nothing was benchmarked.
- Varnish: `xkey` in the official Docker image, and a requests-per-core figure.
- Traefik: TLS handshake capacity on the shared host.
- Cloudflare: cookie expressions on Free, stale directives under an edge TTL override, the verified status of each link preview bot, a bandwidth cap, and the DNS API during the 2025-11-18 outage.
- Bunny: `s-maxage` precedence, header-driven stale directives, `Set-Cookie` handling, origin `Vary` handling, stale retention time, and Namecheap ALIAS support for the apex.
- Fastly: custom VCL and apex addresses on the free account, and the full incident history.
- Hetzner: which product and traffic allowance apply to abio.
