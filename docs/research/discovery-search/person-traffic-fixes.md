# Person traffic: admission, abuse limits and filter controls

Implementation and local verification, 2026-10-27. Follows the committed [traffic investigation](person-traffic-503.md). Rebased onto `origin/main` at `2ba88cfc2` before implementation. No production deployment, restart, configuration edit or write was performed; no push.

## Changed behavior

### 1. Admission belongs to cold profile work

[`person-profile-cache.server.ts`](../../../goodwatch-webapp/app/server/person-profile-cache.server.ts) now owns the parsed profile cache, coalescing and admission. [`person.server.ts`](../../../goodwatch-webapp/app/server/person.server.ts) supplies the shared-cache read and cold SQL-backed load. The old outer `limitFilteredViews` in [`crawlers.server.ts`](../../../goodwatch-webapp/app/server/crawlers.server.ts) is removed.

- Parsed-cache hits, shared-cache hits and requests joining an existing load take no cold-load slot.
- At most four distinct cold profile loads run in a process. Up to 64 cold misses wait in FIFO order for at most two seconds. Expired waiters never start work; success and failure release slots.
- Genuine capacity exhaustion still returns **503, `Retry-After: 2`, `Cache-Control: private, no-store`**. This also bounds cold canonical-page loads; it is not a bot verdict. Outstanding shared-cache reads are bounded at 512 distinct people.
- The existing 50-entry/five-minute parsed cache and 24-hour shared profile cache retain their lifetimes. Live corrections remain outside the cached profile and use the existing coalesced five-second correction snapshot. Full-page caching is unchanged.

This removes the observed failure mode in which four requests, including warm or coalesced reads, excluded unrelated visitors. It does not promise that an overloaded database or renderer can never return 503.

### 2. Reject abusive filter enumeration before expensive processing

[`person-request.server.ts`](../../../goodwatch-webapp/app/server/person-request.server.ts) runs through [`browser-gate.server.ts`](../../../goodwatch-webapp/app/server/browser-gate.server.ts), installed from [`entry.server.tsx`](../../../goodwatch-webapp/app/entry.server.tsx) before cache misses, root loaders and rendering. Only GET/HEAD requests with semantic person filters are budgeted; bare person documents and `_data`-only requests stay outside these abuse limits.

All budgets are **per process**, bounded in memory:

| Behavior | Accepted budget | Scope |
| --- | --- | --- |
| Filter burst | 30 requests / 10 seconds | Trusted client address; IPv6 shares a /64 budget |
| Sustained filtering | 120 requests / minute | Same client |
| Enumeration | 20 distinct person IDs / minute | Same client |
| Rotating-client deep enumeration | 60 requests / 10 seconds, after seeing at least 20 clients and 20 people | Requests combining at least three semantic filter dimensions |

The last budget addresses the observed address rotation. It can also delay a legitimate visitor combining three or more filters during a distributed flood; simple filtering and canonical pages remain available. It is a behavior heuristic, not identification of the scraper. Shallow enumeration across many addresses can evade it.

Before any abuse denial, [`search-bot-verification.server.ts`](../../../goodwatch-webapp/app/server/search-bot-verification.server.ts) verifies the original exact client address, regardless of User-Agent: reverse DNS must end in `.googlebot.com` or `.search.msn.com`, and a forward A/AAAA lookup must contain the original address. A claimed Googlebot UA alone grants no exemption. Verified Google/Bing requests never receive an abuse 429.

Verification is coalesced per address, limited to 32 concurrent checks and 1.5 seconds, with a bounded 10,000-entry cache: positive results last 24 hours, negative results five minutes, inconclusive results five seconds. DNS failure or saturation **fails open**, preserving search-bot access at the cost of reduced abuse protection during DNS trouble. Network timeouts are not treated as a negative bot verdict.

