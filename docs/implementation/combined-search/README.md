# Combined search implementation handoff

Production `/search` combines title lookup with the accepted corrected D4+
interpretation and retrieval. The header, shared filters, 20-item pages and
real detail navigation use a bounded session snapshot of up to 100 results.
Search edits replace history; filter and page changes push history. Pagination
and detail navigation reuse the snapshot rather than repeating paid inference.

The implementation includes the persistent PostgreSQL runtime from the accepted
runtime handoff. The Jev SDK uses an explicit Undici transport to avoid the
Remix fetch-shim abort failure observed during deadline verification.

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

Use Node 20 or later and the committed npm lockfile. Apply these migrations,
in order, to a dedicated PostgreSQL database (not CrateDB):

1. `goodwatch-webapp/migrations/20260921_search_runtime.sql`
2. `goodwatch-webapp/migrations/20260921_search_stages.sql`

Required for paid interpretation/history: `SEARCH_DATABASE_URL`,
`SEARCH_STORAGE_KEY` (64 hexadecimal characters representing 32 bytes), and
`TYPESAFE_API_KEY`. Existing catalog/provider settings are `CRATE_HOSTS`,
`CRATE_PORT`, `CRATE_USER`, `CRATE_PASS`, `TMDB_API_KEY`, `QDRANT_URL`, and
`QDRANT_API_KEY`.

`SEARCH_TRANSLATION_ENABLED` defaults to off. Enabling it also requires
`OPENROUTER_API_KEY`. The pinned nano translation stage shares persistent
budget and admission accounting with Jev. The offline language detector has
limited coverage; translation is not a new ranking strategy.

Only configure `SEARCH_TRUSTED_IP_HEADER` when trusted ingress overwrites that
header and supplies a single valid IP. Otherwise guest requests deliberately
share the conservative unverified-ingress scope. Missing runtime configuration
fails closed to basic search and does not authorize paid calls. Storage failure
can prevent history recording; it is not silently treated as durable success.

No environment secrets, local database, production migrations or production
provider configuration are delivered by this code merge. Rollout still needs
provisioning, trusted-ingress verification, and runtime/quality acceptance.

## Evidence and limitations

- [Exact question parity](payload-parity.json): all 30 fixtures match the
  accepted state/question payloads; no provider calls in this comparison.
- [Runtime probes](runtime-probes.json): disposable local PostgreSQL and mocked
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
