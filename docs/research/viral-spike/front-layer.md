# What terminates TLS and serves cacheable responses in front of the proxy

Researched on October 5, 2026 for two tickets of the map "Serve a viral traffic spike" that are one question now: "Choose the page cache layer" and "Decide where static assets are served from". This page prepares the owner's decision. It doesn't decide.

Scope: vendor documentation and pricing pages read on October 5, 2026, plus the measurements in [`viral-spike-page-views.md`](../../benchmarks/viral-spike-page-views.md). No account was created, no host was touched, and nothing here was load tested.

## How to read this page

- **Measured** means a number from the benchmark documents of this repository.
- **Vendor** means a statement from the vendor's documentation, linked next to it. Nobody tested it against this site.
- **Estimate** means arithmetic on measured numbers and list prices.
- **Unverified** means no primary source confirmed it. Treat it as something to test before relying on it.
- Prices are list prices in USD on October 5, 2026.

## Short version

- **The measured limit is the proxy and the bytes, not the page render.** A layer that sits behind the proxy no longer helps. That retires the earlier recommendation (a Varnish cache behind the proxy).
- **37 of the 39 requests of a movie page view, and about 500 of its 563 to 621 KB, are static files.** Moving only those to a CDN hostname, and switching the certificate to ECDSA, brings the origin's estimated cost to about 1.2 proxy cores and 240 Mbit/s at 500 page views per second. That fits today's hosts on paper. It needs no cache key work, no cookie change, and no purge.
- **Cloudflare's free plan can now key HTML by country and language** (vendor, two documented ways, both untested here). It removes the most, costs nothing, and brings the most changes and the most third-party dependence: DNS moves to Cloudflare, and Cloudflare terminates TLS for members too.
- **bunny.net is a good fit for static files and an awkward fit for HTML.** Its edge rules can't build the identity header, it strips `Set-Cookie`, and its stale serving is a zone setting, not the app's header.
- **Self-hosted TLS termination has enough CPU and probably not enough uplink:** 2.5 Gbit/s doesn't fit one 1 Gbit/s uplink, and the hosts' public uplinks aren't verified.
- **Recommendation (not a decision):** static files on a CDN hostname plus the ECDSA certificate first, then one load run. Put the whole site behind Cloudflare only if that run fails or a bot problem appears. Details and the main risk are at the end.

## What the layer has to carry

Measured, per movie page view on the public path with new connections (plus or minus 20%):

| Resource | Per page view | At 500 per second (estimate) | Available today |
| --- | --- | --- | --- |
| Requests to the site's host | 39 (1 document, 1 POST to the error tracking tunnel, 37 files) | 19,500 per second | |
| New TLS connections | 2 | 1,000 per second | Full at 470 to 500 per second on the proxy host |
| Proxy CPU | 53 ms: two RSA 4096 handshakes at 14 to 16 ms each, and about 0.7 ms per request | About 27 cores, about 14 with an ECDSA certificate | 8 cores, about 5.5 free |
| Node main-thread time | 9.4 ms, about 0.25 ms per request | 4.7 cores, 6 processes | 2 processes |
| Bytes sent | 563 to 621 KB | 2.5 Gbit/s, about 1.1 TB in the hour | Public uplink not verified |

What a spike hour is, for pricing (estimate): 1.8 million page views, 70 million requests, 1.0 to 1.1 TB. The documents alone are about 108 GB (60 KB per title page with Brotli, measured on October 3).

What a normal month is (rough estimate, not measured as a monthly total): crawlers walk about 175,000 titles per day, which is about 5 million documents and 300 GB per month if each is 60 KB. Visitor traffic adds little today. This page uses 0.3 to 0.5 TB per month.

Three things that no option removes:

- **The error tracking POST:** one per page view, 38 to 75 KB of request body, uncached, forwarded by Node to the vendor. Not measured yet (see "Measure and bound the error tracking POST that every page view sends").
- **The home page's pool POST:** `private, no-store`, about 5% of visitors in the primary mix.
- **The analytics POST** goes to another host and never reaches the proxy.

## What changed since the earlier research

