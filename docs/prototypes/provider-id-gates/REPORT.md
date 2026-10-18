# Provider-ID suggestion benchmark — #709

Throwaway offline prototype on map #702. Owner verdict pending. Identifier-free matching remains #374. No UI or production changes.

## Candidate gates — frozen before evaluation

These are proposed limits for **reviewable suggestions**, requiring explicit member acceptance. They do not authorize automatic resolution. This section is committed before harness evaluation; later results must not redefine thresholds.

| Dimension | Candidate acceptance gate |
| --- | --- |
| Precision | At least 99% observed proposal precision and a two-sided 95% Wilson lower bound ≥99% on independently reviewed provider references; report numerator/denominator. Synthetic challenge cases are a separate deterministic safety check, never population estimates. |
| Wrong matches | Zero known wrong suggestions on the challenge set and reviewed real set. A sole stale link or a hidden conflicting target must not be described as proven identity. |
| Coverage | ≥90% correct proposals / all eligible reviewed provider-ID groups, and ≥95% / groups with a valid unambiguous catalog identity. Publish both; do not omit hard cases. |
| Ambiguity | All known conflicting canonical typed targets abstain; report ambiguous / all eligible groups separately. Missing evidence and backend failure are not ambiguity. |
| Abstention | Every unsupported, contradictory, missing-target, stale-only or incomplete-evidence challenge abstains. Publish manual / all groups and unavailable / all groups separately; real-set combined abstention ≤10% is a usability target subordinate to precision. |
| Latency | Ten-group page p50 ≤1.5s, p95 ≤3s, cold and warm reported separately, ≥200 independent page invocations per mode; production applicability requires representative transport/catalog size, not repeated fixture timing. Group deadline 2.5s and page deadline 12s retained. |
| Requests | ≤100 catalog requests per ten-group page, ≤10 per group averaged on representative data; no provider HTTP calls. An index must report build cost separately; zero per-lookup requests cannot hide refresh cost. |
| Rows inspected | ≤50,000 returned rows consumed per page and ≤10,000 per group, no sentinel truncation silently treated as absence. Report database rows scanned as unknown without backend query profiles. |
| Concurrency | ≤3 groups and ≤6 concurrent reads per page, including failed siblings; report aggregate concurrency for simultaneous page calls separately. No implied global limit. |
| Cancellation | Abort returns within 100ms in an abort-aware fixture transport; no reads start after cancellation, all active reads drain. Check pre-aborted, in-flight, sibling failure and actual deadline. Real transport cancellation remains a separate prerequisite. |
| Index evidence | Preserve provider namespace, all conflicting typed targets, retired→canonical links and provenance. Reject stale/unknown observation age (candidate freshness ≤30 days), missing/adult targets and supplied-year contradiction. Freshness alone cannot validate a misassigned link. Report cold build and warm lookup separately. |

## Protocol fixed before evaluation

Use actual shipped suggestion source with only catalog and import-group seams replaced in memory. Block all network access; do not import application boot/cache modules or load .env. Compare with a small in-memory provider-ID index using the shipped URL parser and canonicalization. Construct and audit truth labels from synthetic scenarios before running either route; retain rationale per case. Agent semantic review is explicit, not independent owner review.

Reuse the authorized 77-entry Netflix baseline aggregate and existing 24-entry type/year corroboration as historical evidence only. Do not open real exports or rerun healthy production queries. No precision denominator exists until an independent identity review is supplied. No source-capture recall can be inferred from this benchmark.

Use ≥200 fresh page calls per route/mode with fixed synthetic 2ms per-read delay (event loop adds overhead). Cold means rebuilding index and module seams, not a cold production cache. Report warm repeated fixture behavior without claiming a service cache. Publish unique semantic denominators separately from repeated latency samples. Use nearest-rank percentiles; Wilson intervals describe binomial sampling assumptions only, not uncertainty over adversarial fixtures. Pin source hashes and record runtime/environment.

## Results

The frozen gates are in commit `3c951cde`, before harness execution. Final source baseline is `5a95d122`; this branch changes only `docs/prototypes/provider-id-gates/`. The reproducible artifact is on `prototype/provider-id-gates`; use `git log -1 --format=%H` for its final commit. The handover supplies the exact final commit. No owner verdict is supplied and #709 remains open.

Run from the repository root with Node 24 (measured v24.15.0, Linux x64):

```sh
git fetch origin prototype/provider-id-gates
git switch prototype/provider-id-gates
node docs/prototypes/provider-id-gates/benchmark.mjs
```