Established excess returns **429 with positive `Retry-After` and `private, no-store`**, before application processing. Remix data failures carry its catch header. Denied requests do not extend the fixed windows. New `goodwatch_person_policy_total{outcome=...}` metrics distinguish allowed, limited, verified-bot, dns-unavailable, unkeyed and normalized outcomes without client-address labels. The legacy cookie/UA redirects remain separate from verified bot exemption; the browser cookie never grants a rate-limit bypass.

### 3. Filter controls and normalized URLs

[`PersonFilterButton`](../../../goodwatch-webapp/app/ui/person/filter-button.tsx) replaces person filter links, including genre, trait, role, score, grouping, order and expansion actions. Native buttons are disabled until hydration and navigate with Remix afterwards. They have no href before or after hydration and support keyboard activation. Title and collaborator links remain ordinary crawlable anchors, including the highest-rated-title fact.

[`person-query.server.ts`](../../../goodwatch-webapp/app/server/person-query.server.ts) removes unknown parameters, duplicates, redundant defaults and invalid values, uses deterministic parameter order and bounds accepted scores/decades. It preserves every actual score-expansion key. Normalization runs before expensive work with 308 for documents and the corresponding Remix redirect protocol for data navigation. The route loader also applies it as a fallback. `_data` remains a transport parameter, never a semantic filter.

Supported filter values now form a finite semantic space, although clients can still invent endless raw URL spellings and must request the normalization response. `_data` is retained for Remix compatibility. Buttons and normalization reduce URL discovery and duplicate work; they cannot prevent a client manufacturing requests. Bare canonical and existing person-query robots rules are unchanged; no new robots block or noindex promise was added.

## Verification

The repeatable tests do not boot the webapp, load dotenv, connect to production services or start background jobs:

```sh
cd goodwatch-webapp
node --test app/server/person-*.test.ts app/server/search-bot-verification.test.ts \
  app/server/browser-gate.test.ts app/ui/person/filter-button.test.ts \
  app/utils/headers.test.ts scripts/person-traffic/load.test.ts \
  app/server/cache-identity.test.ts app/server/page-cache.test.ts \
  app/server/feedback/corrections.test.ts app/ui/person/person-images.test.ts
```

**128 tests pass.** They include cold queue bounds/expiry/failure release, warm reads while all four slots are occupied, coalescing, TTL/eviction, negative/mismatched/forward-confirmed DNS, DNS deadlines, bot exemption with browser UA, spoofed bot UA rejection, per-client and rotating-client limits, window recovery, IPv6 grouping, trusted-header fallback, normalization and hydrated navigation.

[`scripts/person-traffic/load.test.ts`](../../../goodwatch-webapp/scripts/person-traffic/load.test.ts) uses real loopback HTTP and production middleware/admission/verifier code, with synthetic cache/database and DNS boundaries. Results:

| Local HTTP scenario | Results | Backend work |
| --- | --- | --- |
| 32 concurrent shared-cache hits | 32 × 200; zero 503 | Zero cold loads |
| 32 concurrent requests for one cold person | 32 × 200; zero 503 | One coalesced load |
| 32 concurrent distinct cold people | 32 × 200; zero 503 | Peak four cold loads |
| 60 concurrent filtered requests from one unverified client | 30 × 200, 30 × 429 | Only 30 reached downstream application handling; every 429 had Retry-After |
| 60 concurrent requests from the forward-confirmed Bing fixture, with browser UA | 60 × 200 | No abuse denial |

The load fixture completes in about half a second. It proves the admission and HTTP policy under controlled load, not production throughput or production DNS availability.

Separately, the full production build ran locally with a fresh explicit environment, dummy database credentials pointing only to a strict read-only SQL proxy, no production Redis credentials, and only a local title snapshot service. A runtime network guard denied non-loopback connections from the app and workers. Background cleanup, reconciliation, warmers and periodic jobs were disabled by a local import hook; the snapshot loaded once without polling. The separate proxy alone held database credentials and accepted only validated read statements/blob reads. No main-checkout `.env` was supplied to the app, no application source was changed for isolation, and no load test targeted production HTTP.

