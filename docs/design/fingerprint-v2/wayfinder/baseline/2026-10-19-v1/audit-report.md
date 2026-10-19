# Current fingerprint baseline and audited evidence bundle, v1.0.0

Prepared for **Capture the current baseline and audited evidence bundle** under **Benchmark a richer fingerprint and discovery system**, on 2026-10-19. This is a read-only source/evidence audit. It records existing facts and qualifications; it selects no V2 corpus, quality threshold, feature set, provider or production design.

## Identity and boundaries

- Workspace: `/home/alp/dev/projects/goodwatch/goodwatch-monorepo`, branch `feat/shared-scoring`, HEAD `aa11d4a0c0ad4ce39da534c9eb2ef99bdfc93860` (commit time 2026-10-19 07:45:47 +02:00).
- Published evidence branch: `planning/fingerprint-discovery-v2-20261019`, observed ref `30f1c85ff7c73f13cd5a2d9f57ad5d9acf89d1bb`. Its asset catalog bytes matched the local catalog. Individual local asset hashes also match that catalog; this does not attest that every current app file exists on that published branch.
- Both complete GitHub issue bodies and comment arrays were captured. The map and task had no comments at capture. The task was assigned to `alp82`; neither issue was changed.
- Root and webapp guidance, issue/triage/domain instructions, CONTEXT.md, ADRs 0001/0002/0011, wayfinder skill and both evidence indexes were read. Current ADR 0001 remains accepted; ADR 0002 is still marked proposed despite implemented local embedding code. No ADR is changed here.
- The checkout was already dirty. Each audited file records its exact SHA-256, byte count, git status and HEAD blob when tracked. Untracked design/audit material is not represented as committed HEAD content. Start/end checkout records and validator results preserve the boundary.
- During the audit a concurrent unrelated commit advanced HEAD to `beaa474a0823b61bdfc6c4f547f84ee66739ebf2` and committed six competitor-entitlement documents. None is in this audit's source set; all audited source hashes remained unchanged. `captures/concurrent-checkout-change.json` records the transition. This thread did not create that commit or restore/undo its files. The manifest deliberately retains the original audited HEAD identity.
- No inference, benchmark, model download, provider/pricing research, inventory export, new crawling, production connection/mutation, provisioning, branch switch, stage, commit, issue edit or publication was performed. No credentials were opened. Historical Claude/Sonnet assessors remain provenance; no agent was delegated or launched.

## Artifact inventory and integrity

`manifest.json` is the versioned entry point. It indexes 2,804 source files: 2,115 exact-byte snapshots plus 689 existing TV Tropes source-body files whose hashes and original local paths are recorded without copying their contents. Selection is explicit in `build_bundle.py`; capture is broad within the selected evidence roots, while semantic audit is narrow and qualified in `evidence-register.json`. A byte hash does not imply every file was read editorially.

| Artifact | Purpose |
|---|---|
| `manifest.json`, `manifest.schema.json` | Version, source identities, snapshots, classifications and provenance corrections. |
| `contract-identities.json` | Machine-readable current routes, tier/retry/pause rules, reading contract, model revisions/digests, pipeline state and storage formats. |
| `current-system-instructions.txt`, `current-score-keys.json`, `current-schema-annotations.json` | Current prompt and ordered V1 contract extracted with AST only, without importing app/database modules. Exact source snapshots remain authoritative; annotations are not a runtime Pydantic schema dump. |
| `evidence-register.json` | Nineteen claim-level records with source hashes, limitations and permitted reuse. Includes measured, historical, proposed, illustrative, waived, unavailable and superseded distinctions. |
| `source-quality-audit.json` | Deterministic QA of existing exports and explicit zero gold admissions. |
| `inherited-hash-checks.json` | Prior catalog, export and historical contract checks, including archive/decompressed distinctions and the preserved lineage mismatch. |
| `missing-and-private-assets.json` | Explicit missing/local-only/private/unverified locations and reuse conditions. |
| `snapshots/<repo path>` | Exact copies of safe selected current sources, existing raw exports, historical responses/reviews/results and QA metadata. |
| `captures/` | Live issue/ref metadata, published asset catalog, checkout receipts, skill provenance and recovered Jev source versions. |
| `reuse-plan.md`, `proposed-resolution.md` | Future reuse/publication instructions and a proposed issue resolution for the orchestrator. |
| `validate_bundle.py`, `SHA256SUMS`, `verification.json` | Structure/hash checks, deterministic bundle integrity and recorded validation outcome. |