The command writes `results.json` beside the harness; expected runtime is roughly 30 seconds. No npm packages, environment file, credentials, database, Redis or provider session are needed. `BENCH_SAMPLES=400 node docs/prototypes/provider-id-gates/benchmark.mjs` increases each timing cell to 400. Fewer than 200 are rejected. `stripTypeScriptTypes` may print Node's experimental warning.

The harness strips TypeScript and replaces the five runtime imports of the **actual shipped reader** with explicit seams; it does not reimplement its candidate algorithm. Real timeout/canonicalization helpers and the reader's own native-URL parser execute. Import-group enumeration and catalog transport are fixtures. Changed runtime import count fails closed. Fetch and socket connections throw, so no local build can touch production Redis. The infrastructure and isolated-Valkey notes were read; no app server/build or cache client is started.

Reference: [semantic audit](REFERENCE.md), [synthetic fixtures](fixtures.mjs), [raw measured results](results.json), [historical aggregate](netflix-historical-aggregate.json). Truth labels were authored and audited by the implementing agent before their cases executed; this is **not independent owner review**. Cases added during harness development retained predeclared gates. Synthetic names include German and Japanese aliases, plus default English. No browser layouts or profile flows were exercised here.

### Accuracy and abstention

Twenty-five unique semantic worlds include **24 eligible provider-ID groups and one unsupported-ID control**. Thirteen eligible worlds have a certifiable, unambiguous target. Timing repetitions add no identity references.

| Metric | Bounded reader | Complete offline snapshot index |
| --- | ---: | ---: |
| Proposals / eligible | 13/24 | 14/24 |
| Certified correct / proposals (conservative proposal precision) | 9/13 (69.2%) | 13/14 (92.9%) |
| Known wrong target / proposals | 2/13 | 1/14 |
| Uncertified proposal, identity not adjudicated / proposals | 2/13 | 0/14 |
| Correct-proposal coverage / all eligible | 9/24 (37.5%) | 13/24 (54.2%) |
| Correct-proposal coverage / certifiable targets | 9/13 (69.2%) | 13/13 (100%) |
| Reported ambiguity / eligible | 1/24 | 2/24 |
| Manual abstention / eligible | 8/24 | 10/24 |
| Unavailable / eligible | 3/24 | 0/24 |
| Manual plus unavailable / eligible | 11/24 | 10/24 |
| Unsafe suggestions violating required abstention | 4/24 | 1/24 |

Both routes also leave the unsupported-ID control manual (all-group manual counts 9/25 and 11/25). States partition the eligible denominator; ambiguity is a subset of manual abstention. Wrong matches and uncertified suggestions partition noncertified proposals, not abstentions. Required-abstention failures overlap known wrong targets, so do not add those rows together.

The bounded reader's two known errors are the stale wrong link and the fresh wrong link. Its hidden conflict and unknown-age suggestions cannot be certified, but are **not counted as proven wrong identities**. Actual identity precision for the challenge proposals is therefore bounded by 9/13 to 11/13; the conservative gate uses 9/13. The index rejects the hidden conflict and stale/unknown-age links but still follows the fresh wrong link. It also recovers the eleventh-ranked target. With a complete snapshot already available, it remains usable during candidate-lane failure/overflow; that is conditional availability, not evidence that a real refresh cannot fail.

Diagnostic two-sided 95% Wilson intervals in `results.json` are 42.4–87.3% (9/13) and 68.5–98.7% (13/14). These are arithmetic illustrations only: the hand-picked challenge worlds are not random samples, and there is no population confidence claim. Neither route meets the zero-wrong-match/abstention gates. The index reaches the certifiable-target coverage gate in fixtures; no route passes the overall accuracy/coverage gate.

### Authorized Netflix baseline, reused without production queries

The saved final real-reader aggregate reports 75 suggested, two manual, zero unavailable out of 77 captured groups: **proposal coverage 75/77 (97.4%)**, manual 2/77, unavailable 0/77. Zero observed candidate-set ambiguity is not catalog-wide uniqueness. The eight sequential pages made 610 successful bounded SELECT requests (7.92/group), maximum six simultaneous reads, maximum 625 returned rows in one query, no overflow; 14.008s total, page range 1.150–2.225s. Total returned rows were not recorded in that aggregate and remain unknown. Eight page timings are inadequate for accepting p95; none is promoted into a production percentile claim.

This was one authorized account/list/layout, with no layout/locale/profile generalization. The source reference size and capture recall are unknown. The earlier saved-page type/year agreement of 24/24 is **metadata corroboration**, not an independently reviewed identity denominator. It is also not guaranteed to cover every final reader proposal. Historical proposals in the private review packet predate the final reader validation and are labeled accordingly; per-row equivalence to the final reader was not persisted/proven. No healthy query was rerun to reconstruct that evidence.