[`page-cache-layers.md`](https://github.com/alp82/goodwatch-monorepo/blob/research/page-cache-layers/docs/research/viral-spike/page-cache-layers.md) (October 3, 2026, branch `research/page-cache-layers`) stays the reference for Varnish, nginx, Caddy, Fastly's caching behavior, and the vendors' outage history. Today's measurements and readings change four of its conclusions.

| Earlier conclusion | Today |
| --- | --- |
| Put Varnish between the proxy and the app. | The in-process page cache does that job since ADR 0007. A cache behind the proxy would save 0.6 to 1.5 ms of Node time per document and nothing of the proxy's 53 ms. The layer has to terminate TLS to help. |
| The spike is 240 Mbit/s and 108 GB. | That counted documents only. With files, it's 2.5 Gbit/s and about 1.1 TB (measured per page view, extrapolated). bunny.net's spike cost moves from about 1 USD to 5 to 20 USD, Fastly's from about 2 USD to about 190 USD, and one 1 Gbit/s uplink is no longer enough. |
| Cloudflare Free and Pro can't put a country in the cache key, so the HTML would have to be country-neutral. | The app now has the `GW-Cache-Identity` request header. Cloudflare documents a `Vary` setting in cache rules on all plans (page updated on August 14, 2026) and a URL rewrite pattern on the free plan. Custom cache keys are still Enterprise only. |
| bunny.net fits best as a CDN in front. | For HTML, three vendor facts found today speak against it: edge rule variables are whole values only, `Set-Cookie` is stripped, and the apex has no address. For static files on a subdomain it still fits. |

## Option (a): Cloudflare in front of the whole site

### What the plans do (vendor)

| Topic | Free | Pro | Source |
| --- | --- | --- | --- |
| Price | 0 USD | 25 USD per month, or 240 USD per year | [Pricing announcement](https://blog.cloudflare.com/adjusting-pricing-introducing-annual-plans-and-accelerating-innovation/). The plans page didn't render its price table for this research, so today's list price is unverified |
| Static files | Cached by default by file extension (scripts, styles, fonts, images). "The Cloudflare CDN does not cache HTML or JSON by default." | Same | [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) |
| HTML | Needs a cache rule with "Eligible for cache". With the edge lifetime set to "use cache-control header if present, bypass cache if not", the app's headers decide | Same | [Cache rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/) |
| `private`, `no-store` | Not stored | Same | [Default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) |
| Custom cache key (header, cookie, country, language) | No | No. Enterprise only | [Cache keys](https://developers.cloudflare.com/cache/how-to/cache-keys/) |
| `Vary` setting in cache rules | Yes | Yes | [Vary](https://developers.cloudflare.com/cache/concepts/vary/) |
| Transform rules (URL rewrite, request and response headers) | 10 active rules, no regular expressions | 25, no regular expressions | [Transform rules](https://developers.cloudflare.com/rules/transform/) |
| Snippets | No | 25 snippets, 5 ms, 2 subrequests | [Snippets](https://developers.cloudflare.com/rules/snippets/) |
| Workers | Free: 100,000 requests per day, 10 ms CPU each. Above the limit the route fails open or closed, as configured. Paid: 5 USD per month with 10 million requests, then 0.30 USD per million | Same, billed separately from the plan | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Purge | By URL, prefix, tag, host, or everything. By URL: 800 URLs per second. Other kinds: 5 requests per minute | By URL: 1,500 per second. Other kinds: 5 per second | [Purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/) |
| Bots | Bot Fight Mode: whole domain, "You cannot bypass or skip Bot Fight Mode using WAF custom rules or Page Rules". A switch to block AI bots | Super Bot Fight Mode, 20 WAF custom rules, managed rule sets | [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/), [Pro plan](https://www.cloudflare.com/plans/pro/) |
| WebSockets | Supported on all plans. The webapp opens none (checked in the code today) | Same | [WebSockets](https://developers.cloudflare.com/network/websockets/) |
| DNS | Cloudflare must be the authoritative DNS. Keeping DNS elsewhere needs Business | Same | Earlier research, [Partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/) |

Pro buys bot rules and snippets. It doesn't buy a better cache key. For caching alone, Free and Pro are the same.

### Keying HTML by country and language

Custom cache keys are out, so the identity has to reach the key another way. Two parts:

1. **Set the header.** A request header transform rule can set a header "according to an expression", and the rule runs before cache rules ([request header modification](https://developers.cloudflare.com/rules/transform/request-header-modification/)). The functions `concat`, `substring`, and `lower` carry no plan limit in the [function reference](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/). So a rule for requests without the auth cookie can set `GW-Cache-Identity` to `anon;`, the country field, `;`, and the first two letters of `Accept-Language` in lower case. A second rule covers requests without `Accept-Language` (crawlers, link preview bots) with `en`. Unverified: that the exact expression is accepted on the free plan, and what the country field holds for unknown locations. The app answers `private` for a value that doesn't match its pattern, so a wrong value fails safe.
2. **Make the cache use it.** Either way is documented for the free plan, and neither is tested:
   - **`Vary` in the cache rule.** The app already answers `Vary: GW-Cache-Identity`. The cache rule's `Vary` setting has a `passthrough` action: "Use the raw request header value to select the cached version." "Purging a URL purges all cached versions for that URL." The page details `Accept`, `Accept-Language`, and `Accept-Encoding` and speaks of "any header other than" those, so a custom header reads as supported. Unverified: that the value a transform rule set is the one used. ([Vary](https://developers.cloudflare.com/cache/concepts/vary/))
   - **A URL rewrite that adds a query parameter.** Cloudflare's own example for the free plan: a request "will be transformed to `/products/item?loc=ca` before reaching your origin or the cache, creating a distinct cache entry." The app would have to drop that parameter the way it drops tracking parameters. ([Serve tailored content](https://developers.cloudflare.com/cache/advanced-configuration/serve-tailored-content/))

A Worker can do the same in code. It costs 5 USD per month in practice, because the free plan's 100,000 requests per day end within the first minutes of the spike. The Workers Cache API is the wrong tool here: it's per data center, it isn't compatible with tiered caching, and it doesn't support `stale-while-revalidate` ([Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)).

### Lifetimes, staleness, and purge

- **`s-maxage` is honored and turns stale serving off.** "`s-maxage` implies `proxy-revalidate` semantics, so shared caches cannot serve stale content." The app's `stale-while-revalidate` and `stale-if-error` would do nothing at Cloudflare with today's headers. Cloudflare's advice: send `max-age` with `stale-while-revalidate` and set the edge lifetime in a rule, or send a separate `CDN-Cache-Control` header. ([Revalidation](https://developers.cloudflare.com/cache/concepts/revalidation/), [CDN-Cache-Control](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/))
- **`Age`: unverified.** No page found today says that Cloudflare subtracts the origin's `Age` from the lifetime. The app's rule ("a layer in front must count `Age`") can't be shown from the documentation.
- **The 60-second limit still holds by arithmetic (estimate).** Behind Cloudflare, a share list page can be 40 seconds old at worst when a reset is lost (20 in the data cache, 20 in the page cache). If Cloudflare ignores `Age` and serves no stale, it adds 10 seconds: 50 in total. With Smart Tiered Cache, a second Cloudflare tier could add 10 more: 60. So for share list pages, keep `s-maxage` as it is (no stale serving at Cloudflare) and test with tiered caching on before trusting it, or purge on every edit.
- **Purge:** by URL on the free plan is enough for a share list edit hook (one or two URLs per edit). With the `Vary` way, one URL purge removes all identities. With the rewrite way, each identity is its own URL, and the hook can't list them: use a prefix purge (5 per minute on Free) or rely on the lifetimes.
- **A deploy** no longer empties the shared copies, which is one of the gains named on the ticket. A feature flag change needs "purge everything".

### What the app and the proxy must change

| Change | Why |
| --- | --- |
| "Stop the balancing route from setting its cookie on shared-cacheable responses" | With "Eligible for cache" and the app's lifetimes, "Cloudflare preserves the `Set-Cookie` but does not cache the asset." With an edge lifetime override, Cloudflare strips the cookie and caches, which would ignore the app's lifetimes and break stickiness. ([Cache behavior](https://developers.cloudflare.com/cache/concepts/cache-behavior/)) |
| Cache rules: bypass when the `Cookie` header contains `-auth-token`; eligible for everything else; never for `/api/e` | Member bypass at the edge, in addition to the app's `private, no-store`. The published example exists; that it works on the free plan is unverified. ([Bypass cache on cookie](https://developers.cloudflare.com/cache/how-to/cache-rules/examples/bypass-cache-on-cookie/)) |
| The proxy must trust Cloudflare's addresses for `X-Forwarded-For`, or the app reads `CF-Connecting-IP` | The poster impressions endpoint takes the client address from `X-Forwarded-For`. Otherwise every visitor looks like a Cloudflare address. A change to the live proxy configuration is an owner step. ([HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)) |
| Smoke check and benchmarks | The smoke check gains a public-route pass that asserts `CF-Cache-Status` and that a member request is never a hit. Load runs through Cloudflare measure Cloudflare, so the origin needs a private-path run of its own, and a load test against Cloudflare from two addresses may be rate limited (unverified). |
| Optional: `CDN-Cache-Control` for title pages | To get stale serving at Cloudflare for pages with the 30-minute lifetime. |

### What it removes and what stays

- **Removes (estimate):** both client handshakes, all static requests, and nearly all bytes from the origin. Cloudflare reuses connections to the origin ("reuses open TCP connections up to the `Proxy Idle Timeout`", 900 seconds, [connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/)).
- **Stays at the origin:** one error tracking POST per page view (500 per second, about 0.35 proxy cores at 0.7 ms each, plus Node's unmeasured cost), the pool POST, and document misses. Each Cloudflare data center has its own cache, so a worldwide spike sends one miss per data center, URL, and identity per lifetime. For a share list page that's every 10 seconds. The in-process cache answers those in 0.5 to 0.8 ms.
- **Crawlers on 175,000 titles per day** mostly miss at Cloudflare as they do in the page cache. Cloudflare saves their handshakes, not their renders.

### Terms, privacy, lock-in

- **Bandwidth (vendor):** the service-specific terms say the CDN "can be used to cache and serve web pages and websites", and that Cloudflare may limit use "to serve video or a disproportionate percentage of pictures, audio files, or other large files". No bandwidth price or cap exists for the free plan. ([Service-specific terms](https://www.cloudflare.com/service-specific-terms-application-services/))
- **Privacy facts (vendor, no legal advice):** Cloudflare is "headquartered in the United States". Its standard data processing addendum includes the EU standard contractual clauses and applies to self-service customers. It is certified under the EU-U.S. Data Privacy Framework. Metadata is "processed on behalf of our customers in our data centers in the United States and Europe". Regional TLS termination and an EU metadata boundary are part of the Data Localization Suite, whose plan availability wasn't confirmed today. ([GDPR page](https://www.cloudflare.com/trust-hub/gdpr/)) With the whole site proxied, Cloudflare terminates TLS for members: sign-in requests and session cookies pass through it in clear text.
- **Availability:** the earlier research lists three incidents in 12 months that would have taken a proxied site down, the longest 5 hours 46 minutes. The bypass is switching the record to "DNS only" in Cloudflare's dashboard or API, which was hard to reach in that incident.
- **Lock-in:** rules live in Cloudflare's dashboard, not in the repository, unless they're managed through its API. Leaving means moving the nameservers back. The app-side changes (cookie, identity header) are vendor-neutral.

## Option (b): bunny.net, and other pay-per-use CDNs

### bunny.net for the whole site (vendor)

| Topic | Finding | Source |
| --- | --- | --- |
| Price | Standard network: 0.01 USD per GB in Europe and North America, 0.03 in Asia and Oceania, 0.045 in South America, 0.06 in the Middle East and Africa. Volume network: 0.005 USD per GB everywhere, with fewer locations. No request fees. 1 USD per month minimum | [CDN pricing](https://bunny.net/pricing/cdn/), [pricing documentation](https://bunny.net/docs/cdn/pricing.md) |
| HTML | Smart Cache excludes `text/html`. An edge rule ("Override Cache Time") or turning Smart Cache off stores it. How `s-maxage`, `private`, and `no-store` are read isn't documented | [Smart Cache](https://bunny.net/docs/cdn/smart-cache) |
| Identity header | The edge rule action "Set Request Header" supports variables such as `%{User.CountryCode}` and `%{RequestHeaders.Accept-Language}`, as whole values only. There's no substring or lower-case function, so an edge rule can't produce `anon;DE;de` | [Variable expansion](https://bunny.net/docs/cdn/edge-rules/variable-expansion) |
| Identity header by script | A middleware script can change the request "before they are sent to the cache". Edge Scripting costs 0.20 USD per million requests plus 0.02 USD per 1,000 seconds of CPU | [Middleware](https://bunny.net/docs/scripting/middleware/overview.md), [Edge Scripting pricing](https://bunny.net/docs/scripting/pricing.md) |
| Cache key | Vary Cache settings: query string, country, hostname, device, cookie, request headers. Vary by country "disables individual URL cache purging". Whether the origin's `Vary` header is honored isn't documented | [Vary Cache](https://bunny.net/docs/cdn/vary-cache) |
| `Set-Cookie` | bunny.net "strips `Set-Cookie` headers traveling over the CDN". If that applies to every response, sign-in through the CDN needs a test or an exception | [Vary Cache](https://bunny.net/docs/cdn/vary-cache) |
| Stale serving | A pull zone setting (serve stale while updating, and while the origin is offline). Not read from the app's header, and no documented bound on how old a stale copy may be | Earlier research, [pull zone API](https://bunny.net/docs/api-reference/core/pull-zone/update-pull-zone) |
| Purge | By URL, prefix, tag (`CDN-Tag`), or zone. About 300 exact purges per minute | [Purge cache](https://bunny.net/docs/cdn/purge-cache) |
| Perma-Cache | "A secondary permanent cache layer that sits between the CDN and your origin", filled on misses. "Wildcard purging and tag-based purging do not work when Perma-Cache is enabled." Useful for hashed files, wrong for HTML. Its storage price wasn't confirmed today | [Perma-Cache](https://bunny.net/docs/cdn/perma-cache) |
| Apex | "There is no stable anycast IP that can be used with A records." The site's name is an apex, so the whole site behind bunny.net needs Bunny DNS or a move to `www` | [Custom hostname](https://bunny.net/docs/cdn/custom-hostname) |
| Client address | `X-Real-IP`, `X-Forwarded-For`, and `CDN-RequestCountryCode` on every origin request. `Cookie` is forwarded | [Request headers to origin](https://bunny.net/docs/cdn/request-headers-to-origin.md) |
| Privacy facts | A data processing agreement is available in the panel. Logs can hold an "anonymized IP". A routing filter limits serving to 24 locations in EU member states (or 26 in the EEA). Where logs are stored isn't stated on those pages | [GDPR](https://bunny.net/gdpr/), [Routing filters](https://bunny.net/docs/cdn/performance/routing-filters.md) |

For HTML, bunny.net can't keep the owner's 60-second limit by any documented mechanism other than purging on every edit, and vary by country takes the URL purge away. With the app's contract as it is, the whole site behind bunny.net needs a script on every request, a DNS move, and four tests. This research doesn't see it as a candidate for HTML.

### Cost at the spike hour and in a normal month (estimate)

| CDN | Whole site, spike hour (1.1 TB, 70 million requests) | Whole site, normal month (0.3 to 0.5 TB) | Notes |
| --- | --- | --- | --- |
| Cloudflare Free | 0 USD | 0 USD | |
| Cloudflare Free with a paid Worker on documents and API requests only | 5 USD | 5 USD | About 4 to 10 million Worker requests in a spike month |
| bunny.net, standard network | 11 USD if all visitors are in Europe and North America. About 20 USD for a mix of 70% there, 20% Asia, 10% elsewhere | 3 to 5 USD | Plus 14 USD if a script runs on all 70 million requests |
| bunny.net, volume network | 5.50 USD | 1.50 to 2.50 USD | Fewer locations |
| Fastly | About 190 USD: 1,000 GB over the free 100 GB at 0.12 USD, and 69 million requests over the free million at 0.01 USD per 10,000 | 25 to 50 USD or more | [Fastly pricing](https://www.fastly.com/pricing). Outside the spending note |
| KeyCDN | 44 USD at 0.04 USD per GB | 12 to 20 USD | [KeyCDN pricing](https://www.keycdn.com/pricing): 4 USD per month minimum, 49 USD minimum payment. Outside the spending note in a spike month |

Fastly and KeyCDN drop out on price. Fastly's caching behavior is the closest to the app's headers (see the earlier research), which doesn't outweigh 190 USD.

## Option (c): static files on a CDN hostname, HTML stays on the origin

The built files, the fonts, the local images, the manifest, and the icon move to a second hostname, for example a `static` subdomain, served by a CDN that pulls from the site. Documents, API requests, and OG images stay where they are.

### What it removes (estimate from the measured costs)

| Per movie page view | Today | Static files elsewhere, RSA 4096 | Static files elsewhere, ECDSA |
| --- | --- | --- | --- |
| Requests at the origin | 39 | 2 (document, error tracking POST) | 2 |
| New TLS connections at the origin | 2 | 1, if the manifest moves too | 1 |
| Proxy CPU | 53 ms | About 15 ms (one handshake, two requests) | About 2.4 ms |
| Node main-thread time | 9.4 ms | About 0.5 ms, plus the POST's unmeasured cost | Same |
| Bytes sent by the origin | 563 to 621 KB | About 60 KB | Same |
| At 500 per second: proxy cores | 27 | About 7.7 | About 1.2 |
| At 500 per second: bytes out | 2.5 Gbit/s | About 240 Mbit/s | Same |

The handshake with ECDSA is estimated at about 1 ms in this proxy (see the benchmark's options table). It isn't measured.

So with both changes, the origin's estimated load at the destination fits the hosts that exist: about 1.2 of the 5.5 free proxy cores, two Node processes, and a quarter of a 1 Gbit/s uplink. Without ECDSA, 7.7 cores don't fit the 5.5 that are free.

### What stays

- Every visitor still opens a TLS connection to the origin. A flood of connections or documents hits the origin directly. This option is no bot or attack answer.
- The error tracking POST, the pool POST, and incoming POST bodies of 150 to 300 Mbit/s at 500 per second.
- OG images: about 220 Mbit/s at the primary mix (estimate from the OG ramp). They can move to the same hostname later, because the `og:image` URL can name any host and they carry `s-maxage` of 7 days.
- Far-away visitors still fetch the document from one European region.

### What changes

- **App:** the build's public path for assets points to the static hostname. Module scripts and fonts from another origin are fetched with CORS, so `/assets/*` must answer `Access-Control-Allow-Origin`. A `preconnect` hint for the hostname keeps the extra connection off the render path. The manifest link moves too, which removes the second connection to the origin.
- **Not needed:** the cookie change, the identity header at the edge, purge hooks, and the 60-second arithmetic. Hashed files are `immutable`, and the CDN never sees HTML or a member's cookie (cookies set for the site's host without a `Domain` attribute aren't sent to a subdomain).
- **Deploys:** a CDN that pulls without the sticky cookie reaches either instance. "Serve a build's script files from every instance during a deploy" already covers that, and the CDN keeps a build's files after the build is gone, which removes the mixed-build problem at its root.
- **Smoke check and benchmarks:** the page view scenario must fetch files from the static hostname, and the origin's numbers then describe documents and POSTs only.

### Where the files could be served from

| Choice | Monthly cost, normal and spike month (estimate) | Setup | Notes |
| --- | --- | --- | --- |
| bunny.net pull zone on the subdomain | 1 to 5 USD normal. 5 to 20 USD in a spike month (about 1 TB) | One CNAME record at the current DNS host | Smart Cache stores scripts, styles, fonts, and images by default. DNS and TLS for the site stay as they are |
| Cloudflare Free, proxying only the subdomain | 0 USD | The nameservers move to Cloudflare. The site's own record stays "DNS only" | Static files are cached by default by extension. Turning the proxy on for the whole site later is option (a) |
| An object store with a CDN | Not priced today | A deploy step uploads each build | More moving parts than a pull zone, and no benefit while the instances can serve every build's files |

## Option (d): TLS termination and a cache on our own hosts

Two or three existing hosts run a TLS terminator and a cache in front of the current proxy, and DNS lists all of them.

- **Software (vendor):** Varnish reads `s-maxage` before `max-age`, takes grace from `stale-while-revalidate`, honors `Vary`, and counts `Age`: "If present and valid, the value of the `Age` header is effectively deduced from all ttl calculations." ([VCL variables](https://vinyl-cache.org/docs/trunk/reference/vcl-var.html)) It's the only option on this page that follows the app's contract without an open question. Hitch terminates TLS 1.2 and 1.3 with HTTP/2 through ALPN and the PROXY protocol. Its latest stable release is 1.8.0 from August 9, 2023. ([Hitch](https://hitch-tls.org/)) HAProxy can terminate TLS instead. Its own cache isn't suitable (earlier research).
- **TLS cores (estimate):** an ECDSA P-256 signature takes 0.036 ms with OpenSSL on these CPUs (measured with `openssl speed`). A full handshake in an OpenSSL-based terminator is then well under 1 ms, so 1,000 handshakes per second need under one core. Encrypting 2.5 Gbit/s and answering 19,500 stored requests per second weren't measured for Varnish or Hitch on these hosts. Expect a few cores, and measure before relying on it.
- **Identity header:** Varnish has no location database built in. The header would use the `Accept-Language` region as the app does today, or a GeoIP module and database that someone keeps current.
- **Bandwidth: unknown, and probably the limit.** 2.5 Gbit/s needs three 1 Gbit/s uplinks at 83% each, or four with room, and DNS round robin doesn't spread visitors evenly. The provider's documentation for dedicated servers says "a dedicated 1 GBit uplink by default and with it unlimited traffic" ([traffic](https://docs.hetzner.com/robot/general/traffic/)). Which product each host is, and what its public uplink sustains, isn't verified. To find out: the product page of each host in the provider's console, `ethtool` on the public interface for the link speed (read-only), and one `iperf3` run to a host outside the provider for what the path sustains.
- **Certificates:** two or three hosts answer for one name. The HTTP challenge reaches a random host, so the certificate needs the DNS challenge or a copy step. Not researched for the current DNS host.
- **Operations and failure modes:** a VCL file, a TLS terminator, certificate renewal on several hosts, and purge calls to every cache. DNS round robin has no health check: a dead host keeps receiving its share until the record changes (30-minute lifetime today). A deploy of the cache empties it. A flood still lands on our hosts.
- **Cost:** 0 EUR on existing hosts.
- **Combination:** with static files on a CDN (option c), the origin needs about 240 Mbit/s and about 1.2 proxy cores, and this layer has nothing left to remove. Options (c) and (d) are alternatives, not steps.

## Option (e): no layer, an ECDSA certificate and more proxy hosts

- **Needs (estimate from the measurements):** about 14 proxy cores, 6 Node processes, and 2.5 Gbit/s. That's three to four hosts that each run the proxy and one or two webapp processes, all listed in DNS.
- **What it removes:** nothing per page view. It divides the cost.
- **Same open points as (d):** the uplinks, certificates on several hosts, and DNS round robin without health checks. In addition, every host needs every build's files during a deploy, and the in-process page caches multiply (one render per process and lifetime, which is small).
- **Cost:** 0 EUR on existing hosts. The most hosts to deploy to and watch of all options.
- **Reversible:** yes, by removing records.

## Comparison

| | (a) Cloudflare, whole site | (b) bunny.net, whole site | (c) Static files on a CDN hostname, plus ECDSA | (d) Own TLS and cache hosts | (e) More proxy hosts, plus ECDSA |
| --- | --- | --- | --- | --- | --- |
| Client handshakes at the origin per page view | 0 | 0 | 1 | 2, on the new hosts | 2 |
| Requests at the origin per page view | 1 POST, plus misses | 1 POST, plus misses | 2 | 1 POST, plus misses, behind the cache | 39 |
| Origin bytes at 500 per second (estimate) | Small | Small | About 240 Mbit/s | 2.5 Gbit/s on our uplinks | 2.5 Gbit/s on our uplinks |
| Proxy cores at 500 per second (estimate) | Under 1 | Under 1 | About 1.2 | A few for TLS and cache, not measured | About 14 |
| Cost, normal month | 0 USD (Pro: 25) | 3 to 5 USD | 0 to 5 USD | 0 | 0 |
| Cost, spike month | 0 USD (5 with a Worker) | 11 to 34 USD | 0 to 20 USD | 0 | 0 |
| Needs the cookie change first | Yes | Yes | No | Yes | No |
| Identity header at the layer | Transform rule, untested | Script on every request | Not needed | VCL, without a location database | Not needed |
| 60-second limit | By arithmetic (50 to 60 seconds), `Age` unverified | Only by purge, and vary by country removes URL purge | Unchanged | Kept: Varnish counts `Age` | Unchanged |
| Member bypass | Cache rule and the app's `private, no-store` | Vary by cookie, pitfalls in the earlier research | Members never reach the CDN | VCL and the app's header | Unchanged |
| Third party sees | All traffic, members included | All traffic, members included | File requests only: address, referrer, user agent | Nothing | Nothing |
| DNS | Moves to Cloudflare | Moves to Bunny DNS, or the site moves to `www` | One CNAME (bunny.net), or moves (Cloudflare) | Several A records | Several A records |
| Bot and flood cover | Yes | Basic | No | No | No |
| Open questions before it works | Five (keying, `Age`, cookie rule on Free, forwarded address, load test through the edge) | Five or more | One (the origin's rate after the change) | Uplinks, certificates, capacity | Uplinks, certificates |
| Reversible | Nameserver move back, hours | DNS change | One build setting and a deploy | Remove records | Remove records |

## Questions for the owner

1. **May a third party terminate TLS for the whole site, members included, and hold the DNS zone?** If no, options (a) and (b) are out, and the choice is between (c) and (d).
2. **Is the destination a capacity target only, or should the same step also cover bots and floods?** Only (a) covers both. The map's note says no bot countermeasure so far, with Cloudflare as a possible later answer.
3. **For static files: Cloudflare for free with the DNS zone moved, or bunny.net for 1 to 20 USD per month with DNS left alone?** The first makes a later move to (a) a switch. The second touches nothing but one record.

## Recommendation

This is a recommendation, not a decision.

1. **Switch the certificate to ECDSA** ("Switch the proxy's certificate from RSA 4096 to ECDSA"). Every option that keeps handshakes at the origin needs it.
2. **Take option (c): serve static files from a CDN hostname.** It removes 37 of 39 requests and about 90% of the bytes, needs no cache key, cookie, purge, or staleness work, keeps members and DNS away from a third party, and is undone with one build setting. Vendor: bunny.net if DNS should stay where it is, Cloudflare Free if the owner expects to want option (a) later.
3. **Run the page view benchmark again** on the public path with new connections. If 500 per second hold for the hour with the document p95 under 300 ms, the destination's capacity part is met without a page cache layer in front.
4. **Keep option (a) on the free plan as the next step,** for the case that the run fails or bots become a problem. "Stop the balancing route from setting its cookie on shared-cacheable responses" is worth doing in any case, because every shared cache needs it.

**Main risk:** the origin's estimated cost after steps 1 and 2 (2.4 ms of proxy CPU per page view) is arithmetic on two things that weren't measured: the handshake cost with ECDSA in this proxy, and the error tracking POST. If either is several times higher, 500 page views per second won't hold, and the origin remains the only thing that answers a flood of new connections. The load run in step 3 settles it within a day.

## Not confirmed from primary sources

- Cloudflare: today's list price of Pro (the plans page didn't render), whether the origin's `Age` shortens the edge lifetime, whether the cache rule's `Vary` uses a header value that a transform rule set, whether the cookie bypass rule and the header expression work on the free plan, which plans can buy the Data Localization Suite, and how concurrent misses for one URL are collapsed.
- bunny.net: how `s-maxage`, `private`, `no-store`, the origin's `Vary`, and `Age` are treated, whether `Set-Cookie` stripping can be turned off per path, the bound on stale copies, Perma-Cache's storage price, the number of locations on the volume network, connection reuse to the origin, and where logs are stored.
- Hosts: the public uplink of each host and what it sustains.
- Self-hosted: Varnish's and Hitch's CPU cost per request and per Gbit/s on these hosts, and the certificate challenge for several hosts with the current DNS host.
- A normal month's bytes and requests: estimated from the crawler rate, not read from a monthly total.
- Fastly's free account details beyond the pricing page (apex addresses, custom VCL): unchanged from the earlier research, not read again.