All paths above are relative to `/tmp/goodwatch-fingerprint-baseline`. The review directory is not durable publication. The orchestrator must choose and record the durable destination before deleting it. Optional `snapshots.tar.gz` packages only the copied snapshots, never the local-only page bodies or credentials.

## Current generation and pipeline stages

The source column below gives repository paths; each has an exact copy and digest in the manifest. Configuration facts are static observations at the stated HEAD, not deployed-state assertions.

| Stage | Observed contract and important boundary | Sources |
|---|---|---|
| Catalog acquisition and eligibility | Priority crawl selects movie/show TMDB IDs, fetches TMDB details, then runs critic, streaming and title-analysis branches. IMDb and TV Tropes branches default off. Standalone title-analysis init requires listed details and nonnull original title/date/overview. This is the existing implementation trace; nothing was crawled. | `f/priority/crawl_all.flow/flow.yaml`, `f/dna/init/{main,update}.py` under `goodwatch-flows/windmill/`. |
| Selection and freshness | Generation queue batch 100, claim buffer 60 minutes, DNA stale at 180 days. Existing fresh analysis is reused; missing fingerprint can be derived from stored scores. Priority missing-fingerprint claims respect seven-day failed cooldown. Chunks of five titles run with five parallel chunks; individual calls within a chunk are serial. | `f/dna/generate/{next,iterate,fetch}.py`, `f/dna/crawl_all_by_id.flow/flow.yaml`. |
| Title-analysis call | Input is `original_title (release_year) - Movie|Show: overview`, not equal rich retrieved evidence. Primary Qwen3.8 Flash for popularity >=1.0 or release within the previous calendar year through today; otherwise Qwen3.7 Flash first. Both go through OpenRouter's Alibaba-only route with provider fallback disabled, requested reasoning off, max 8192, timeout 10/120s. Primary uses strict schema; fallback uses JSON object plus local validation. | `f/dna/generate/fetch.py`, `current-system-instructions.txt`. |
| Validation, fallback and pause | 74 integer scores 0..10, nonzero set, valid score-key highlights. At most six requests/title, one validation repair/model, up to two retriable transport retries/model (429/502/503) within that cap; alternate model after failure. All-zero avoids a futile repair. Unknown highlights are rejected; prompt-only highlight/tag count/uniqueness and sentence-count instructions are not separately enforced in current fetch. 402 pauses to UTC midnight; explicit monthly-budget 403 pauses to next month; unrelated 401/403 raises. | `f/dna/generate/{fetch,spend_pause}.py`, `f/dna/models.py`. |
| Mongo persistence | Analysis, generation timestamp, route provenance, raw ordered fingerprint and released selection save together. The later vectors step derives from the currently stored score dictionary with conditional update, not a paid embedding call or the run's stale returned data. | `f/dna/generate/{fetch,vectors}.py`. |
| Crate publication | Targeted priority publish writes details, ratings, streaming, tropes, DNA, then Qdrant. Scheduled DNA copy joins existing details and retains eligibility/catch-up behavior. V1 direct score/companion field extraction is typed despite dynamic object storage. Scheduled sync state uses last-success start minus30min overlap, initial48h fallback and seven-day maximum lookback; older gaps need separate authorized recovery. | `f/priority/publish.py`, `f/sync/copy/{dna_data,sync_state}.py`, `f/sync/models/{crate_models,crate_schemas}.py`. |
| Fingerprint/vector publication | `media_fingerprint_v1` uses 74-D Cosine `fingerprint_v1`, 74-D Dot `fingerprint_v1_raw` exact-only, two text vectors and sparse BM25F. Point ID is movie1e12/show2e12 plus TMDB ID. Writer derives vectors from scores, preserves vectors owned by other writers, carries titles missing published streaming forward and advances checkpoints after success. Unscoped scheduled publication starts title-snapshot publication. | `f/sync/copy/vector_data.py`, `f/sync/models/qdrant_schemas.py`. |
| Text acquisition/preparation | Combines Qdrant title/year/genres/tropes with Crate essence/tags, synopsis truncated at600 characters, keywords and fallbacks. English excludes title, retains year; multilingual adds title and `passage: `. Dense text uses at most25 keywords/15 tropes, essence or synopsis. BM25F receives all tags/keywords/tropes and essence. Exact punctuation, ordering, tokenization/stemming, float32 field normalization and hash inputs are frozen in code. | `f/search/{title_text,terms}.py`. |
| Local title encoding | BGE base English768-D CLS; multilingual E5 small384-D mean; fp32 CPU ONNX, L2 normalization, max512 tokens, batch32/threads4. Pinned repo revisions, model/tokenizer SHA-256s are captured. Incremental72h overlap and once-daily complete input-hash sweep cover lag; only changed inputs and missing vectors are written, preserving other vectors. State is in `search_embedding_inputs`, `search_terms`, `search_embedding_state`; new term IDs use CAS. | `f/search/{text_encoder,embed_titles}.py`. |
| Index/profile build | Eligible votes>=2000 and nonadult; joins catalog, credits, people, companies and translations; computes additional intent encodes. Format1 gzipped JSON blobs addressed by SHA-1; manifest records file sizes/digests, build/alias versions and profiles. Complete/current CAS follows file/profile publication; current and previous builds retained. This audit uses SHA-256 for its own capture integrity. | `f/search/{build_indexes,index_builders}.py`. |
| Title snapshot | Format1 base101 bytes/title, 74 uint8 scores with255 missing. `title-snapshot:current` identifies version/chunks/keyOrder/SHA-256; chunks <=1MiB. Optional ratings sidecar format1 has separate layout/hash. Source marks use count/sum of analysis source timestamps; actual current manifest/chunks not captured. | `f/sync/copy/title_snapshot.py`, webapp `app/server/title-snapshot/format.server.ts`. |
| Query reading/encoding/ranking | Jev-1.13.0, `accepted-d4-corrected-v1`: two parallel requests, lean full-criteria attributes/words/phrase and148 want/avoid probability questions. Weight2*(want-avoid), want>=.5/avoid<=-1.2;1500ms deadline with bounded529 retries; shared cache/admission/accounting retains uncertain reservations. Local query encoders have their own prefixes and128-token worker cap; current ranker version `hybrid-v2`. Search role defaults two encoder threads/in-flight4; runtime overrides and per-role deployment commits unverified. | Webapp `app/server/{combined-search,search-runtime,search-ranking}/` snapshots. |

