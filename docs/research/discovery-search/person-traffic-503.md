# Person-page traffic and 503s

Investigated **2026-10-27**. All times are UTC. Production was inspected read-only; this report contains only aggregate traffic evidence and public code references.

## Finding

**The sampled flood is overwhelmingly clients claiming Chrome, spread across consumer access networks and some hosting networks. The evidence supports distributed scraping, but does not identify its operator. It is not evidence of a Googlebot flood.** In the first sample, 1,305 of 1,314 person requests (99.3%) claimed Chrome, from 1,223 distinct forwarded addresses. Six claimed ClaudeBot and two Applebot. Neither Googlebot nor Bingbot appeared in that sample.

**The observed 503s come from the application's four-concurrent-filtered-load limit.** It is shared by every filtered person request in one process, across clients and people. All 476 matched 503s in a second sample were Chrome-claiming requests carrying the browser cookie, and every one had `Retry-After: 30` and `Cache-Control: private, no-store`. Both HTML and Remix data requests were affected. An ordinary visitor can lose this competition too.

**Most suggested crawl controls already exist:** filtered HTML canonicals point to the unfiltered person, filter links have no server-rendered href and become `nofollow` links after hydration, and robots.txt disallows `/person/*?`. The traffic is bypassing or ignoring those controls. Adding them again will not fix the flood.

