# Availability evidence publication and consumer handoff

Resolution asset for [Preserve availability-check evidence through publication](https://github.com/alp82/goodwatch-monorepo/issues/96). Implemented and verified locally on 2026-09-19. **Production rollout remains part of [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94).**

## Representation and semantics

`streaming_evidence` is additive to the existing offer table. Its primary key is `(media_tmdb_id, media_type, country_code)`. The versioned JSON `payload` contains both logical source keys (`tmdb_web`, `tmdb_api`) together, so source checks, normalized offers and successful empty results arrive atomically for a country. Each source has its own successful UTC millisecond time, last attempt, state/reason, offer-type coverage, mapping completeness and deterministic snapshot reference shared by its offers. `unknown_contributions` preserves legacy/unattributed and missing-source uncertainty. Publication timestamps are not check timestamps.

The existing streaming publisher owns the envelope under its existing title lease. Scheduled and priority publication both use this path. Failed-only changes, pending repairs and quarantines invalidate proof without refreshing success time. Quarantines preserve prior provenance but mark its checks unknown. A country disappearing from both sources invalidates its previous envelope, including previously empty checks. A successful empty source remains represented without offer rows. Old offer rows and aggregate/vector behavior remain compatible.

The API fetcher records proof only for a successful HTTP response with the requested identity and structurally validated provider payload. Its proof hashes the normalized stored payload; publication validates that binding. Only explicit country entries have coverage. Missing, malformed, failed or mismatched responses do not refresh prior provider payload/proof, and record an unsuccessful attempt. Existing API data has no proof until a successful fetch; title `updated_at` is never a backfill.

A source may establish an independent positive despite another source being unknown. Two current complete sources disagreeing on the same service/type make that offer unknown. Another unconflicted offer may still qualify. No-match requires both source checks to be current, complete for the requested types, and no unknown contribution. Thus an empty web snapshot cannot clear a retained API offer of unknown age. API membership never supplies web prices, quality or clickout URLs.

## Consumer interface

- `getAvailabilityEvidence({ mediaType, tmdbId, country }, options?)` in `app/server/availability.server.ts` returns a validated envelope or `null`. `options.bypassCache` bypasses its cache. Movie aliases are canonicalized. Country is uppercase and part of the cache key. Query parameters are bound.
- Existing movie/show details results now include `availability_evidence`. This is attached outside the old details cache, so old cached title objects do not hide the new field. Existing offer fields are unchanged.
- `evaluateAvailability(raw, { mediaType, tmdbId, country, serviceIds, includePaid? }, now?)` in `app/utils/availability-evidence.ts` is server/browser safe. It returns `{ state, reason, evaluatedAt, expiresAt, offers }`. States are `watchable`, `no_match`, and `unknown`; missing country/services returns unknown with `needs_selection`.
- Default offer types are flatrate/free/ads; rent/buy require `includePaid`. Returned offers remain source-specific and include only usable, current, unconflicted contributions. Consumers must use those offers for confirmed facts, not merge stale auxiliary fields from the legacy offer table.
- Freshness is `0 <= now - checked_at < 2_592_000_000` milliseconds. Exactly thirty days is unknown. Missing, nonfinite, future and second-unit times are rejected. No calendar-month or local-time arithmetic is used.
- The thirty-minute cache stores raw envelopes only. **Evaluate on every response and schedule a render/revalidation at `expiresAt` while displayed.** Reevaluate on service/country/type selection changes. Do not cache the eligibility boolean or rely on title/vector membership. The watchability delivery ticket owns that UI lifecycle and filtering integration. A cache hit may age to unknown; a source status update may take up to the raw cache TTL to appear unless bypassed/invalidated.
- Before migration, absent table/rows or malformed evidence degrade to unknown; DB errors remain logged. Interest discovery is retained. Current production rows therefore remain unknown until the additive pipeline is rolled out and publishes proof.

## Runtime verification

A disposable **local** CrateDB 5.10.9 container at loopback port 14296, with isolated synthetic movie/show ID 42 fixtures and mocked Mongo inputs, exercised the actual publisher, actual Crate schema/upsert/select, and bundled actual webapp server reader. No production title or source record was written. The resulting twelve envelopes were also evaluated through Chrome DevTools in the running localhost:3003 browser. The [sanitized runtime record](availability-publication-evidence.json) captures server and browser outcomes.

| Case, for both movie and show | Result |
| --- | --- |
| Fresh web and API matching offer | Watchable, distinct source references |
| Old web offer + independently fresh API offer | Watchable from API only; old web URL/HD excluded |
| Failed web source + independently fresh API offer | Watchable from API only |
| Fresh complete web and API empty | No-match |
| Fresh web positive / fresh API empty | Unknown, source conflict |
| Identity repair pending | Unknown |
| Missing country envelope | Unknown |

Additional Chrome DevTools probes verified: a fresh empty web check with unknown retained API offer stays unknown; unknown legacy contribution blocks a negative; current checks with no selected-service match yield no-match; empty selection requests selection; paid offers require opt-in; an independent unconflicted offer survives a conflict on another type; wrong country fails scope validation. Thirty days minus 1 ms is current; exactly thirty days and plus 1 ms are unknown. Reusing the same raw cached object before and after expiry changes watchable to unknown. Null/NaN/future/epoch-second times all yield unknown.

The live-data-backed local Remix loaders returned HTTP 200 for movie 256591/DE, movie 256591/BR and show 1399/GR with their original 17/8/3 legacy offers and `availability_evidence: null` before migration. This verifies the actual additive loader fallback, **not production deployment**. No visible UI was changed; Lighthouse is not applicable to this data-boundary task. No automated webapp tests were added.

Validation: 10 focused evidence tests, 30 streaming publication tests and 20 priority publication tests pass. Alias-resolution checks pass (8; 12 live integration checks skipped by their existing gates). Production webapp client/SSR build passes. Typecheck has the same 272 baseline diagnostics before and after, with no new diagnostic signatures. Source normalization/omitted payload, identity mismatch, empty-country removal, failure-only scheduling, quarantine, country separation and movie/show provenance have executable pipeline regression coverage.

## Rollout and recovery

Coordinate with the existing [deployment runbook](deployment-recovery-runbook.md). Do not deploy just this partial feature to claim the complete journey.

1. Before enabling the new writer, create only the additive Crate table (same definition as `SCHEMAS`; verified against local Crate):

   ```sql
   CREATE TABLE IF NOT EXISTS streaming_evidence (
     media_tmdb_id INTEGER,
     media_type TEXT,
     country_code TEXT,
     payload TEXT INDEX OFF,
     created_at TIMESTAMP,
     updated_at TIMESTAMP,
     PRIMARY KEY (media_tmdb_id, media_type, country_code)
   ) CLUSTERED INTO 6 SHARDS;
   ```

   The general schema initializer includes this table, but the scoped DDL avoids unrelated migrations. Verify columns/PK if the table already exists.

2. Deploy Windmill helpers `f/tmdb_api/provider_evidence` and `f/sync/availability_evidence`, updated API/Crate models and schemas, API fetch script, and streaming publisher as one coordinated workspace revision. Scheduled and priority publication import the shared writer. New helpers use stdlib/internal imports; their script metadata is included. No schedule or API-secret change is required.

3. The publisher idempotently ensures narrow Mongo indexes for each corresponding movie/TV source collection: provider `(failed_at, tmdb_id)`, details `(watch_providers_attempted_at, tmdb_id)`, and two partial provider `tmdb_id` indexes named `evidence_identity_repair_pending` and `evidence_country_identity_error`, each covering existence of its marker. Provision/observe those index builds before enabling scheduled work at catalog scale; failures remain visible. Existing successful-time indexes remain in use. These are publication invalidation indexes, not a rescrape or capacity program.

4. After the writer is enabled, let ordinary/priority work publish, or run a bounded targeted publication for acceptance identities using `copy_media(..., {"tmdb_id":{"$in":[...]}}, media_type, recent_only=False)`. This is publication of stored snapshots; mapping retries retain their existing bounded behavior and can issue a fetch. Do not claim API legacy freshness or broad coverage. A broad rescrape is not required or authorized by this implementation.

5. Deploy the completed webapp consumer; verify real stored evidence/readback, failures, empty countries, selected-service negatives, conflicts and displayed expiry. Bypass/clear only the `availability-evidence-v1` cache entries for acceptance scopes, or allow their thirty-minute TTL to expire. Production acceptance and UI aging remain release gates.

Recovery: revert consumer/code using the release runbook and leave the additive Crate table/indexes in place. Old offer-table readers remain valid. Rolling back to an API MongoEngine model that does not know the three new fields can reject documents: retain the compatible model definitions, or after pausing writers and taking a source snapshot, remove **only** `watch_providers_check`, `watch_providers_attempted_at` and `watch_providers_error` from the two TMDB details collections before restoring that old model. Removing proof intentionally returns those sources to unknown and does not alter provider payloads. Do not drop legacy availability rows, reinterpret publication times, or roll back saved user progress. Restoring stale evidence snapshots cannot make their times current; republish from authoritative sources before re-enabling confirmed watchability.