Pinned title and query multilingual ONNX hashes differ (`ca456c…` versus `4aa845…`), while BGE model hashes agree. Historical parity evidence exists; no new binary/vector parity check was performed. Model labels alone cannot substitute for byte identity. ADR0011 permits search roles to run different commits from page roles; local HEAD cannot identify all live processes.

The wider consumers are indexed by the existing architecture-impact record, retained with its qualifications: shared filters/mood/theme/style rules, Taste calibration and groups, Explorer, related titles/maps, person summaries, title displays and API payloads. Fixed V1 keys/orders/thresholds and missing-value policies make a compact 547-score draft an incompatible direct replacement. This audit proposes no frontend or UX changes.

## Evidence quality and currentness

Existing generated catalog output is not gold truth. Top-title and exact tag/trope exports are same-day source assertions, frozen to their original SELECT queries and hashes rather than refreshed. Their extraction time is not a per-record generation/source-review timestamp. Historical benchmark outputs, human notes, request/response repairs, route captures, repeat/cost ledgers, acceptance failures/followups and prototype lineages remain separate dated evidence.

| Evidence class | Recorded meaning |
|---|---|
| Measured | Observed source bytes or a historical measurement with its method/population. Static identity is not executed behavior; reported metrics are not newly reproduced. |
| Historical | Original date/configuration/review limitations retained. No current provider availability, pricing, production state or live demand inference. |
| Proposed | V2 definitions, gap recommendations, architecture adaptations, experiment plans and prepared-only tooling. |
| Illustrative | Both Matrix examples,256 imagined query cases and78 trope-inspired scenarios; not model outputs, observed demand or independent evaluation. |
| Waived | Earlier independent Astra/Fable first-pass review gate explicitly waived by owner strategy resolution. Not a passing review and not a waiver for a new V2 protocol. |
| Unavailable | Missing private captures, catalog/vector replay files and uncaptured live state explicitly located; never assigned a fabricated digest or zero cost. |
| Superseded | Specific pending/invalid-record claims replaced by later owner resolution or followup; originals remain unchanged and accessible. |

