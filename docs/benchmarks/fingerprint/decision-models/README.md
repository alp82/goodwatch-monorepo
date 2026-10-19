# Decision-model V1 vector bench

This experimental harness compares **74 V1 attribute scores**, in actual `CoreScores` declaration order. It does not compare search embeddings. V1 stored vectors are float conversions of these scores; `create_fingerprint` performs no normalization. The frozen order-file SHA256 is `d43f6e429107a705c5599f8ef55e0dd63a83d93bea3c452ce7dbdc581e3a5f5b`.

Everything defaults to offline. Example candidates are **disabled placeholders**, not verified model IDs, prices, API compatibility, funding, or run authority. No historical release authorizes this new experiment. No provider call is required to run the demo or tests. Requires Python3 and the already installed `jsonschema` for report-schema tests; installs/downloads are unnecessary.

Run from this directory:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s . -p 'test_*.py' -v
PYTHONDONTWRITEBYTECODE=1 python bench.py demo --out /tmp/goodwatch-v1-demo-new
PYTHONDONTWRITEBYTECODE=1 python bench.py run --manifest /tmp/goodwatch-v1-demo-new/manifest.json --runtime /tmp/goodwatch-v1-demo-new/unused-runtime
```

Use a new output directory: writers refuse to overwrite prior artifacts. Demo titles, vectors and responses are invented fixtures. Its two adapter renderings, one fake send, zero network requests, and synthetic schema-valid review report are **not model performance**. `review/REVIEW.md`, `differences.json`, `representative-outputs.json` and `review-report.json` are the review products. The ledger exercise deliberately pauses with synthetic liability, demonstrating that a response alone does not reconcile cash.

## Small interfaces

| Module | Responsibility |
| --- | --- |
| `v1-contract.json`, `core.py` | Exact order/definitions, identity/scope checks, explicit native mappings, field/family/craft distances and coverage |
| `native_routes.py`, `catalog.py` | Provider-owner catalog registration, documented native endpoint shapes, optional state banks and explicit chunk assembly |
| `adapters.py` | Shared title/year/type/synopsis policy; OpenRouter JSON-schema/JSON-object serializers; disabled native Score/Choice serializer plugin |
| `transport.py` | Reviewed bounded urllib diagnostics with explicit native endpoint additions; one HTTP request, no retries/redirects/fallback; sanitized header progress survives outer timeout |
| `session.py` | Locked durable pre-dispatch reservation, one-attempt cursor, cumulative budget, failure retention, exact new approval gate, explicit reviewed reconciliation |
| `bench.py` | Saved-history import, request freeze, dry run, bounded raw response ingestion, synthetic demo and report export |
| `report.py`, `review.schema.json` | Astra-compatible report assembly; no automated factual verdict or winner |

`transport-provenance.json` identifies the reused transport by hash. No old custody bundle, request, account identifier, rating, credential, or private source body belongs here. Private manifests, input corpus, responses and review products must remain in a mode0700 directory with mode0600 files under `/tmp` until separately reviewed. Imports are inert: no network, credential lookup or production integration.

## Recipe and compatibility lanes

The historical Jev state contained original/title identity, year, media type and synopsis. Its question asked how strongly each trait applies to the whole title, not merely whether the synopsis mentions it. The historical Qwen POC used one title per full-document request, the same74 definitions, an identity envelope, and strict/local JSON validation. New arms use the same frozen title/year/type/scope/synopsis object and a **new scores-only shared prompt projection**; all74 definitions and original anchors remain. Canonical input and policy hashes are equal across adapters; necessary wire/schema/question formatting differs and is hashed separately. No rich passages, ratings, hidden referee answers, prose or companion requests are added.

The new prompt explicitly permits unknown=null. That extends the old mandatory-integer response contract to preserve abstentions; a null makes a vector incomplete for strict V1. It does not improve or reinterpret an old vector. `0=not present/irrelevant`, `1=minimal`, `10=defining` coexist awkwardly with historical craft-quality definitions; report that ambiguity rather than substituting a new rubric. A V1 violence zero is not a strict content clearance.

- `identity_integer`: actual integer0–10 only; bool, fractional values and strings fail.
- `choice_labels`: eleven declared labels mapped explicitly to integers0–10, with no probability-based intensity. This is the strict native compatibility lane. The supplied native wire shape is unverified for current APIs and remains disabled.
- `native_expected_linear`: ten native levels0–9 map continuously as `10*x/9`; fractional projections remain fractional. This lane cannot claim native strict74 integer compatibility. Raw distributions, explicit unknown state and reported score are retained separately; a reported score is not a calibrated per-value confidence.
- `historical_python_round`: optional **labelled historical replication** of `round(10*x/9)` or `round(2*x)` with Python ties-to-even. Never the primary silent map. Example:2.25 on0–9 projects2.5, historically rounds2. No presence0.5 gate.

No mapping fits itself to baseline scores. Unknown/refusal/missing/invalid remain distinguishable in raw/errors; normalized values are null where assessment is unsupported or invalid. Every raw selection survives. Native API association is request-bound because the old native API did not echo work identity; this limitation is explicit.

## Reuse saved evidence

Prepare a private, sanitized cohort JSON array with only `{media_type,tmdb_id,title,year,scope}`; do not pass a ratings/account export as the benchmark manifest. Then:

```bash
python bench.py import-history --repo /absolute/repository --cohort /tmp/private/cohort.json --out /tmp/private/imported
python bench.py prepare --titles /tmp/private/imported/synopsis-inputs.json --candidates example-candidates.json --opening /tmp/private/opening-accounting.json --out /tmp/private/proposal
python bench.py run --manifest /tmp/private/proposal/manifest.json --runtime /tmp/private/proposal/unused-runtime
```

The importer reads saved historical score vectors and their actual request/generation metadata, verifies projection equality to parsed originals, and imports saved repeats without rerunning them. Saved Jev integer projections are also imported as explicitly labelled historical reproduction context, preserving arm/mapping labels and the absence of raw native responses; they are not eleven-category native outputs. It records raw-source, derived-float-vector, field-order, prompt, request and producer hashes/identities when available. A panel median is labelled a derived comparator, not a producer or gold. Baseline generation/prompt/as-of metadata not found remains unverified. A newly projected scores-only prompt differs from the full-output historical control even when the synopsis is byte-identical: **distance is not model-only causal evidence or factual error**.

Existing local top-title snapshots supply additional saved synopses only. They do not prove vector availability. Missing input or baseline is explicitly missing; output is never synthesized and titles are never swapped. Optional `--catalog /path/catalog.jsonl.gz` reads an already existing export, retains only exact selected identities, and imports raw `fingerprint_scores`; title/year/type mismatch aborts. The search-arena export documents separately normalized search-vector copies and some payload/vector drift. Do not invert a normalized copy into scores or confuse that artifact with V1's raw float construction. No inventory export, database call or crawl is performed.

For an existing externally authorized capture, parse without dispatch:

```bash
python bench.py ingest --manifest /tmp/private/proposal/manifest.json --cell c0001 --request /tmp/private/exact-request-wire.json --response /tmp/private/existing-response.json --out /tmp/private/ingested-c0001
```

The original request wire must match the sealed cell hash; model/provider identity remains separately verified or explicitly unverified. The exact bounded response bytes are copied privately and hashed; parsed values remain unaccepted. A review uses a JSON array of these parsed records and the frozen manifest:

```bash
python bench.py review --manifest /tmp/private/proposal/manifest.json --parsed /tmp/private/parsed-records.json --baselines /tmp/private/imported/baselines.json --out /tmp/private/review
```

Manifest cell IDs prevent accidental duplicate scheduling; configuration and cell association are required. Failed attempts must be represented as failed parsed records with `returned:false`, all74 mapped values null, and errors; they are not silently omitted from attempts. Not-attempted expected cells remain in coverage. New API adapters need dedicated serializer/parser tests and current route/cap/price admission; unknown adapters fail closed. Actual chunking and internal passes must be supplied by the provider catalog. Default templates use one request per vector; documented native batches are explicit cells, never silent splitting or fanout.

## Metrics and review

Exports retain all fieldwise signed/absolute differences, paired counts, unknowns, mean/median/max distances, family views, eight-field craft slice, macro-title and per-field means, and raw native versus mapped output. Main aggregate metrics exclude invalid identity/format/guard results but keep their failure/coverage records and diagnostic raw differences. Whole-vector cosine is reported only for complete pairs, with undefined zero-vector comparison=null. No cross-family rank metric or weighted winner is fabricated.

Repeated historical vectors are exported separately for matched-input sensitivity. They must be compared under the same identity/schema/recipe checks; there is no universal noise correction, no subtraction of a historical0.51, and no automatic repeats. The report includes pending fields for independent meaning review. Astra adds source-qualified judgments and recommendations before the human decides. Deterministic top-difference items are review prompts, not proven errors or final curated six cards. Human time remains45 minutes minus time already consumed; this harness does not reset it.

Costs are scores-only and stage-specific. Exact response usage/cache/reasoning fields and reported cost survive; reconciled cash is separate from pending full bounds. The transport captures request elapsed time, and the assembler records request/local-parse/vector-stage timing. No p95 from tiny samples, inferred throughput or complete-pipeline savings claim. Unknown complete-vector cost remains null. Prose/essence/tags/highlights/advisories/context generation and their failure modes remain separate, deferred work.

## Live boundary and current limitations

`run` without `--live` validates shapes/hashes, resolves no credentials, opens no runtime and sends nothing. Live dispatch additionally requires a new sealed benchmark-specific APPROVED record, exact code/manifest/custody digests and nonexpired root operational window, reviewed provider/token/price admission, explicit budget allocation disposition, and an explicit disposition of inherited accounting/semantic holds. It rejects Q12/Q13 records. Budget headroom never waives an unknown-charge stop. Only a new actual human record and exact approval explicitly naming the carried parent liability can permit that exact inherited exception; every new unknown charge still stops. No such approval is included. All candidate templates remain disabled/unadmitted. A proposed positive run ceiling is still UNAPPROVED and creates no reservation or authority.

Only after a separately reviewed future release would the entry be:

```bash
python bench.py run --manifest /tmp/private/approved-manifest.json --runtime /tmp/private/exclusive-runtime --live --approval /tmp/private/actual-approval.json --approval-sha256 EXACT_ROOT_DIGEST --credential-env OPENROUTER_API_KEY
```

No key is accepted on the command line or searched for. The gate runs before environment lookup and repeats immediately after the one documented key-allowance preflight. It requires sufficient remaining key allowance for the next explicit POST conservative bound, without account balance proofs or settings changes; auth/402 stops, no purchase. No paid compatibility probe or metadata follow-up is implicit. Native dispatch requires current provider-specific API/cost/output-cap admission; all supplied native candidates remain unadmitted. Direct-host dispatch needs a separate provider allowance boundary. Native serialization and existing-capture ingestion work offline.

The exact approval and root release bind one authoritative runtime path; another path cannot create a second ledger from the same approval. The cursor uses exclusive cell directories, a process lock, fsynced atomic ledger writes and pre-call full-bound reservation. Exactly one send, zero automatic retries/fallback. Timeout means unknown acceptance/charge and retains liability; it does not imply cancellation. HTTP/route/schema/refusal/cap/accounting errors pause. A successful response also pauses for independent review/reconciliation. An exact-ledger charge settlement updates cash once and leaves review holds/cursor unchanged. A separate reviewed hold disposition may reopen only the unchanged next unattempted cursor under the same consolidated authority; it changes neither cash nor attempt history. Every next live entry still passes the full approval/expiry gate. No per-cell human approval or new scientific slot is implied. Original raw files and attempt history remain immutable. Ledger adoption validates operator-supplied evidence bindings, not source-entailment or provider billing truth.

Legacy fixtures retain their12-attempt stage cap. A new bench imports the authoritative retirement receipt: three initial attempts consumed,69 remaining in the existing72 capacity, and the existing18 retry pool with zero consumed/reserved. New retries default0. These are shared capacity ceilings, not authorization or automatically scheduled calls. Recommended3-title screens and up-to3 finalists are preparation defaults contingent on baseline availability, meaningful native compatibility and budget admission—not automatic scheduling or a cost guarantee. No calls are authorized by this code or documentation.

## Provider-owner native packet integration

The native catalog is consumed through `catalog.py`, not recrawled or treated as launch authority. It verifies all74 definitions plus the exact historical order-file hash. Register the prepared queue from an existing packet:

```bash
python bench.py import-catalog --packet /tmp/provider-owner-packet/public-safe --out /tmp/private/catalog
python bench.py prepare --titles /tmp/private/paired-synopsis-inputs.json --candidates /tmp/private/catalog/registered-candidates.json --opening /tmp/private/opening-accounting.json --out /tmp/private/native-proposal
```

The output preserves exact model IDs, host proposals, version limitations and source-record hashes. Thirteen queued OpenRouter maker configurations plus direct Celeris/Nimble have offline serializers. ScaleDown uses `state.text` containing the canonical complete shared payload; its Decisions route performs74 internal native classify calls, one external POST, and requests no explanations. The separate `/classify` endpoint and its default extra explanation call are excluded. Kettei is retained as a disabled descriptor: the supplied packet summarizes its request but provides no tested response fixture/shape, so this harness does not invent a parser. Other local controllers/reserves remain source inventory references. No `supported_parameters:[]` exclusion is applied to native APIs.

Five native endpoint keys are registered explicitly: OpenRouter `/api/v1/systemone`, OpenRouter **root** `/api/alpha/decisions`, direct Jev, Celeris's named-model decisions list, and direct Nimble. They are not chat. Native bodies contain typed state/questions, with no chat reasoning, `max_tokens` or `max_completion_tokens`. The corrected transport gains only explicit URL/phase registrations and native raw-success retention; no arbitrary URL or fallback is introduced. Fake urllib tests exercise these actual URLs and serializers.

`native_routes.py` uses this harness's frozen synopsis, shared policy and exact V1 definitions, not the provider packet's different compact sizing prompt. Compact native option meanings live in shared task instructions; this is a recorded presentation projection, not added title evidence. **Choice11 and Choice16-with-states are separate configurations**. The five optional nonordinal states remain raw and map to null. Known smaller option limits reject the16-option variant; no state compression or silent conversion to11 options occurs. A pure Score10 lane remains separately projected. Selected label, distribution, provider confidence and diagnostic numeric probability mass remain separate; none is truth, intensity, or calibrated semantic confidence. No expectation conditional on numeric mass silently discards unknown mass.

Native host batch limits are explicit. DREX on DeepInfra (`deepinfra/us`) and direct Nimble prepare exactly `[64,10]`, repeating the same frozen state and charging each request independently. DREX chunks have separate documentary conservative bounds$0.503316480/$0.078643200; the maker direct512-question limit is not this host limit. Celeris's documented count fit permits `[74]` as preparation. Unverified hosts get a **hypothetical**74-question template with unknown actual subcalls/work/admission, not a claimed count guarantee. Every chunk has an exact question slice, wire hash, endpoint and input hash. No extra state-gate questions, hidden passes, retries or semantic repairs are introduced.

Use `assemble-chunks --records /tmp/private/ordered-chunk-records.json --batches /tmp/private/batches.json --out /tmp/private/assembled` for deterministic complete74 assembly. It rejects missing/duplicate/wrong-scope/changed-input chunks and preserves raw chunk records. Cost and request-time sums must include every chunk; full vector wall time stays unmeasured until actually captured, rather than substituting a sum of medians. Report assembly groups chunks as one title and counts every attempted request. `collect-runtime --manifest ... --runtime ... --out ...` exports failures as well as returned outputs, with exact reconciled cash components and pending bounds for the review command. Do not build a successful-only report from selected parsed files.

OpenRouter native runtime entry remains controlled by the same new sealed approval and unresolved-hold gates, plus an exact root-reviewed native request/billing/input/output/no-extra-work receipt and verified native price guard. There are **zero admitted native configurations** in the supplied packet. An empty parameters advertisement is not a rejection, while unknown processed/billed input or output bounds still prevent dispatch. No983,616-token exception transfers to this bench. Direct native serializers/captures work offline; direct dispatch still needs its own reviewed credential/allowance/accounting boundary rather than borrowing OpenRouter's key preflight. No such access is looked up here.

The complete synthetic native demonstration is also runnable without network:

```bash
python bench.py demo-native --out /tmp/goodwatch-native-demo-new
```

It renders five exact endpoint configurations and six request bodies (Nimble64+10), invents explicitly synthetic responses, and exports the same reviewed report shape. It tests no real model and measures no cost/latency.

## Root retirement and parser review corrections

Use `import-accounting --ledger /tmp/private/authoritative-retired-ledger.json --receipt /tmp/private/root-retirement-receipt.json --out /tmp/private/new-accounting` to import the terminal old experiment read-only. The importer verifies receipt/hash/status, carries cash and each unknown liability once, retains original attempt consumption/allocations, and records zero reusable old-stage hold. It neither mutates the old ledger nor creates a new reservation. The proposed rolling bench reserves only the conservative bound of the next explicit POST, after the actual gate and allowance check. The run ceiling is a limit, not a blanket reservation; retired slots/hold never reactivate.

`reviewed_native.py` adopts the provider owner's corrected **review-v2** pure normalization functions. `parser-adoption.json` binds exact source/adapted hashes and the three small generalizations (existing field contract, explicit chunks, Choice11/Choice16 bank). Original parsers confer no comparison eligibility. Use the returned `comparison_scores_in_field_order`, never raw `scores_in_field_order` or a `strict_v1` coverage label as eligibility. Score10 reported mean and complete distribution must agree under arithmetic epsilon or an explicitly sourced precision policy; inconsistent means remain raw and have comparison=null. Celeris pairwise selection tolerance `.01+epsilon` is independent of aggregate mass compatibility tolerance `.08+epsilon` for16 labels. Nonunit `.95` mass and `.47` selected versus `.53` alternative are comparison-ineligible; raw selections/distributions survive without renormalization. Unknown states stay null and are separate from withheld numeric predictions. Envelope conflicts and serving/usage guards override numerical eligibility. Neither parser nor syntax proves source support.

Each Jev request records its actual wire bytes and a qualification around the guide's **approximate**32k-byte automatic long-context marker. Below the marker is not proof of execution mode; no unsupported mode switch is sent. Model/provider/id/native usage are retained by the parser, while exact bounded successful raw bytes and sanitized HTTP correlation headers are joined in private transport custody. The native response's optional provider field is not required by pure parsing. Runtime identity guard pauses on unavailable inline identity rather than assuming provider proof or issuing a speculative metadata request; an alternate custody check needs exact documented evidence/admission. This is an execution/provenance limitation, not a model-quality judgment.

An exact tokenizer is not the only possible finite bound. The provider register carries reviewed documentary ceiling alternatives and breadth qualifications, separately from actual admission. Microsoft/DREX/Perplexity/Span02 join Jev/Liquid as a six-family preparation possibility, not a guaranteed or admitted grid. ScaleDown/Solar coarse bounds exceed current title headroom; Mercury/Luna still lack aggregate bounds. Unbounded routes remain in the preparation queue. Large but finite billed/processed-input ceilings still require route-specific input exceptions in the **new** actual human approval and matching root-reviewed guard receipt. No previous Qwen exception transfers, and no such exception is created by these examples.


## Corrected integration and exact prepared catalog inputs

Only `native-challenger-prep/versions/review-v2/public-safe` is an accepted catalog input. Include the separately reviewed breadth file explicitly:

```bash
python bench.py import-catalog --packet /tmp/provider-owner/versions/review-v2/public-safe --breadth /tmp/provider-breadth/candidate-bounds.json --out /tmp/private/catalog-new
python bench.py import-prepared --packet /tmp/private/existing-catalog-comparators --out /tmp/private/inputs-new
python bench.py prepare --titles /tmp/private/inputs-new/screen-model-inputs.json --candidates /tmp/private/reviewed-screen-candidates.json --opening /tmp/private/opening-accounting.json --run-ceiling 3.28723353 --out /tmp/private/screen-new
python bench.py matrix --manifest /tmp/private/screen-new/manifest.json --out /tmp/private/matrix-new
```

`import-prepared` verifies the prepared input manifest, hashes, exact model-view bytes, identity/year/scope, raw74 integer comparator validity and synopsis linkage. It never invokes the historical importer's synopsis precedence. All-ten input/source custody stays private; only whitelisted identity/original-title/synopsis fields enter model views. Producer/model/original prompt/generation scope of an existing catalog comparator may be unknown; label that comparator accordingly. The stored secondary normalized Qdrant vector is not an upstream raw V1 vector. Historical controls/repeats remain separately labelled and do not acquire the new snapshot's recipe.

## Rolling policy proposal and counting scope

The immutable manifest freezes shared-title rounds, deterministic model-order rotation before outputs, adjacent ordered chunks and zero retries. Planned queue breadth is separate from an eventual admitted dispatch subset. Keep known-unaffordable/conditional descriptors outside a proposed executable schedule; do not skip them opportunistically during execution. If the next scheduled bound cannot fit, stop with all remaining cells not attempted. No automatic finalists, model insertion, rerender, route change or new attempts follow a failure.

Before each POST, `next_bound_check` applies the hard run ceiling and cumulative title/global ceilings to cash + outstanding liabilities + that POST's conservative bound. Runtime locking, exact cursor and an exclusive attempt directory precede atomic intent/reservation. There is no upfront sum-of-grid reservation and no revived$2.51 hold. A root-reviewed attributable charge replaces only that attempt's bound with cash, releasing only bound-minus-cost. A confirmed above-bound cost is recorded in full even above the caps, replaces its reservation once, and latches an unconditional stop; released unused reservation is never negative. Every new unknown charge holds its entire bound and stops. Carried s02 stays separate and requires a new actual human exception naming exactly that liability; historical Q12/Q13 do not authorize the bench. Successful billing reconciliation cannot waive route/schema/refusal/scientific stops; a separate exact disposition is required.

A new consolidated human record and root release must bind the exact `counting_scope_proposal`. It distinguishes external POST attempts (69 remaining shared initial capacity), actual/unknown provider subrequests, native scoring groups/passes, known internal calls and billed aggregation. The older provider-subcall/fanout contract is not silently redefined: a74-internal-call implementation is not claimed to be one total call. Exact bounded fanout/count exceptions and route-input exceptions remain unapproved. Native host implementation may perform unobserved work; a documentary ceiling is conditional on the recorded meter/host contract, not proof that all source text was read.

Perplexity's proposed lane is **adaptive-host-grouped exploratory, grouping unknown if telemetry unavailable**. Keep the frozen74-question order, worst≤74-group ceiling and same-maker meter-transfer caveat; do not describe an unsplit group or issue74 singletons. Span02 preserves unknown hosted count cap/truncation/upstream-default thought mode. No unsupported chat reasoning flag is inserted. Returned identities, raw native usage and observed work must be retained or explicitly unknown. No unexplained charge/pass is free.

The matrix reports planned POSTs/vectors, documentary-bounded and individually affordable cells, worst-case fixed-prefix capacity, actual admitted/completed counts and separate opening cash/pending. It is not a full-grid guarantee. Serial settlement can release unused reservation, never invent expected cheap costs. Incomplete DREX chunks are retained and costed but excluded from full-vector ranking. Per-field diagnostics identify matched title/field intersections; unknown, numeric-withheld, missing, invalid and not-attempted coverage are separate. Models on different title intersections cannot be ranked by unmatched averages. Reports are scores-only disagreement, not factual accuracy or full-pipeline savings.


## Settlement and review disposition (bounded v5 correction)

The two offline commands have separate jobs:

```bash
python bench.py adopt-reconciliation --manifest /tmp/private/manifest.json --runtime /tmp/private/exclusive-runtime --receipt /tmp/private/exact-charge.json --receipt-sha256 EXACT_REVIEWED_DIGEST
python bench.py dispose-review-hold --manifest /tmp/private/manifest.json --runtime /tmp/private/exclusive-runtime --receipt /tmp/private/review-disposition.json --receipt-sha256 EXACT_REVIEWED_DIGEST
```

These commands perform no dispatch, credential lookup or billing API request. Actual records must be authored/reviewed by the operator; synthetic test records are not authority. The live entry persists `authority.json` only after the full repeated approval gate, binding the original manifest, exclusive runtime, consolidated approval digest, actual human-record/root-release digests and exact carried-pending exception. Ordinary review disposition references this existing consolidated binding, not a new per-cell approval. Settlement/disposition can record past liabilities after a dispatch window expires; any later paid dispatch still needs a currently valid original-scope gate. These operations cannot renew it.

Both receipt types require `status:ROOT_REVIEWED`, `operation`, current `ledger_sha256`, `manifest_sha256`, exact `runtime_path`, `authority_sha256`, `cell_id` and original `request_sha256`. The original saved request must still hash to the recorded attempt. A settlement has `operation:settle_charge`, `cost_usd` and typed `evidence`. A disposition has `operation:dispose_review_hold`, the applied `settlement_receipt_sha256`, exact `next_cell_id`, and action `resume_next_unattempted` or terminal `finish_after_review` with next=null. It cannot skip/repeat a cell, rewrite cash/history, waive a bound breach, or clear a new unresolved liability. The only inherited exception remains the exact carried s02 map from consolidated custody.

Settlement evidence references are runtime-relative `{path,sha256}` objects, bounded to2MB and protected against path escape/symlinks. `billing` references actual retained provider evidence; `attribution` references an operator-reviewed typed wrapper (`kind:reviewed_exact_charge_attribution`, `status:FINAL_ATTRIBUTABLE`) binding cost, cell, request, manifest, runtime and `billing_evidence_sha256`. This validates operator custody/attribution, not provider billing truth. No provider API/usage-field assumption or fake generation ID is introduced. The evidence kind must be one of:

- `retained_transport_raw`: `response` points to exact `cell/http/*.successful-response.private.bin` and the wrapper binds `response_sha256`. Malformed HTTP200 bytes are valid custody even when no decoded response exists.
- `retained_decoded_response`: fallback `cell/response.json` only when exact transport raw bytes do not exist (for existing decoded-only captures or synthetic injected transports). It is explicitly decoded custody, never claimed exact gateway bytes.
- `attributable_no_response`: no successful raw/decoded response exists. `correlation_receipt` points to the attempt's saved sanitized failure receipt; the wrapper binds its hash and an observed allowlisted provider correlation header/value plus the exact billing evidence/request linkage. Missing/unattributable charge stays fully held. This is not permission to query history or infer non-execution.

Applying the identical already-applied latest settlement is an idempotent no-op with evidence revalidation. A changed second settlement/stale receipt cannot release funds again. Exact settlement archives and root dispositions are saved exclusively before an atomic ledger update; an interrupted pre-update archive can be reused only for identical bytes. A known charge replaces its own pending reservation once; over-bound charge records both actual cost and excess, releases zero unused amount, and permanently stops this runtime even with headroom. Original raw/parsed errors and attempt status remain intact.

Settlement always leaves `paused_settled_review` (or a bound-breach stop). A later, current-ledger disposition can follow close/reopen. A technical/route/schema/refusal failure additionally requires a hashed `ROOT_DISPOSITIONED` record with decision `retain_invalid_advance`, exact original stop and all retained diagnostic/parsed stop-evidence hashes. This acknowledges the failed outcome; canonical acceptance remains false. Terminal disposition ends at `completed_reviewed`, needs no nonexistent next cell, and never initiates another request. No automatic repair/retry occurs.

## Coverage semantics (bounded v5 correction)

Coverage is counted per frozen POST's requested fields and its actual returned field IDs, not null padding in a74-entry map. `unknown_cells` is now an alias of **explicit semantic unknown predictions only**. Separate counters/field-ID ledgers identify unattempted, unreturned (including failed-unreturned), invalid returned fields, withheld numeric predictions, not-applicable, not-assessed, refused, other assessment states and assessed numeric fields. Classification is descriptive of the raw output, never evidence of truth. Failure/guard eligibility still independently excludes comparisons.

A64-assessed DREX chunk plus10 unattempted fields means64 assessed,10 unattempted and0 semantic unknowns. An entirely failed/no-response attempt means74 unreturned/failed-unreturned, not74 abstentions. Partial chunk costs/liabilities remain in economics; complete-vector ranking remains withheld. `core.compare` reports `candidate_noncomparable_cells` separately from explicit `candidate_abstentions`, with requested/returned missingness detail. Chunk diagnostics compose the child records so assembly cannot erase their missingness provenance.

## Six-route documentary guard integration (v5 proposal)

`route_runtime.py`, `six-route-contracts.json` and `generation-metadata-shape.json` implement source-bound proposed mechanics for the six named routes. Their hashes identify the immutable evidence-v1 matrix/schema and additive F1/F2 interpretation. They confer no admission. The renderer's explicit `documented-server-price-filter-v1` mode adds only `provider.max_price` prompt/completion **strings inUSD/M**. These are tariff filters, not request cash caps; endpoint rates areUSD/token. The proposed21-body version preserves every state/question, cell order and per-POST cash bound. Native requests have no chat token/reasoning parameters.

A future launch must pass real consolidated approval and root documentary receipt checks; supplied configurations stay disabled/unadmitted. Before credentials or reservation, the actual pipeline fetches exactly the six public endpoint URLs through a credential-free HTTP branch: no Authorization, proxy, redirect or arbitrary endpoint. It verifies matching endpoint set/tag, price units/rates, context and advertised dated name, then rechecks approval. A separate key-allowance preflight and repeated approval gate precede the single reserved POST. Public current metadata does not lock a quote; the documented server tariff filter also travels in the POST. The proposed screen discloses at most126 public endpoint GETs,21 account-allowance GETs and63 exact-generation GETs separately from21 inference POSTs and native internal work. No such call occurred in preparation.

After successful POST bytes are retained and parsed, the real pipeline joins the **actual validated body generation ID** to the documented metadata endpoint before final identity/usage/cost guards. Missing ID never becomes a guessed request-ID lookup. Literal body model/provider/cost are preserved; explicit alias↔dated identity and tag↔display mappings carry source hashes. Conflicting metadata is retained and held, never silently overwritten or passed to the pure parser as a falsely conflicting literal model replacement. A dated returned name is still no weight digest. Requested `deepinfra/us` policy and reported `data_region` are separate from independent model-server region attestation, which remains unavailable.

The F1 interpretation uses at most three serial exact-ID GETs at monotonic lower-bound start offsets0,+2,+5seconds. Only exact endpoint HTTP404 may continue; every other HTTP/timeout/auth/shape/identity/cost failure pauses immediately. There is no invented successful-body pending status. Intent, exact ID/request/manifest binding, attempted count and receipts are persisted before every GET. Interrupted/restarted joins pause without automatic new reads or a reset allowance. Success ends polling; final404 retains liability and means no zero-charge inference. The existing per-request socket/outer deadlines remain. No new POST occurs during this metadata window.

The F2 classification is projected from captured GenerationResponse.data: all source-required fields must be present with their documented types/nullability, even when privacy excludes their values from stored receipts. In particular api_type/native_tokens_prompt/provider_responses are required-but-nullable; is_byok/data_region are required nonnullable. Missing is not null and neither defaults to0/false. Nonselected account/user/referrer/session/workspace values are checked only in memory and excluded from selected metadata custody. A bounded transport receipt preserves the original response hash without persisting the full metadata body; allowlisted identity/billing/native counts and provider-attempt fields retain their literal values/origins. Source declarations do not prove runtime compliance.

Native body input/output integer counts remain primary; generic metadata tokens_prompt/completion never substitute for native billed aggregation. Nullable native metadata counts corroborate only when populated. Total_cost supplies attributable account-charge evidence; inline cost/metadata usage conflicts hold. It does not automatically settle the ledger: R1–R3 root-reviewed exact-charge settlement remains separate.8192 is a **postcall observed-output threshold**, not a provider-enforced native token cap. Zero output tariff is not zero output usage. Span02's upstream-auto native thought profile remains explicit; no no-thought assertion or extra prose/search/fallback API call is introduced. Provider response attempts are distinct from native classifier heads/groups/passes and remain unknown when absent/null.

Root's future operator steps are: review exact combined code/request hashes; adopt documentary input/count/output/native-work qualifications and real root guard receipts; obtain the new consolidated human scope (including s02 and route input/count/read-policy exceptions); create actual manifest/code/runtime-bound authority; then use one-POST live entry with serial reviewed settlement/disposition. No actual approval, REVIEWED receipt, credential reference, provider acceptance or live reservation is supplied by these source files.
