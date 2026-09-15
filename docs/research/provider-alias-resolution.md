# Historical provider alias resolution

September 15, 2026. **Implementation and audit complete; production rollout has not started.** This report is a handoff for independent review and execution. No production records, schemas, schedules, scripts, or frontend deployment were changed during this phase.

## Authoritative identity evidence

Live authenticated TMDB API requests returned 404 for all three retired movie IDs. Each canonical movie returned HTTP 200 with the ID/title/IMDb identity below. Both stored Mongo details records in each pair have the same IMDb ID and original title. No offers should be moved between the records.

| Retired movie ID | Canonical ID | Title | IMDb | Quarantined source rows | Outstanding demand |
| --- | --- | --- | --- | ---: | ---: |
| 5338654 | 658039 | The Forgotten Mountain / Mali i Harrum | tt8443724 | 3 | 4 |
| 3635601 | 872517 | Treasure Island: The Adventure Begins | tt0111483 | 131 | 0 |
| 162483 | 10679 | Iron Sky | tt1034314 | 37 | 52 |

Primary endpoints are `https://api.themoviedb.org/3/movie/{id}`. Complete sanitized API responses and BSON source snapshots are archived privately. Canonical details already exist; canonical 658039 has no Qdrant point at this observation, which is a preexisting completeness gap, not a reason to copy an old alias vector.

## Downstream audit

All Mongo collections were queried by `tmdb_id`, followed by schema/code inspection of actual movie references. Both IDs in each pair have details, IMDb/Metacritic/Rotten Tomatoes ratings, TV Tropes, genome, and DNA records. The retired IDs have no active provider records and no movie daily-dump records; all 171 original provider snapshots remain in quarantine.

Crate has three obsolete `movie` rows and the following obsolete movie child rows:

| Table | Rows |
| --- | ---: |
| alternative_title | 3 |
| media_image | 81 |
| media_video | 3 |
| person_appeared_in | 63 |
| person_worked_on | 91 |
| release_event | 41 |
| streaming_availability | 302 |
| translation | 43 |
| trope | 148 |

All five user tables (`user_favorite`, `user_score`, `user_skipped`, `user_watch_history`, `user_wishlist`) contain **zero movie-alias records**. Canonical Iron Sky has one score and one watch-history record; these must remain byte/value-equivalent. There are three alias queue rows, unleased, with acknowledgment zero and the outstanding demand above. Canonical demands are respectively 6, 48, and 0, also acknowledgment zero. Reread these live values before execution.

Qdrant collection `media_fingerprint_v1` contains all three obsolete movie points, IDs `1000005338654`, `1000003635601`, `1000000162483`. Archive vectors and payloads before deleting these exact IDs. Canonical points 872517/10679 exist and must remain unchanged.

Crate movie recommendation/similar arrays contain zero references to the retired IDs. A combined Mongo scan of `recommendations.results.id` and `similar.results.id` also completed with zero references. The first separate Mongo scan hit a 120-second timeout; the combined scan completed with a nine-minute limit. No array replacements are needed.

**Namespace exclusions:** show 10679 is Beef: The Series. Numeric matches in `production_company`, `season`, and TV Mongo collections are unrelated entities. Preserve all of them; never delete by numeric ID across arbitrary tables. `tmdb_daily_dump_data` is mixed media and requires `type: movie` in any selector.

## Implemented prevention

- Python and TypeScript registries contain exactly the three verified movie mappings; a Python parity test checks the shared facts. TV/show IDs remain unchanged.
- Public old movie routes issue 301 redirects preserving query parameters. Server details queries canonicalize IDs before caching. All five user-action writers, priority demand increments, and poster-impression deduplication canonicalize movie IDs.
- Explicit priority selection resolves movie aliases before Mongo lookup/claim; direct attempts to claim a retired queue ID reject it. Details initialization skips retired movie IDs.
- Both provider initializers and streaming publication honor `resolved_alias` tombstones as well as unresolved quarantines. The bulk initializer skips retired titles, while unresolved titles remain errors. Monitoring continues to count only genuinely unresolved markers.
- Operator primitives compose retired-ID denial with the existing Mongo validator. Later provider-repair finalization now preserves the previous validator, preventing another maintenance window from erasing these exclusions.
- The Crate queue schema adds nullable `alias_demand_transfers OBJECT(DYNAMIC)` for an atomic migration ledger on each canonical queue row.

## Demand transfer and recovery

`goodwatch-flows/scripts/provider_alias_resolution.py` supplies `transfer_demand`. It reads canonical demand, acknowledgment, ledger, and Crate `_seq_no`/`_primary_term`. A single conditional update adds only the untransferred outstanding amount and records the transferred total under the old ID in the **same row**. It never changes acknowledgment or lease fields.

A response lost after commit is safe: rerunning observes the ledger and does not add again. Concurrent canonical enqueues cause an OCC retry and are preserved. A late alias enqueue can be handled by rereading the fenced source and passing the new outstanding total: only its increment is transferred. A lower outstanding total than the existing ledger aborts. Zero-demand aliases also get an explicit ledger receipt. Missing canonical queue rows are initialized safely.

The operator must archive/fence the alias source queue row, transfer its outstanding total, read back the canonical ledger, then delete the alias row using its exact key and original `_seq_no`/`_primary_term`. A failed delete means reread/archive the changed alias and transfer only its new delta before retrying. Do not delete an actively leased alias row; reconcile its owning job first. Do not acknowledge demand as a substitute for moving it.

Rollback must not blindly subtract transferred demand after canonical requests/claims/acknowledgments have progressed. Preserve the ledger and snapshots; require a demonstrated safe fenced rollback or roll forward. Original user actions must never be counted or merged twice.

## Exact rollout order for the next agent