Semantic scope is limited: prior movie audit read all 2,000 names, four tags for 798 residuals and 77 detailed descriptions; show audit read all 1,000 names and three rare tags, expanded 160 residuals and 99 detailed followups. Prior essence/trope semantic samples were 823/1,282 labels; computational screening covered more. None implies full independent viewing or semantic confirmation of every label.

### Preserved provenance discrepancies

1. **holdout5 count:** evidence-index.md says “five-query”; discovery index, evaluation contract and LOG.md establish30 blind agent-written cases h5-01..h5-30. The captured v2 list has exactly30 keys. Frozen `combo-safe-v2` scored .794 vs r6 .764 and historical captured production .511 on that set. Later v3 reuse is a regression check on exposed cases. Historical two Sonnet assessors plus blind-third adjudication are provenance, not new agent work. No source file was corrected here.
2. **Jev source snapshot:** three current files match the historical manifest; `prototype-jev-vector.server.ts` differs at HEAD. Expected frozen SHA-256 is `009fcaeff41ff6ddf52f33ec0b9bc267c8a3757b486a1b9ddc3e7f5e8c01a3e8`; current SHA-256 is `ca0fd2432fa14b3e78e3c4a6afd3b776299aaf595e87403d50a47ab9c971b783`. All four exact originals were recovered read-only with `git show` from `c22696bfe961651a01c0da63778cdb9b00c7caa2`. Current and frozen copies plus identities are in `captures/`; inherited mismatch is preserved, not hidden.
3. **Pending validation wording:** earlier POC/protocol pending independent reviews were later waived. Repeats and paid-embedding measurement subsequently completed. Old pending text is historical.
4. **Acceptance wording:** invalid stored highlights and monthly-budget-response uncertainty were later addressed in regeneration/monthly followups. Earlier missing fallback-request cost remains unreconciled. Historical disabled-schedule text establishes no current schedule state.

## Source-quality admission audit

The offline QA used existing exports only. It found no duplicate TMDB IDs within either title export, while 32 movie-name groups and 9 show-name groups contain distinct IDs. These are identity-review candidates, often legitimate remakes; no names/IDs were merged. The two Monster (2022) IDs 338676/336273 remain separate. Show 333439 is the prior high-vote/no-evidence anomaly. The exports omit release dates, external identifiers and edition/episode metadata, so they cannot establish identity alone.

The 468 excerpt rows contain 15 groups of identical `(stored URL, excerpt text)` shared across distinct media IDs, including Cracked, Frank and Cast Away/Castaway examples. That can indicate duplicated catalog associations, not confirmed duplicate works. Deterministic candidate scans flagged 43 rows for scope/polarity review: 17 segment mentions, 15 book/album/source-medium mentions, 8 hypothetical/subversion cues and 3 averted/mixed applications (overlap allowed). Literal scanning is deliberately incomplete and can produce false positives.

Concrete averted examples include Heroic BSoD/Hard Boiled (“Averted”), Karma Houdini/To Kill a Mockingbird (averted for one participant, played straight for another), and My God, What Have I Done?/Great Expectations (mixed application). A title-level positive label loses participant/polarity distinctions. Prior narrative review also flags The Wall album context, Twilight book context and a Fame finale context. A movie-labelled row does not prove the source discusses that movie or whole work.

A separate edition-cue scan found three candidate rows: generated tags for Zack Snyder's Justice League and Kingdom of Heaven, and a stored Heat excerpt. They are quarantined for edition interpretation; the cue may compare cuts instead of identifying the source edition. Missing cues do not establish theatrical or whole-work scope. The exports contain no explicit edition identifiers.

The existing malformed-prefix count was independently recomputed:1,452 stored strings affect3,416 detailed associations. Original URLs are retained. No canonicalization, fetching or count merging was performed; this check does not claim every other URL is valid. Array counts and detailed associations are not interchangeable.

