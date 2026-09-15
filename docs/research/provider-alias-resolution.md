# Historical provider alias resolution

September 15, 2026. **All three historical movie aliases are resolved in production.** The 171 original provider snapshots remain archived in quarantine; their three markers are now permanent `resolved_alias` tombstones. No unresolved alias markers remain.

## Verified identities and transferred demand

Authenticated TMDB requests returned 404 for every obsolete movie ID and 200 for each canonical ID. Both stored details records in each pair and the current canonical TMDB response have the same IMDb identity. Complete API responses and BSON originals are retained privately.

| Obsolete movie ID | Canonical ID | Title | IMDb | Quarantined originals retained | Demand transferred |
| --- | --- | --- | --- | ---: | ---: |
| 5338654 | 658039 | The Forgotten Mountain / Mali i Harrum | tt8443724 | 3 | 4 |
| 3635601 | 872517 | Treasure Island: The Adventure Begins | tt0111483 | 131 | 0 |
| 162483 | 10679 | Iron Sky | tt1034314 | 37 | 52 |

Exactly **56 outstanding requests** were transferred. There was no late-demand delta during the conditional-delete window.

| Canonical ID | Demand before | Demand after | Acknowledged before/after | Atomic ledger |
| --- | ---: | ---: | --- | --- |
| 658039 | 6 | 10 | 0 / 0 | `5338654: 4` |
| 872517 | 48 | 48 | 0 / 0 | `3635601: 0` |
| 10679 | 0 | 52 | 0 / 0 | `162483: 52` |

The ledger is stored on the same canonical Crate queue row as its demand. Each update uses `_seq_no` and `_primary_term`, preserving concurrent enqueues, acknowledgments, and leases. Rerunning after a lost committed response does not transfer twice. Alias rows were archived and deleted using their original sequence/term; no demand was acknowledged to discard it. All five alias user tables were rechecked and contained zero rows.

## Exact cleanup

Removed 21 obsolete Mongo documents: three each from movie details, IMDb ratings, Metacritic ratings, Rotten Tomatoes ratings, TV Tropes, genome, and DNA. There were already zero active alias provider rows and zero movie-scoped daily-dump rows.

Removed **878 Crate movie/catalog rows**:

| Table | Removed |
| --- | ---: |
| movie | 3 |
| alternative_title | 3 |
| media_image | 81 |
| media_video | 3 |
| release_event | 41 |
| streaming_availability | 302 |
| person_appeared_in | 63 |
| person_worked_on | 91 |
| translation | 43 |
| trope | 148 |

Every shared-table selector included `media_type = 'movie'`. Removed three obsolete movie points from Qdrant `media_fingerprint_v1`: `1000005338654`, `1000003635601`, and `1000000162483`. Removed the three obsolete Crate priority queue rows after ledger verification.

No offers, DNA, ratings, or vectors were copied from obsolete titles into canonical titles. Mongo and Crate recommendation/similar references had zero alias matches, so no array rewriting was needed.

### Preserved data

Hash comparison verified 35 groups of canonical or unrelated records, including:

- All three canonical movie rows, their catalog children, 340 streaming rows, details, ratings, tropes, genome, and DNA.
- Iron Sky's one user score and one watch-history row, unchanged; all other matching user tables remained empty.
- Both existing canonical Qdrant points, unchanged. Canonical movie 658039 had no vector before this task and still has none; this preexisting completeness gap was not filled using an obsolete vector.
- Real show 10679, **Beef: The Series**, its Mongo records, and unrelated numeric matches in two production-company and two season rows.
- All 171 original quarantine documents, byte/value-equivalent. Original marker reason, archive references, and provenance remain intact; resolution mapping and evidence were added.

## Prevention deployed

Python and TypeScript registries encode only these three verified **movie** mappings; TV/show IDs remain independent.

Old movie URLs now return HTTP 301 to the canonical numeric route, preserving query parameters. Details readers canonicalize before cache lookup. All five user-action writers, poster-impression deduplication, and priority demand increments canonicalize movie IDs. Explicit priority selection resolves aliases before Mongo lookup; direct retired queue claims reject them. The details initializer skips retired movie IDs without copying obsolete fields over canonical content.

Both provider initializers and streaming publication honor resolved tombstones. The bulk provider initializer skips resolved aliases, while unresolved identities remain errors. Monitoring excludes only resolved markers from unresolved counts.