No proposal has an independent identity adjudication in this ticket: real precision is unknown (0 reviewed / 75 proposed), and correct-proposal coverage is bounded by 0/77–75/77 until review. Even if all 75 proposals were independently correct, the Wilson lower bound would be only 95.1%, below the proposed 99% lower-bound gate. At least 381 independent all-correct proposals would be needed mathematically; diversity and selection bias still matter. The present sample can reveal defects and guide scope, not satisfy that statistical gate.

### Latency and cost

Each cell below is **200 sequential ten-group calls**, in one process, same tiny world, fixed 2ms abort-aware delay per catalog call. Cold reader includes creating a fresh source module; warm reader reuses the module. It still performs catalog calls every time: no reader result cache is introduced. Cold index includes building its snapshot; warm index reuses it. These are not cold OS/process/database/cache experiments and are not 800 independent production workloads. Route order is fixed; JIT, event-loop and timer effects limit comparison.

| Route/mode | Calls | p50 ms | p95 ms | Min–max ms | Catalog calls/page | Returned rows consumed/page | Index rows examined/page |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| bounded-cold | 200 | 44.266 | 48.812 | 41.284–53.063 | 60 | 120 | 0 |
| bounded-warm | 200 | 42.278 | 46.963 | 39.829–51.212 | 60 | 120 | 0 |
| index-cold | 200 | 0.017 | 0.027 | 0.015–0.108 | 0 | 0 | 20 |
| index-warm | 200 | 0.005 | 0.007 | 0.004–0.029 | 0 | 0 | 20 |

Catalog calls are in-process seam calls, **not HTTP requests** in this run. There are zero provider or catalog network requests. The historical baseline's 610 are actual read requests. Returned-row counts include repeated rows across queries; database scanned rows are unknown because no database query profiles are used.

The small index build examines **11 input rows** (ten offers, one catalog row), separately from 20 evidence/catalog-row inspections per ten-group lookup page. Cold build p50 0.011ms, p95 0.013ms over 200 builds. Local JSON/snapshot loading and a production refresh are excluded. Synthetic `ageDays` and complete-snapshot status are fixture assumptions; the production reader does not currently supply that provenance. The index is restricted to the implicit Netflix namespace; it cannot mix providers. It preserves all canonical typed targets and offer provenance, including stale conflicts; it rejects unknown/stale sole evidence rather than deleting conflicting identities. It is not a deployed schema or a measured full-catalog service.

The healthy fixture meets candidate request/row/latency budgets **only for this workload** (60 calls/page, six/group, 120 rows/page, 12/group; peak six reads). The dense single-page stress case returns 5,000 offer rows per group and produces ten suggestions: **60 calls, 50,020 consumed rows/page, 5,002/group**. No individual overflow sentinel fires. It fails the proposed 50,000 page-row budget. Existing per-query caps do not enforce an aggregate page budget. This stress sample is one cost measurement, not a latency percentile dataset.

### Concurrency, cancellation and deadlines

The healthy page peaks at six active reads. Four simultaneous pages reach **24 active reads**, 240 calls, 480 returned rows; there is no global six-read admission limit. Three group workers/page are exercised by the shipped scheduler, but only read concurrency is directly instrumented.

- Pre-aborted: zero reads, all ten groups unavailable, return about 2.6ms.
- In-flight: six active reads aborted; return about 1.6ms after cancellation, zero reads started after abort, zero active reads left.
- Early sibling failure: twenty reads across ten groups, ten stalled siblings cancelled, peak four, zero active reads left; about 1.5ms total.
- Actual group deadline: ten groups consume four 2.5s waves, about 10.002s total, twenty reads aborted and zero active reads left. All groups stay unavailable rather than being labeled missing.
- Index: pre-aborted lookup returns unavailable with zero requests. Its synchronous small build is not interruptible mid-loop; large-build cancellation and index rebuild recovery were not tested.

These are one operational case each, not latency confidence estimates. The separate 12s page timer is retained in the real source but was not forced to expire. Socket/database cancellation, production cold/warm behavior, load admission across processes, a large snapshot, refresh publication/expiry and service failures remain unverified. The fixture timing gate passes; representative operational acceptance remains open.

## Limits and recommendation

**Recommendation: narrow scope.** Keep the shipped Netflix route as explicitly member-reviewed suggestions; defer extending it to another provider and defer adopting a production identity index until the owner accepts limits and reviewed identity evidence exists. This is a recommendation, not a verdict or an acceptance decision. Nothing in this artifact changes the shipped matcher.

