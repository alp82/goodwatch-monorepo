# Baseline reuse plan, v1.0.0

This plan refers to the exact manifest and snapshots in `/tmp/goodwatch-fingerprint-baseline`. It does not authorize new collection, inference, crawling, provider changes or implementation. The orchestrator owns review, issue recording and path-scoped commit/publication.

## Reuse without repeating extraction

1. Verify `SHA256SUMS` and run `python validate_bundle.py --snapshot-only` after moving/unpacking the bundle. For verification against this working checkout, run without that flag. Keep `verification.json` with its source-observation time; a later pass is a new receipt, not a rewrite of the evidence history.
2. Reference the existing 2,000/1,000 title rows, complete essence/trope exports, ledgers and original extraction manifests by hash. Do not rerun exports merely to recreate these facts. Source hash changes require a new baseline version and reason; never overwrite v1.0.0.
3. Keep current V1 source/prompt/order and historical frozen benchmark prompt/schema as different baselines. Reuse historical raw outputs under their exact original input/prompt/route/cost scope. The AST annotation record is a convenience, not a runtime schema attestation.
4. Read claim-level qualifications before using an artifact. V2 definitions/examples and synthetic searches are proposals/illustrations. Generated tags and stored trope associations are source assertions. No artifact in this bundle is automatically a gold label.
5. Apply the source-quality quarantine before selecting reference evidence: work/remake/duplicate identity, movie/show/season/episode/edition, original and canonical URL, polarity/application mode, participant/event binding and evidence coverage. Confirm rather than auto-merge same-name IDs. Store an independent reviewer verdict/rationale and unknown state when unsupported.
6. Existing historical holdouts and exposed 256+78 scenarios are development/regression evidence. `holdout5` means30 cases; frozen v2's outcome is historical. The holdout/corpus/goals tickets own fresh hidden cases, calibrated judgments and thresholds. Do not duplicate the evaluation-goals thread here.

## Match experiments to complete outputs

| Later decision | Reusable fixed baseline | Required choice/evidence owned by its ticket |
|---|---|---|
| Title knowledge versus extraction | Current title+year+type+synopsis prompt; historical synopsis-only Jev and blind-input arms; stored excerpts and source QA. | Independently verified corpus, controlled equal evidence arms, masking/recognizability limits, abstention and false probes. |
| Representations and scales |74-key order, V2 stable group.key definitions, illustrative matrices and gap ledgers. | Candidate feature subsets; binary/category/ordinal/count versus0–10; unknown/N/A/not-assessed, scope and confidence policy. |
| Companion outputs | Current essence/tags/highlights/advisories/production/suitability/context contract and invalid-highlight history. | Output-by-consumer matrix; complete versus composed generator; factuality, spoiler and representative-highlight checks. No score-only cost comparison against complete generation. |
| Discovery mechanisms | Two-request Jev reading, hybrid-v2 source, six arena branches and dated parity/latency evidence. | Fixed catalog and matching cached readings for ranker-only comparison; separately vary reading, annotation and ranker before testing interaction. |
| Total cost/time | Historical request/repair/reservation/token ledgers plus current pipeline stages. | Per-title acquisition+generation+repair+prose+CPU encoding+publish/index costs; per-query fresh/cached reading+translation+encode/retrieval/display; concurrency, p50/p95, completion/error rates, index lag and cache assumptions. |

## Missing assets: reuse or qualify, never silently regenerate

- Jev raw captures: ask the existing custodian for a sanitized manifest/response and usage ledger from `docs/benchmarks/fingerprint/jev/private`; keep credentials excluded. This is optional for planning but required for claims needing raw-call reproduction. Absence is not zero cost.
- Arena raw captures/grading: existing archive branch `proto/search-simplify` is the documented destination. If needed later, inspect/copy an immutable ref read-only into a new isolated artifact directory, with authorization appropriate to any private query content. No branch switch is needed for source reads. Do not recreate paid readings.
- Catalog/vector matrices: locate existing owner/benchmark-host copies of `data/catalog.jsonl.gz` and matching `.npy` files; require SHA-256, row-order identity, dimensions/dtype and text/model contract. Do not reconstruct from a new live export just to repeat the old inventory.
- TV Tropes saved bodies:689 existing local files are hashed at original paths; later `run-2026-09-26b/sources` is absent locally. Bodies stay local under project policy. Only reuse existing saved pages; this plan authorizes no fetch, recovery run or Cloudflare workaround.
- Live state: if a later experiment requires a live-production comparison, prepare a separate narrowly bounded sanitized read-only request for Windmill deployed hashes/schedule configuration, per-role image/commit identities, current Crate index manifest/blob digests, Redis title-snapshot manifest/chunk digests, vector configuration/counts and source watermarks. Record observation UTC and scope. No secrets or broad catalog export. This prerequisite deliberately does not claim that capture occurred.
- Pinned model files: reuse already verified binaries or later authorized build artifacts; compare configured hashes. Python and TS multilingual ONNX exports differ. Historical parity supports prior behavior only; current binary/vector parity remains unverified.

## Proposed durable destinations

| Material | Proposed destination | Publication condition |
|---|---|---|
| Manifest/schema, audit report, reuse plan, evidence register, contract identities, QA/hash results, validator, verification and proposed resolution | `docs/design/fingerprint-v2/wayfinder/baseline/2026-10-19-v1/` | Orchestrator reviews, stages only this destination and records immutable commit. Existing sources remain untouched. |
| Current prompt/order/AST annotation capture, issue/ref receipts and recovered Jev sources | Same baseline directory, retaining current relative names and `captures/` | Check all content is appropriate for repository readers; no credentials captured. |
|2115 copied exact source snapshots | Same baseline directory as `snapshots.tar.gz`, or an immutable checksum-addressed project artifact with its URI/retention recorded beside the manifest | Archive contains relative `snapshots/<repo path>` entries. Unpack beside manifest before snapshot-only validation. Avoid committing duplicate expanded source trees unless desired. |
|689 local-only TV Tropes source bodies | Original local paths in manifest; a private owner-controlled archive if durable retention is needed | Publish only metadata/hashes/locator. Do not include bodies in the public snapshot archive. |
| Missing private raw captures/model binaries/live state | Explicit unavailable register until separately captured | Do not invent paths, digests or completed work. Credential locations are provenance, never copy targets. |
| Original source inventories/benchmarks | Existing published evidence paths/immutable refs, additionally frozen in the snapshot archive | Reuse rather than export again; preserve original queries, hashes and dates. |
| Resolution comment and named map context pointer | Existing **Capture the current baseline and audited evidence bundle** task and **Benchmark a richer fingerprint and discovery system** map | Orchestrator only, after review; this thread leaves issues and map unchanged. |

The manifest's `repository_root` is an audit-time source location, not a portable destination. Relative snapshot paths and archived bytes make reuse portable. The orchestrator should replace the temporary review pointer in the proposed resolution with the immutable published commit/artifact URL, retaining the v1 identity and SHA256SUMS digest. No additional ticket is claimed or created.
