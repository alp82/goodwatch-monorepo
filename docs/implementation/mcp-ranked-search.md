# Opt-in MCP ranked search (#569)

The permission-list title is **Search titles by name**. The default is name lookup; the optional mode is described to clients as a **smarter match for descriptive queries**. The internal `ranked` argument, result fields, quotas and admission behavior remain unchanged (owner decision Q50, 2026-10-17).

This extension builds on [#584](https://github.com/alp82/goodwatch-monorepo/pull/584). `search_titles` remains cheap catalog name lookup by default. Only `ranked: true` enters the ranked path. Write-tool name resolution still calls the existing catalog resolver directly and cannot use the ranked budget, even when the member has exhausted that budget.

## Execution and admission

The ranked adapter calls the real `combinedSearch` with the verified member ID, non-adult catalog policy and up to `RESULT_LENGTH` (100) rows. It keeps native relevance as the base order, canonicalizes/deduplicates title identities, and applies the website's bounded For you search rule by default (`for_you=false` preserves relevance order). `exclude_seen=true` applies the website's Not seen yet rule before pagination; default availability is everywhere and seen titles are included. Pages default to 40, matching Discover, and return `total`/`returned` plus a cursor. A missing taste signal leaves the base order intact and reports `for_you_applied=false`. It uses the search role's existing `searchAdmission` and the unchanged shared Crate spending ledger, paid-reading cache and provider admission. A basic fallback is returned with `ranked: false` and the native explanation; asking for ranking does not claim that ranking succeeded.

The ranked module loads lazily on an explicit ranked call. A page-role process refuses ranked work before loading the engine. The two existing proxy routing files now include exact `/mcp`, so the entire MCP endpoint reaches search roles, without an internal HTTP relay or a new shared relay credential. OAuth and well-known metadata routes retain their page routing. The proxy extension is repository configuration only, not installed by this work. Deploy MCP-capable roles and configure #566's verifier and canonical `MCP_RESOURCE_URL` before installing it. The authorization seam still denies real calls pending #566.

`REC_MCP_RANKED_SEARCH` uses the same on/off/member-allowlist syntax as other MCP flags. The ordinary read/tool flags also apply. It does not add an OAuth scope: the existing `mcp:read` permission plus the explicit argument is sufficient. The global MCP request limits remain in effect, including for cached calls and pages.

## Member quota, cache and paging

- Each verified member receives **20 admitted uncached attempts per UTC day**, shared across OAuth clients and search-role processes. Valkey's server clock determines the day; the response reports limit, used, remaining and `resets_at`. Atomic scripts claim the member gate and increment the counter only after the process admission succeeds.
- Normalization is NFC, trim, lowercase and whitespace collapse. A successful result for that normalized query is cached for **60 seconds** per member. A cache hit is checked before the member gate and quota, so it remains usable during another flight or after exhaustion. A different page size does not make a new search.
- At most one uncached attempt per member is in flight. Its 30-second lease is renewed every five seconds with owner checks; a lost lease/renewal error aborts the search. Native work held by `searchAdmission.hold` can outlive a response. An async-context observer keeps this member's lease renewed until that work settles, without mixing another search's holds or delaying the response for it.
- A ranked cursor addresses the member's fixed result snapshot, retained for **15 minutes**. Paging never invokes the engine or increments quota, even after the 60-second query cache expires or the member reaches 20. A cursor from another member, an expired snapshot or a mismatching supplied query is refused. It never causes an automatic rerun. Name lookup keeps its original offset cursor format.
- Busy process admission, an existing member flight, invalid input, disabled flags, wrong role and pre-start cancellation do not charge a new attempt. Once admitted, failures, provider/budget fallbacks and cancellation may have spent resources and still count. There are no speculative refunds or automatic retries.
- Shared Valkey and a valid, stable `SEARCH_STORAGE_KEY` are required. There is no process-memory fallback that could multiply member quotas across roles. Member/query key components are HMAC digests; snapshot values contain public catalog titles, generic native messages, cost and an AES-256-GCM encrypted query for the page link (authenticated to the member namespace and snapshot ID), with no raw query or personal marks. Native encrypted search history remains unchanged.

Filter views preserve the original raw query snapshot/cache. The first page materializes a member-bound, canonicalized view of the full batch, using For you and optional unseen filtering, and retains that view for 15 minutes. Its cursor inherits both flags; explicitly changing either flag on that cursor is rejected. Pages never re-read member marks or re-rank, so changes during pagination cannot cause skipped/repeated titles. Repeating the same query with different flags while its 60-second raw cache survives creates/reuses a free view, with no new engine call or quota charge. View keys are HMAC digests in the same member Cluster slot; values hold only public catalog summaries/order, generic filter flags, native messages/cost and the encrypted query authenticated to the view ID. They contain no raw personal marks or taste vectors. Existing raw cursors remain readable. Filtering/order reflects the member data when that view was first materialized.

Valkey is the quota/cache/lease authority. Data loss, eviction or storage-key rotation can reset this temporary state; configure persistence/eviction accordingly. The existing durable Crate budget remains an independent spending guard. Leases are bounded coordination, not a guarantee across arbitrary process pauses or a store losing acknowledged writes.

## Metrics

- `goodwatch_mcp_ranked_requests_total{outcome=...}` records bounded cache/page/uncached, quota, admission, failure and configuration outcomes.
- `goodwatch_mcp_ranked_cost_nano_total` accumulates `combinedSearch.chargedNano`, including its conservative estimates when billing is uncertain. Cached calls/pages report `charged_nano: 0` and add no cost.
- `goodwatch_mcp_ranked_cost_unknown_total` records failures before a quantified batch returns; use the shared spending ledger for accounting. It does not silently record those failures as free.

The existing tool latency/call metrics also cover these calls. No member IDs, client IDs, queries or cursor values become metric labels.

## Local verification

Use the dedicated loopback CrateDB/Valkey containers described in [the read runbook](mcp-read-tools.md). The ranked seed refuses any Crate cluster except `gw-mcp-567`, creates schemas from the repository, and resets only that dedicated cluster's search budget/history fixture tables. It also sets vote counts/essence text on the local catalog fixtures. No production credentials are needed.

```bash
python goodwatch-webapp/scripts/mcp-ranked/seed-local.py
cd goodwatch-webapp
node_modules/.bin/vite-node --config scripts/arena-vite.config.mjs scripts/mcp-ranked/local.integration.ts --ttl
node_modules/.bin/vite-node --config scripts/mcp-ranked-vite.config.mjs scripts/mcp-ranked/native.integration.ts
```

The quota probe runs through the public MCP handler against real Valkey, with a deterministic search-backend fixture reading real local Crate catalog rows. It verifies 40+10 full pages, default For you/everywhere/include-seen flags, native unseen filtering, free filter changes, inherited stable cursor views and mismatched-filter rejection, normalization, 20/day across clients, peer isolation, UTC rollover via an injected clock, live 60-second cache expiry, long-work lease renewal, free/stable paging, member/process admission, detached holds, failure charging, pre-start cancellation, flags, role checks, cheap lookup/write resolution after exhaustion, member-bound cursors and metrics. Its test request limiter is private/unlimited to permit the full matrix; the application limit is unchanged.

The native probe uses the real `combinedSearch`, SDK, spending ledger and Valkey coordination. A test-only Vite transform points TypeSafe and TMDB at the loopback HTTP fixture; global fetch and the default Undici dispatcher reject other backends. Provider calls return deterministic contract-valid readings priced by the native runtime. It verifies the reported 8,400-nanodollar charge, free repeated MCP query, real shared budget halt and honest basic fallback. No model files or search index are loaded, and model downloads are blocked, so full vector ranking quality is not claimed by this probe. Reseed before repeating the native probe because it leaves the local paid kill switch halted.

The proxy test runs actual local Traefik 2.10.7 and 3.6.25 processes with role stubs. It verifies exact MCP routing, balancing and bearer forwarding alongside the existing failure/drain/routing checks:

```bash
cd goodwatch-proxy/traefik
./test-search-local.sh
```

Live OAuth, real provider billing, populated vector ranking, production ingress installation and Valkey failover/data-loss recovery are outside these checks. No production service or deployment is used.