The [preceding log investigation](googlebot-log-check.md#useful-application-evidence-explicitly-not-googlebot-evidence) was read from `origin/main` first. Its exact person denominator is **55,198 / 296,696 = 18.60%**, over 13:55:02–15:35:58, rather than precisely 21%. The task's approximately 21% can describe a different window. Neither percentage is an identified-Googlebot error rate; neither includes all requests answered before Morgan.

## Read-only measurement and identity

The inspected application initially ran revision `d5fa01bd75eb29971a1ce32fcc0e1a8e429dffb1`. During this investigation another deployment replaced it with `d49ac11aba58b5b689d16958d9334e82002a036c`, whose container started at 15:43:24.560. This investigation did not initiate that deployment. The person route, crawler limiter, browser gate, person profile cache, response-header helper and robots.txt had no diff between those revisions. The replacement's compiled server chunk independently contained the four-slot limiter and its 503/30-second response.

Two bounded `tcpdump` runs observed plain HTTP on the application's host-side Docker interface. A destination/port filter restricted the first to app-bound requests; the second observed both directions to associate response headers with requests on the same connection. Packet bytes flowed through an anonymous pipe into an in-memory Python parser, never into a capture file. Only request classification, User-Agent family, forwarded address sets for transient DNS/ASN lookups, browser-cookie presence as a boolean, response status and selected response headers were used. Cookies, authorization headers, bodies, raw request records and addresses were not printed or retained. Temporary local scripts and the isolated test dependency directory were removed after use; no script file was created on production.

The first capture was intended to last 45 seconds but ended early during removal of the old container/interface: its actual interval was **15:43:30.636–15:43:56.885**, about 26.25 seconds, during traffic handover. Do not extrapolate it into a host-wide requests/minute figure. It captured 5,837 packets, with zero kernel drops, and parsed 1,432 GET/HEAD requests, including 1,314 person requests. A deployment and capture boundaries can omit traffic.

| First sample: person User-Agent family | Requests | Distinct forwarded addresses | Identity conclusion |
| --- | ---: | ---: | --- |
| Chrome | 1,305 | 1,223 | Browser claim, not a verified crawler identity |
| ClaudeBot | 6 | 1 | Claimed bot; AWS network ownership alone does not verify Anthropic |
| Applebot | 2 | 2 | Claimed bot on Apple's network; no Apple-specific verification performed |
| Firefox | 1 | 1 | Browser claim |
| Googlebot / Bingbot | 0 / 0 | 0 / 0 | No candidates to verify in this sample |

There were **892 distinct person paths and 1,106 distinct person URLs**. **1,292 / 1,314** contained queries; 710 carried `gw_browser=1`, while 604 did not. Query-name occurrences included `genre` 1,016, `trait` 925, `minScore` 742, `decade` 668, `role` 505, `group` 435, `order` 397 and `_data` 317. These counts overlap. Carrying the cookie does **not** prove JavaScript execution: the cookie is a constant, unsigned value that a scraper can send directly.

### Network owners, not crawler operators

Transient forwarded addresses were resolved through Team Cymru's DNS origin-AS and AS-name lookups. The table selects several networks and groups the remainder; it is not a ranking of every observed network. Counts apply only to the 1,305 Chrome-claiming person requests in the first sample. ASN ownership identifies the network announcing an address, not who operates a scraper or where a person lives. [Team Cymru's mapping documentation](https://www.team-cymru.com/ip-asn-mapping).

| Network | Distinct addresses | Requests |
| --- | ---: | ---: |
| Comcast, AS7922 | 114 | 121 |
| Verizon Business, AS701 | 43 | 45 |
| T-Mobile USA, AS21928 | 40 | 41 |
| British Telecommunications, AS2856 | 39 | 39 |
| Virgin Media, AS5089 | 24 | 25 |
| Tencent, AS132203 | 23 | 50 |
| Cox, AS22773 | 23 | 25 |
| AT&T, AS7018 | 22 | 22 |
| Datacamp, AS212238 | 15 | 15 |
| All remaining network results | 880 | 922 |
| **Total** | **1,223** | **1,305** |

Separately, the ClaudeBot person requests mapped to Amazon AS16509 (one address, six requests); Applebot to Apple AS714 (two addresses, two requests); Firefox to Telkomsel AS23693 (one address, one request). Do not block these networks wholesale: the dominant networks also serve ordinary visitors. The dispersion makes a simple per-IP threshold insufficient on its own. The combination of request rate, address churn, deep filter combinations and browser-cookie use is **consistent with scraping through a rotating proxy pool**, not proof of a particular proxy provider or AI company.

### Forwarding trust and Google/Bing verification

The first sample had 1,425 parseable forwarded addresses across its 1,432 requests and no multi-address X-Forwarded-For chains; seven non-person requests had no parseable address. The parser used the rightmost address. In the second sample, **all 2,783 parsed requests came from the inspected proxy container's network address**. The proxy command had no forwarded-header or PROXY-protocol trust override, no static-config-file argument, and no corresponding forwarding environment option. This is consistent with Traefik's default untrusted-header handling and the forwarded immediate peer; no evidence of an additional trusted public ingress was found in these checks. This was not an external TLS packet-to-request join. [Traefik v2.10 forwarding configuration](https://doc.traefik.io/traefik/v2.10/routing/entrypoints/#forwarded-headers).

The verification procedure required a reverse lookup with a proper domain suffix, followed by a forward A/AAAA lookup containing the original address: `.googlebot.com` for ordinary Googlebot (Google's other documented fetcher categories are separate), or `.search.msn.com` for Bingbot. A browser UA or an ASN containing “Google” does not establish Googlebot. [Google verification guidance](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests), [Bing verification guidance](https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26).

No genuine Googlebot/Bingbot candidate appeared in either short sample. The second included **one deliberate Googlebot-UA control probe from this investigation**, which received 301 and failed the reverse-domain check as expected; it is excluded from any claim about genuine bot traffic. There was no eligible bot hostname to forward-confirm and no Bingbot claim. Thus **zero verified Google/Bing requests in these samples**, not a conclusion that they never visit, nor a backfill of the earlier window. Applebot/ClaudeBot are reported as claims, not verified identities.

## Why 503, and who sees it

The relevant code path is:

1. [`app/server/browser-gate.server.ts`](../../../goodwatch-webapp/app/server/browser-gate.server.ts), `gateAnswer`: filtered person documents without the browser cookie receive a small 403/noindex JavaScript check, or a 301 to the bare path if `isbot` recognizes the UA. `_data` requests bypass this gate and reach Remix. The gate runs before Express/Morgan.
2. [`app/routes/person.$personKey.tsx`](../../../goodwatch-webapp/app/routes/person.$personKey.tsx), `canonicalLoader`: a nonempty query with a recognized crawler UA gets 301; a nonempty query without the browser cookie gets 302 to the unfiltered path. Otherwise a query invokes `limitFilteredViews(request, () => getPersonProfile(id))`. Bare person requests load without that limiter.
3. [`app/server/crawlers.server.ts`](../../../goodwatch-webapp/app/server/crawlers.server.ts), `limitFilteredViews`: a module-level count permits **four simultaneous loads for the entire process**. The fifth throws `Response("Busy, try again shortly", { status: 503, headers: { "Retry-After": "30" } })`. It does not examine source IP, caller rate or whether the caller is a real visitor. The slot is released in `finally` after the profile load, before filtering/rendering completes. This is admission refusal, not a 30-second deadline.
4. [`app/utils/headers.ts`](../../../goodwatch-webapp/app/utils/headers.ts), `pageHeaders`, preserves the retry header through an HTML error boundary. [`app/entry.server.tsx`](../../../goodwatch-webapp/app/entry.server.tsx) preserves the route status and applies the noncacheable error policy. Data errors also retain the retry header, as observed on the wire.

**Important `_data` distinction:** the installed Remix 2.17.2 `server-runtime/dist/data.js` calls `stripDataParam` before the route loader, deleting `_data`. A URL with **only** `_data=routes%2Fperson.%24personKey` therefore becomes a bare URL to this loader and does **not** consume one of the four slots. A data request with remaining `genre`, `minScore`, etc. does. The direct `_data`-only probe returned 200 JSON. Do not “fix” this by treating every Remix data request as a filtered view.

### Matched wire evidence

The second capture ran **15:46:25.090–15:46:55.168**, 30.08 seconds, on the replacement instance. It observed 24,942 packets, zero kernel drops, 2,783 parsed requests, and 2,578 person requests. Of the person requests, 2,567 claimed Chrome. TCP request/response ordering matched **2,564 person responses**; requests outstanding at the end and responses to requests predating the capture are excluded, as are informational 103 responses. This bounded parser is a diagnostic sample, not a complete HTTP audit trail. Controlled page probes overlapped this sample and are not evidence of organic visitors.

| Matched person requests | 200 | 301 | 403 | 503 |
| --- | ---: | ---: | ---: | ---: |
| Chrome, filtered HTML, browser cookie | 606 | 0 | 0 | 267 |
| Chrome, data request, browser cookie | 398 | 0 | 0 | 209 |
| Chrome, filtered HTML, no browser cookie | 0 | 0 | 1,037 | 0 |
| Chrome, bare document | 37 | 0 | 0 | 0 |
| Other bare documents | 7 | 0 | 0 | 0 |
| Firefox, filtered HTML, no browser cookie | 0 | 0 | 2 | 0 |
| Controlled Googlebot-UA probe | 0 | 1 | 0 | 0 |
| **Total** | **1,048** | **1** | **1,039** | **476** |

Every sampled 503 had **`Retry-After: 30` and `Cache-Control: private, no-store`**. The 503 share is **18.56% of matched ingress person responses**, or **31.21% after excluding the browser-gate 403s**. These denominators differ from the earlier Morgan-only window; page-cache hits also bypass Morgan. In this half-minute alone, more than a thousand person requests were absent from Morgan because the browser gate answered them.

A separate bounded log read shortly after the replacement started found 774 person 503s, all query-bearing (487 documents and 287 data requests), versus no movie/show 503s. Those person 503s had Morgan p50 **26.632 ms**, p95 **78.445 ms**, max **121.801 ms**: quick refusals, not slow timeouts. One completed minute report explicitly counted 325 “refused as busy”; that report's interval does not match the full log-read interval and must not be equated to all 774 errors.

The compiled live limiter, its counter, matching 30-second response signature and fast query-only failures identify the mechanism. The earlier historical requests cannot individually be joined to UAs, but the unchanged limiter is a strong explanation of the same person-only pattern.

### Other 503 paths checked

- [`app/server/page-cache.server.ts`](../../../goodwatch-webapp/app/server/page-cache.server.ts) can refuse excess concurrent renders of one cache key with **`Retry-After: 2`** and `GW-Page-Cache: busy`, before Morgan. That is a separate mechanism, not the sampled 30-second failures or the earlier Morgan-recorded person 503s.
- [`app/server/lifecycle.server.ts`](../../../goodwatch-webapp/app/server/lifecycle.server.ts) uses 503 for readiness, not as a person-filter limiter. The entry's five-second React abort is not this four-slot refusal. A proxy-generated failure would not produce the matching application Morgan response; the second sample observed these 503s leaving the app itself.
- The general [`app/server/rate-limit.server.ts`](../../../goodwatch-webapp/app/server/rate-limit.server.ts) is not called by the person loader. This limiter is not a per-client abuse rate limit.

A single ordinary visitor can receive this 503 while other clients occupy all four slots, even with no excessive personal request rate. One visitor alone with a single filtered request will not hit the cap; browser concurrency can also contribute. Canonical bare requests bypass this particular limit. Recognized Googlebot/Bingbot UAs requesting filters are redirected before it, even if they supply the cookie. Recognition here is UA-based, not DNS verification. A verified bot can still encounter other failures, but there is **no measured Googlebot 503 in this investigation**.

Google treats both 503 and 429 as overload signals that can reduce crawling. Merely changing all 503s to 429 is therefore not an SEO fix; caller-specific abuse rejection and genuine service overload need different handling. [Google's HTTP-status guidance](https://developers.google.com/search/docs/crawling-indexing/http-network-errors).

## Where the URLs come from

[`person.$personKey.tsx`](../../../goodwatch-webapp/app/routes/person.$personKey.tsx) creates combinations through `useFilterHref`, retaining a fixed list of filter names, changing one dimension, and clearing `expand` unless explicitly patched. `FilterLink` renders `<a rel="nofollow">` without `href` on the server; [`useHydrated`](../../../goodwatch-webapp/app/utils/hydrated.ts) adds the actual href and navigation handler in the browser. The shared type control uses `navigate`, not an SSR filter anchor. Title and collaborator links remain ordinary server-rendered links.

There is therefore **no current SSR filter-link trap for an HTML-only crawler**, but rendered JavaScript exposes filter URLs, and a client ignoring nofollow can enumerate combinations or manufacture them. The UI has a finite, very large combination space for a given profile; the server accepts arbitrary strings/numbers and unknown query parameters, leaving an effectively unbounded set of URL spellings. Do not claim every URL was followed from a current link. Earlier discovery, JavaScript rendering and synthetic enumeration remain possible. The samples establish requests, not their provenance.

The `_data` suffix is constructed for loader navigation, including [`app/navigation/instant-navigation.ts`](../../../goodwatch-webapp/app/navigation/instant-navigation.ts), rather than an SEO `<a href>` destination. Its presence does not prove a human click: clients can reproduce Remix requests.

Six spaced public probes confirmed:

| Response | Status | Canonical / robots |
| --- | ---: | --- |
| Bare `/person/287-brad-pitt` | 200 HTML | Canonical bare URL; `index, follow` |
| `?minScore=70`, browser UA, no cookie | 403 HTML | No canonical; meta `noindex`, `X-Robots-Tag: noindex` |
| Same filter with browser cookie | 200 HTML | Canonical bare URL; **`index, follow`**, not noindex |
| Same filter with controlled Googlebot UA | 301 | Location is bare person path; no HTML canonical |
| `_data` only, browser cookie | 200 JSON | No HTML meta or canonical; no X-Robots-Tag observed |
| `/robots.txt` | 200 | Contains `Disallow: /person/*?` |

The bare and filtered 200 documents had zero person-query hrefs in their server HTML. The filter-free document had 62 nofollow anchors, 60 without href; the filtered document had 57, 55 without href. The other two nofollow links are not person-filter URLs. Canonical construction is in the person route; [`app/utils/meta.ts`](../../../goodwatch-webapp/app/utils/meta.ts) supplies the default `index, follow`.

The existing [`public/robots.txt`](../../../goodwatch-webapp/public/robots.txt) rule covers both filter queries and `_data` on person paths. It does not provide a site-wide `_data` rule. A compliant crawler blocked there cannot read the filtered page's canonical, noindex or redirect. Canonical and nofollow are hints; robots rules are voluntary for a hostile scraper. [Google's faceted-navigation guidance](https://developers.google.com/crawling/docs/faceted-navigation), [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Ranked actions

Effort estimates are engineering time including focused verification, not deployment promises. These are proposals; no application fix or production setting was changed.

| Rank | Fix and reason | Files / surface | Effort |
| --- | --- | --- | --- |
| **1** | **Fix admission around actual expensive work.** Serve an already-cached person profile before taking a cold-load slot; coalesce loads by person before counting them; use a bounded, fair wait policy for real misses instead of making every visitor compete for four whole-profile calls. Preserve limits on expensive loads and rendering rather than simply deleting/increasing the cap. Record admission reason and cache-hit/miss counts. Test a visitor sharing the process with a distributed filtered crawl. | `goodwatch-webapp/app/server/crawlers.server.ts`, `app/server/person.server.ts`, `app/routes/person.$personKey.tsx`; focused tests alongside these | **1–2 days**, with a capacity check before rollout |
| **2** | **Reject abusive filter enumeration before application work, without penalizing verified Google/Bing.** Add bounded, behavior-based budgets and a trustworthy client/session signal; `gw_browser=1` alone is not proof. Reuse the per-client rate-limit machinery where suitable, but supplement it for address rotation. Use 429 + Retry-After for established caller excess; retain 503 for actual service overload. Cache bot verification results, use trusted ingress identity, and keep legitimate canonical search crawling available. Do not blanket-block Chrome, consumer ASNs, Googlebot or Bingbot. | `app/server/browser-gate.server.ts`, `app/server/crawlers.server.ts`, `app/server/rate-limit.server.ts`; ingress access-log configuration described in the preceding report | **2–3 days** for abuse controls; **0.5 day** for durable observability |
| **3** | **Reduce the filter URL surface.** Prefer buttons for filter/group/expand actions (with accessible keyboard behavior), so even hydrated DOM does not advertise a link graph; keep title/person links. Normalize supported query values and remove redundant/unknown dimensions before cache/admission decisions. Keep the bare canonical and existing person-query robots rule. Add noindex for successful filtered HTML only if exclusion is desired, acknowledging that robots-blocked URLs cannot convey it. | `app/routes/person.$personKey.tsx`, `app/server/person.server.ts`, `app/utils/meta.ts`, `public/robots.txt` | **0.5–1 day**, plus landing-surface budget verification |

Further caching is a supporting change, not a missing first layer. [`person.server.ts`](../../../goodwatch-webapp/app/server/person.server.ts) already keeps 50 parsed profiles for five minutes, coalesces concurrent profile reads by person, and uses a 24-hour shared profile cache. The global limiter sits **outside** these caches and includes the live correction read. With 892 paths in roughly 26 seconds, the 50-entry cache is vulnerable to churn. Measure hit rates, profile size and correction-read time before selecting a larger byte-bounded cache. Respect correction invalidation and [ADR 0007](../../adr/0007-in-process-page-cache.md): full HTML caching already exists, keyed by complete URL, admits repeated URLs, and cannot collapse arbitrary filter variants into one HTML entry. Caching alone will not stop a distributed URL spray.

Do not deploy another identical robots disallow as the main fix. A site-wide `_data` block is unnecessary for this person incident because the existing rule already covers it. If extending the policy to other routes, evaluate `/*?_data=` and `/*?*&_data=` with URL-matching and rendering/navigation checks first. Do not combine a block with a promise that Google will read canonical/noindex on those blocked responses. If existing indexed variants need canonical consolidation, plan a bounded allow-and-redirect migration separately rather than opening the entire facet space.

## Verification and owner action

- Read the prior report from `origin/main`, compared the deployed revisions' relevant source, inspected the live compiled limiter and installed Remix request normalization, read bounded aggregate app logs, and collected two transient network samples. No packet file or visitor address list remains.
- Verified the six spaced live responses above and all 476 sampled retry headers. The test command for `app/server/browser-gate.test.ts` and `app/utils/headers.test.ts` passed **16/16 tests**. This worktree lacked dependencies; the first attempt could not load `isbot`. The successful run resolved the lockfile's `isbot@5.1.17` from an isolated temporary install via a Node import hook; no source or lockfile changed.
- No production restart, deployment, configuration edit, database/API write, load test, push or publication was performed by this investigation. The application deployment observed mid-sample was external to this work. No fix implementation or performance benchmark was run.
- **Owner action:** schedule implementation/rollout of the first two fixes and enable durable attributable ingress logging using the [preceding report's exact proposal](googlebot-log-check.md#smallest-owner-change-in-coolify). Retention must include successful requests and pre-Morgan responses. Verify Google/Bing sources and compare their daily status mix with Search Console after rollout; this short sample cannot establish the cause of Google's historical indexing exclusions. No additional access change is needed to obtain short read-only identity samples—the capture method worked.
