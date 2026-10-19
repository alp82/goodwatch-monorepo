## Resolution: benchmark goals, quality gates, and experiment limits

Agreed with the human through the orchestrator on 2026-10-19 for **Choose the benchmark goals, quality gates, and experiment limits**, within [Benchmark a richer fingerprint and discovery system](https://github.com/alp82/goodwatch-monorepo/issues/716). This decision resolves the goals and operating envelope only. **No spending yet:** lineup, corpus/evidence, representation, required-output and executable-protocol dependencies remain. Fresh confirmation is not funded by this approval.

### Actual answers

- Q1: `quality_first`.
- Q2: `45_minutes`, with this exact note:

> use titles that i'm well aware of, from the 1990-2010 era that i scored highly and few low ones. reviews should always include a frontier model judging the quality and summarize that + recommendations for my picks

- Q3: `usd_5_draft_envelope`.

### Priorities, quality gates and acceptable uncertainty

Prioritize faithful **complete title analysis** and useful descriptive/compound discovery. Retain assessment of core traits, supported precise concepts, essence text/tags, valid representative highlights, advisories and other required companions. Keep title knowledge, evidence extraction, query interpretation and retrieval/ranking distinct. Prefer cheaper/faster designs when judged quality is indistinguishable; a cheap scores-only call does not win against a complete pipeline by omitting prose or enrichment.

Treat structural validity, factual correctness and discovery usefulness separately. Neither existing Qwen scores, frontier judgments, generated tags/tropes nor personal ratings are gold. Unknown, not assessed, not applicable and supported absence are distinct; do not coerce missing evidence to zero. Strict exclusions require supported absence with adequate work/season/episode/edition coverage. Unknown cases do not pass strict filters; fewer/no verified results are preferable to false assurances, and withheld coverage must be reported. Same-title co-occurrence does not prove a same-scene or same-character relation.

Preserve failures, but pause an affected arm on a confirmed wrong-title association, false hard-exclusion assurance, fabricated decisive evidence or invalid required companion output until diagnosed and re-evaluated. One confirmed critical failure is sufficient to pause that arm. No semantic retries to improve an inconvenient verdict. Soft regressions and increased unknown rates can be investigated on development data; no automatic advancement based on cost savings or abstention. Human acceptance is required for material tradeoffs. Production SLOs and numeric promotion/non-inferiority margins remain provisional during diagnostic screening and must be agreed before fresh confirmation or a winner claim.

### Corpus and review agreement

The initial development review uses **familiar titles from the user's own recorded ratings, released in 1990–2010 inclusive, mostly highly rated plus a few low-rated contrasts**. Ratings guide familiarity and preferences, not factual correctness. Exact identities, rating cutoffs, movie/show mix, year/scope handling and high/low mix stay open in [Choose the title corpus, evidence arms, and reference judgments](https://github.com/alp82/goodwatch-monorepo/issues/720). Eight high-rated and two low-rated titles is a reversible suggestion if ten suitable records exist, not an agreed selection. Sol is locating rating evidence read-only; this decision does not duplicate that lookup. Do not generalize this cohort to new, obscure, unfamiliar or whole-catalog quality.

The human review allowance is **45 minutes total across the initial development round**, targeting **20 paired reference/relevance judgments and six full-output spot checks** within that time. Prioritize consequential disagreements. Targets are not mandatory completion claims; exhaustion pauses advancement and leaves remaining outputs unreviewed.

**Every review round requires a frontier-model quality assessment before human picks**, using existing authorized **Astra agent sessions**, with no separately billed judge APIs. Record actual model/session, evidence, rubric, output coverage, uncertainty and exposure. Existing subscription/agent review effort is reported separately; it does not enlarge or consume the $5 provider-call envelope. Unavailability of an authorized Astra assessment pauses review-dependent picks rather than silently waiving the requirement. This new instruction supersedes the draft's omission of mandatory frontier review; the historical Astra/Fable waiver is not a waiver here.

Use shuffled candidate labels and conceal provider/rank/cost during the initial Astra quality pass where feasible. Preserve the assessment before human feedback. Then **show the human its evidence-grounded summary and recommendations for their picks**, including measured cost/speed tradeoffs. Do not withhold requested recommendations to manufacture independent evidence. A human shown judge recommendations supplies **assisted judgments**, even if candidate providers remain blinded. Preserve the summary shown, candidate-label exposure and human choices; distinguish assisted agreement from genuinely independent judgments. Candidate-label blinding does not establish independence, including for an Astra session with prior exposure.

Agents establish discoverable facts from attributable sources. Use supported/contradicted/unknown factual assessments and 0–3 relevance judgments (irrelevant/contradictory, partial, useful, strong fit). Correct demonstrably wrong references with provenance and rescore all affected arms. Preserve unresolved disagreements and sensitivity results; do not average disputed truth into a gold label. Human preference resolves interpretive tradeoffs; unverified facts stay unknown.

### Stage-specific measurement contract

| Stage | Required measurements |
|---|---|
| Evidence preparation/enrichment | Identity, source/scope/coverage and independent support; per-title expense, wall/CPU time and review effort; allocate shared enrichment to every deployment design that requires it. Local stored inputs only in this envelope. |
| Complete title analysis | First-attempt/repaired validity separately from factual support, contradictions, unknown coverage, highlights, spoilers, advisories, completeness and repeat drift; total USD per attempted/valid/human-accepted title including prose, reasoning, retries and escalation; cold/warm cache costs; request and complete-title p50/p95; accepted titles/hour at stated concurrency. |
| Embedding/index preparation | Version/order/dimension/input coverage and parity; distinguish numeric-vector derivation from text encoding; CPU time, RAM, bytes/title, build/update time, titles/sec and paid embedding fees. Local compute resource use is not economically free. |
| Query interpretation | Intent/entity/polarity/binding and hard/soft constraint correctness, abstention and repeat stability; USD/1,000 fresh readings versus cached lookups, requests/query, queue-inclusive p50/p95 and completed readings/sec. |
| Retrieval/ranking only | Fixed readings/catalog; fully graded pooled top-10 nDCG, useful results, wrong top-5, strict-exclusion violations and exact-title guardrails; recall only over known references; encoding/retrieval/ranking p50/p95, CPU/RAM and completed QPS at stated load. |
| End-to-end discovery | Useful results, hard/catalog constraints, withheld coverage and partial/failure rates; fresh/cached p50/p95, first usable delivery separately from completed answer, queue/timeout/busy rates and completed QPS; total expense with explicit title/index amortization scenarios. |

Keep attempted/planned/valid/reviewed counts, failed-call costs and uncertainty visible. Small-sample percentiles are descriptive; a median request time does not establish throughput. Stage p95s cannot simply be summed. Preserve parallel overlap and cache state; compare equivalent outputs and matched conditions. Unknown cost is not zero. Frontier-assisted ratings are not independent inter-reviewer accuracy evidence.

### Approved shared development envelope

**USD 5 total**, shared across all participating tickets/runners for this development round; no reset, automatic replenishment or stage transfer. Old budgets confer no authority. The selected $5 option changes dollars only; sample, request, retry, concurrency, token and time ceilings stay unchanged.

| Stage | USD ceiling | Initial provider requests | Retry allowance | Maximum requests |
|---|---:|---:|---:|---:|
| Title scoring/generation + all prose/companions | 3.50 | 72 | 18 | 90 |
| Shared evidence enrichment from local inputs | 0.50 | 12 | 3 | 15 |
| Query interpretation | 0.50 | 48 | 12 | 60 |
| Paid embedding, if chosen | 0.10 | 2 batches | 1 | 3 |
| Unresolved-charge contingency; no new calls | 0.40 | 0 | 0 | 0 |
| **Total** | **5.00** | **134** | **34** | **168** |

- Title sample ceiling: **three complete pipeline configurations × 12 output slots each**, each using **10 distinct titles + two unchanged-input repeats**. At most two initial generation stages per complete-output slot.
- Query sample ceiling, once its dependencies are satisfied: **two configurations × 12 query slots each**, each using **10 distinct queries + two repeats**; at most two initial reading calls per slot. Embedding batches contain **at most 36 inputs each**. More components require fewer slots, not a cap bypass.
- Global paid-call concurrency **2**; at most **one logical title/query pipeline at once**, with two independent subcalls allowed to overlap. No larger fanout. Isolated local retrieval probes use concurrency **1 then 2**, at most **200 completed attempts total**, with a **30-minute wall-clock cap**. No production load tests.
- At most **one retry per logical stage/input**, within the smaller stage retry pools above; disable hidden SDK/job retries. Retry transient failures or constrained structural repair only, using unchanged source evidence. Abstention/factual disagreement does not receive a quality-improvement retry. Repairs, timeouts, provider subcalls and discovered retries count toward limits.
- Per generative request: **16,000 input tokens** including repair context and **8,192 total billed completion/reasoning tokens**. Classification/batched-question input uses the same ceiling and requires verified billed-token bounds. **120-second attempt timeout; 60-second maximum retry wait**, otherwise stop the route. No automatic token-limit increase.
- Reserve conservative worst-case input/output/cache/request charges before dispatch against stage and shared limits. Unreconciled calls retain full reservations; never interpret missing usage as free. Keep observed charges, estimates and held reservations separate without double-counting the same exposure. The **$0.40 contingency cannot fund optional calls**. No reliable bound means no dispatch.
- Stop the route on auth/privacy/schema-cap incompatibility, unexpected model/provider, two successive transient failures or unexplained costs. Stop all paid dispatch if accounting fails or the next reservation exceeds a limit. No automatic provider substitution, new arms or budget transfer. Preserve not-attempted denominators.
- Review after the first **three title slots per configuration**, inside the limits and with the required Astra assessment before human picks. Repeated output-schema failure or confirmed critical factual failure pauses an arm. Resume only after relevant contract/reference issues are resolved. End at request/spend/review limits even if inconclusive.
- No paid judge API, purchases, provisioning, new account-policy/shared-key changes, new crawling, production changes or fresh-confirmation spending. TV Tropes material stays local. UX/design/frontend work remains outside this work and reserved for Opus 5.5 after the requested 48-hour pause.

Historical rationale is cost headroom, not a current quote: the earlier 101-attempt comparison charged **$0.3764186484**, with **$0.3525869667** held reservations (**$0.7290056151** accounted exposure). Thirty-six outputs extrapolate to **$0.03047** at the old Qwen3.8 sample average or **$1.03012** at the old Grok average; three times the latter is approximately **$3.09**. Rich inputs, cold caches, extra prose/enrichment and current prices can change these costs. The higher ceiling does not select an expensive model or authorize more scope.

### Development, confirmation and remaining dependencies

Previously exposed titles/queries, historical arena holdouts and discussed gap scenarios are development evidence. Familiarity/personal ratings do not by themselves establish experimental freshness. Before future confirmation, agree numerical promotion criteria and review capacity, freeze finalists and references, isolate fresh title/query cases from tuning, split underlying works/franchises and near-duplicate query intents, record exposure and score once. A contaminated or retuned-on set becomes development data. Fresh confirmation requires separate funding/approval; no winner or rollout claim follows from this development envelope.

Goals are settled; exact corpus choices remain open. Current provider identities/routes/prices/caps and composition feasibility belong to [Research current Jev alternatives and their knowledge and output contracts](https://github.com/alp82/goodwatch-monorepo/issues/719). Corpus, representation and complete-output decisions, a frozen run manifest, reliable reservations and reviewed reference coverage must be in place before paid work. Query allocations remain dormant until their prototype dependencies are met. No final 547-field taxonomy, production SLO or full migration architecture is required to resolve this goals decision.

The baseline from [Capture the current baseline and audited evidence bundle](https://github.com/alp82/goodwatch-monorepo/issues/718) is reviewed and committed locally as `af0e21b1` under `docs/design/fingerprint-v2/wayfinder/baseline/2026-10-19-v1/`; apply its `PUBLICATION.md` corrections and missing-asset qualifications. Remote publication remains pending as of this preparation. A local commit is not an accessible remote artifact. ADR 0001 still excludes synopsis-only Jev production scoring; enriched evidence can test its stated revisit condition. ADR 0002 remains proposed; accepted search-role ADR 0011 informs later measurements, not deployment permission.

Supporting repository destinations are `docs/design/fingerprint-v2/wayfinder/evaluation/2026-10-19-v1/{evaluation-contract.md,exact-answers.json,supporting-evidence.md,resolution-comment.md}`. Their commit/publication is handled by the orchestrator. **All essential approval terms are recorded in this comment itself**, so access to supporting files is not required to understand the decision.
