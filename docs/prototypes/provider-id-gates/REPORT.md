# Provider-ID suggestion benchmark — #709

Throwaway offline prototype on map #702. Owner decisions Q7–Q9 are recorded below. Identifier-free matching stays with #374. No UI or matcher changes. **Owner decision Q7: keep Netflix suggestions member-reviewed as shipped. Owner decision Q8: select gate B.** This benchmark found no reason to change the shipped matcher. Provider expansion and unattended resolution remain gated on independent review evidence; no new collection or implementation work is started by this report update.

Fable independently reproduced the original `3d8160cd` counts and verified that the offline harness executes the shipped reader without production I/O. This revision addresses its framing concerns, adds two mirror cases, removes toy-index latency comparisons and adds one explicitly authorized read-only timestamp query. A sole misassigned provider link with no independent contradiction illustrates the **ceiling of provider-ID evidence**, not a demonstrated retrieval-route defect.

## Candidate gates and scope

The original gates were committed **before evaluation** in `3c951cde` ([frozen protocol](https://github.com/alp82/goodwatch-monorepo/blob/3c951cde/docs/prototypes/provider-id-gates/REPORT.md)). They remain inspectable there. Fable correctly identified that the 99% Wilson lower-bound threshold was too strong as the only option for member-reviewed suggestions, and the synthetic coverage/zero-error framing was inappropriate. The following are explicitly **revised proposals**, not retroactive passes. The owner subsequently selected **option B (Q8)**; option A remains below only as the historical alternative. Real independent identity review is still pending.

| Dimension | Revised candidate gate / interpretation |
| --- | --- |
| Precision option A — historical alternative, not selected | Zero wrong among **at least 75 independently reviewed proposed identities**; two-sided 95% Wilson lower bound >95%; real-set manual plus unavailable ≤10%. With 75/75 correct, lower bound is 95.13%. The mathematical minimum for that bound is 73 all-correct; the proposed policy minimum is 75. Review the two manual rows too, so the existing list requires **77 row reviews**, including 75 proposed matches. |
| Precision option B — owner-selected gate (Q8) | Observed precision ≥99% and two-sided 95% Wilson lower bound ≥99%; zero known wrong in the reviewed set. At least **381/381 all-correct independently reviewed proposals** are required (lower bound 99.002%); the present 75 proposals would need at least 306 additional independent reviews. This is a stronger target suited to considering unattended resolution, but passing it alone would not authorize unattended imports. |
| Wrong matches | Report real known wrong matches separately from uncertainty and abstention. Test detectable contradictions, conflicts, missing targets and incomplete reads. Misassigned-link fixtures without independent contradictory evidence measure an evidence ceiling; zero errors on those fixtures cannot fairly be a route gate. |
| Coverage | **Reviewed real set only:** ≥90% correct proposals / all eligible groups and ≥95% / groups with a valid unambiguous catalog identity. Historical proposal coverage is 75/77, not yet verified correct-match coverage. No 90% gate applies to a deliberately abstention-heavy challenge set. |
| Ambiguity and abstention | Publish ambiguous, manual and unavailable / all eligible groups separately. Abstain on visible conflicts, supplied-year contradictions, missing/adult targets and incomplete reads. Evaluate the experimental freshness policy as a recall tradeoff, not an identity guarantee. Real-set combined abstention target ≤10%. |
| Latency | Ten-group page p50 ≤1.5s and p95 ≤3s, with ≥200 representative independent invocations per mode and representative transport/catalog size. **Unevaluated here.** Two hundred sequential repetitions of one fixture do not satisfy this requirement. Existing 2.5s/group and 12s/page deadlines remain. |
| Requests and rows | Proposed engineering budgets: ≤100 catalog calls and ≤50,000 returned rows consumed per ten-group page, with workload averages ≤10 calls/group and ≤10,000 returned rows/group. No provider requests; incomplete budget-limited work stays unavailable. Database scanned rows need query profiles and remain unknown. Index refresh/build costs must be separate from lookups. |
| Concurrency and cancellation | Retain ≤3 group workers/≤6 catalog reads per page. Propose a separate process-wide ceiling of 24 catalog reads for suggestions, with abortable admission counted against existing deadlines. Caller abort should drain abort-aware fixture reads within 100ms; no reads should start after abort. Production transport cancellation and multi-process admission remain unverified. |
| Index evidence | Preserve Netflix namespace, retired→canonical identities, all conflicting typed targets and snapshot completeness/version. The optional 30-day row-age policy must explicitly trade coverage for abstention; `updated_at` exists but does not prove identity correctness or provider check time. Never treat an incomplete/outdated snapshot as proof of absence. |

Wilson sample-size arithmetic assumes independently reviewed proposals and still does not remove selection bias from a single list/account. A fully reviewed historical list can expose wrong matches, but its 75 proposals cannot satisfy the owner-selected gate B or authorize expansion; it is not a population-wide or multi-provider guarantee. Neither confidence intervals nor the challenge-set counts resolve that limitation.

## What was built and how to reproduce

Branch: `prototype/provider-id-gates`. Shipped reader baseline: `5a95d122`. Only `docs/prototypes/provider-id-gates/` changes. The handover supplies this revision's commit; `git log -1 --format=%H` identifies it locally. No issue closure or resolution comment is posted.

From the repository root, with Node 24 (measured v24.15.0, Linux x64):

```sh
git fetch origin prototype/provider-id-gates
git switch prototype/provider-id-gates
node docs/prototypes/provider-id-gates/benchmark.mjs
git status --short
```

The run takes about 30 seconds and leaves the committed tree clean. Durations, timestamps and runtime diagnostics go to ignored `results.local.json`; deterministic per-case evidence goes to [semantic-results.json](semantic-results.json). `BENCH_SAMPLES=400` increases each reader timing cell; fewer than 200 are rejected. No npm packages, credentials, app build/server, Redis, database or provider session are needed. Node may print its TypeScript-stripping warning.

The harness strips TypeScript and substitutes only explicit import/group/catalog seams. It executes the actual shipped reader, real timeout/canonicalization helpers and the reader's own native URL parser. The source has **six import declarations: one `import type` is erased and five value imports remain**; the assertion of five counts those value imports, not the erased type line. This corrects the requested comment's premise. Fetch and socket connections throw in the offline harness. No application initialization or cache client runs.

References: [reference audit](REFERENCE.md), [fixtures](fixtures.mjs), [semantic outcomes](semantic-results.json), [historical baseline aggregate](netflix-historical-aggregate.json), [one-query freshness aggregate](freshness-aggregate.json). Synthetic truth labels were authored and agent-audited before their cases executed; they are not independent owner adjudications.

## Original challenge results, interpreted correctly

The original 25 cases contain **24 eligible provider-ID groups and one unsupported control**. Eleven eligible cases require abstention under the original evidence policy, so its maximum certifiable coverage is **13/24 (54.2%)** by construction. Comparing it with the real-set 90% target is inappropriate. The same fixture worlds are repeated for timing; repetitions add no reviewed identities.

**Original bounded-reader headline: 9 certified, 2 correct but uncertifiable, 2 known wrong, out of 13 suggestions.** The latter two are misassigned links whose wrong identity cannot be detected from the supplied provider-ID evidence. Age can trigger abstention for the stale case but cannot diagnose its correctness. The fresh case is inherently undetectable by either route without additional independent evidence.

| Metric, original cases | Bounded reader | Offline index | Interpretation |
| --- | ---: | ---: | --- |
| Suggested / eligible | 13/24 | 14/24 | Challenge behavior, not population coverage. |
| Certified suggestions | 9 | 13 | Certification by this challenge protocol; not proposal precision. |
| Correct but uncertifiable suggestions | 2 | 0 | Hidden conflict and unknown age have synthetic underlying truth `movie:101`; the reader picks it but cannot certify it under the original protocol. |
| Known wrong suggestions | 2 | 1 | Misassigned links; the shared fresh error measures the evidence ceiling. |
| Reported ambiguity / eligible | 1/24 | 2/24 | Index sees the hidden conflict only because its snapshot is complete. |
| Manual / eligible | 8/24 | 10/24 | Includes policy abstentions; not automatically better or worse. |
| Unavailable / eligible | 3/24 | 0/24 | Structural: index already has a complete snapshot while the bounded transport fails/overflows. |
| Certified / eligible | 9/24 | 13/24 | Descriptive only; no challenge coverage gate. |

The unsupported control is manual in both routes (all-group manual counts 9/25 and 11/25). States partition the eligible denominator; ambiguity is a subset of manual. The old 9/13 “69.2% proposal precision” label is withdrawn. If counting known synthetic underlying identities, the bounded proposals comprise **11 correct and 2 wrong**, with certification status reported separately; this also is not a real-world precision estimate. No Wilson population inference is drawn from these selected cases.

### Structural comparison and mirror cases

| Case(s) | Observed difference | Structural assumption / limit |
| --- | --- | --- |
| `alias-overflow`, `offer-overflow`, `lane-failure` | Reader unavailable; index suggests. | Index's complete snapshot predates the failed bounded read. This does not test index refresh failure. |
| `hidden-conflict` | Reader suggests the underlying correct work; index abstains. | The index is given catalog-wide conflict evidence unavailable in the bounded candidates. |
| `stale-wrong-link`, `unknown-link-age` | Freshness policy abstains where the reader suggests. | Synthetic age/protocol assumptions; age does not establish which work is correct. Production row-age impact is measured separately below. |
| `top-ten-miss` | Reader manual; index suggests. | Complete snapshot avoids title ranking's top-ten boundary; database ranking itself is scripted. |
| **Mirror: `stale-correct-link`** | Reader gives a correct suggestion; index abstains. | A 45-day-old link can still preserve the correct identity. Freshness sacrifices a valid suggestion. |
| **Mirror: `outdated-snapshot`** | Reader gives a correct suggestion; index manual. | Live catalog contains a new title/link absent from the index's earlier snapshot. Snapshot absence cannot establish catalog absence. |

The two mirror cases are supplementary; original denominators above stay fixed. The final harness runs **27 cases total, 26 eligible**, with separate original/mirror summaries. Across the mirror pair the reader makes 2/2 correct suggestions; the index makes 0/2 suggestions and abstains twice. These cases expose tradeoffs, not a weighted route ranking. Complete-snapshot wins and snapshot-lag losses cannot establish their frequency in production.

Localized German translation, Japanese alternative title, movie/show numeric-ID collisions, remakes, retired canonical IDs, lowercase wrappers, missing metadata/targets, adult targets, contradictory source observations, hostile hosts and overflow/failure behavior are covered. Candidate lanes and import-group enumeration are injected, so SQL ranking/tokenization and source-group construction are not validated. No real browser layouts/profile flows or new provider scopes are exercised.

## Authorized Netflix baseline and partial review evidence

The historical actual-reader run returned **75 suggestions, two manual, zero unavailable / 77 captured groups**: proposal coverage 97.4%, abstention 2.6%. All 610 SELECT requests succeeded, maximum six concurrent reads, no overflow, largest returned query 625 rows. Eight pages took 14.008s total, range 1.150–2.225s. Total consumed rows were not recorded. Eight observations cannot establish p95. This is one authorized account/list/layout; capture completeness/reference size and locale/profile generalization are unknown.

Partial evidence **does exist**: the owner stated that mapping/matching worked on this list, and the research recorded **24/24 type and release-year agreements** with saved-page metadata. These support feasibility and compatibility. They are clearly **not independently adjudicated identity reviews** of each proposal. Independent identity review is still **0/75**, so a real precision numerator/denominator is not available yet. Correct-proposal coverage remains bounded by 0/77–75/77 until review; that uncertainty does not negate the owner's partial validation.

The private packet contains historical 75 proposals and two manual rows. Per-row equivalence to the final reader output was not persisted/proven, although counts agree; review must preserve any discrepancies. The original healthy matching query was not rerun. The independent Fable reproduction confirms harness/count correctness, not Netflix proposal identity correctness.

## New evidence: exactly one read-only timestamp query

Authorized exception to the offline benchmark: [freshness-audit.mjs](freshness-audit.mjs) issued **one bounded SELECT**, no retries, against Netflix service 8 and the 75 historical typed targets (including retired aliases where applicable). It selected only typed identity, link and `updated_at`, parsed exact Netflix IDs locally and published aggregates only. No production writes or member queries occurred; raw rows/IDs, credentials and exports were not persisted to Git. A private one-shot marker prevents accidental reruns. The configured read-only catalog route follows the memory notes' existing configured-connection recipe; no application build or Redis client was started.

At the UTC evaluation time recorded in [freshness-aggregate.json](freshness-aggregate.json):

| Measurement | Count |
| --- | ---: |
| Requests | 1 |
| Returned offer rows | 5,487 |
| Rows matching a historical native ID and canonical target | 5,439 |
| Matching rows updated within 30 days | 3,481 |
| Matching rows older than 30 days | 1,958 |
| Invalid/missing/future matching timestamps | 0 |
| Proposals retained by at least one matching row aged 0–30 days | **74/75 (98.7%)** |
| Proposals rejected, stale-only | **1/75 (1.3%)** |
| No matching offer / unknown timestamp groups | 0 / 0 |

This would reduce historical proposal coverage from 75/77 to **74/77 (96.1%)**, with combined manual/policy abstention 3/77 (3.9%). It does **not** show that the rejected identity is wrong, or that any retained identity is right. Countries/offer variants are combined for identity evidence; this is not a country-specific watchability assertion.

Production **does have** `updated_at`: see the [timestamp contract](../../research/continuous-journey/availability-timestamp-contract.md) and [watch-link reader](../../../goodwatch-webapp/app/server/mcp/watch-links.server.ts). The contract distinguishes generic row publication/update time from independently verified provider-check time. Therefore this query measures the proposed `updated_at` age filter's coverage cost, not a validated observation-age or correctness gate. It is new timestamp evidence, not a replay to reproduce the healthy 75/77 matching count. Repeating it is not authorized by this report.

## Operational measurements and unevaluated latency gate

**The latency gate is unevaluated.** There are 200 sequential ten-group calls per reader mode on a single tiny fixture with a fixed 2ms abort-aware delay per catalog call. They are not independent representative invocations. Cold creates a new reader module; warm reuses it. Neither measures cold OS/process/database caches, production transport or workload variation. Descriptive p50/p95 values remain available in ignored `results.local.json`; they are not acceptance evidence.

Index latency rows are removed. The index uses only **11 input rows** (ten offers, one catalog row) and examines 20 evidence/catalog entries per ten-group lookup. That is inadequate for a realistic Netflix-slice latency comparison. Build duration is local diagnostic output only. Snapshot loading, full Netflix-slice build, refresh cost, memory, concurrent publication and recovery are unmeasured; even the historical query returned up to 625 rows and the new bounded timestamp query returned 5,487. No toy-index speed claim is retained.

The healthy reader fixture makes 60 catalog seam calls/page (six/group), consumes 120 returned rows/page (12/group), and peaks at six active reads. These are in-process calls, **zero network requests**. Database scanned rows are unknown. A dense single-page case consumes **50,020 rows** across 60 calls while still suggesting all ten groups; each offer lane returns 5,000 rows without triggering the 5,001 sentinel. This exceeds the proposed page budget, illustrating why an aggregate budget would complement per-query caps, not why an identity is wrong.

Four simultaneous pages reach **24 active reads**, 240 calls and 480 consumed rows: the current six-read cap is per page, not global. Proposed follow-up limits are engineering recommendations: 100 calls/50,000 returned rows per page, 24 suggestion catalog reads per process, abortable admission inside existing deadlines, and unavailable for incompletely checked groups. Multi-instance capacity and fairness need load measurement; these choices do not require a product-owner budget question.

Operational assertions pass for pre-abort (zero reads), in-flight abort (six reads cancelled, return under 100ms), early failed sibling (all stalled siblings drained), actual 2.5s group deadlines (ten groups take four waves, about ten seconds), and index pre-abort. No reads start after cancellation and no active fixture reads remain. These are one case each, not latency confidence estimates. The 12s page timer was not forced to expire. Production socket/database cancellation, large synchronous index-build cancellation and multi-process admission remain unverified.

## Recommendation and limits

**Recommendation: keep Netflix suggestions member-reviewed as shipped.** This benchmark found no reason to change the shipped matcher. It documents boundaries and a production index's unmeasured tradeoffs; it is not evidence for an automatic identity resolver. The owner's row review is the next evidence needed for a bounded acceptance decision. Other providers wait for capture evidence; no provider-extension verdict is being requested here.

Freshness can remove a misassigned link accidentally, but also a correct old identity; a fresh wrong link remains indistinguishable from a correct one using only that evidence. An index can retain conflicts and recover title-candidate misses while losing newly added identities or completeness during refresh. Neither challenge mix establishes production error frequency. No production index implementation is recommended from the current size/cost evidence. Identifier-free matching remains [#374](https://github.com/alp82/goodwatch-monorepo/issues/374).

## Owner decisions Q7–Q9 and gate B implications

- **Q7 — Yes:** keep Netflix suggestions member-reviewed as shipped. This benchmark found no reason to change the shipped matcher.
- **Q8 — Gate B selected:** observed precision ≥99%, two-sided 95% Wilson lower bound ≥99%, and zero known wrong among independently reviewed proposals. At least **381/381 all-correct independently reviewed proposals** are required. Even 75/75 correct from the existing 77-row packet yields a lower bound of only 95.13%, so that review alone cannot meet B; it can only reveal wrong matches and contribute independently reviewed evidence toward the larger set.
- **Q9 — Review workflow:** a separate Opus thread is building a local keyboard review page for `review.json` on `prototype/provider-id-review-page`. Keep the existing packet format stable. This report update changes neither `~/goodwatch-private/709/review.json` nor its schema, review codes, helper or page implementation.

**The Netflix pilot stays member-reviewed. No provider expansion or unattended resolution proceeds until at least 381 independently reviewed proposals exist and gate B is met.** Merely reaching 381 reviews is insufficient if any is wrong, unknown or otherwise fails the gate. Passing B would remove this evidence prerequisite only; it would not itself authorize unattended imports, bypass provider-specific capture/identity validation or replace the map's owner acceptance and build/release steps.

### Plan for the approximately 306 additional reviews — not started

1. Review the existing 77-row packet (about 30 minutes, using the separate local keyboard page when ready). It contains **75 proposed identities** plus two manual rows; only independently adjudicated proposals count toward 381. If all 75 are correct, at least **306 further proposals** are needed. Current independent adjudication remains 0/75, so the total outstanding target is still 381 until those reviews occur.
2. Seek further **authorized Netflix accounts/lists**, preferably spanning distinct works, languages and movie/show scopes. Collect only selected-list evidence outside Git, and review each proposed work independently. Repeated appearances of the same identity or reruns of the same list must not inflate the independent-review denominator. An illustrative allocation is three additional cohorts of roughly 102 distinct proposals each; actual account/list sizes and overlap will determine the number of accounts needed.
3. Add **providers with validated capture evidence** when it becomes available, using provider-specific native-ID/scope validation and reporting each provider's denominators separately. Such offline evidence collection is not provider expansion or release authorization. Do not pool provider samples to imply untested per-provider accuracy; retain the source/account strata and bring the resulting support scope back to the owner.
4. Keep all wrong, unknown and ambiguous outcomes visible. **Synthetic fixtures do not count**, nor do owner statements, type/year-only corroboration or repeated checks of an existing proposal substitute for independent identity adjudication. The 381/381 minimum assumes all correct; a known wrong blocks the selected zero-wrong gate and must not be dropped to repair the rate.

This is a collection plan only. No accounts are requested, captures performed, reviews fabricated, provider queries run or follow-up tickets created now.

The existing private packet remains at `~/goodwatch-private/709/review.json`, mode 0600. Its top-level instructions and one-character `review` fields remain unchanged: `c` correct, `w` wrong, `a` ambiguous, `?` unknown, `-` unreviewed; `n` for a confirmed manual/absent row with no proposal. `c` attests an independent same-work check; optional notes can explain exceptions. Never infer correctness from the same stored streaming link.

After review, the existing aggregate command remains:

```sh
node docs/prototypes/provider-id-gates/private-review.mjs aggregate "$HOME/goodwatch-private/709/review.json"
```

Return only aggregate output through the orchestrator; keep raw rows and notes private. The helper's existing `memberReviewedGate` field evaluates the former **option A**, not owner-selected B; it must not be interpreted as acceptance under Q8. No helper or packet-format changes are made here. Unknown/ambiguous or unreviewed proposals do not count as all-correct reviewed proposals. The helper cannot independently verify the owner's attestations.

To prepare a packet elsewhere using already authorized local files:

```sh
mkdir -p "$HOME/goodwatch-private/709"
chmod 700 "$HOME/goodwatch-private/709"
node docs/prototypes/provider-id-gates/private-review.mjs prepare \
  /absolute/private/capture.json /absolute/private/netflix-proposals-private.json \
  "$HOME/goodwatch-private/709/review.json"
```

Preparation refuses to overwrite. `upgrade PACKET` preserves prior review decisions while adding the quicker instructions. No new capture/export or production query is required for the owner step.

## Proposed follow-ups — do not create yet

- **Enforce provider suggestion engineering budgets:** Can abortable admission cap suggestion reads at 24/process and pages at 100 calls/50,000 returned rows, keeping incompletely checked groups unavailable within existing deadlines?
- **Benchmark a realistic Netflix identity snapshot:** What build/refresh/lookup cost, memory and lag result from the actual Netflix slice while preserving conflicts, retired aliases and partial-refresh state?
- **Validate an accepted provider slice:** Once capture evidence exists, which independently reviewed native-identity references and representative operational measurements support that provider's bounded member-reviewed route?

These are proposed questions, not created tickets or duplicated work under #374. Accepted execution would follow #702's build/validation/release cycle.

## Verification and remaining work

The revised harness runs 25 original cases plus two mirrors, 400 sequential reader timing calls (descriptive only), four cancellation/deadline cases, four simultaneous pages, index pre-abort and dense-page cost checks. All harness validity assertions pass; there is no synthetic route-acceptance verdict. Deterministic outcomes are committed; volatile timings are ignored so a reproduction leaves Git clean.

The private packet upgrade and aggregate command were exercised; current independent identity adjudication remains 0/75. The one newly authorized bounded timestamp SELECT completed successfully and only aggregate results were published. No other database reads, database/member/provider writes, Redis access, app build, deployment, issue resolution comment, closure, PR or merge occurred. Production latency and realistic index performance remain unevaluated. Owner decisions Q7–Q9 are recorded; independent identity review and satisfaction of gate B remain open. This final update changes only this report; no new benchmark, query, review-page or data-collection work was performed.