On that full local build, 16 concurrent filtered person loader requests returned 200. A separate 60-request burst from one test client returned **30 × 200 and 30 × 429**, every refusal with Retry-After, using the actual installed early middleware and DNS resolver. A real browser at mobile width verified keyboard score filtering, group switching, a genre change requiring normalized Remix navigation, zero hydrated filter anchors, preserved bare canonical/title/person links and zero page errors. `npm run build` passes. Type checking produces the same 189 diagnostics as untouched `2ba88cfc2`, with no new diagnostics after normalizing line locations; the repository type check is not green.

### Performance budget: fails on baseline and branch

Ran `./bench.sh budget --where local --runs 1` against both isolated production builds with the same snapshot, read-only proxy, mobile settings and unchanged budget limits. Every surface produced a valid Lighthouse report in the final comparison. Both runs exit 1 with the **same failed budget checks on all six surfaces**; no previously passing check failed on the branch. Existing failures include script/request/payload budgets. This is not a green performance gate or a production throughput measurement.

| Surface | Script transfer KiB, baseline → branch | LCP ms, baseline → branch | Performance score, baseline → branch |
| --- | ---: | ---: | ---: |
| Home | 389.2 → 391.2 | 2,327 → 2,327 | 97 → 97 |
| Movie | 419.7 → 422.3 | 2,495 → 2,505 | 97 → 97 |
| Show | 419.8 → 422.4 | 2,698 → 2,672 | 96 → 96 |
| Person | 408.5 → 411.3 | 4,006 → 3,526 | 81 → 84 |
| Discover | 500.4 → 504.3 | 4,193 → 4,543 | 77 → 75 |
| Share list | 307.0 → 308.3 | 4,131 → 4,131 | 80 → 80 |

TBT was 0–17 ms across both runs. Single-run timing differences are noisy. The baseline was built from an archive without Git metadata, while the branch build includes Sentry's automatically detected release stamp (206 additional uncompressed bytes in the inspected React and shell chunks). Therefore the transfer deltas include build metadata, not just application changes; they are reported without adjustment. No new client dependency was added and neither package manifest nor lockfile changed.

Local raw artifacts, intentionally not committed because they include environment-specific URLs: `goodwatch-benchmark/results/20261027T181323Z-lighthouse-person-traffic-baseline-valid/` and `goodwatch-benchmark/results/20261027T181631Z-lighthouse-person-traffic-branch-valid/`. Initial runs with Docker reachability, SQL-comment rejection and local restart timing errors were discarded; they are not evidence about application performance. The final proxy strips comments before read-only validation and forwarding. The earlier [technical SEO validation](technical-seo-fixes-validation.md) also records existing performance-budget debt.

## Owner action and rollout

1. Set **`PERSON_TRUSTED_IP_HEADER`** to a single-address header that trusted ingress **overwrites**, and restrict direct application access to that ingress. An existing correctly configured `SEARCH_TRUSTED_IP_HEADER` is the fallback when the person setting is empty/unset. Do not blindly select X-Forwarded-For or trust a client-supplied chain. The setting is documented in [`.env.example`](../../../goodwatch-webapp/.env.example). Without a valid trusted identity, abuse rejection fails open and counts `unkeyed`; cache admission and normalization still work.
2. Deploy through the normal reviewed rollout. Check that spoofed inbound header values cannot reach this trust boundary, DNS reverse/forward lookups work, and `unkeyed`/`dns-unavailable` are not dominating. Neither an allowlist based solely on UA nor an ASN-wide block is needed.
3. Compare person 429/503 rates, cache behavior, latency and verified crawler outcomes after rollout. Windows reset at restart and multiply across replicas; shared budgets would require a later design if process-local limits are insufficient. Keep attributable ingress monitoring from the investigation: pre-Morgan responses remain invisible to Morgan. Do not interpret this local test as evidence that historical Google indexing exclusions are resolved.

No production setting was changed by this branch. The remaining 503 capacity guard is intentional; verified search bots are exempt from abuse limits, not from real service exhaustion.