Strict Mongo validators deny retired IDs in eight movie collections and deny only movie aliases in the mixed daily-dump collection. These restrictions are intersected with existing validators. Future provider-repair finalization preserves existing operator restrictions and unique indexes. Thirty-six live aborted-transaction probes verified all three retired IDs were rejected in all nine collections and canonical replacements remained accepted.

## Deployment and operational evidence

Application source commit: [`cba5ba3`](https://github.com/alp82/goodwatch-monorepo/commit/cba5ba380bf061da3d6dd9a8a033d24e580db210).

- [Initial Windmill deployment passed](https://github.com/alp82/goodwatch-monorepo/actions/runs/34956709588).
- [Repeated normal Windmill deployment passed](https://github.com/alp82/goodwatch-monorepo/actions/runs/34957852701).
- Coolify deployment `oqqetjx2pmjkxpqkewrdeign` finished with that application commit. All three production 301 redirects, three canonical movie HTTP 200 responses, and Beef's HTTP 200 response were verified **before** catalog deletion.
- Captured 22 dependent Windmill scripts before deployment. Automatic dependency refresh changed locks; repository-pinned locks were restored in dependency order. All 22 deployed sources and locks matched afterward, and 18 actual import jobs passed.
- Twenty alias/actual-Crate tests and 15 actual replica-set Mongo tests passed independently during rollout. Earlier implementation validation passed 89 focused Python tests. Frontend typechecking retained the same 287 baseline diagnostics; no new frontend tests were added, following its AGENTS.md. Browser MCP was unavailable, so HTTP/SSR checks verified this routing-only change.
- Seventeen publication/initialization/priority schedules were briefly paused; all 27 schedule enabled states match the saved baseline after restoration. The normal provider-refresh schedule stayed enabled throughout. A stale Metacritic initializer holding old snapshots was archived and cancelled. A running priority job was explicitly proven to select unrelated movie 620883/show 103314 and was allowed to finish normally.
- Deployed guard job `01a0a499-acdc-9b6a-0d8a-fa19937d351b` exercised both provider initialization entrypoints and direct queue claims for all three aliases: no records were recreated.
- Actual monitoring job `01a0a49a-8fc6-0fc7-6b49-a6904024523c` reported `complete: true`, no active maintenance, unique identities in both partitions, and zero unresolved quarantines. At 10:26:28 UTC, 68,008 movie countries and 15,995 TV countries still awaited fresh verification. These counts declined from 68,012/15,999 in the preceding read. This task did not clear pending flags, trigger replacement scrapes, or change refresh capacity.

Two operator preview probes initially lacked dependencies when combining separate runtime modules; they performed no writes. They were corrected to use each module's deployed dependencies and passed. These were verification-harness errors, not failures of the deployed application.

### Cache handling

The initial targeted cached-result scan found no alias values. Predeployment HTTP checks subsequently populated three obsolete detail-cache entries. Six exact known movie-detail keys were checked; the three present values were semantically verified, archived, and deleted with atomic compare-and-delete. No broad Redis invalidation occurred. Other detail variants expire within 30 minutes, and deployed readers canonicalize before cache lookup. Cross-title cached cards can retain old links until their normal expiry; those links now redirect correctly.

## Archives and recovery

Private evidence directory: `/home/alp/.local/state/goodwatch/provider-identity-repair/alias-rollout`.

The full pre-execution source/published/user/queue/vector/control snapshot is `execution-before.json`, SHA-256:

`a0205fd5b686071aae34cf1743ab8d7b4822a27d437fbd8e1e1147abfb213ed2`

Durable receipts accompany snapshots, previous validators, queue schema, schedule/job states, conditional-demand ledgers, deletion counts, frontend checks, runtime probes, and preservation results. `final-manifest.json` hashes the evidence files; operator adapter source is retained alongside them. Credentials were never written into committed reports. Original earlier audit artifacts also remain in the parent directory.

Recovery is a scoped, fenced operation using these exact originals. Never blindly subtract transferred demand or overwrite canonical records after newer user requests, claims, acknowledgments, or content updates. Prefer rolling forward while preserving the atomic ledger. Do not remove the permanent tombstones or restore obsolete IDs into active collections without explicitly reconciling validators and ingress behavior.

The report-only follow-up commit does not change application source from the verified `cba5ba3` deployment.