A complete index offers a cheap way to retain conflicts and avoid title-retrieval misses, but freshness plus a provider link is insufficient evidence of identity. It trades request work for refresh cost and trust in a snapshot that has not been measured here. It needs provenance and a conservative stale/partial-snapshot policy before a production comparison. The current reader lacks a page-wide row budget and its concurrency limit multiplies across requests; a future extension should explicitly decide both budgets. No broad scan, index refresh or infrastructure change is authorized by this result.

Missing source metadata is safe only when identity evidence is sound. Same-name remakes, wrong provider associations, retired IDs, adult/missing targets and type collisions need separate controls. A bounded candidate set cannot establish global uniqueness. New providers need namespace/scope-specific parsing and independently reviewed native identity evidence; no Prime/JustWatch or season/episode identity support was tested. Identifier-free matching stays in [#374](https://github.com/alp82/goodwatch-monorepo/issues/374).

## Owner decisions and minimal private review

No new capture, browser run or export is required for the existing Netflix review. A prepared **mode-0600** packet is at `~/goodwatch-private/709/review.json`, inside a mode-0700 directory. It contains 77 source rows, 75 historical catalog proposals, and two manual rows; its content never belongs in Git or an issue.

1. **Scope:** retain member-reviewed Netflix suggestions and defer other providers/index deployment (recommended), or defer further provider-ID work entirely? This benchmark does not justify automatic resolution.
2. **Limits:** retain the candidate 99% observed precision plus 99% Wilson lower-bound gate for provider expansion (recommended), or explicitly approve a narrower pilot gate with its smaller denominator and known limitations? Decide the aggregate page-row and cross-request concurrency budgets as part of this choice; current per-query/per-page caps do not establish them globally.
3. **Private reference review:** review the prepared packet against independent provider/work identity evidence (recommended), or defer identity validation? For each row set `review` to `correct`, `wrong`, `ambiguous`, `absent`, or `unknown`; correct/wrong require `referenceTarget` such as `movie:123` and `independentEvidence` explaining the separate source checked. Inspect both manual rows too. Never treat the same stored streaming link as independent proof. Leave unreviewable cases `unknown`, not correct. If historical rows differ from the final reader, preserve that distinction rather than silently certifying the final route.

After saving the private packet, produce aggregate counts locally:

```sh
node docs/prototypes/provider-id-gates/private-review.mjs aggregate "$HOME/goodwatch-private/709/review.json"
```

The helper validates adjudication consistency and prints only counts and bounds; a partial subset remains explicitly incomplete. Return that aggregate and the chosen scope/gates through the orchestrator; keep notes and raw rows at the private path. An all-correct result for 75 proposals still cannot pass the predeclared statistical gate.

To regenerate a packet on a different machine with the already authorized local files (never use a new production query):

```sh
mkdir -p "$HOME/goodwatch-private/709"
chmod 700 "$HOME/goodwatch-private/709"
node docs/prototypes/provider-id-gates/private-review.mjs prepare \
  /absolute/private/capture.json /absolute/private/netflix-proposals-private.json \
  "$HOME/goodwatch-private/709/review.json"
```

Preparation refuses to overwrite an existing packet. No issue resolution comment, closure, reassignment, follow-up creation, PR, merge or deployment was performed.

## Follow-up ticket proposals — do not create yet

- **Enforce provider suggestion page budgets:** What aggregate row/request and cross-request concurrency limits should stop work with an unavailable state?
- **Audit native identity conflicts and provenance:** Can a bounded read-only snapshot preserve every typed conflict, observation age and incomplete-refresh marker without implying current availability equals identity?
- **Validate accepted provider slice:** Which independently reviewed provider-specific reference set, permitted operational benchmark and owner-approved gates justify implementation under #702?

These are proposed questions, not duplicate matching work under #374 or provider-capture tickets. Implementation would follow an owner decision and the map's build/validation/release cycle.

## Verification

The final harness completed all 25 semantic cases, 800 ten-group timing calls, four cancellation/deadline cases, four simultaneous pages, index pre-abort, and the dense-page case. Validity assertions passed; route acceptance gates deliberately did not. Private packet preparation and aggregate generation ran against existing local artifacts; there are zero independently adjudicated proposal rows so far. Node syntax checks and `git diff --check` passed. Production reader SHA-256 is `50b60a78cdc66f42470fc69c686b511ea684083241c51aa8cf3d7fd257a08dbe`; fixture SHA-256 is `4d64d05e3d3f07f035d64b5d3ad54c696864fc619bb6b617b88532c9345ca287`. Full precision/coverage counts, per-case outcomes, timing distributions and costs are in `results.json`.

No app build, full app suite, browser/provider capture, production database query/write, Redis access, deployment or large-index refresh was run in this ticket. Application code is unchanged; the remaining real reference review and owner verdict are explicit prerequisites rather than invented results.
