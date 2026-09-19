# Availability timestamps: verified evidence and propagation contract

Resolution asset for [Verify availability timestamps for the 30-day watchability rule](https://github.com/alp82/goodwatch-monorepo/issues/91), observed 2026-09-19, 04:26–04:30 UTC. The [sanitized data extract](availability-evidence.json) records representative live Mongo, Crate and local webapp responses. This investigation makes no application or production data changes. It does not deliver the propagation or watchability feature.

## Finding

Successful **TMDB web country snapshots** have trustworthy last-success timestamps, including explicit empty results. Their scope is media identity plus country and the page's offer types/providers, not an independently checked service. The current read boundary loses that evidence. Existing API-provider payloads have no independently trustworthy offer-check timestamp: title refresh can retain an omitted older payload. Neither the title-wide maximum provider timestamp nor publication timestamps establish watchability.

The scoped implementation belongs to [Preserve availability-check evidence through publication](https://github.com/alp82/goodwatch-monorepo/issues/96). Its consumer belongs to [Implement interest discovery and explicit watchability checks](https://github.com/alp82/goodwatch-monorepo/issues/92). They must preserve discovery when watchability is unknown.

## Live path and counterexamples

Windmill's enabled `f/sync/copy/tmdb_streaming` schedule runs `0 0 2/6 * * *`. Enabled priority flow `f/priority/crawl_all` runs every twenty seconds and its deployed definition invokes `f/priority/publish`, which imports the same streaming copier. The ordinary API-fetch schedule is disabled; that does not disable API fetching inside priority work. Read-only deployed source downloads exactly matched local source for:

| Script | Deployed hash |
| --- | --- |
| `f/sync/copy/tmdb_streaming` | `0999245320595c4f` |
| `f/priority/publish` | `347547eb782839a2` |
| `f/tmdb_web/country_state` | `0344620c36d2382f` |
| `f/tmdb_api/tmdb_fetch_details_from_api/fetch` | `9a1092f60964e64f` |

Representative current source snapshots and publication readbacks:

| Identity/country | Successful web check (UTC) | Observed result |
| --- | --- | --- |
| Movie 256591 (Focus), BR | 2026-09-14 17:45:37.957 | Eight web offers, eight published offers. |
| Same movie, DE | 2025-09-19 11:45:03.355 | Fifteen web offers, seventeen published offers. Title maximum is nevertheless September 2026. A fresh other country must not validate these German contributions. |
| Same movie, NE | 2023-12-27 16:04:46.180 | Empty old snapshot retained after failure on 2026-09-13; zero published offers does not establish a current negative. |
| Movie 1226863, US / DE | 2026-09-10 08:34:42.533 / 08:38:04.903 | Twelve / fifteen successful web offers, twelve / fifteen published offers. |
| Same movie, CV | 2026-09-10 08:38:02.818 | Successful zero-web-offer snapshot, but two API-only buy/rent rows remain published. The API title timestamp is September 4, which is not independently verified offer time. An empty web snapshot cannot validate a combined negative. |
| Show 1399, GR | 2026-09-10 08:34:05.568 | Two web offers and three reconciled rows. |
| Same show, US / DE | 2025-11-03 18:26:25.497 / 23:07:43.053 | Six / eight old web offers, eight / fourteen reconciled rows; September 2026 API title refresh and title maximum do not refresh scraped URLs/prices. |
| Show 66732, US / DE | 2025-11-09 09:26:28.071 / 09:26:19.003 | Two old web offers and two published rows per country. |
| Show 9361, AT / DE | 2025-06-17 14:48:20.300 / 14:47:48.276 | Five / nine retained web offers; eight consecutive failures, last failures September 18, and identity-repair-pending markers. Sixteen published rows across those countries remain retained. None is made current by retention. |

Pending movie 899/NE and 14546/NE retain empty historical snapshots with failures. The marker is a nonempty repair-plan identifier, **not boolean true**. Resolved-alias quarantine tombstones still exist for movie 162483, 3635601 and 5338654; the publisher intentionally freezes these retired identities. No unresolved quarantine was established by this bounded sample.

Crate's live `streaming_availability` schema has identity, country, type, service, contribution fields and generic `created_at`/`updated_at`, but no source-check/status columns. Crate timestamps arrive as epoch **milliseconds** (for example title maximum `1789407963566`), whereas Mongo supplies BSON UTC datetimes. The existing Python writer uses naive `datetime.utcnow()`; normalize these explicitly as UTC before crossing the JSON boundary.

Five HTTP 200 Remix loader responses from localhost:3003 (Focus DE/BR, movie 1226863 CV, show 1399 US/GR) contained 17/8/2/8/3 country-scoped offers respectively. Each offer exposes exactly service ID, offer type, TMDB link, stream URL, price and quality; no evidence time/state. Repeating Focus DE within the 30-minute cache lifetime returned identical offers. This demonstrates the current local read boundary against live data, not a cache-invalidation or production UI acceptance test.

## Source semantics confirmed in deployed code

- [country_state.py](../../../goodwatch-flows/windmill/f/tmdb_web/country_state.py): fenced success saves links/time atomically, including an empty list, and clears failure/pending state. Failure leaves old links and successful time intact. Seven-day refresh scheduling and retry deadlines do not define the thirty-day product rule. Historical `failed_at` may predate a later success; do not reject a success merely because an old legacy failure field exists.
- [Web parser](../../../goodwatch-flows/windmill/f/tmdb_web/tmdb_crawl_providers/fetch.py): country verification plus provider blocks or explicit no-offers markup is required. HTTP success alone is insufficient.
- [API fetch](../../../goodwatch-flows/windmill/f/tmdb_api/tmdb_fetch_details_from_api/fetch.py): only fields present in converted data are replaced; overall `updated_at` advances. Consequently retained `watch_providers` plus recent title time cannot prove when offers were checked. API-country omission is not presently established as a successful empty country check.
- [Reconciler](../../../goodwatch-flows/windmill/f/sync/copy/tmdb_streaming.py): preserves independent API and web contributions, freezes pending identities, skips failed/deferred/invalid country scrapes, and keeps unattributed legacy rows unless both source scopes replace them. Unresolved mapping defers that country after a bounded refresh; another country's successful publication does not resolve it. Source-specific fields can have different check times within one published row.
- [Details reader](../../../goodwatch-webapp/app/server/details.server.ts) and [discovery reader](../../../goodwatch-webapp/app/server/discover.server.ts): row/aggregate existence currently substitutes for availability. Qdrant membership and title publication times are candidate-retrieval aids, not final watchability proof.

## Minimal propagation contract

This is the technical contract needed to implement the already-confirmed thirty-day/unknown distinction; it does not set a new product preference or require a general freshness program.

1. **Scope and snapshot identity.** Persist evidence separately from offer rows, keyed by canonical media type (`movie`/`show`), TMDB ID, uppercase country, and source (`tmdb_web`/`tmdb_api`). Keep a snapshot/version reference shared by all contributions from that check. Store evidence even when it produced zero offers. Snapshot coverage explicitly identifies supported offer types and whether service mapping is complete. A country's check never applies to another country.
2. **Check time and state.** Carry nullable `checked_at` as UTC epoch milliseconds, last-attempt/failure state separately, and a usable/unknown state with reason (missing, invalid, stale, failed/deferred, identity pending/quarantined, mapping incomplete, unattributed). Preserve original successful time through retries/publication; never stamp publication time as check time. A latest failed/deferred check cannot establish a new negative. Use the conservative unknown state for a retained source contribution whose active failure/pending state prevents the publisher from verifying it; an unrelated independently usable source may still support a positive.
3. **API proof going forward.** Capture a dedicated provider-check timestamp only when the provider response is present, structurally validated and attributable to the media identity. Preserve prior evidence on omitted/error payloads without refreshing its time. Do not backfill this field from title `updated_at`. Mark only explicitly validated country coverage usable; absent API country entries remain unknown unless the fetch implementation establishes/documentedly validates complete-country omission semantics. Existing API snapshots remain unknown until this proof exists.
4. **Offer provenance.** Every offer contribution references its source snapshot and its exact service/type. Keep API and web provenance separately when combined into one row. Fresh API membership cannot relabel old scraped price, quality or URL as current. A fresh web positive with resolved identity/mapping can establish matching offer membership independently; unknown/stale other-source absence does not refute it. Do not expose stale auxiliary fields as newly checked facts.
5. **Positive, conflict and negative.** Evaluate selected services and allowed offer types against usable current evidence. A positive needs at least one independently verified matching contribution and no contradictory **usable current** complete snapshot covering that same service/type. Fresh contradictory sources produce unknown for that offer; do not invent source precedence. Other independent unconflicted offers may still qualify the title. A verified no-match needs complete current coverage from all applicable contributing sources for the selected scope, no matches, no unresolved mappings that could hide a match, and no unknown retained/legacy contribution. One source's empty result cannot clear another source's uncertain positive. Without that coverage return unknown. Conservative unknown is permitted until API coverage is established; never fabricate a negative to improve result counts.
6. **Read boundary and caching.** Return raw scoped timestamps, coverage/status, contribution references and sufficient normalized offers to derive `watchable`, `no_match`, or `unknown`, with reason and evaluation time. Keep raw evidence in cache, not a permanently valid eligibility boolean. Re-evaluate age at each response and as displayed evidence expires, or schedule revalidation at `checked_at + 2,592,000,000`. Cache keys must include country and any service/type constraints used to compute the result. Prefer deriving user-specific matches after fetching reusable scoped evidence. A cached old snapshot can become unknown; refreshing a cache alone cannot make it current.
7. **Missing selection and discovery.** Without a country or selected services, ask for the missing watchability input; do not return no-match from an empty selection. Included-service types remain the default and paid offers require opt-in per the resolved product decision. Lack of current evidence excludes confirmed watchability only; retain interest discovery and Want to See. Candidate aggregate/vector membership must pass this evidence gate before presentation as a confirmed result.

`0 <= now_ms - checked_at_ms < 2,592,000,000` is the freshness interval, provided timestamp units/types and provenance are valid. Reject missing/nonfinite/invalid/future times as unknown; do not parse unknown numeric units heuristically. Identity and mapping/status gates apply in addition to age. Evaluate UTC elapsed time, not calendar-month subtraction or browser-local dates.

## Boundary verification and limitations

A one-off Node calculation using fixed UTC `2026-09-19T04:30:00.000Z` produced:

| Case | Contract result |
| --- | --- |
| 30 days minus 1 ms | Fresh, subject to scope/status and matching |
| Exactly 30 days | Unknown |
| 30 days plus 1 ms | Unknown |
| Missing, NaN, future timestamp | Unknown |
| Cached success 1 minute short of expiry, displayed 2 minutes later | Unknown |
| Current complete check with no matching selected service | No-match only if all required source coverage is usable; otherwise unknown |
| Current check with no selected service input | Needs selection, not no-match |
| Fresh BR / stale DE on the same title | BR evidence cannot qualify DE |
| Fresh empty web / retained API offer | Unknown unless independent API proof resolves the conflict |

The first five rows were evaluated directly; the remaining rows are required semantic outcomes supported by the observed scope/counterexamples and contract, **not claims of an implemented evaluator passing tests**. No UI or production data was changed, so browser UI QA and Lighthouse are not applicable here. No automated application tests were added.

These checks did not trigger scrapes, replay publication, change schedules, inspect playback entitlement, or prove catalog-wide accuracy. Bounded initial broad Mongo queries for empty/pending examples timed out; targeted identity reads and the actual nonempty pending-marker query supplied the reported samples. Unmapped provider and unattributed legacy behavior is source-verified, not reproduced as an active live failure. Omitted API payload retention is source-verified, not an observed captured upstream omission. Existing fresh-empty snapshots prove stored empty success semantics but do not replace a new parser/network acceptance test. Production web UI freshness behavior and post-implementation cache expiry remain release acceptance work.

No broader crawler, identity cleanup or infrastructure ticket is justified by this investigation. The existing propagation task is the required dependency. It should validate publication/readback for successful empty, mixed contributions, active failure/pending, mapping/legacy unknown, and cache boundaries before the watchability consumer is accepted.