1. Independently review this change and rerun focused checks. Inspect current branch/main divergence; the shared checkout is `fix/priority-dna-gating`, with unrelated docs/AGENTS edits. Commit/integrate only scoped files. No commit has been created in this implementation phase.
2. Deploy the frontend canonicalization **before removing alias catalog rows**. Verify production HTTP 301/location/query behavior for all three old IDs, 200 canonical destinations and unchanged TV 10679. Local checks already pass. Chrome DevTools tools were unavailable; no layout changed. Frontend AGENTS forbids adding automated frontend tests.
3. Add `alias_demand_transfers OBJECT(DYNAMIC)` to production Crate if absent; preserve existing schema. Deploy the new Python module and scoped dependent scripts with pinned locks. Windmill may regenerate dependent locks; compare actual content/locks and run real import smoke jobs. Do not perform a sweeping unrelated sync.
4. Reread authoritative identity evidence and all affected data. Archive complete BSON originals, Crate movie/child/queue/user rows, Qdrant payloads/vectors, previous validators, and exact schedule/job states to the private directory with fsync, hashes, and receipts. Capture canonical user/content hashes separately. Existing snapshots are audit evidence, not permission to overwrite changed data.
5. Pause/drain only writers/publishers that could hold alias snapshots. Do not restart the bulk provider repair or clear its refresh queue. Source validators must deny retired movie IDs on the eight movie collections listed in `MOVIE_COLLECTIONS`, intersecting any existing validator, strict/error. Preserve validation settings/options in the archive. The mixed daily dump needs a movie-scoped guard if used. Reject probe writes in aborted transactions; retain unique indexes.
6. Archive/remove only movie-specific Mongo source documents for these three IDs (details, ratings, tropes, genome, DNA; active providers should already be zero). Preserve all `provider_identity_quarantine` originals. Remove the three Crate movie rows and exact `(media_type='movie', media_tmdb_id IN aliases)` child rows in the allowlist; remove no company, season, person, show, or canonical title records. Remove only the three exact Qdrant movie points. Coordinate against in-flight snapshot publishers before deletion and verify no regrowth.
7. Transfer outstanding queue demand with the atomic ledger/CAS policy above. Reread all five user tables before any deletion; unexpected alias user data requires lossless canonical reconciliation rather than discarding it. Existing canonical user data must remain unchanged.
8. Mark each original quarantine marker `resolved_alias`, adding canonical ID, resolution evidence/archive hash/path/date while keeping the original reason/archive/provenance. Keep the 171 quarantined snapshots. Resolved markers must remain effective tombstones, not be deleted.
9. Handle only matching Redis cached-result entries after inspecting candidate values. Never flush Redis, poster dedup/rate-limit keys, warmup leases, or unrelated cache namespaces. Long-lived cross-title cached cards are also protected by old-link redirects; record remaining TTL limits honestly.
10. Read back zero obsolete active/movie-derived/queue/Qdrant rows, zero unresolved markers for these aliases, all preserved quarantine rows and canonical/TV/user hashes. Verify pending country refresh still progresses. Restore exact prior schedule states and record deployment hashes, job IDs, archive receipts and final counts in this report.

## Tests and verification

- 89 focused Python tests pass, including registry parity, both initializer tombstone guards, monitoring exclusion, demand restart/concurrency and streaming/priority regression tests.
- 12 actual CrateDB integration tests pass on disposable local `crate:5.10.9`, including lost committed response/retry, concurrent enqueue with existing acknowledgment, missing canonical row and zero/late demand. These include inherited queue checks. Container `goodwatch-alias-crate-test`, endpoint `http://127.0.0.1:14200`.
- 15 actual replica-set MongoDB integration tests pass, including a new test proving retired-ID denial survives final maintenance while canonical writes remain accepted. Container `goodwatch-provider-repair-test`, test endpoint `mongodb://127.0.0.1:27129/?replicaSet=repair&directConnection=true`.
- Frontend TypeScript check reports 287 errors both at baseline HEAD and with this change. Diagnostics are equivalent after line-shift/path normalization; two preexisting union types print their alternatives in a different order. No new type errors were introduced.
- Existing local dev server: all three alias URLs return 301 to canonical numeric routes with query preserved; movie 10679 returns 200 with Iron Sky title; show 10679 returns 200 with Beef title.
- `git diff --check` passes. No new frontend automated tests, consistent with its AGENTS instructions.

## Private evidence and remaining read-only work

Directory: `/home/alp/.local/state/goodwatch/provider-identity-repair` (credentials only loaded in memory).

- `alias-audit-initial.json`: authoritative API responses, Mongo originals, full Crate schema.
- `alias-crate-before.json`: complete matching Crate rows with count cross-check (also includes clearly identified unrelated numeric-match controls that must not be removed).
- `alias-qdrant-before.json`: actual movie point IDs, complete payloads and vectors.
- `alias-nested-before.json`: completed zero-match Crate/Mongo nested-reference audit.
- `alias_cache_audit.py`: read-only targeted `cached-*` Redis scan; running exec session **15606** at handoff. It writes `alias-cache-candidates.json` on completion. Candidates are numeric token matches and require semantic inspection before any invalidation. The output can contain cached personal data and stays private.
- `/tmp/provider-alias-tests.log`, `/tmp/provider-alias-crate-tests.log`, `/tmp/provider-alias-mongo-tests.log`: passing test outputs.
- `/tmp/provider-alias-typecheck.log`, `/tmp/provider-alias-typecheck-baseline.log`: frontend diagnostic comparison.
- `/tmp/provider-alias-local-*`: local HTTP response evidence.

The two disposable test containers remain running for independent verification; stop them once the next review no longer needs them. Production has not been mutated.