**Gold admissions: zero.** Admission requires independently established work/alias identity, scope and edition, valid source identity/capture, asserted versus averted/subverted/hypothetical mode, participant/event binding and coverage/unknown state, plus a reviewer verdict with rationale. The corpus/reference ticket owns those judgments and sampling; goals remain with the separate evaluation thread.

## Cost and latency qualifications

| Stage/evidence | What exists | Gap before equivalent-output comparison |
|---|---|---|
| POC title generation | Historical ten-title full-output medians19.2s Qwen3.8/12.8s Qwen3.7 and about$0.85/$0.34 per1,000 extrapolated from the pilot. | No current invoice/provider-rate verification, production retry/cache mix, throughput/load or title-population estimate. |
| Repeats |20/20 completed; observed generation$0.01179756, held rejected-call reservations$0.006466144; highlights changed for every title/model. | Reservations are not observed charges; repeat stability is not factual correctness. |
| Old paid embeddings |20 valid768-D vectors,1,881 tokens, rate-derived$0.0003762. Combined historical budget accounting$0.018639904. | Not an invoice charge or current CPU-encoder cost. |
| Jev title scores | Historical roughly$0.79/1,000 ten-level scores-only,0.8–1.4s/title, against Qwen's complete outputs. | Jev arm omitted prose/tags/companion generation; enriched inputs and calibration unrun. |
| Enrichment/acquisition | Existing source/QA records and policies. | No new acquisition plan, licensed-access cost, evidence-selection coverage or end-to-end enrichment timing measured. No crawl authorized. |
| Local title encoding/indexing/publication | Pinned configs, historical backfill/encoder/store/parity results and pipeline source. | No current CPU/resource amortization, changed-title rate, full/index rebuild cost, storage bill or index-lag distribution. Zero paid API calls is not zero operational cost. |
| Query reading | Locked model/question versions, dated42 nanoUSD/input-token constant; two-call reserve5,505,024 nanoUSD; historical wording/retry/cost evidence. | Current price/invoice, cache-hit distribution, translation share and retry/unknown-usage cost are unverified. Search spend is per query, separate from title generation. |
| Retrieval/endpoint latency | Historical holdout ranking p50/p9538.3/81.5ms versus uncached166.6/558.4ms; later production whole-search p95 fresh835ms/cached389ms in differing populations. | Not a current comparable model trial. Distinguish ranking, reading, encode, retrieval, display, first delivery, completed result and browser paint; report incomplete/timeouts separately. |
| Failure/accounting | Captured guardrail/repair behavior, missing-charge reservations and superseding followups. | One earlier acceptance fallback response/cost unresolved; errors never imply zero usage. Historical budgets authorize no new spend. |

## Missing/private evidence and decisions enabled

`missing-and-private-assets.json` gives locations. Important gaps: Jev scoring `docs/benchmarks/fingerprint/jev/private/experiment.env` and `docs/benchmarks/fingerprint/jev/private/runs/` are absent locally (credential files must never be published); raw arena captures/grading are archived on `proto/search-simplify` per README, not reacquired; gitignored catalog/embedding matrices and row-order manifests are absent locally; later TV Tropes page bodies are absent while 689 older bodies remain local-only. Private conversation links were not fetched. Actual deployed script/role/image identities, live vector/build/snapshot manifests and model binaries were not inspected.

These are limits on replay/live-currentness, not missing entries disguised as evidence. This prerequisite can be resolved as a **static versioned evidence baseline with explicit gaps**. It enables corpus/evidence-arm choices, mixed representation comparisons, companion-output coverage decisions, controlled knowledge-versus-extraction experiments and an honest cost/time ledger. It does not decide those choices, authorize runs or provide a fresh hidden reference set.

Verification is recorded in `verification.json`: schema and path checks; source/snapshot/archive SHA-256/size equality; inherited catalog/export hashes including gzip and decompressed content; recovered historical Jev hashes; 74-key Python/webapp/historical order agreement; 30-key holdout5 count; deterministic QA counts; seal verification; branch/audited-source preservation, the concurrent unrelated commit, and negative tamper checks. No application or production tests were run because no app implementation changed.
