# Fingerprint comparison protocol

Status: approved by the owner on September 12, 2026. Canonical decision: [Choose the POC comparison protocol](https://github.com/alp82/goodwatch-monorepo/issues/31). This asset specifies the agreed experiment; the resolution is recorded in that issue. No inference was performed during planning.

## Agreed constraints

Use full production responses, the frozen ten-title corpus, and independent human/Astra/Fable review. Gemini is a candidate, not ground truth. Run all ten titles for each admitted candidate, then all ten again for the strongest two under unchanged settings. The human decides advancement and the final trade-off after independent review. Target US$5; never exceed US$10 across inference, retries, paid judging if separately approved, and embeddings.

The owner approved thirteen candidates, pinned third-party hosts and disclosed quantization, a small JSON-only comparison, and Muse Contributor's disclosed data-use condition in the [selection-policy discussion](https://github.com/alp82/goodwatch-monorepo/issues/31#issuecomment-5643145155). Judges will run manually through existing Codex and Claude Code subscriptions. No paid judge API calls are planned.

## Approved exact lineup

The thirteen candidates include the two configured Gemini controls, a JSON-only Qwen comparison, Muse Contributor, and Grok 4.6 as an additional model family. Each row is a model/provider/output/thinking configuration; provider transport and precision are part of the result.

| OpenRouter model ID | Pinned provider tag | Output mode | Requested thinking mode |
|---|---|---|---|
| `google/gemini-2.5-flash` | `google-ai-studio` | Strict schema | Off, using the documented Gemini budget control |
| `google/gemini-3.6-flash` | `google-ai-studio` | Strict schema | Minimal |
| `deepseek/deepseek-v4.1-flash` | `deepinfra/fp8` | Strict schema | Disabled |
| `z-ai/glm-5.3-flash` | `deepinfra/fp4` | Strict schema | Low; mandatory thinking |
| `openai/gpt-5.6-luna` | `openai` | Strict schema | None |
| `meta/muse-spark-1.3-contributor` | `meta` | Strict schema | Minimal; mandatory thinking |
| `qwen/qwen3.8-flash` | `alibaba` | Strict schema | Request disabled; verify adapter |
| `qwen/qwen3.7-flash` | `alibaba` | JSON object, locally validated | Request disabled; verify adapter |
| `mistralai/mistral-small-2603` | `mistral` | Strict schema | None |
| `minimax/minimax-m3` | `coreweave/fp4` | Strict schema | Request disabled; verify adapter |
| `xiaomi/mimo-v2.5` | `deepinfra/fp8` | Strict schema | Request disabled; verify adapter |
| `nvidia/nemotron-3.5-lightning` | `deepinfra/bf16` | Strict schema | Request disabled; verify adapter |
| `x-ai/grok-4.6` | `xai` | Strict schema | Low; mandatory thinking |

The [research report](../../research/openrouter-fingerprint-candidates.md), [route matrix](../../research/openrouter-fingerprint-candidates.csv), and [endpoint evidence](../../research/openrouter-fingerprint-evidence.json) establish advertised routes and capabilities. Research proposals remain historical evidence; this protocol's thirteen-row table is the approved run lineup. Larger GLM 5.3, latest Gemini 3.8, cheap Gemini Flash Lite, and Composer are not admitted merely because they were researched. Any additional arm requires a distinct follow-up decision.

Use standard synchronous service tiers. Pin the full endpoint tag with an allowlist and disabled fallbacks; do not use floating model aliases, automatic routers, model substitution, or unrecorded service-tier changes. Request parameter support explicitly. No browsing, plugins, response healing, tools, or extra title evidence.

## Prompt, schema, and inputs

Use the title identities, original-title/year/type/overview metadata, trait definitions, full production schema, and manifest from [the frozen benchmark commit](https://github.com/alp82/goodwatch-monorepo/tree/3b3248f712146f22c4d0d644c40cf2aee9d13992/docs/benchmarks/fingerprint). Preserve its source bytes and hashes. Freeze the evaluation date to September 12, 2026 and judge the series material released by that date, consistent with the agreed overall-series identity. No live metadata refresh during the comparison.

Make one versioned, shared transport adaptation to the prompt: submit one title per request and return an object of the form `{"results":[{"benchmark_id":"movie:603","analysis":{...}}]}`. `analysis` preserves the full production fields. The ID is copied from the frozen type/TMDB identity; the envelope explicitly separates association metadata from the analysis. The transport adaptation fixes the existing array-input/object-repair ambiguity without changing trait definitions or supplying extra semantic evidence. Record the exact adapted prompt and schema hashes before the first request.

Every candidate receives identical rendered title metadata, definitions, and schema instructions. Strict-capable rows additionally receive that schema through the structured-output parameter. Qwen3.7 receives JSON-object mode and the same schema instructions in the prompt. This evaluates usable deployment configurations, not an isolated causal comparison of model weights or output modes.

Local validation requires exactly one result for the expected benchmark ID; all 74 exact score keys; integer values excluding booleans and numeric strings; each score in 0–10; all production fields with their specified types/enums; and no unexpected fields. Enforce four to eight unique highlight keys drawn from the score keys, eight to ten string tags, and documented conditional production fields. Treat the intended four-to-five-sentence essence description and semantic consistency of advisories/highlights as separately recorded content checks rather than relying on a brittle sentence-count heuristic. A structural pass is never a factual-quality verdict.

An unknown/abstaining answer is recorded as failure to supply the agreed complete response. Do not fabricate defaults, replace nulls with zero, clamp values, coerce strings, reorder a wrong title silently, or omit required fields to make a response pass. Preserve the raw response even when local parsing fails.

## Generation settings and compatibility

Optimize this first comparison for inexpensive generation: disable optional thinking where supported, use the lowest listed level for mandatory-thinking rows, and preserve those settings for repeat runs. This tests cheap configurations; it does not establish each model's maximum possible quality. A later higher-thinking arm must be separately identified and justified by observed failures.

Leave temperature, top_p, top_k, penalties, and model seed omitted for every candidate, using provider defaults; preserve these request omissions across both passes. Record documented server defaults and returned version metadata where available. Do not impose a universal temperature on models that do not expose it or claim the defaults imply identical randomness across architectures. A fixed experiment seed controls request order and blind labels, not provider determinism. An observed provider-version/default change between passes makes the comparison qualified rather than silently reproducible.

Use a per-attempt ceiling of 8,192 total completion tokens, including reasoning where the provider counts it within completion. Use the currently documented OpenRouter completion-cap field and verify its mapping with the selected route. The cap is not an extra 8,192 visible tokens on top of unrestricted thinking. Do not increase it after seeing a candidate fail.

Documented requested reasoning fragments are `reasoning.effort: none` for Luna/Mistral, `minimal` for Gemini3.6/Muse, `low` for GLM/Grok, and `reasoning.enabled: false` for optional-thinking rows without a none effort. Gemini2.5's zero thinking budget must be verified with its adapter. Native off-mode support or catalog optional-thinking flags do not establish that a particular reseller honors the gateway request. Do not label thinking as confirmed off solely because no reasoning text is returned.

Before inference, inspect current public routes, price overrides, schema-support metadata, and credential/account restrictions. The first title request for each configuration is its bounded compatibility attempt and counts toward the first pass, rather than an extra unaccounted pilot. Validate acceptance, output-cap handling, returned model/provider, and usage. A documented equivalent transport correction can be made within the same attempt budget and must be logged; changing effort, model, host, schema meaning, or token cap is a different configuration and must return to the protocol decision.

If the requested route/configuration is not executable after the allowed attempts, stop that candidate and mark remaining titles not attempted. Report attempted and expected-ten coverage explicitly. Do not silently admit a different endpoint or claim all ten failed generations occurred. The report must distinguish a model-quality failure from a transport/access incompatibility.

## Attempts, order, and stop rules

One title per request, one request in flight, non-streaming capture. Use a fixed seeded shuffle of the 130 candidate/title pairs, preserving the same frozen inputs. Run repeat requests only after independent first-pass review and the human's selection of two finalists; repeat the same configurations with a separately recorded request-order seed.

Allow at most two attempts per candidate/title/pass: the initial request and one retry. Disable implicit SDK, gateway-configured, and outer job retries wherever controllable; any provider retry discovered in metadata remains part of reported cost. Explicitly classify 429/5xx/network failures, truncation, malformed JSON, range/schema/association errors, abstention, and factual-quality concerns.

The one retry may recover a transient error or make a constrained structural repair using the same title data and definitions. A repair includes the original response and only machine-detected validation errors; cap its input as well as output in the reservation. Do not feed judge feedback into repairs or retry a valid response because its scores seem wrong. Abstentions and semantic disagreement do not receive a quality-improvement retry. Store first-attempt validity and after-repair validity separately; raw and repaired responses remain available to reviewers.

Record stop/incomplete status on auth errors, insufficient credit, unresolved account restrictions, an incompatible cap, unexplained cost above the reservation, or exhaustion of budget. Do not proceed with uncertain unbounded charges. A timed-out call may have incurred a charge; reconcile its generation ID/account activity or reserve its maximum plausible charge before another attempt.

## Budget and cost measurement

The selected-route illustration is approximately $0.97 for first pass plus ten-title repeats of the two most expensive selected candidates at 6K input/2K billed output per title, or $3.01 at 12K/8K. These are arithmetic for this lineup, with conservative Luna automatic cache writes. They exclude retries, embeddings, fee changes, and unforeseen charges; neither is a guaranteed upper bound. The GLM Flash route's current discount must not be assumed permanent.

Grok 4.6 uses the standard `xai` route at $2 input/$6 output per million tokens below the long-context threshold. Its first-pass illustration is $0.24 or $0.72 under the two scenarios. Updated totals including the illustrative two finalist repeats are $0.9694 and $3.01384; actual finalists still follow human review. The [Grok route snapshot](grok-route-evidence.json) preserves advertised schema/reasoning support, prices, and overrides. The $5 target and $10 ceiling apply to all thirteen candidates together.

Keep an experiment ledger in USD. Reserve every request before launch using a conservative provider-specific input estimate, the total output cap, applicable cache-write premiums, worst applicable price overrides, any request charges, and unresolved preceding charges. Only start when the entire reserved amount fits the remaining allowance. Actual usage replaces the reservation after reconciliation. Missing usage does not mean zero cost. Include provider-side bills if any BYOK configuration is present.

Use an experiment-isolated OpenRouter key with a non-resetting cap of at most $9 in inference credits, or an equivalently enforceable remaining allowance, leaving at least $1 for separately billed stages and charge uncertainty. Do not change an unrelated shared key's allowance. Inspect or establish the isolated cap at the execution step using available authorized account access. If no enforceable cap or sufficiently conservative reservation is available, stop before paid work rather than treating an estimate as protection of the hard ceiling. New credit-purchase fees, if needed, are recorded and reduce the available cash budget.

The $5 target is the normal operating target; reserve remaining paid work and stop adding optional attempts when projected spend approaches it. The already agreed $10 ceiling is absolute and may be used for the agreed runs/retries only. No new models, thinking variants, paid judge calls, or production work can consume the buffer under this protocol.

Save per-attempt request/generation IDs, actual serving provider/model/tier, prompt/completion/reasoning/cache counts, actual account-charged cost, elapsed wall time, finish/error codes, and response headers useful for tracing without secrets. Reconcile usage cost against generation metadata/activity. Report measured charges separately from rate-derived estimates; retain discrepancies rather than forcing agreement. Report median and p95 observed request latency with sample counts, plus complete two-attempt time per usable title; ten titles is a small latency sample.

Report first-attempt validity, after-repair validity, attempted/expected coverage, unknown-title rate, quality flags/verdicts, consistency of repeated scores, and cost per attempted, structurally valid, and human-accepted title. Include all failed attempts in costs. Show repeat-score differences without inventing a numerical rejection threshold.

## Independent review and embeddings

Use blind per-title packets, shuffled candidate labels, identical attribute definitions, and the same frozen metadata for the human, Astra, and Fable. Store the model-label key separately. Hide cost, provider, candidate identity, and other reviewers' verdicts until all initial reviews are recorded. Each reviewer flags implausible traits, explains the concern, and supplies the already agreed overall verdict. Review full-response plausibility as supporting evidence while retaining the 74 traits as the benchmark's primary quality target.

Run Astra and Fable in separate fresh subscription-authenticated Codex and Claude Code sessions. Record their actual model IDs and effort settings. If the agreed models are unavailable, pause that reviewer instead of silently substituting a different judge. The human resolves disagreement and chooses finalists; no majority vote or matching-Gemini score replaces that decision.

Embedding scope: after selecting the strongest two candidates, embed their valid first-pass essence descriptions using the existing `gemini-embedding-2` stage, with its deployed settings recorded before calls. That is at most twenty inputs, not an embedding call for every candidate response or retry. Reserve the separately billed amount before these calls, use at most one attempt per input, and record failures and costs independently. Do not persist the results into production indexes. This small sample measures embedding-stage expense; embedding similarity/ranking is not part of this benchmark. If there is insufficient budget or access, report this stage as unmeasured with a separately labeled current-rate estimate rather than borrowing from the hard ceiling.

## Reproducible output and handoff

The subsequent [Compare candidate fingerprints](https://github.com/alp82/goodwatch-monorepo/issues/32) session creates and runs the bounded POC. Save a run manifest, immutable input/prompt/schema hashes, exact per-model configurations and provider snapshots, raw requests/responses with credentials removed, attempt and cost ledgers, validator outputs, blind review packets, independent verdicts, and repeat comparisons. Publish non-secret assets on a separate POC branch linked from that ticket. Every failed or incomplete arm remains visible.

This planning ticket does not run inference, alter the production provider, write catalog fingerprints, backfill data, or select the final strategy. Execution and human evaluation remain the next ticket's work.

## Assessment of external critique

The owner confirmed the lineup, cost-oriented generation settings, and finalist embedding sample, then requested an assessment of another model's critique. The [primary-source fact-check](https://github.com/alp82/goodwatch-monorepo/blob/e92a86b/docs/research/fingerprint-critique-fact-check.md) confirms meaningful calibration concerns and identifies inaccurate identities/configurations and overgeneralized statistics. It does not establish a reason to replace this approved pilot.

Retain separate structural and semantic judgments. Reviewers should flag unsupported plot or series claims that could distort the 74 traits. Cheap reasoning settings are a cost/quality experiment, not a proven hallucination treatment. The ten familiar titles do not establish catalog-wide accuracy; Haiku, Solar Pro 4, plain Ling, latest Gemini, larger holdouts, or richer shared grounding remain possible follow-up hypotheses rather than unapproved new arms.

## Technical references

- [Grok pricing](https://docs.x.ai/developers/pricing), [reasoning controls](https://docs.x.ai/developers/model-capabilities/text/reasoning), and [selected route evidence](grok-route-evidence.json): standard xAI deployment and low reasoning.

- [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection): exact endpoint selection, parameter support and fallbacks.
- [OpenRouter reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens): effort, disabled reasoning, billing and model differences.
- [OpenRouter Chat API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion): completion-cap fields; verify adapter naming against endpoint metadata.
- [DeepInfra reasoning](https://docs.deepinfra.com/chat/reasoning): reasoning enable/disable mappings.
- [Qwen latest-model guide](https://docs.qwencloud.com/developer-guides/getting-started/latest-model): native thinking controls.
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs): supported schema transport.
- [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting) and [prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching): cost categories and actual usage.

These references and the linked research distinguish documented capability from behavior that must still be observed during the budgeted run.
