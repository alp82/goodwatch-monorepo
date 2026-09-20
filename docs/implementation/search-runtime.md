# Persistent search storage and runtime controls

Implementation handoff for [Implement persistent search storage and runtime controls](https://github.com/alp82/goodwatch-monorepo/issues/117), following the [canonical runtime contract](https://github.com/alp82/goodwatch-monorepo/issues/113#issuecomment-5751068292). Prepared 2026-09-21. This is reviewable implementation, not production deployment or integrated-search acceptance.

## Delivered interfaces

- `goodwatch-webapp/app/server/search-runtime/runtime.server.ts`: `runJevStage`, `recordSearchHistory`, `nativeLanguagePolicy`, `translationEnabled`, typed `JevOutcome`, and the explicit model/price/deadline constants. Pass the unchanged D4+ full-attribute and short-B2 question payloads as the two requests. Consume the returned readings in existing retrieval/ranking. No questions or ranking were changed.
- `goodwatch-webapp/app/server/search-runtime/store.server.ts`: dedicated PostgreSQL store, atomic claims/reservations, settlement, explicit unknown-outcome reconciliation, authenticated/anonymous history, and encryption. `getSearchStore()` reuses one pool per process; all instances must connect to the same database.
- `goodwatch-webapp/migrations/20260921_search_runtime.sql`: one-time owner-applied PostgreSQL schema. It is deliberately not Crate SQL, not a Redis cache, and not an automatic application-start migration.
- `docs/research/typesafe-budget-controls.md`: preserved original research. Its “pending decision” wording describes research-time status; the linked canonical resolution subsequently accepted reservations and fail-closed behavior.

## Integration contract

1. Obtain the authenticated account from verified server authentication, and a client network address from the deployment's trusted ingress resolver. Never pass a user-supplied account ID, forwarded header without trusted proxy validation, or minted cookie as the network identity. Guest full search is supported. The network scope enforces 20 uncached stages per rolling 60 seconds even if cookies change; authenticated searches also share an account scope. A shared NAT can therefore encounter a conservative shared limit. Admission identifiers are HMACs in a separate table, lazily removed after two minutes; there is no guest identity in retained history.
2. Check `translationEnabled()` **before** any translation call, cache preparation that charges money, or reservation. It is false unless server `SEARCH_TRANSLATION_ENABLED` equals `true`. Default-off non-English input must use `nativeLanguagePolicy(false)` and native Jev plus vector-only retrieval, without an English phrase search. English/title handling is unchanged. The accepted nano translator remains a keeper behind this flag; the translation/route implementation belongs to the integration ticket.
3. Translation success uses `language.mode='translated'` with translation model, policy version, and translated text. English, native fallback, and translated cache identities cannot collide. A translated Jev input while the flag is off returns a configuration fallback. The Jev wrapper does not itself invoke translation.
4. Call `runJevStage` only for interpretation. Reuse its readings across current catalog retrieval, filters and snapshot pagination. The cache HMAC includes conservatively trimmed/NFC request identity, exact complete payloads, model, question version, and language policy; payload text is preserved, not lowercased. Creation dates are retained without TTL. Concurrent duplicate misses receive a typed busy/basic outcome rather than launch another pair of calls. Ready cache entries can be reused without provider credentials or remaining budget.
5. A basic outcome calls the accepted title + literal-text fallback and displays “Showing basic search results.” The 1,500 ms deadline covers parallel Jev network/response parsing, not database operations, translation, or total browser latency.
6. Call `recordSearchHistory` once per completed search, including cached/basic/title paths, with the original text, verified account ID at that moment (otherwise `null`), elapsed milliseconds, outcome/reason, and actual or conservatively reserved cost. Never retroactively associate guest rows. Check `recorded`; a storage outage returns false instead of pretending history was saved. Do not put raw input or provider errors into URLs, analytics, replay, error reports, breadcrumbs, or generic SQL logs. Final route/telemetry changes belong to integration.

### Paid translation extension

Every future paid stage, including nano translation, must use the **same store** and budgets: `lookup` → `claim` with its own complete versioned stage identity, verified maximum billable cost and price version → `dispatch` before its one no-retry call → `finish` with verified usage, or `null` for any unknown outcome. Translation-only cache hits must not be assumed to imply free downstream interpretation, and a Jev cache hit does not excuse an earlier paid translation. Stage-local claims also prevent duplicate translation calls. Compose visitor admission so a two-stage search consumes one uncached-search allowance (extend the transaction to carry an unforgeable admission ticket); do not enable paid translation until that composition and a verified nano bound are implemented. The current default-off path uses one paid Jev stage and already enforces the agreed 20-search limit.

## Accounting and failures

The ledger uses integer nanodollars: one dollar is 1,000,000,000 units. Daily cap is $1 and monthly cap $5, shared by all instances. One short PostgreSQL row lock serializes both window charges, admission counters, cache ownership and concurrency. Windows are UTC calendar days/months chosen from a single database statement timestamp at admission; reconciliation changes the original admission windows, even after midnight/month rollover. These are GoodWatch feature admission windows, not a claim about a provider's invoicing timezone.

The current [official Jev models documentation](https://docs.typesafe.ai/models), checked 2026-09-21, specifies a 64k total-input context, $0.042 per million input tokens, and free output. Reserve **65,536 tokens × 42 nanodollars × two calls = $0.005505024**. The documented context ceiling, rounded upward, is the bound; the roughly 6,600–8,000 observed tokens are not a bound. The wrapper also rejects source requests over 4,096 UTF-8 bytes and serialized call payloads over 65,536 bytes before spending. A reported context-bound breach halts further paid admissions; deployment must review provider pricing/context changes before updating the explicit versioned constants.

Successful usage releases unused allocation immediately. Typical 8,000-token usage costs $0.000336. Fully unknown pairs each retain $0.005505024, permitting at most 181 such pairs against the daily cap or 908 against the monthly cap. Actual typical successful-search capacity remains much higher (roughly 2,976/day or 14,880/month at that example cost, less a final reservation headroom). This is intentionally conservative.

The published [HTTP contract](https://docs.typesafe.ai/api) reports token usage, but does not establish failed-request billing or monetary rounding. Local ledger enforcement is conditional on the published context ceiling and per-token price being the complete charge; it is not an account-wide provider hard cap or a guarantee about undocumented surcharges. Any absent/unusable usage, error, cancellation, timeout, unknown commit, or restart preserves allocation. Never infer free inference from a 4xx/5xx response. Provider bodies are not logged. SDK `@typesafe-ai/sdk@0.6.0` and model `jev-1.13.0` are pinned, retries are zero, SDK logging is explicitly off, API endpoint is fixed, and `TYPESAFE_API_KEY` comes only from server environment. Node 20+ is required.

Global rolling admission is 240 stages/minute and global live-stage concurrency 16. On a later claim, attempts older than 30 seconds are marked unknown and stop occupying concurrency slots; their cache keys stay blocked and budget stays charged. A restart therefore cannot produce a duplicate paid attempt for those keys. `recoverOrphans()` is also available for maintenance. `reconcileUnknown(id, totalActualNano, evidence)` requires verified total billing for the entire pair; it is idempotent and has no public route. An operator may then release unused cost and permit a fresh attempt. Age alone never establishes zero cost. A lost response can reduce availability until billing is established; this is the accepted fail-closed tradeoff.

## Storage and deployment preparation

No production database connection, migration, provider request, deployment, or secret change was made for this work.

Required server secrets/configuration: `SEARCH_DATABASE_URL` (shared durable PostgreSQL, TLS verified for remote connections), `SEARCH_STORAGE_KEY` (persistent 32-byte secret encoded as 64 hex characters), `TYPESAFE_API_KEY`, and optional `SEARCH_TRANSLATION_ENABLED` (leave unset/false initially). Back up both database and encryption key; changing the key without migrating encrypted rows makes history unreadable and changes cache identity. Use normal database durability/backups; ephemeral storage is unsuitable.

Apply the migration once as a database owner after production approval. Grant a dedicated server role schema USAGE and SELECT/INSERT/UPDATE/DELETE on control/budget/attempt/interpretation/admission, but only INSERT on history for the interactive runtime. Give history access and reconciliation to a separate restricted operator process where practical. The schema and its tables revoke PUBLIC privileges. Do not expose them through anonymous/client data APIs. The runtime pool uses bounded connection/query/lock timeouts and bypasses the application's generic SQL logger.

Raw retained text, interpretation payloads, and reconciliation evidence use authenticated AES-256-GCM encryption before SQL parameters are constructed. Retained guest history contains no IP, cookie, visitor digest, cache key or attempt foreign key; account ID is nullable and assigned only on insertion. Ordinary history writes do not update past rows. A server `.server.ts` boundary and the SDK browser prohibition keep provider/storage secrets out of client imports. The final production bundle and deployed ingress/telemetry must still be checked during integration/release acceptance.

## Verification observed locally

No automated test files were added, per webapp AGENTS. Ad hoc probes used an isolated disposable PostgreSQL 18.6 cluster on loopback port 55483 and a fake fetch transport; no paid calls were made.

| Probe | Observed result |
| --- | --- |
| 32 simultaneous identical cache claims | 1 claim, 31 busy outcomes; 20 ms total |
| 24 concurrent claims with one conservative allocation left, daily and separately monthly | 1 admitted, 23 budget fallbacks; no overshoot |
| Repeated visitor, settled calls | 20 admitted; 21st rate fallback |
| Global active claims | 16 admitted; 8/24 busy |
| Successful settlement | Both windows reduced from full reservation to actual cost |
| Restart/orphan recovery | 16 stale attempts became unknown; a different key admitted; same unknown key remained blocked |
| Reconciliation twice | First applied; second no-op |
| Interpretation dated 2000, new version key | Old entry still reusable; new version missed |
| Guest versus authenticated history | NULL versus verified UUID; distinct encrypted texts, no visitor columns |
| Successful fake SDK pair | Exactly two calls; 26 ms including local DB and fake transport |
| Cached pair with provider secret removed | Cached outcome, zero additional calls |
| Translation flag unset | False; translated stage rejected with zero additional calls |
| HTTP 529 | Exactly two initial calls for the pair, no retries; full reservation retained |
| Headers succeed, response body stalls | Basic deadline at 1,503 ms; both signals aborted |
| Caller abort | Cancelled outcome at 51 ms; full reservation retained |
| Database unavailable | Basic storage outcome, zero provider calls |
| Local cache lookup, 100 samples | p50 0.04 ms, p95 0.13 ms (loopback only, not production forecast) |

Standalone strict TypeScript checking passed for both new server modules. Repository-wide `npm run typecheck` still reports existing failures outside these modules (440 output lines); it reports none in `search-runtime`. Dependency-tree validation was performed after adding pinned SDK/PostgreSQL packages. No UI change was made, so no browser/Lighthouse acceptance was claimed. Final route composition, actual provider latency/cost, production migration/ingress verification, and integrated evaluation remain later map work.
