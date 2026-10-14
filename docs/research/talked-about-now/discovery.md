# Short answer

Checked **2026-10-14** for [research ticket 539](https://github.com/alp82/goodwatch-monorepo/issues/539), child of [map 537](https://github.com/alp82/goodwatch-monorepo/issues/537).

- **What works:** official YouTube uploads playlists, publisher RSS, unauthenticated Bluesky Jetstream, and public Mastodon trends provide practical discovery inputs. Live checks returned RSS items, Mastodon results and Jetstream events. YouTube's documented default is now **100 search calls/day in a separate bucket plus 10,000 units/day for other reads**; `playlistItems.list` costs one unit. The `mostPopular` chart survived July 2025 with changed contents. Sources: [Google quotas][yt-quota], [playlist items][yt-playlists], [revision history][yt-history], [Jetstream][jetstream], and the live endpoint tables below; checked 2026-10-14.
- **What needs qualification:** Bluesky search returned first-page results without credentials at `api.bsky.app`, but its returned pagination cursor received 403; `public.api.bsky.app` search also received 403. Threads supports approved public keyword search at **2,200 queries/user/rolling 24 hours**, so it need not be permanently manual. Instagram hashtag discovery requires a professional account and approval; guaranteed Reels coverage remains **unverifiable**. Sources: [live Bluesky search][bsky-live-andor], [public-host search][bsky-live-public], [Threads docs][threads], [Instagram hashtag docs][ig-hashtags], [recent media][ig-recent]; checked 2026-10-14.
- **What does not provide a durable foundation:** Reddit announces new API access requests ending 31 October 2026, RSS ending 13 November 2026, and remaining public API access ending March 2027. TikTok Research Tools and Meta Content Library are research access programs, not a generally available GoodWatch product backend. Sources: [Reddit developer announcement][reddit-dev], [Reddit moderator announcement][reddit-mod], [TikTok eligibility][tt-research], [Meta eligibility][mcl-access]; checked 2026-10-14. The product-eligibility conclusion is an inference from those criteria; no application was submitted.
- **What this means for the map:** recommendation, not a new product decision: build discovery around YouTube allowlists and RSS first, add Mastodon and a bounded Bluesky consumer, and keep Threads as an optional approved adapter. Keep curated URLs for TikTok, Reddit and Reels until stronger access evidence exists. Replace the map's blanket “discovery is closed” assumption with **“discovery is heterogeneous, quota-bound and replaceable.”** Evidence is the source-specific results above and below, checked 2026-10-14. Rendering, consent, rights and buzz-score methodology remain separate tickets; this report does not re-verify the previous report's legal or embed claims.

## Scope, method and prior-research audit

Only primary evidence is used for conclusions: platform documentation/source code, publisher-owned websites/feeds, original Reddit admin announcements, and public endpoints called directly. No account login, private credentials, anti-bot workaround, or authenticated product trial was used. Ordinary HTTP GETs used Python `requests`/`urllib`; the two Jetstream probes used Python `websockets` with the documented `xrpc.v1.json` subprotocol. Feed success means HTTP 200 **and parsed RSS with items**, not merely a successful HTTP status. All observations and linked source checks in this file are dated **2026-10-14**; future Reddit dates are announcements, not observed shutdowns. SOMAR pricing is the one explicitly identified first-party indexed excerpt below; its direct fetch was blocked.

Baseline read with `git show origin/ccr-327ca25f-xd6xns:<path>` at commit `5db32f8212c35b6a5452d684a1745f9af32f36c5`:

- [Report: Social content embeds deep dive][prior-report].
- [Video platform notes][prior-video], especially “Discovery for a given title.”
- [Text social network notes][prior-text], especially Reddit, Bluesky, Mastodon and Threads.
- [Film communities/media notes][prior-media], especially publisher RSS.
- The remaining notes, `legal_gray_areas.md` and `libraries_tooling.md`, were read for context; no legal or library claims are adopted here.

The **confirmed / corrected / unverifiable** labels below apply to every prior discovery claim used here. “Confirmed” can mean documentation-confirmed; it does not imply an authenticated live test. New findings are identified separately. Recommendations and capacity calculations are explicitly inferences. Prior research is the audit target, not a source establishing platform behavior.

## YouTube: inexpensive channel polling; search has its own quota

| Prior claim touched | Finding and status | Primary source; checked |
| --- | --- | --- |
| `search.list` costs 100 units against a shared 10,000-unit daily allocation | **Corrected.** The current method page says one unit in the **Search Queries** bucket, default 100 calls/day. Google's revision history dates the move toward granular search/upload buckets to **1 June 2026**. | [Search method][yt-search], [revision history][yt-history]; 2026-10-14 |
| Default capacity is approximately 100 searches/day | **Confirmed outcome; corrected accounting.** The default is 100 `search.list` calls, 100 uploads, and 10,000 units/day combined for other endpoints. Additional pages consume additional calls. | [Quota/compliance guide][yt-quota], [quota calculator][yt-cost]; 2026-10-14 |
| More quota requires compliance review | **Confirmed.** Google requires an audit before quota above the default allocation. This research did not request one. | [Quota/compliance guide][yt-quota]; 2026-10-14 |
| Known-channel uploads are cheaper than keyword search | **Confirmed and quantified.** `channels.list` costs one unit and exposes uploads via `contentDetails`; `playlistItems.list` costs one unit/page, up to 50 items. | [Channels method][yt-channels], [playlist items][yt-playlists]; 2026-10-14 |
| July 2025 Trending removal might have killed `chart=mostPopular` | **Corrected uncertainty.** Google's 10 July 2025 release note says that from **21 July 2025** the chart draws from Trending Music, Movies and Gaming instead of the old Trending Now list. It remains documented in `videos.list`, at one unit/call. | [Revision history][yt-history], [videos method][yt-videos]; 2026-10-14 |
| `mostPopular` can discover material about a particular title | **Corrected scope.** It selects a chart by region/category, not a keyword. It can generate candidates but cannot replace title search. | [Videos method][yt-videos]; 2026-10-14 |

**The prior apparent quota conflict is resolved:** the current calculator's table also describes 100 search calls per day, each costing one unit; its `100` is the daily allocation, not a 100-unit request cost. Verify the actual project's Cloud quota allocation at implementation time; it was not inspected here. [Quota calculator][yt-cost], [search reference][yt-search]; checked 2026-10-14.

**Implementation implication, calculated:** resolve and store each official channel's immutable ID and uploads playlist once; poll the newest playlist page, then batch-fetch selected video metadata. For 20 channels, hourly one-page polls cost `20 × 24 × 1 = 480` units/day in the other-methods allocation, before metadata requests and backfills. Reserving 50 one-page title searches/day consumes 50 of the separate 100 default search calls. This is quota arithmetic, not a production benchmark. [Channels method][yt-channels], [playlist items][yt-playlists], [quota guide][yt-quota]; checked 2026-10-14.

Public Data API reads require project credentials; the ordinary public-data route uses an API key rather than a visitor OAuth login. **No keyed API call was made**, so quota enforcement and a real `mostPopular` payload are documentation-confirmed only. No per-request currency price is established here: the relevant published constraint is quota, and quota extensions require review. [API overview][yt-auth], [quota guide][yt-quota]; checked 2026-10-14.

## Bluesky: live open streaming, inconsistent anonymous search

### Search and app passwords

| Exact public request / check | Observation | Status against prior claim; checked |
| --- | --- | --- |
| [`api.bsky.app` search, `q=Andor&limit=3&sort=latest`][bsky-live-andor] | HTTP 200, JSON `posts` with three results and a cursor; repeated first-page check also succeeded. | **Corrected:** not universally auth-only; 2026-10-14 |
| [`api.bsky.app` search, `q=Dune&limit=3&sort=latest`][bsky-live-dune] | HTTP 200, three results. | Additional live confirmation; 2026-10-14 |
| [`public.api.bsky.app` search][bsky-live-public] | HTTP 403, HTML rather than a post-result payload. | **Confirmed** for this host, request and environment only; 2026-10-14 |
| Next page using the actual cursor returned by the Andor request | HTTP 403, `Request forbidden by administrative rules.` Exact continuation URL is in the reproduction block below. No workaround attempted. | **Confirmed fragility**, not a claim that every query/cursor fails; 2026-10-14 |
| [Public-host `getAuthorFeed`, `actor=bsky.app&limit=1`][bsky-author] | HTTP 200, JSON `feed` and cursor. | Control showing that public-host failure was endpoint-specific; 2026-10-14 |

```text
https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Andor&limit=3&sort=latest&cursor=eyJzIjpbMTc5MTk3NjU1OTAwMCwiZGlkOnBsYzp0bm9zaWt1N3B5ZXZvNHM3ZW55Mnd1a2YiLCIzbXh0Z2I1eGxmczI1Il19
```

**App-password answer: documented route exists; end-to-end search success remains unverifiable here.** AT Protocol's current SDK guide supports app-password sessions for bots/CLI tools; user-facing login applications should use OAuth. Authenticated `app.bsky.*` calls route through the account's PDS and service proxy. The direct `api.bsky.app` and `public.api.bsky.app` endpoints do **not** support authentication; adding a Bearer token to those direct hosts is not the documented authenticated route. Thus the prior “app password, then authenticated AppView directly” advice needs correction. Sources: [SDK authentication][bsky-sdk-auth], [API hosts/auth][bsky-hosts], [rate limits][bsky-rates]; checked 2026-10-14. No login was attempted, so a password session fixing this search/pagination restriction is **not confirmed**.

The first-party `searchPosts` lexicon explicitly allows implementations to require auth, supports `top`/`latest`, language/date/author/tag filters, and warns that its cursor need not traverse the entire result set. It is a candidate finder, not evidence of complete or representative discussion volume. [Search lexicon][bsky-lexicon]; checked 2026-10-14. Hosted PDS requests have a documented overall IP limit of 3,000 per five minutes; `createSession` is limited to 30 per five minutes and 300/day per account. The direct public API has a different, non-numeric “generous” limit statement; do not apply the PDS number to it. [Rate limits][bsky-rates]; checked 2026-10-14.

### Jetstream access and measured volume

**Confirmed:** a public, unauthenticated JSON WebSocket stream exists. **Corrected/current detail:** new projects are directed to **Jetstream v2** (`jetstream.us-east.bsky.network` / `jetstream.us-west.bsky.network`); legacy hosts and the old `/subscribe?wantedCollections=...` protocol are not the current v2 interface. V2 filters by collection, DID and event kind; title keywords still need local filtering. Replay/history adds authenticated HTTP calls, so “the live tail is open” must not be extended to all history access. [Current Jetstream guide][jetstream]; checked 2026-10-14. This updates the earlier report's generic Jetstream recommendation rather than adopting an old bandwidth estimate.

Two concurrent **30.001-second** samples ran approximately **11:54:42–11:55:12 UTC on 2026-10-14**, without authentication:

| Live endpoint | JSON frames | Decoded UTF-8 frame bytes | Frames/second | Linear daily payload extrapolation |
| --- | ---: | ---: | ---: | ---: |
| [`wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents?collections=app.bsky.feed.post&kinds=commit`](wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents?collections=app.bsky.feed.post&kinds=commit) | 1,268 | 1,234,814 | 42.27 | 3.56 GB/day |
| [`wss://jetstream.us-west.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents`](wss://jetstream.us-west.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents) | 10,329 | 7,086,307 | 344.29 | 20.41 GB/day |

The post-only sample contained 1,214 creates, 53 deletes and one update. Both streams delivered the documented `$type`/`payload` envelope. These figures are **observations at the cited live endpoints, checked 2026-10-14**, not service guarantees. Bytes are decoded application payload, excluding WebSocket/TLS overhead and any compression savings; daily values are `bytes / elapsed_seconds × 86,400`, in decimal GB. Thirty seconds cannot establish average daily traffic or peaks. The samples also used different regions, so their ratio is not a controlled compression/filter benchmark. First-party documentation describes the protocol and deletion events: [Jetstream guide][jetstream]; checked 2026-10-14.

Minimal reproduction of the measurement method, outside the repository, with the `websockets` package installed:

```python
import asyncio, json, time
import websockets

async def sample(uri):
    async with websockets.connect(uri, subprotocols=["xrpc.v1.json"]) as ws:
        start = time.monotonic()
        frames = payload_bytes = 0
        while (remaining := 30 - (time.monotonic() - start)) > 0:
            try:
                frame = await asyncio.wait_for(ws.recv(), remaining)
            except asyncio.TimeoutError:
                break
            json.loads(frame)  # validate the JSON envelope
            frames += 1
            payload_bytes += len(frame.encode() if isinstance(frame, str) else frame)
        print(frames, payload_bytes, time.monotonic() - start)
```

**Map implication, inference:** start with periodic first-page search for candidates if useful, but treat it as fallible. Use a continuously connected, post-filtered Jetstream consumer only if broader coverage justifies its bandwidth, reconnect/de-duplication logic and local title matching. Do not collect every like/follow event by default. Account for updates/deletes; a stream of post creates alone cannot maintain current content. Sources: [observed search][bsky-live-andor], [Jetstream filtering/resumption/events][jetstream]; checked 2026-10-14. Public endpoints did not ask for payment in these probes; worker/network/storage costs are ours and were not priced here.

## Mastodon: public trends work on three tested instances

**Confirmed:** `/api/v1/trends/statuses`, `/tags` and `/links` are documented public endpoints. These return instance-selected activity, not a network-wide movie/show chart or a title-keyword search. The documented maxima are 40 statuses and 20 tags/links per page. [Trends reference][mastodon-trends]; checked 2026-10-14.

All nine requests below used no token, `limit=3`, and returned **HTTP 200 with three JSON objects**. Each response advertised `X-RateLimit-Limit: 300`. Live checks: 2026-10-14, approximately 11:53–11:58 UTC.

| Instance | Statuses | Tags | Links | Access cost / limit evidence |
| --- | --- | --- | --- | --- |
| mastodon.social | [Live statuses][ms-statuses] | [Live tags][ms-tags] | [Live links][ms-links] | No key/payment requested; limit header 300; checked 2026-10-14 |
| mastodon.online | [Live statuses][mo-statuses] | [Live tags][mo-tags] | [Live links][mo-links] | No key/payment requested; limit header 300; checked 2026-10-14 |
| mstdn.social | [Live statuses][md-statuses] | [Live tags][md-tags] | [Live links][md-links] | No key/payment requested; limit header 300; checked 2026-10-14 |

**Confirmed:** the documented default is **300 requests per five minutes per account and per IP**, shared with other methods, with reset/remaining response headers. Honor actual headers and 429 responses rather than assuming every host uses the default. Polling three endpoints every 15 minutes is a proposed budget of 288 requests/day/instance; that is arithmetic, not a new server allowance. [Rate limits][mastodon-limits]; checked 2026-10-14.

**Confirmed with limits:** [the `#Andor` timeline on mastodon.social][ms-andor] returned 200 and three statuses without auth. However, instances can disable anonymous timeline access. Full-text status search requires authentication and a search backend, so public trends do not imply anonymous keyword search. [Timeline reference][mastodon-timelines], [search reference][mastodon-search]; checked 2026-10-14.

**Unverifiable:** the prior claim that film-specific instances such as `mastodon.film` or `filmfans.club` form an active usable source list was not established. Do not put them in the initial adapter configuration on that evidence. An exploratory [filmly.co.ua trends call][filmly] returned 404 JSON `Not implemented`, checked 2026-10-14; this does not establish anything about other film communities. Also **unverifiable here:** representative movie/show volume and whether every trends result respects every author's indexing preference. These checks establish connectivity, not those product/policy properties. [Trends documentation][mastodon-trends]; checked 2026-10-14.

## Threads: 2,200 searches per rolling day, with approval

**Corrected:** use **2,200 queries per user per rolling 24-hour period across apps**, not the prior unresolved 500-per-seven-days number. Repeating a keyword counts; queries returning zero results do not. Public keyword search needs `threads_basic`, `threads_keyword_search` and approval; before approval, search only finds the authenticated user's posts. Thus “Threads discovery is necessarily curated” was too restrictive. [Meta keyword-search reference][threads]; checked 2026-10-14.

The documented search supports `TOP`/`RECENT` and time bounds. An anonymous [keyword-search call][threads-live] returned HTTP 400, OAuthException code 190. **No authenticated query, app review or GoodWatch allowance was tested.** Fifty titles queried twice/day means 100 queries before variants or retries, not proof of approval. No currency fee is specified. [Meta keyword-search reference][threads]; checked 2026-10-14.

**Map implication, inference:** try approved discovery; retain curated URLs while approval is absent. [Meta keyword-search reference][threads]; checked 2026-10-14.

## Reddit: primary-source sunset timeline, with Devvit limits

The original admin posts resolve the earlier secondary-only dates:

| Announced date | What Reddit says | Prior claim status | Primary source; checked |
| --- | --- | --- | --- |
| 31 October 2026 | Stop accepting **new public Data API access requests** | **Confirmed date; corrected wording:** not the deadline for every migration registration | [r/redditdev announcement][reddit-dev]; 2026-10-14 |
| 13 November 2026 | End RSS support; Discord Relay suggested for moderation alerts, no replacement for feeds outside communities one moderates | **Confirmed** | [r/modnews announcement][reddit-mod]; 2026-10-14 |
| 30 November 2026 | Close migration **bounty** registration | **Confirmed distinction** from access-request/migration dates | [r/redditdev announcement][reddit-dev]; 2026-10-14 |
| 12 January 2027 | Begin removing access for apps/users not registered or not responding in the migration process | **Confirmed** as a staged removal date, not the universal API end | [r/redditdev announcement][reddit-dev]; 2026-10-14 |
| March 2027 | Close remaining public Data API access | **Confirmed announcement**, not an observed completed shutdown | [r/redditdev announcement][reddit-dev]; 2026-10-14 |

Reddit's [8 October changelog][reddit-changelog] corroborates the migration/RSS announcements, checked 2026-10-14. The previous broad claim that discovery becomes “manual after October” needs **correction**: access does not all stop in October, but a new external discovery integration would depend on a sunsetting interface. The recommendation to avoid it as a durable foundation is an inference from the [announced phases][reddit-dev], checked 2026-10-14.

**Devvit is not established as a drop-in external search API.** Its official migration guide is about Reddit extensions/community tooling; HTTP Fetch domains beyond the normal allowlist and external-endpoint access require requests in the migration program. GoodWatch has no verified exemption. A migration bounty is not an API price or permission for off-platform reuse. [Official migration guide][reddit-migration]; checked 2026-10-14. Recommendation: keep Reddit discovery to curated URLs for this map until an explicitly suitable supported route exists. That recommendation does not verify Reddit embeds or their behavior after the future cutoffs.

The earlier May 2026 anonymous-JSON shutdown history and its exact date are **unverifiable in this report**; they are not needed to establish the first-party future sunset. No blocked Reddit data endpoint was bypassed or used as a fallback.

## Publisher RSS: working URLs and precise failures

**Confirmed:** the previous report's untested general RSS recommendation is operational for the feeds below. Each URL is a publisher-owned endpoint called directly without login, returning **200 and parseable RSS with nonzero items**. Counts and first-item dates are observations, not promises of feed size, freshness or archive completeness. Every row checked **2026-10-14**; most calls were around 11:53–11:56 UTC.

| Publisher / scope | Working feed URL (primary live source) | Items | First item's `pubDate` day |
| --- | --- | ---: | --- |
| Variety, all | [variety.com/feed/](https://variety.com/feed/) | 10 | 2026-10-14 |
| Variety, movies | [variety.com/v/film/feed/](https://variety.com/v/film/feed/) | 10 | 2026-10-14 |
| Deadline, all | [deadline.com/feed/](https://deadline.com/feed/) | 12 | 2026-10-14 |
| Deadline, movies | [deadline.com/v/film/feed/](https://deadline.com/v/film/feed/) | 12 | 2026-10-14 |
| The Hollywood Reporter, all | [hollywoodreporter.com/feed/](https://www.hollywoodreporter.com/feed/) | 10 | 2026-10-14 |
| The Hollywood Reporter, movies | [hollywoodreporter.com/c/movies/feed/](https://www.hollywoodreporter.com/c/movies/feed/) | 10 | 2026-10-14 |
| IndieWire | [indiewire.com/feed/](https://www.indiewire.com/feed/) | 12 | 2026-10-13 |
| Collider | [collider.com/feed/](https://collider.com/feed/) | 10 | 2026-10-14 |
| ScreenRant | [screenrant.com/feed/](https://screenrant.com/feed/) | 10 | 2026-10-14 |
| Slashfilm | [slashfilm.com/feed/](https://www.slashfilm.com/feed/) | 20 | 2026-10-14 |
| Den of Geek | [denofgeek.com/feed/](https://www.denofgeek.com/feed/) | 10 | 2026-10-14 |
| FILMSTARTS, all news | [filmstarts.de/rss/nachrichten.xml](https://www.filmstarts.de/rss/nachrichten.xml) | 20 | 2026-10-13 |
| FILMSTARTS, movie news | [filmstarts.de/rss/filme-nachrichten.xml](https://www.filmstarts.de/rss/filme-nachrichten.xml) | 20 | 2026-10-13 |
| FILMSTARTS, show news | [filmstarts.de/rss/serien-nachrichten.xml](https://www.filmstarts.de/rss/serien-nachrichten.xml) | 20 | 2026-10-14 |
| Moviepilot | [moviepilot.de/news.rss](https://www.moviepilot.de/news.rss) | 19 | 2026-10-14 |
| film-rezensionen.de | [film-rezensionen.de/feed/](https://www.film-rezensionen.de/feed/) | 10 | 2026-10-14 |
| epd Film | [epd-film.de/rss.xml](https://www.epd-film.de/rss.xml) | 10 | 2026-10-13 |
| Netflix newsroom, English; new first-party supplement | [about.netflix.com/en/feed.xml](https://about.netflix.com/en/feed.xml) | 15 | 2026-10-14 |
| Netflix newsroom, German; new first-party supplement | [about.netflix.com/de/feed.xml](https://about.netflix.com/de/feed.xml) | 15 | 2026-09-24 |

FILMSTARTS explicitly links the three exact feed paths on its [own RSS service page][filmstarts-directory]; checked 2026-10-14. This **corrects** the earlier vague `filmstarts.de/rss/…` suggestion. Moviepilot's working path is `/news.rss`, not `/news/feed`. Mainstream and German coverage are now backed by successful parsed-feed checks rather than URL conventions.

| Rejected candidate (live primary source) | Observation; checked 2026-10-14 |
| --- | --- |
| [deadline.com/category/film/feed/](https://deadline.com/category/film/feed/) | 200 RSS but **zero items**; use `/v/film/feed/` above |
| [filmstarts.de/rss/news.xml](https://www.filmstarts.de/rss/news.xml) | 404 HTML; use the publisher-listed German paths above |
| [rss.filmstarts.de/ac/actualites.xml](https://rss.filmstarts.de/ac/actualites.xml) | DNS resolution failed from this environment; no working feed established |
| [moviepilot.de/news/feed](https://www.moviepilot.de/news/feed) | 404 HTML |
| [kino.de/feed/](https://www.kino.de/feed/) | 404; [kino.de/rss/](https://www.kino.de/rss/) redirected to HTML news, not RSS |
| [critic.de/rss/](https://www.critic.de/rss/) | Redirected to HTML home, not RSS |
| [filmportal.de/rss.xml](https://www.filmportal.de/rss.xml) | 404 HTML; no further attempt |

**Cost and map implication, inference:** these probes required no account, key or payment. Feed sizes are small enough to trial scheduled polling; a proposed 15-minute poll of 15 feeds is 1,440 GETs/day total. Use conditional requests and back off on failures; deduplicate overlapping category/general feeds. Headline/title matching can produce candidates for known movies/shows, but the observed feeds do not establish catalog IDs or a social engagement score. Discovery access is confirmed; publication/reproduction rights and thumbnail handling are **not established by HTTP success** and remain outside this ticket. Sources: the live publisher URLs above, checked 2026-10-14.

## Instagram hashtags, Reels and Meta Content Library

### Instagram's conditional hashtag route

**Confirmed with correction of the blanket exclusion:** Instagram API **with Facebook Login** offers hashtag search on behalf of a Business or Creator account. It needs `instagram_basic` and approved `Instagram Public Content Access`. The cap is **30 distinct hashtags per rolling seven days per professional account**; repeated queries for an already counted hashtag do not use another distinct slot. This confirms the prior unverified 30-hashtag limit, but corrects “no Instagram discovery API usable by an app like GoodWatch” to a conditional, approval-dependent route. [Meta hashtag guide][ig-hashtags]; checked 2026-10-14.

Recent media is limited to public photos/videos published in the preceding **24 hours**, excludes boosted/ad media, returns up to 50 results/page and omits the username. Top media also omits username and ranks using popularity signals. These are hashtag results, not arbitrary title-keyword search. [Recent-media reference][ig-recent], [top-media reference][ig-top]; checked 2026-10-14.

**Unverifiable: dependable Reels discovery.** The two endpoint references describe photos/videos but do not explicitly promise Reels inclusion or categorical exclusion; their documented returnable fields do not include `media_product_type`. No approved-account response was obtained. Do not infer “all Reels are searchable” from video support, or “Reels never appear” from older anecdotes. [Recent-media reference][ig-recent], [top-media reference][ig-top]; checked 2026-10-14.

**Map implication, inference:** an optional approved hashtag experiment is possible, but 30 distinct tags across a week, spelling variants and uncertain Reels coverage make it unsuitable as the default adapter for a large title catalog. Approval and results quality remain untested. The cited documentation establishes quotas and permissions, not a per-call monetary fee. [Hashtag guide][ig-hashtags], [recent-media reference][ig-recent]; checked 2026-10-14.

### Meta Content Library is a research environment

**New finding resolving a prior gap:** access requires affiliation with an eligible nonprofit academic institution or a nonprofit institution whose primary/core activity is scientific or public-interest research. Applications use Meta Research Tools Manager and independent CASD review. Being an individually operated non-commercial website does not itself satisfy these institutional/research criteria. The last sentence is an eligibility inference, not an application decision from Meta. [Meta access guide][mcl-access]; checked 2026-10-14.

The library covers photos, videos and Reels; its API runs in Meta's Secure Research Environment or an approved third-party cleanroom. UI download is restricted to an approved public-data subset; this is not evidence of a generally exportable product feed. [Meta overview][mcl-overview]; checked 2026-10-14. Access/computation in Meta's interface and secure environment have no fees. [Meta access FAQ][mcl-access]; checked 2026-10-14. SOMAR's Spring 2026 newsletter reports a separate VDE charge of **$371/month from July 2026**, plus **$1,000 setup for new users after June 2026**. **Evidence limitation:** these fees were read in a first-party indexed excerpt; direct fetch returned 403, so the full newsletter was not verified. [SOMAR newsletter][somar-fees]; checked 2026-10-14. Do not assume every research access environment is free.

**Map implication, inference:** not usable as an ordinary GoodWatch discovery backend on the evidence available. A qualifying institutional research project would be a different purpose and access path. [Meta eligibility][mcl-access], [research environment][mcl-overview]; checked 2026-10-14. No application, institutional partnership or secure-environment access was tested.

## Seed list: official channels with ownership evidence

**New concrete seed list supporting the prior allowlist recommendation.** Every ownership-evidence page below was fetched successfully on **2026-10-14** and directly linked the listed channel/profile. Each listed YouTube URL additionally returned 200 with the expected channel title and the canonical channel ID shown below. IDs came from the page's canonical channel URL, not from unrelated video/recommendation IDs in the HTML. These are starting seeds, not a claim that every upload is a trailer, cleared for reuse, or relevant to every region.

| Organization / role | YouTube channel (live primary source) | Canonical channel ID | TikTok profile | Ownership evidence; checked |
| --- | --- | --- | --- | --- |
| Universal Pictures / studio | [UniversalPictures](https://www.youtube.com/UniversalPictures) | `UCq0OueAsdxH6b8nyAspwViw` | [@universalpics](https://www.tiktok.com/@universalpics) | [Universal site][seed-universal]; 2026-10-14 |
| Warner Bros. / studio | [WarnerBrosPictures](https://www.youtube.com/user/WarnerBrosPictures/) | `UCjmJDM5pRKbUlVIzDYYWb6g` | [@warnerbros](https://www.tiktok.com/@warnerbros) | [Warner site][seed-warner]; 2026-10-14 |
| Sony Pictures / studio-distributor | [sonypictures](https://www.youtube.com/sonypictures) | `UCz97F7dMxBNOfGYu3rx8aCw` | Not established in this check | [Sony site][seed-sony]; 2026-10-14 |
| A24 / studio-distributor | [A24Films](https://www.youtube.com/A24Films) | `UCuPivVjnfNo4mb3Oog_frZg` | Not established in this check | [A24 site][seed-a24]; 2026-10-14 |
| NEON / distributor | [neonrated](https://www.youtube.com/neonrated) | `UCpy5dRhZd-JbZP4NsrnLt1w` | [@neonrated](https://www.tiktok.com/@neonrated) | [NEON site][seed-neon]; 2026-10-14 |
| Constantin Film / German studio-distributor | [ConstantinFilm](https://www.youtube.com/ConstantinFilm) | `UC51KZjUZokzJfb08mzAGS2A` | Not established in this check | [Constantin site][seed-constantin]; 2026-10-14 |
| Disney+ / streamer | [@disneyplus](https://www.youtube.com/@disneyplus) | `UCIrgJInjLS2BhlHOMDW7v0g` | [@disneyplus](https://www.tiktok.com/@disneyplus) | [Disney+ site][seed-disney]; 2026-10-14 |

Warner's site also links [@warnerbroshorror](https://www.tiktok.com/@warnerbroshorror), [@warnerbrosepics](https://www.tiktok.com/@warnerbrosepics) and [@warnerbroscomedy](https://www.tiktok.com/@warnerbroscomedy), useful potential editorial subdivisions. Ownership is confirmed from the [Warner site][seed-warner], checked 2026-10-14; the TikTok profiles' playback and inventory were **not** independently tested. The same limitation applies to all four primary TikTok seeds above. Missing TikTok cells mean “not verified,” not “no account exists.”

**TikTok access audit:** the prior Display API scope claim is **confirmed**: it reads an authorizing user's profile/videos, rather than offering general title search across these channels. Research Tools require an approved research project; the FAQ explicitly excludes creators, advertisers and commercial users. Eligibility now lists more regions than the prior US/Europe-only summary, including Canada and Brazil with specified conditions; the old geography is **corrected**. GoodWatch's non-commercial status alone does not establish a qualifying research institution/project. [Display API][tt-display], [Research Tools eligibility][tt-research], [Research FAQ][tt-faq]; checked 2026-10-14.

**Recommendation, inference:** ingest the YouTube seeds through their uploads playlists. Treat TikTok seeds as an editorial bookmark list; no permission to enumerate arbitrary channels through the Display API follows from the profiles being public. Do not turn Creative Center's private/internal endpoints or challenge-solving extractors into an adapter. [YouTube channels][yt-channels], [TikTok Display API][tt-display], [research eligibility][tt-research]; checked 2026-10-14. The prior internal-endpoint claims are **unverifiable here** and no such endpoints were tested.

## Handover to map 537

These are proposed implementation consequences of the evidence above, not changes to the map's settled decisions:

1. Start with the verified publisher URLs and seven official YouTube channel IDs; track each adapter's last successful fetch and an empty/error distinction. Evidence: [parsed publisher feeds](#publisher-rss-working-urls-and-precise-failures), [verified channels](#seed-list-official-channels-with-ownership-evidence), checked 2026-10-14.
2. Separate quota budgets: YouTube search versus other reads; Mastodon instance-specific headers; Threads rolling per-user queries; Instagram rolling distinct hashtags. Evidence: [YouTube quota guide][yt-quota], [Mastodon limits][mastodon-limits], [Threads][threads], [Instagram][ig-hashtags]; checked 2026-10-14.
3. Prototype title matching and noise on a small set before treating post/news volume as a hotness score. Search can be incomplete; RSS and instance trends are selective. Evidence: [Bluesky search definition][bsky-lexicon], [Mastodon trends][mastodon-trends], [observed publisher feeds](#publisher-rss-working-urls-and-precise-failures); checked 2026-10-14.
4. Budget a continuously running worker if Jetstream is chosen. The post-only sample extrapolates to gigabytes/day, and streaming needs reconnection and deletion handling. Evidence: [measured stream](#jetstream-access-and-measured-volume), [Jetstream protocol][jetstream]; checked 2026-10-14.
5. Keep Threads optional until app approval; keep Instagram/Reels experimental until an approved live response settles coverage; avoid dependence on Reddit's sunsetting external API/RSS and research-only libraries. Evidence: [Threads][threads], [Instagram recent media][ig-recent], [Reddit announcement][reddit-dev], [Meta eligibility][mcl-access], [TikTok eligibility][tt-research]; checked 2026-10-14.

Remaining validation is explicit: no authenticated YouTube/Threads/Instagram/Bluesky calls, actual GoodWatch quotas or approval, stable multi-day feed/stream operation, Reels inclusion, future Reddit cutoff execution, deployment, or embedding/rights/consent behavior was tested. These are bounded limitations of the research, not a claim that those routes all fail. The file is the sole repository change for ticket 539.

## Primary source links

All linked evidence was checked **2026-10-14**. Baseline links are prior claims under audit, not primary authority for external facts.

[prior-report]: https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/reports/Social%20content%20embeds%20deep%20dive.md
[prior-video]: https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/research_notes/Social%20content%20embeds%20deep%20dive/video_platforms.md
[prior-text]: https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/research_notes/Social%20content%20embeds%20deep%20dive/text_social_networks.md
[prior-media]: https://github.com/alp82/goodwatch-monorepo/blob/5db32f8212c35b6a5452d684a1745f9af32f36c5/docs/research/research_notes/Social%20content%20embeds%20deep%20dive/film_communities_media.md
[yt-search]: https://developers.google.com/youtube/v3/docs/search/list
[yt-playlists]: https://developers.google.com/youtube/v3/docs/playlistItems/list
[yt-channels]: https://developers.google.com/youtube/v3/docs/channels/list
[yt-videos]: https://developers.google.com/youtube/v3/docs/videos/list
[yt-quota]: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
[yt-cost]: https://developers.google.com/youtube/v3/determine_quota_cost
[yt-history]: https://developers.google.com/youtube/v3/revision_history
[yt-auth]: https://developers.google.com/youtube/v3/getting-started
[jetstream]: https://bsky.network/docs/jetstream/
[bsky-live-andor]: https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Andor&limit=3&sort=latest
[bsky-live-dune]: https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Dune&limit=3&sort=latest
[bsky-live-public]: https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Andor&limit=3&sort=latest
[bsky-author]: https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=bsky.app&limit=1
[bsky-lexicon]: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPosts.json
[bsky-hosts]: https://bsky.network/docs/api-directory/
[bsky-rates]: https://bsky.network/docs/rate-limits/
[bsky-sdk-auth]: https://atproto.com/guides/sdk-auth
[mastodon-trends]: https://docs.joinmastodon.org/methods/trends/
[mastodon-limits]: https://docs.joinmastodon.org/api/rate-limits/
[mastodon-timelines]: https://docs.joinmastodon.org/methods/timelines/
[mastodon-search]: https://docs.joinmastodon.org/methods/search/
[ms-statuses]: https://mastodon.social/api/v1/trends/statuses?limit=3
[ms-tags]: https://mastodon.social/api/v1/trends/tags?limit=3
[ms-links]: https://mastodon.social/api/v1/trends/links?limit=3
[mo-statuses]: https://mastodon.online/api/v1/trends/statuses?limit=3
[mo-tags]: https://mastodon.online/api/v1/trends/tags?limit=3
[mo-links]: https://mastodon.online/api/v1/trends/links?limit=3
[md-statuses]: https://mstdn.social/api/v1/trends/statuses?limit=3
[md-tags]: https://mstdn.social/api/v1/trends/tags?limit=3
[md-links]: https://mstdn.social/api/v1/trends/links?limit=3
[ms-andor]: https://mastodon.social/api/v1/timelines/tag/Andor?limit=3
[filmly]: https://filmly.co.ua/api/v1/trends/statuses?limit=3
[threads]: https://developers.facebook.com/documentation/threads/keyword-search
[threads-live]: https://graph.threads.net/v1.0/keyword_search?q=Dune&limit=1
[reddit-dev]: https://www.reddit.com/r/redditdev/comments/1wubcvf/moving_data_api_apps_to_the_developer_platform/
[reddit-mod]: https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/
[reddit-changelog]: https://support.reddithelp.com/hc/en-us/articles/54353370049684-Changelog-October-8-2026
[reddit-migration]: https://developers.reddit.com/docs/guides/migrate/public-api
[filmstarts-directory]: https://www.filmstarts.de/service/rss/
[ig-hashtags]: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search
[ig-recent]: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-hashtag/recent-media
[ig-top]: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-hashtag/top-media
[mcl-access]: https://developers.facebook.com/docs/content-library-and-api/get-access/
[mcl-overview]: https://developers.facebook.com/docs/content-library-and-api/
[somar-fees]: https://www.icpsr.umich.edu/sites/somar/somar-newsletter-archive/somar-newsletter-spring-2026
[seed-universal]: https://www.universalpictures.com/
[seed-warner]: https://www.warnerbros.com/
[seed-sony]: https://www.sonypictures.com/
[seed-a24]: https://a24films.com/
[seed-neon]: https://www.neonrated.com/
[seed-constantin]: https://constantin.film/
[seed-disney]: https://www.disneyplus.com/
[tt-display]: https://developers.tiktok.com/doc/display-api-overview
[tt-research]: https://developers.tiktok.com/products/research-api/
[tt-faq]: https://developers.tiktok.com/docs/en/research-api-faq?enter_method=left_navigation
