# Cloudflare proxy cut-over for goodwatch.app

Staged plan to put `goodwatch.app` and `www.goodwatch.app` behind Cloudflare's proxy. Decision:
[ADR 0013](adr/0013-proxy-site-through-cloudflare.md), accepted by the owner on November 13, 2026. This is its
phase 2 from [edge-cache-cloudflare.md](research/edge-cache-cloudflare.md): proxy with caching off, no Worker.
Written on November 13, 2026, when the Cloudflare zone was only read. Zone settings were applied later the same day;
see [Status](#status). DNS records are unchanged.

Why now: over 99% of requests are anonymous, many from crawlers that pretend to be browsers or search engines
([overload-shed.server.ts](../goodwatch-webapp/app/server/overload-shed.server.ts)). Cloudflare can drop spoofed
search engines and AI training crawlers before they reach abio, which the origin can't do cheaply.

Out of scope: `yepwatch.com`. It isn't a zone in this Cloudflare account, and its move behind a Caddy front on
pgnode01 is a separate change. See [stage 6](#stage-6-later-yepwatchcom).

## Status

Updated November 13, 2026, about 16:00 UTC. Owner decisions: agents do every part of the cut-over outside Coolify
(Q56); AI training crawlers are blocked, AI search and user-triggered fetchers are allowed (Q57). The owner sets
`goodwatch.app` and `www.goodwatch.app` to proxied, later. Both are still DNS-only.

| Step | State |
| --- | --- |
| 0.1 webapp with `edge-client-address.server.ts` | done: both instances run 691d21e1 (includes 6fcec94a3) |
| 0.2 key in the webapp's Coolify environment | done: `EDGE_ORIGIN_KEYS` is set in both instances (checked by name only) |
| 0.2 key in the search roles' `.env` on vector1 | done (one shared `.env`, backed up first) |
| 0.2b search roles redeployed | done: both roles on 6fcec94a3, no `has no key` line, `/mcp` answers 401 with the expected `WWW-Authenticate` |
| 0.3 trusted-header names | done, checked inside every container by name and header name only: `SEARCH_TRUSTED_IP_HEADER` and `AUTH_TRUSTED_IP_HEADER` name `X-Real-Ip` on both instances and both search roles; `PERSON_TRUSTED_IP_HEADER` is unset (falls back to the search header); `EDGE_CLIENT_ADDRESS` is unset (rewriting on) |
| 0.4 Traefik `forwardedHeaders` on abio | done: the running proxy (recreated 15:13 UTC from Coolify's saved configuration) has no `forwardedHeaders` or `proxyProtocol` argument on any entry point, no `--configfile`, and no environment besides `PATH`, so nothing else can set them. vector1 trusts only abio, as planned |
| 0.5 baseline | done, see [Baseline before the flip](#baseline-before-the-flip) |
| 1.1 SSL Full (strict) | done (was Full) |
| 1.2 Minimum TLS 1.2 | done (was 1.0) |
| 1.3 Always Use HTTPS | checked: off |
| 1.4 origin key transform rule | done: owner pasted the key and enabled it. `goodwatch_edge_client_address_total{outcome="cloudflare"}` counts static requests on abio, no `unkeyed` there |
| 1.5 configuration rule | done |
| 1.6 cache bypass rule, Browser Cache TTL | done (TTL was 4 hours, now respect existing headers) |
| 1.7 fake search engines rule | done, plan expression unchanged |
| 1.8 rate limiting rule | deferred, as planned |
| 1.9 AI crawlers | done, see below |
| 2 access log header | optional, owner decides: nothing automated needs it (see [Stage 2](#stage-2-access-log-keeps-the-visitors-address-owner-coolify-ui-proxy-restart)) |
| IP Access Rule from 2014 | left alone: user scope allow (whitelist) for one address, no notes. Owner: confirm or remove |

`static.goodwatch.app` answered 200 for a cached file, a cache-busted file (origin fetch) and `robots.txt` after every
change, with its own `Cache-Control` intact.

AI crawlers (Q57), as applied:

- **AI Crawler and Agent access policies** (bot management): Training **block**; Search and Agents stay **allowed**.
  Requests with the user agents of GPTBot, CCBot, ClaudeBot and Bytespider get 403 on the proxied host.
- That policy didn't block `meta-externalagent`, so a second WAF custom rule, "AI training crawlers", blocks these
  user agents zone-wide (case-insensitive): GPTBot, CCBot, ClaudeBot, anthropic-ai, Claude-Web, Bytespider,
  meta-externalagent, FacebookBot, cohere-ai, cohere-training-data-crawler, Diffbot, omgilibot,
  Google-CloudVertexBot, AI2Bot, Timpibot, ImagesiftBot, MistralAI-Training, Amazonbot. `facebookexternalhit` (link
  previews) isn't matched. The custom rules now use 2 of 5.
- OAI-SearchBot, ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, a browser and
  Googlebot (as a user agent on the static host, outside the fake search engine rule's hosts) get 200.
- **Bot Preference Sync is off** (it was on). With it on, the training block made Cloudflare prepend its own section to
  `robots.txt` on proxied hosts: a Content-Signal line and Disallow for about 40 agents, among them Baiduspider,
  PetalBot and GoogleOther. That would change the app's `robots.txt` after the flip. With it off, `robots.txt` through
  Cloudflare is byte-identical to the origin's.
- `Google-Extended` isn't a crawler, only a `robots.txt` token that Googlebot honors, so no edge rule can block it.
  To opt out of Google's training, the app's `robots.txt` needs a `User-agent: Google-Extended` / `Disallow: /`
  group. Not done yet.
- Managed robots.txt, AI Labyrinth, Bot Fight Mode and JS detections stay off.

Undo values for every change are kept outside the repository. In short: SSL back to Full, Minimum TLS back to 1.0,
Browser Cache TTL back to 14400, Training back to `disabled`, Bot Preference Sync back to on, and delete the rules.

Before the flip, the owner still needs to:

1. Decide on stage 2 (one extra access log line, then a proxy restart) or accept that abio's access log shows
   Cloudflare addresses after the flip. It's not required: nothing automated reads visitor addresses from that log
   in a way the flip breaks silently (see stage 2).
2. Decide on the 2014 IP allow rule (IP Access Rules, under **Security > WAF > Tools** in the zone). Not a flip
   blocker.
3. Pick a quiet hour and flip (stage 3).

Done since the last update: the key is in the webapp's environment and in the enabled transform rule, and
steps 0.3, 0.4 and 0.5 are checked by an agent.

## Baseline before the flip

Recorded November 13, 2026, 15:10 to 15:50 UTC, by an agent, with apex and www DNS-only. Compare the stage 4 numbers
with these, at a similar time of day. Raw scrapes stay outside the repository.

**Caveats.** abio's proxy was recreated at 15:13:29 UTC, so its Docker log only goes back to then. The webapp was
deployed twice during the window (691d21e1 at about 15:05, 5fb928ad at about 15:30), so counters restarted and the
first minutes after each start run warm. The longer view comes from vector1's proxy, which sees only the half of the
traffic abio balances to it. Grafana Cloud keeps the webapp metrics series for a longer comparison.

Request volume and status mix:

| Source | Window | Requests | Rate | Status mix |
| --- | --- | --- | --- | --- |
| abio proxy, all `goodwatch.app` | 15:13 to 15:45 (32 min) | 121,914 | 64/s; per minute median 3,640, p95 5,749, max 6,300 | 2xx 51.3%, 3xx 13.2% (308 13.1%), 4xx 32.3% (403 24.6%, 429 7.2%), 5xx 3.1% (all 503, no 502), status 0 (client gone) 0.1% |
| vector1 proxy, its half | 24 h to 15:15 | 3,079,186 | 36/s; per minute median 1,743, p95 5,102, max 15,735 | 2xx 51.6%, 3xx 11.6%, 4xx 36.2% (403 23.8%, 429 11.4%), 5xx 0.65% (503 19,671, 502 253) |
| webapp metrics, abio instance | 7.4 min, 15:13 to 15:20 | 15,150 | 34/s | 2xx 50.4%, 3xx 13.7%, 4xx 30.7%, 5xx 5.2% |
| webapp metrics, vector1 instance | same | 15,199 | 34/s | 2xx 54.6%, 3xx 12.8%, 4xx 30.9%, 5xx 1.7% |

Shedding: every 5xx in the webapp metrics was a shed busy page (`goodwatch_overload_shed_total` rose by 790 on abio
and 262 on vector1 in the 7.4 minutes, equal to the 5xx counts). Over 60% of app requests are `/person/:personKey`;
person policy in the same window: about 8,900 allowed, 3,900 normalized (3xx), 2,500 limited (4xx) across both
instances. The app's 4xx come almost entirely from person pages and `/sign-up` and `/sign-in`.

Latency, apex requests in abio's proxy log (total time, ms):

| | p50 | p90 | p99 |
| --- | --- | --- | --- |
| all statuses (32 min) | 58 | 532 | 1,244 |
| 2xx only | 286 | 655 | 1,401 |
| 503 | 6 | 262 | 1,239 |
| vector1, all statuses (24 h) | 95 | 731 | 3,883 |

Webapp histogram, time to headers for HTML GETs: p50 at most 0.1 s on both instances, p90 at most 1 s (abio) and
0.5 s (vector1), p99 at most 2 s and 1 s.

TTFB, 5 samples each, median of `time_starttransfer` (both vantage points are in Germany; no second region was
available to the agent):

| URL | desktop (residential) | hq (datacenter, near abio) |
| --- | --- | --- |
| `/` | 0.18 s | 0.05 s |
| `/movie/603-the-matrix` | 0.20 s | 0.04 s |
| `/sitemaps/sitemap.xml` (`/sitemap.xml` 301s there) | 0.09 s | 0.05 s |

3 of 15 desktop samples took 1 to 2 s to connect (a TCP retry), already before Cloudflare.

Crawler share by User-Agent (Cloudflare's own bot analytics will be more exact after the flip):

| Class | abio, 32 min | vector1, 24 h |
| --- | --- | --- |
| browser-like (includes the distributed crawler) | 88.9% | 81.6% |
| other bots and scripts (`bot`, `curl`, `python` and similar) | 7.4% | 10.7% |
| AI training crawlers (blocked at the edge after the flip) | 2.7% | 3.4% (104,248) |
| AI search and user fetchers (stay allowed) | 0.1% | 3.5% (108,654) |
| SEO tools | 0.7% | 0.5% |
| other search engines | 0.3% | 0.2% |
| Googlebot, Bingbot by User-Agent | under 0.01% | 33 and 6 requests |

Distinct connecting addresses: 79,277 in abio's 32 minutes.

Googlebot crawl (abio candidate collector and the verified export):

| Day (UTC) | Nov 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| verified (Google IP and UA) | 4 | 5 | 24 | 61 | 18 | 10 | 13 | 89 | 33 |
| Googlebot UA, unverified | 91 | 36 | 191 | 73 | 90 | 15 | 13 | 96 | 34 |

Verified statuses are almost all 200, a few 404 and 301, one 503 and one 410 on Nov 11. After the flip the verified
count drops to zero by design (see stage 2); use Search Console crawl stats instead.

Search Console:

- Sitemaps: index `/sitemaps/sitemap.xml` (last read Oct 30) with `sitemap_new` (300 URLs, read Nov 7),
  `sitemap_people` (30, Nov 11), `sitemap_movie_detail_0` (700), `sitemap_show_detail_0` (300),
  `sitemap_categories` (87), `sitemap_static` (11), all read Oct 18 or later, 0 warnings, 0 errors.
- URL inspection: `/` indexed (last crawl Nov 11 19:35 UTC, mobile, fetch successful); `/discover` crawled, not
  indexed (Oct 11); `/movie/603-the-matrix`, `/show/1396-breaking-bad`, `/person/287-brad-pitt` unknown to Google.
- Search performance: only `/` gets impressions, 1,492 impressions and 93 clicks Oct 14 to Nov 12; about 100
  impressions and 5 to 13 clicks a day in the last week.
- Crawl stats and host status are UI only: owner, open **Settings > Crawl stats** before the flip and note total
  requests, average response time and host status for comparison.

Behavior checks:

| Check | Baseline |
| --- | --- |
| Search limit | 11 POSTs to `/api/combined-search` within a few seconds (site `Origin`, empty `q`, so no search runs): ten 400, then 429. One POST from hq at the same time: 400 |
| `/mcp` initialize without token | 401, `www-authenticate: Bearer error="invalid_token", error_description="Missing Authorization header", scope="mcp:read mcp:write", resource_metadata="https://goodwatch.app/.well-known/oauth-protected-resource/mcp"`, body 76 bytes, `cache-control: private, no-store, no-transform` |
| `/.well-known/oauth-protected-resource` and `/mcp` suffix | 200 JSON, 339 bytes, SHA-256 starts `7f88d0ccea058869` |
| `/.well-known/oauth-authorization-server/api/auth`, `/.well-known/openid-configuration/api/auth` | 200 JSON, 2,301 bytes, both `196cc77bdd26b0b6` (without the suffix: 404) |
| `robots.txt` | 200, 198 bytes, `65d73a969077a6c2` |
| `https://www.goodwatch.app/movie/603-the-matrix` | 308 to the apex |
| `http://goodwatch.app/` | 308 to HTTPS |
| `http://goodwatch.app/.well-known/acme-challenge/test` | 404, no redirect |
| `https://goodwatch.app/` | 200, `cache-control: private, max-age=0` |
| `/og/movie/603-the-matrix.png` | 200 `image/jpeg`, `cache-control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400` |
| `goodwatch_edge_client_address_total` | instances: `direct` most requests, `unknown` a few hundred (no connecting address), `cloudflare` 8 on abio (static), none on vector1. Search roles: `unknown` about 4,600 each (health checks), `direct` about 1,120, and one `unkeyed` on search-a: a Cloudflare address without the key reached the origin directly (WARP or another account's Worker). After the flip, a trickle of `unkeyed` like this is normal; a rise in step with traffic means a key mismatch |
| `goodwatch_search_rate_limit_total` | `allowed` 485 and 482 on the two search roles over about 100 minutes, `limited` 1 |

## Rules for this rollout

- The Traefik configuration under `/data/coolify/proxy` on abio holds TLS keys. Agents never read, list or print
  anything there. Every Traefik change below is an owner step in the Coolify UI.
- No Coolify database or API writes. No zone writes by agents unless the owner asks for a specific one.
- The repository is public: no origin addresses in this file, issues or commits.

## Zone state, read on November 13, 2026

| Item | Value |
| --- | --- |
| Plan | Free |
| SSL/TLS mode | **Full** (not strict) |
| Edge certificate | Universal, `goodwatch.app` + `*.goodwatch.app`, Let's Encrypt, backup from SSL.com, valid to 2027-01-07 |
| Proxied records | only `static.goodwatch.app` |
| DNS-only records on abio's address | `goodwatch.app`, `www.goodwatch.app`, `*.goodwatch.app` |
| Other DNS-only records | `a`, `coolify`, `status`, `windmill` (other hosts), mail and verification records |
| AAAA records | none (origin is IPv4 only; Cloudflare will add IPv6 at the edge) |
| Always Use HTTPS | off |
| Minimum TLS | 1.0 |
| HTTP/2, HTTP/3, WebSockets | on |
| 0-RTT, Early Hints, Rocket Loader, Always Online | off |
| Email Obfuscation | **on** (rewrites HTML) |
| Automatic HTTPS Rewrites, Server Side Excludes | on (rewrite HTML) |
| Browser Integrity Check | on |
| Security Level | medium |
| Browser Cache TTL | 4 hours (zone default) |
| Cache Level | aggressive |
| Tiered Cache | on, Smart topology on (since 2026-10-29) |
| Proxy read timeout | 125 s |
| Cache, configuration, origin, transform, custom firewall and rate limiting rules | none |
| Page Rules, Worker routes | none |
| Bot Fight Mode, JS detections | off |
| Block AI bots, AI Labyrinth, managed robots.txt | off / disabled |
| Authenticated Origin Pulls | off |
| Managed transforms | all off |
| IP Access Rules | one user-scope allow rule from 2014 for a single address. Review it: an allowed address skips security features. |

Origin certificates on abio, checked with SNI against the origin directly: `goodwatch.app`, `www.goodwatch.app` and
`static.goodwatch.app` each present a valid Let's Encrypt (YE2) certificate for exactly that name, valid to
2027-02-11, issued through Traefik's HTTP-01 challenge on port 80.

## Client addresses today

abio's Traefik (2.10.7) overwrites `X-Real-Ip` and `X-Forwarded-For` with the connecting address, because it trusts
no peer for forwarded headers. vector1's Traefik trusts only abio, so the instance and search roles there see the
same values. The app reads:

| Reader | Header | Purpose |
| --- | --- | --- |
| Search limit (`search-runtime/rate-limit.server.ts`) | `SEARCH_TRUSTED_IP_HEADER` (`X-Real-Ip` in production) | 10/30 s, 60/10 min per visitor |
| Person page limits (`person-request.server.ts`) | `PERSON_TRUSTED_IP_HEADER`, falls back to the search header | abuse limits, forward-confirmed Googlebot/Bingbot check by address |
| Better Auth (`auth/auth.server.ts`) | `AUTH_TRUSTED_IP_HEADER` | auth endpoint rate limits, session IP |
| Poster impressions, hot cards limit, feedback hash | first entry of `X-Forwarded-For` | per-address limits, never stored raw |
| `api.guess-country` | `remix-utils` header list | country guess only |
| Overload shedder | cookies, user agent, loop lag | **no address** |
| Traefik access log on abio | `ClientHost` (connecting address) + User-Agent | crawler analysis, verified Googlebot export (`goodwatch-proxy/seo/`) |

Proxied without changes, every one of these would see a Cloudflare edge: thousands of visitors would share a few
edge addresses, so the search limit, the person page limits and the auth limits would trip for everyone at once, and
the Googlebot check by reverse DNS would never pass.

### Why Traefik should not trust Cloudflare's ranges

The obvious fix, adding Cloudflare's ranges to `forwardedHeaders.trustedIPs` on abio, makes the address forgeable.
For a trusted peer, Traefik 2.10.7 keeps the incoming `X-Forwarded-*` and `X-Real-Ip` headers and only sets
`X-Real-Ip` when it's empty (`pkg/middlewares/forwardedheaders/forwarded_header.go`). Cloudflare strips a visitor's
`X-Real-Ip` on ordinary requests, but a Worker's subrequest can set it, and Cloudflare appends to a visitor's own
`X-Forwarded-For`, so its leftmost entry is the visitor's choice. Trusting Cloudflare at Traefik would put the
production limits on headers a caller can shape.

`CF-Connecting-IP` is the header to use. It's only trustworthy for requests that came through **this** zone:
Cloudflare's address ranges also carry other accounts' Workers, which can point at abio with a GoodWatch host name
and choose `CF-Connecting-IP` themselves
([Cloudflare headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)). So the app requires
two things: abio's untrusting Traefik says the connection came from a Cloudflare address (its `X-Real-Ip`), and the
request carries a secret header that only this zone adds.

### The app change (shipped with this plan)

[`edge-client-address.server.ts`](../goodwatch-webapp/app/server/edge-client-address.server.ts) runs on Node's
`http.server.request.start` channel, before the shedder, page cache, browser gate and Remix:

- If `X-Real-Ip` is in Cloudflare's published ranges, `GW-Edge-Key` matches one of the keys in `EDGE_ORIGIN_KEYS`, and
  `CF-Connecting-IP` is one valid address: `X-Real-Ip` and `X-Forwarded-For` become that address. Every reader in the
  table above then counts the visitor without further changes.
- Otherwise `CF-Connecting-IP` and `True-Client-IP` are removed, so nobody can name their own address through them.
  Behavior is otherwise as today.
- `GW-Edge-Key` is always removed before the app sees the request. Comparison is constant-time.
- Without `EDGE_ORIGIN_KEYS` nothing is restored (fail closed). Two comma-separated keys allow a rotation.
- `EDGE_CLIENT_ADDRESS=off` stops the rewriting; the key header is still removed.
- The key header is removed from every representation Node keeps (`headers`, `headersDistinct`, `rawHeaders`).
- `goodwatch_edge_client_address_total{outcome}` counts each request: `cloudflare` (restored), `unkeyed` (a Cloudflare
  address without a valid key), `invalid`, `direct`, `unknown`. It's the positive evidence that restoration works.

The key is set by a request header transform rule in the zone (stage 1, step 4), which overwrites any value a visitor
sends. It's a shared secret: it lives in the Cloudflare dashboard and in Coolify's environment for the webapp and
the search roles, never in the repository or a chat.

It's safe before the flip: without the key nothing changes, and with it only `static.goodwatch.app` requests arrive
through the zone. The search roles run the same image, so they need their own deploy and the same environment
variable ([search-role-deploy.md](search-role-deploy.md)).

The same commit fixes a pre-existing gap the review found: `isStaticHost` compared the whole `Host` header, so
`Host: static.goodwatch.app:443` (or a trailing dot) reached Traefik's static router but got the full app instead of
files only. It now ignores any port and a trailing dot when the configured static host has no port.

The ranges are hard-coded from `https://www.cloudflare.com/ips-v4` and `/ips-v6` (read November 13, 2026).
Cloudflare announces changes in advance. When the lists change, update `CLOUDFLARE_RANGES` and the Traefik allowlist
in stage 5 together.

Remaining limit: another account's Worker can still reach the origin from Cloudflare's ranges and skip this zone's
WAF rules, even through the stage 5 allowlist. It can't choose the address the limits count (it has no key). Closing
that path needs per-hostname Authenticated Origin Pulls with our own certificate, or a Traefik check of the key
header; see stage 5.

## Stages

Each stage lists who does it, how to check it and how to undo it. Don't start a stage until the previous gate holds.

### Stage 0: Prepare (no visitor-visible change)

| # | Step | Who |
| --- | --- | --- |
| 0.1 | Deploy the webapp with `edge-client-address.server.ts` (push to main auto-deploys both instances). | done by agent, verify deploy |
| 0.2 | Generate a key on a private machine (`openssl rand -hex 32`), keep it in the password manager. Add `EDGE_ORIGIN_KEYS=<key>` to the environment of the webapp application and of both search roles in Coolify. Never paste it into a chat, issue or commit. | owner |
| 0.2b | Redeploy the webapp and the search roles with the new commit and variable ([search-role-deploy.md](search-role-deploy.md)). Startup logs must not contain `EDGE_ORIGIN_KEYS has no key`. | agent or owner |
| 0.3 | Confirm production's trusted-header settings name `X-Real-Ip` (or `X-Forwarded-For`): `SEARCH_TRUSTED_IP_HEADER`, `PERSON_TRUSTED_IP_HEADER` if set, `AUTH_TRUSTED_IP_HEADER`. Look at the names only, never print values of other variables. | owner (Coolify UI) |
| 0.4 | Confirm abio's Traefik has **no** Cloudflare ranges and no `insecure` in its forwarded-header arguments: in Coolify, **Servers > abio > Proxy > Configuration**, search the editor for `forwardedHeaders`. Expected: no such line on abio's `http`/`https` entry points. | owner |
| 0.5 | Record a baseline: search limit test (below), 5 URL inspections and sitemap status in Search Console (`goodwatch-webapp/scripts/gsc.py`), TTFB for `/`, a movie page and `/sitemap.xml` from two regions, the unauthenticated `/mcp` answer, the OAuth `.well-known` documents and `robots.txt`. | agent |

Gate: both instances and both search roles run the new commit with `EDGE_ORIGIN_KEYS` set;
`goodwatch_search_rate_limit_total` keeps counting `allowed` as before.

### Stage 1: Zone settings that are inert or safe before the flip (owner, Cloudflare dashboard)

All of these only affect proxied hostnames. Today that's `static.goodwatch.app`, whose origin certificate is valid.

1. **SSL/TLS > Overview: Full (strict).** Static keeps working (its origin certificate is valid for its name). Check:
   `curl -sI https://static.goodwatch.app/manifest.webmanifest` answers 200, no 526. Undo: back to Full.
2. **SSL/TLS > Edge Certificates: Minimum TLS 1.2.** Optional, zone-wide. TLS 1.0/1.1 clients are negligible. Undo:
   back to 1.0.
3. **Leave Always Use HTTPS off.** abio's Traefik already redirects HTTP to HTTPS with 301 and still answers the
   Let's Encrypt HTTP-01 challenge on port 80. In Full and Full (strict), Cloudflare connects to the origin with the
   visitor's scheme, so a challenge request reaches port 80 through Cloudflare. An edge redirect would send the
   challenge to HTTPS, where Traefik doesn't answer it, and renewals would fail.
4. **Rules > Transform Rules > Modify Request Header > Create rule** "goodwatch origin key":
   - When: `(http.host in {"goodwatch.app" "www.goodwatch.app" "static.goodwatch.app"})`
   - Then: **Set static**, header name `GW-Edge-Key`, value: the key from step 0.2.

   This proves to the app that a request came through this zone (see [the app change](#the-app-change-shipped-with-this-plan)).
   Rotation: put `new,old` into `EDGE_ORIGIN_KEYS`, redeploy, change the rule's value to the new key, then remove the
   old key and redeploy. Undo: delete the rule (the app then stops restoring addresses, so do it only together with a
   DNS-only rollback).
5. **Rules > Configuration Rules > Create rule** "goodwatch site: no HTML rewriting, no browser check":
   - When: `(http.host in {"goodwatch.app" "www.goodwatch.app"})`
   - Then: Email Obfuscation **Off**, Automatic HTTPS Rewrites **Off**, Browser Integrity Check **Off**. Rocket Loader,
     Early Hints and Under Attack mode are off zone-wide; leave them off.

   Why: email obfuscation and HTTPS rewrites change the server-rendered HTML, which breaks React hydration on pages
   with an email address (support, legal). The browser integrity check challenges API, MCP and OAuth clients that
   don't look like browsers. Bot handling moves to the explicit rules in step 7.
6. **Caching > Cache Rules > Create rule** "goodwatch site: no edge cache":
   - When: `(http.host in {"goodwatch.app" "www.goodwatch.app"})`
   - Then: **Bypass cache**.

   Also set **Caching > Configuration > Browser Cache TTL: Respect Existing Headers** (zone-wide; today 4 hours).
   Bypassed responses shouldn't be touched by it, but this removes the doubt; static files send their own one-year
   `immutable` policy and are unaffected. Stage 4 checks that `Cache-Control` arrives unchanged.

   This keeps HTML, `?_data=` loader responses, member traffic, APIs, `/mcp`, OAuth, `/og/*` images, sitemaps and
   robots uncached at the edge. The origin's own headers (`private, max-age=0` documents, `private, no-store` member
   responses, OG and sitemap policies) reach browsers unchanged. Static files keep using `static.goodwatch.app`.
   Edge caching of anonymous HTML is phase 3 of ADR 0013 and has its own gates.
7. **Security > WAF > Custom rules** (Free allows 5). "Fake search engines": When
      `(http.host in {"goodwatch.app" "www.goodwatch.app"} and not cf.client.bot and (http.user_agent contains "Googlebot" or http.user_agent contains "Google-InspectionTool" or http.user_agent contains "Storebot-Google" or http.user_agent contains "bingbot" or http.user_agent contains "Applebot" or http.user_agent contains "DuckDuckBot" or http.user_agent contains "YandexBot"))`
   Then **Block**. These are the user agents the overload shedder lets through (`LET_THROUGH` in
   `overload-shed.server.ts`); a crawler that claims one without being Cloudflare-verified is spoofing.
   `cf.client.bot` is Cloudflare's verified-bot flag, available on Free. Verified Googlebot and Bingbot never match.
   Don't add a blanket "skip for verified bots" rule: AI Crawl Control adds its blocks after the custom rules, and such
   a skip would let verified AI training crawlers past them.
   The proxy limits on abio from owner Q49 (`goodwatch-proxy/traefik/README.md`: 120 open anonymous requests per
   router, 60 a minute per crawler User-Agent) count by host and by User-Agent, not by address, so they keep working
   behind Cloudflare unchanged.
8. **Security > WAF > Rate limiting rules** (Free allows 1): defer until a week of proxied traffic shows per-address
   rates. A starting point to discuss: `not cf.client.bot` and page GETs without the `gw_browser=1` cookie, per IP, over
   60 in 10 s, block for 10 s. Per-address limits don't stop the measured distributed crawler (12,000 addresses); the
   shedder still covers that.
9. **AI Crawl Control** (owner decision). Recommendation: block AI **training** crawlers (GPTBot, ClaudeBot, CCBot,
   Bytespider, Meta-ExternalAgent and similar), allow AI **search** and **user-initiated** fetchers (OAI-SearchBot,
   ChatGPT-User, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User), since GoodWatch wants to be used from
   AI apps. Keep managed robots.txt, AI Labyrinth and Bot Fight Mode off: Bot Fight Mode can't be skipped by WAF rules
   and challenges API clients; robots.txt stays owned by the app. After saving, check in **Security > WAF** that the AI
   Crawl Control rule exists and that nothing earlier skips it.

Gate: the apex/www rules 5 to 7 exist and show zero matches (8 is deferred; check 9's rule separately), since those hostnames aren't proxied yet. The key
transform rule (4) already matches `static.goodwatch.app` requests, and the webapp's
`goodwatch_edge_client_address_total{outcome="cloudflare"}` starts counting them (static requests that reach the app),
while `outcome="unkeyed"` stays near zero. Static still answers.

Undo for 5 to 9: disable or delete the rule. For step 4, see its own undo note.

### Stage 2: Access log keeps the visitor's address (owner, Coolify UI, proxy restart)

Without this, abio's access log shows only Cloudflare edges after the flip, and the verified-Googlebot export in
`goodwatch-proxy/seo/` stops finding Googlebot (it checks `ClientHost` by reverse DNS).

In **Servers > abio > Proxy > Configuration**, add one line to the `command:` list next to the other
`accesslog.fields.headers` lines, save, then **Restart Proxy** in a quiet minute (a few seconds of refused
connections on every site on abio):

```yaml
      - '--accesslog.fields.headers.names.Cf-Connecting-Ip=keep'
```

Do **not** add `--entrypoints.https.forwardedHeaders.trustedIPs=<Cloudflare ranges>`; see
[why](#why-traefik-should-not-trust-cloudflares-ranges).

Follow-up for the SEO export (agent, before the flip): Traefik can't tell this zone's requests from another account's
Worker, so a logged `Cf-Connecting-Ip` is not proof of Googlebot, even from a Cloudflare `ClientHost`. Until the
origin checks zone authentication at ingress (stage 5's stronger option), keep the logged header for diagnostics
only, and mark records with a Cloudflare `ClientHost` as "unverifiable" instead of verifying them. Use Search Console's
crawl stats and Cloudflare's verified-bot analytics for Googlebot volume meanwhile. Never log the key.

Undo: remove the line, Restart Proxy.

**Optional (checked November 13, 2026).** After the flip, `ClientHost` in abio's log is a Cloudflare edge address for
every apex and www request, with or without this stage. What reads abio's access log:

- `goodwatch-googlebot.service` (candidate collector) keeps recording Googlebot user agents; it doesn't use the
  address.
- `goodwatch-googlebot-export` verifies only a `ClientHost` inside Google's crawler ranges. Cloudflare-peer records
  fail that check and are counted as `excluded_unverified_candidates`, so the verified CSV goes quiet instead of
  claiming wrong visits. That's safe; it means about 10 to 90 verified Googlebot requests a day stop appearing. The
  stage 2 line doesn't bring them back, since a logged `Cf-Connecting-Ip` isn't proof (see above). Updating the
  export to label these records "unverifiable" and say why in its package text is a non-blocking follow-up.
- `goodwatch-search-ingress.service` (search acceptance) counts routers, methods and statuses, not addresses.
- fail2ban on abio runs only the `sshd` jail; Grafana Alloy ships metrics, not logs. Neither reads the proxy log.
- Traefik's own limits on abio (in-flight per host, crawler rate per User-Agent) don't use addresses.

So stage 2 only keeps visitor addresses available for manual crawler analysis. The app's limits never depended on
the log; they get the visitor's address from the key check.

### Stage 3: Flip (owner, Cloudflare dashboard)

**The flip can happen when all of these hold:**

1. Stage 0 gate: the new commit runs on both instances and both search roles with `EDGE_ORIGIN_KEYS`, and the
   trusted-header names are confirmed.
2. Stage 1 steps 1, 4, 5, 6 and 7 are saved (SSL Full (strict), origin key transform rule with the same key, configuration
   rule, cache bypass rule and zone Browser Cache TTL, fake-search-engine rule).
3. Stage 2 is applied, or the owner accepts losing visitor addresses in the access log for a while.
4. It's a quiet hour (European night), the owner is at the dashboard, and nobody is deploying.

Then, in **DNS > Records**, set **Proxied** on `goodwatch.app`, then on `www.goodwatch.app`. Keep their targets. Leave
`*.goodwatch.app`, `coolify`, `status`, `windmill`, `a` and mail records DNS-only.

Before flipping, note the exact time for the verification and rollback logs.

### Stage 4: Verify (agent, owner for the signed-in parts)

Within 15 minutes:

| Check | Command or action | Expected |
| --- | --- | --- |
| Edge in front | `curl -sI https://goodwatch.app/` | `server: cloudflare`, `cf-ray`, `cf-cache-status: DYNAMIC`, `cache-control: private, max-age=0` unchanged |
| www redirect | `curl -sI https://www.goodwatch.app/movie/603-the-matrix` | one 308 to `https://goodwatch.app/movie/603-the-matrix` (308 in the baseline) |
| HTTP | `curl -sI http://goodwatch.app/` | 308 to HTTPS (from Traefik, as in the baseline) |
| ACME path reaches port 80 | `curl -sI http://goodwatch.app/.well-known/acme-challenge/test` | 404 from the origin, not a redirect |
| Members | owner signs in, opens My shows and settings | works; responses `private, no-store`; `cf-cache-status: DYNAMIC` or `BYPASS` |
| Google sign-in | owner signs in with Google | callback completes |
| Discord link | owner links Discord from settings | `/discord/link/callback` completes |
| MCP | an `initialize` POST to `/mcp` without a token, and one MCP client connected end to end (sign-in, a read tool, a write tool) | same status, `WWW-Authenticate` and body as the stage 0.5 baseline; the client works |
| OAuth discovery | the `/.well-known/oauth-protected-resource`, `oauth-authorization-server` and `openid-configuration` URLs recorded in the baseline | 200 JSON, byte-identical to the baseline |
| Streaming | `curl -sN -o /dev/null -w '%{time_starttransfer} %{time_total}\n'` on a movie page, and a Discover search from the browser | first byte well before the end; search results stream in |
| OG images | `curl -sI https://goodwatch.app/og/movie/603-the-matrix.png` (any known card path) | 200, same `content-type` as the baseline (`image/jpeg` for this path), origin `cache-control` unchanged, `cf-cache-status: DYNAMIC` |
| Sitemap, robots | `curl -sI https://goodwatch.app/sitemap.xml`; `curl -s https://goodwatch.app/robots.txt` | 200 XML; robots identical to the baseline (no Cloudflare additions) |
| Restoration, positive evidence | scrape `goodwatch_edge_client_address_total` on every webapp instance and both search roles (metrics port on the private network) | `outcome="cloudflare"` rises on each of them with traffic; `unkeyed` and `invalid` stay near zero. `unkeyed` rising means the key in Coolify and in the transform rule differ: roll back to DNS-only, then fix |
| Visitor address, behavior | from machine A, run 11 searches in 30 s; at the same time from machine B (other address) run one | A gets 429, B doesn't. This alone doesn't prove restoration (A and B can use different edges); it complements the metric |
| Key not logged | owner on abio: `docker logs --since 5m coolify-proxy 2>&1 \| grep -ci gw-edge-key` | `0` (access log headers default to drop) |
| Access log | owner on abio: `docker logs --since 5m coolify-proxy 2>&1 \| grep -c Cf-Connecting-Ip` | non-zero after stage 2 |
| Shedder | `goodwatch_overload_shed_total` and the "Overload:" log line | unchanged behavior; busy pages arrive as 503 from the origin, not a Cloudflare error page |
| Errors | Cloudflare **Analytics > Traffic** by status | no 52x; any 520/522/524 means origin connection trouble |

Within 48 hours:

- Search Console: URL inspection of the 5 baseline URLs (live test), sitemaps status, and in the UI **Settings >
  Crawl stats > Host status** (server connectivity, robots.txt fetch). Expect no change; a drop in crawl requests
  or host status warnings means Googlebot is being challenged: check **Security > Events** for verified bots.
- Bing Webmaster Tools: crawl errors for the same period.
- Security Events: count of "Fake search engines" blocks, and no blocks of verified bots.
- Load on abio: render time and shed counts before and after.

### Stage 5: Lock the origin to Cloudflare (owner, after a week of clean stage 4)

Constraints found while planning:

- abio's ports 80 and 443 also serve other projects' sites and their Let's Encrypt challenges. A host firewall rule
  limited to Cloudflare's ranges would cut them off, unless every name on abio is proxied.
- Traefik's ports are Docker-published, so UFW `INPUT` rules don't filter them; Docker's NAT goes through `FORWARD`
  and the `DOCKER-USER` chain ([private-administration.md](private-administration.md) notes the same).

So lock at Traefik, per hostname. Add a dynamic configuration on abio
(**Servers > abio > Proxy > Dynamic Configurations > + Add**, file `goodwatch-cloudflare-only.yaml`):

```yaml
# Owner: gw-webapp. Only Cloudflare may reach goodwatch.app on abio. Remove this file before a DNS-only rollback.
http:
  middlewares:
    gw-webapp-cloudflare-only:
      ipWhiteList:
        # No ipStrategy: Traefik 2.10 matches the connecting address. Cloudflare ranges as of 2026-11-13, the same list
        # as CLOUDFLARE_RANGES in goodwatch-webapp/app/server/edge-client-address.server.ts.
        sourceRange:
          - 173.245.48.0/20
          - 103.21.244.0/22
          - 103.22.200.0/22
          - 103.31.4.0/22
          - 141.101.64.0/18
          - 108.162.192.0/18
          - 190.93.240.0/20
          - 188.114.96.0/20
          - 197.234.240.0/22
          - 198.41.128.0/17
          - 162.158.0.0/15
          - 104.16.0.0/13
          - 104.24.0.0/14
          - 172.64.0.0/13
          - 131.0.72.0/22
          - 2400:cb00::/32
          - 2606:4700::/32
          - 2803:f800::/32
          - 2405:b500::/32
          - 2405:8100::/32
          - 2a06:98c0::/29
          - 2c0f:f248::/32
          # Private network (benchmarks and checks from inside).
          - 10.0.0.0/16
```

Then add `gw-webapp-cloudflare-only` as the **first** middleware of the routers `gw-webapp-https`,
`gw-webapp-member-https`, `gw-webapp-crawler-https` and `gw-webapp-www-https` in `goodwatch-balance.yaml`,
`gw-search-https` in
`goodwatch-search.yaml`, and the HTTPS router that serves `static.goodwatch.app` (already proxied), through the same
Coolify page. Without the static router, a direct request with SNI and `Host` for the static name still reaches the
app (files only since this commit, but outside Cloudflare). Middlewares are referenced across files with no suffix inside
the file provider. Leave the `http` routers alone: the ACME challenge router outranks them, and they only redirect.

Coolify's own label routers for `goodwatch.app` (priority 39) stay underneath and have no allowlist. They only
answer if the files above are deleted, which is also the rollback path.

Check: from a machine outside, `curl -sk --resolve goodwatch.app:443:<origin address> https://goodwatch.app/` gets 403;
through Cloudflare it's 200. Let's Encrypt renewals keep working (challenge on port 80, outside these routers).

Stronger, later: per-hostname Authenticated Origin Pulls with a certificate of our own, which proves the request came
through this zone and not another account's Worker. Needs a TLS option with client auth on abio; plan separately.

Undo: remove the middleware from the routers (or delete the file and the references in one save).

### Stage 6: Later: yepwatch.com

After the Caddy front on pgnode01 is live and `yepwatch.com` is a zone in this account (nameserver change): proxy it
with Full (strict), WebSockets on (already zone default), a cache bypass rule for the gateway and API paths, and the
same address rule at the Caddy front: take the client address from `CF-Connecting-IP` only for requests that come
from Cloudflare's ranges **and** carry that zone's key header (or arrive over per-hostname Authenticated Origin
Pulls), then strip the key. Cloudflare's ranges alone are not enough, as for goodwatch.app. Never take the address
from the left of `X-Forwarded-For`. Cloudflare deploys can drop long-lived WebSockets; the clients already fall back to polling and
reconnect. Plan this with its own checks.

## Rollback

| Situation | Action | Time |
| --- | --- | --- |
| A rule misbehaves (blocks, challenges) | disable that rule in the dashboard | seconds |
| Address counting wrong while proxied | **roll back to DNS-only first** (row below). Turning `EDGE_CLIENT_ADDRESS` off or reverting the commit while still proxied makes every limit count Cloudflare edges, which is worse. After DNS-only has settled (TTL plus a margin), fix or revert | minutes, then one deploy |
| Broad breakage, Cloudflare incident | **if stage 5 is in place, remove the allowlist middleware first**; then set `goodwatch.app` and `www.goodwatch.app` to **DNS only** | minutes: resolvers keep Cloudflare's answers for up to the 5-minute TTL |
| Cloudflare dashboard and API down | nothing in our hands changes DNS (Cloudflare is the authoritative DNS). Accepted in ADR 0013 | |

Direct-origin TLS stays valid (Let's Encrypt on abio), so DNS-only serves immediately without certificate warnings.
Leave SSL Full (strict), the configuration and cache rules in place on rollback; they're inert for DNS-only names.

## Risks

- **Whole-site dependency on Cloudflare** (ADR 0013): an edge or control-plane incident blocks documents, members,
  APIs and MCP; the static-host fallback can't help.
- **Address handling depends on abio's Traefik not trusting Cloudflare.** If someone later adds Cloudflare to
  `forwardedHeaders.trustedIPs`, `X-Real-Ip` becomes forgeable through the edge. The comment in
  `edge-client-address.server.ts` and this file say so; keep it in reviews.
- **Search roles not redeployed**: search, command palette and `/mcp` would count the edge address; search 429s for
  everyone. Stage 0 gate.
- **Verified-Googlebot export goes blind** after the flip: Cloudflare-peer records can't be verified until the origin
  checks zone authentication at ingress (stage 2 follow-up).
- **Let's Encrypt renewals** (next around mid-January 2027) depend on Always Use HTTPS staying off and port 80
  reaching Traefik.
- **125-second proxy read timeout**: any request without a first byte for 125 s gets 524. The app's slowest known
  pages are well under that; long imports must stay asynchronous.
- **New IPv6 visitors**: Cloudflare serves IPv6 at the edge, so visitors appear with IPv6 addresses. The search limit
  counts IPv6 by /64; the person limit and Better Auth count the whole address.
- **Cloudflare range changes**: stale lists in the app and the stage 5 allowlist would mis-count or block new edges.
  Cloudflare announces changes; update both together.
- **Origin key**: if it leaks, anyone reaching the origin from Cloudflare's ranges (another account's Worker) can
  choose the address the limits count. Rotate as in stage 1, step 4. If the key in Coolify and in the transform rule
  ever differ, restoration stops and the limits count edges: change both together with the two-key rotation.
- **Other accounts' Workers** can still reach the origin from Cloudflare addresses and skip zone WAF rules until
  per-hostname Authenticated Origin Pulls (or a Traefik check of `GW-Edge-Key`) is in place.
- **Privacy**: Cloudflare terminates TLS and sees URLs, cookies and bodies. Review the privacy policy wording.
- **The 2014 IP allow rule** at user scope lets one address skip security features on all zones; confirm or remove.

## Housekeeping found while planning

- The untracked `docs/adr/0013-private-administration-through-wireguard.md` in the main checkout reuses number 0013,
  and 0014 and 0015 exist on main. Commit it as 0016.
