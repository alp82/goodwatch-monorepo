# Combined search implementation handoff

Production `/search` combines title lookup with the accepted corrected D4+
interpretation and retrieval. The header, shared filters, 20-item pages and
real detail navigation use a bounded session snapshot of up to 100 results.
Search edits replace history; filter and page changes push history. Pagination
and detail navigation reuse the snapshot rather than repeating paid inference.

The search runtime uses the existing Redis cluster for fast cache reads and
short-lived rate/concurrency coordination. Crate retains encrypted interpretations,
search history, and append-only spending estimates/adjustments. Qdrant retrieval
is unchanged. The user explicitly replaced the earlier PostgreSQL/strict-cap
approach with this existing-stack design and accepted small concurrency overruns.

## Final user amendments

- Readable `q` URLs and shareable links are required. A new tab reconstructs the
  search rather than receiving another tab's cached snapshot.
- GA automatic site-search and history collection stay enabled, including raw
  search terms. There is no duplicate manual page-view tracker. PostHog and
  Sentry sanitization remains; see [analytics](analytics.md).
- Remove the adult opt-in control. The public action always excludes
  adult-flagged titles, even if an old link or request requests inclusion.
  Unknown classification remains allowed. The lesser-known option remains.
- Detail taste/search bar links use Remix `prefetch="render"`; result links and
  pagination use `prefetch="intent"` (hover/focus).

The user reviewed the local journey positively and explicitly authorized
pushing and merging the implementation. This is not a claim that every
integrated relevance/rollout criterion has passed.

## Runtime configuration

Use Node 20 or later and the committed npm lockfile. Apply the additive, repeatable
`goodwatch-webapp/migrations/20260921_search_crate.sql` to the existing CrateDB.
There is no PostgreSQL dependency, migration, or `SEARCH_DATABASE_URL` requirement.

Configure `TYPESAFE_API_KEY` and a stable `SEARCH_STORAGE_KEY` (64 hexadecimal
characters representing 32 bytes). The latter protects retained text and cache
identities and must survive redeploys. Reuse existing `CRATE_*`, `REDIS_*`,
`TMDB_API_KEY`, `QDRANT_URL`, and `QDRANT_API_KEY` settings.

`SEARCH_TRANSLATION_ENABLED` defaults to off. Enabling it also requires
`OPENROUTER_API_KEY`. Translation shares spending/admission accounting with Jev.
Only configure `SEARCH_TRUSTED_IP_HEADER` for a header overwritten by trusted
ingress that supplies one valid IP; otherwise guests share a conservative scope.

Each paid attempt appends a conservative estimate before dispatch. Known usage
appends one adjustment under a deterministic primary key; repeated settlement
cannot double-charge. Unknown billing retains its estimate until evidence-based
reconciliation. No spending row is updated/deleted by runtime code. Settlements
use the original estimate's UTC budget window, including across midnight.

The $1/day and $5/month checks are practical cutoffs, not atomic hard limits:
simultaneous checks and Crate's search-index refresh delay can admit work beyond
the threshold. Redis limits rate/concurrency but is not the authoritative spending
ledger. Loss of Redis does not erase interpretations or spending history; missing
coordination/storage prevents new paid calls, while readable cached interpretations
remain usable. Cache data has a one-day Redis TTL and indefinite Crate retention.

Crate primary-key claims also prevent a duplicate paid request if Redis loses a
lease. Abandoned pending/unknown interpretations stay blocked rather than being
automatically retried/refunded. Tables are created explicitly during release, not
by web requests. The migration does not change catalog or vector tables.

## Evidence and limitations

- [Current Crate/Redis probes](crate-redis-probes.json) use disposable real CrateDB
  5.10.9 and Redis 7.2.4 with mocked providers. They cover durable reuse after cache
  loss, duplicate suppression, immutable/idempotent accounting, cutoff and accepted
  concurrent overrun, rate/concurrency limits, translation admission reuse,
  guest/account separation, storage failure, and timeout reconciliation.
- Earlier PostgreSQL captures below are historical evidence, not validation of
  the replacement storage adapter.

- [Exact question parity](payload-parity.json): all 30 fixtures match the
  accepted state/question payloads; no provider calls in this comparison.
- Historical [PostgreSQL runtime probes](runtime-probes.json): disposable local PostgreSQL and mocked
  providers exercise cache reuse, duplicate work, budget denial, translation
  flag changes, admission composition, and deadline handling.
- [Composed baseline](baseline.json): 30 actual production-action calls with
  live read-only catalog/providers and an isolated local database. Median
  1,736.5 ms; 29 fell back to basic search. Charged/reserved accounting totaled
  $0.126615552, including uncertain reservations, not a billed-cost estimate.
  Five translation-on calls had median 2,467 ms and $0.126912296 reserved/charged;
  all five ultimately used basic retrieval. No new human relevance grades were
  inferred. The `Incepton` failure and high deadline-fallback frequency remain
  acceptance work; the fixed 1.5-second Jev deadline was not silently relaxed.
- [Browser observations](browser-observations.json) preserve the intermediate
  debounce/Enter, replacement and pagination run, including its interrupted
  navigation failures. Subsequent Chrome DevTools checks confirmed real Heat
  detail navigation and browser Back, the removed adult toggle even with an
  old `adult=1` URL, automatic route module preloads in the search detail bar,
  and a preload only for the hovered result. The user reviewed the final UI.
  This is not exhaustive mobile, recovery, relevance, or production validation.
- Clean-install build and type-check comparison against current main are
  reported in the PR. The repository has existing type errors; do not describe
  type checking as green.

Implementation ticket: [Implement accepted combined search and header-to-detail journey](https://github.com/alp82/goodwatch-monorepo/issues/122).
Further acceptance: [Complete integrated search acceptance and close baseline coverage gaps](https://github.com/alp82/goodwatch-monorepo/issues/121).
