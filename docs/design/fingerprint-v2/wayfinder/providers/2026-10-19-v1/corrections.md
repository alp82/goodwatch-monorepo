# Corrections after independent Astra review

Corrected 2026-10-19 by the research owner, following the orchestrator's explicit R1/R2 instructions. Research resolution is ready to propose with conditional findings; this is not a new independent acceptance review, protocol freeze, lineup decision or permission to publish/spend. **Q7, Q8 and Q9 remain unanswered.** The offered 52-file baseline/evaluation branch remains outside this revision and its pending publication approval does not include provider assets.

## Evidence and history

Read the supplied `review-report.md`, `protocol-impact.md` and `verification.json` under `/tmp/goodwatch-provider-contract-review/`. The review identifies gpt-6-astra, high effort, reviewed at `2026-10-19T09:24:52.981332+00:00`. Its verification receipt is preserved byte-for-byte as [captures/astra-review-verification.json](captures/astra-review-verification.json). The original review report and protocol-impact hashes are recorded in that receipt and in `provenance.json`; full copies of those narrative files are not added here.

The receipt independently checked the material Jev/Qwen/Liquid/Clef contracts and six route records, not every reserve/local candidate. Its original disposition required two corrections. These edits address them; they do not rewrite that historical disposition as approval. No new network calls or inference were needed for this revision.

All 24 pre-existing capture files remain byte-identical to their review-start hashes, including observed endpoint data and original failed fetches. The old package seal and old checks are preserved as `captures/pre-correction-SHA256SUMS` and `captures/pre-correction-checks.json`. Those describe the **pre-correction** package; their ticket checks retain their original observation time. The root `SHA256SUMS` and `checks.json` describe this corrected revision. Source records are extended with the reviewer's Liquid article and Workers AI schema observations, without replacing earlier observed responses.

## R1 — Liquid billing scope

The former actual-usage inequality `B_d1_bound >= sum_j (S + Q_j + H_j)` is withdrawn. Per-question prompts and aggregate input usage are documented, but repetition of all shared text, criterion and wrapper content is not a verified billed-input floor. The maker also claims input savings from batching. The report, candidate record and proposed resolution now preserve that unresolved accounting explicitly. [Liquid models](https://docs.liquid.ai/lfm/models/decision-models), [usage](https://docs.liquid.ai/lfm/models/d1), [maker article](https://www.liquid.ai/blog/d1-decision-model)

The replacement is a conservative **scenario**: `B_repeat_scenario = sum_j (S + Q_j + H_j)`, with bounded units, wrapper and host accounting required before reservation. Its illustrative repeated-state component is `98 × 2500 = 245000`, which exceeds the 16k aggregate cap **under those scenario assumptions**. This is neither the actual bill nor proof that every real d1 encoding violates the cap. Actual compatibility remains unresolved and not admitted until bounded. No eligibility, discount or per-question reinterpretation of the cap is assumed. Verified pricing and original endpoint capture bytes are unchanged.

## R2 — Clef host scope

The earlier broad “current hosted whole-title arm incompatible” conclusion is withdrawn. The 1–64-question cap and long-state truncation are verified for **Workers AI `@cf/cloudflare/clef-flash`**, where the illustrated 98-atomic-question stage cannot run in one request. [Workers AI schema](https://developers.cloudflare.com/workers-ai/models/clef-flash/)

OpenRouter Cloudflare's adapter mapping, question cap and truncation remain unverified. DeepInfra and PrimeIntellect also need their own question/truncation contracts. These routes are **not admitted, not proven incompatible**. Their distinct context/pricing observations remain unchanged. The report labels each surface separately and the route candidate records these unknowns explicitly. The Workers limit does not apply intrinsically to local Clef weights. No hidden splitting, packing or provider substitution is authorized. [OpenRouter route metadata](https://openrouter.ai/api/v1/models/cloudflare/clef-flash/endpoints)

## Representation qualification

The proposed eleven native integer categories plus explicit assessment states can use fourteen Choice options. Jev's at-most-ten-level probability-weighted Score does not directly implement **that document contract**. A separately designed coarse-Score projection is possible and would answer a different experimental question. Keeping exact precision for all 74 legacy traits is a compatibility constraint, not a fair universal test of the best native classifier representation. Failure of this adapter cannot establish that the architecture intrinsically cannot score. No new scale, mapping, rounding or arm is selected. This qualification is present in both prose conclusions and machine-readable candidate semantics. [Score](https://docs.typesafe.ai/primitives/score), [Choice](https://docs.typesafe.ai/primitives/choice)

## Changed assets and validation boundary

- `provider-contracts.md`: Corrected summary, per-host matrix, billing scenario, local/host distinction, shortlist, native-scale qualification and research/execution boundary.
- `route-candidates.json`: Added explicit Liquid accounting/scenario status, Clef surface-specific unknowns and Workers reference, proposed legacy compatibility semantics, and unanswered Q7–Q9 status.
- `proposed-resolution.md`: Mirrored the corrections and preserved conditional research readiness and pending publication scope.
- `sources.json`: Added two attributed primary-source observations from the supplied independent verification; earlier records retained.
- `provenance.json`, `checks.json`, `SHA256SUMS`: Recorded the correction inputs, historical evidence preservation and validation of the revised package.
- `corrections.md` and three historical/review receipts under `captures/`: Added this correction trail and preserved the original seal/checks plus independent verification.

Validation checks JSON, original capture hashes, registered endpoint hashes, candidate mappings, scenario arithmetic, explicit corrected semantics and whitespace, then refreshes the root seal. No actual schema rendering, paid compatibility, account inspection, inference, benchmarks or model downloads were performed. Those execution prerequisites do not block completion of this research decision. No commits, pushes, tracker writes or changes to other worktrees/publication branches occurred.
