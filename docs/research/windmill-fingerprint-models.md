# Windmill fingerprint model screening

Research date: 2026-09-11. Decision ticket: [Identify eligible low-cost models](https://github.com/alp82/goodwatch-monorepo/issues/29). This is a provisional POC shortlist, not a quality ranking or production selection. No inference requests, billing changes, or credential access were performed.

## Workload and screening decision

At repository commit `5a24c90cc26bc6329aa11058015a8393ff43c7b5`, [generation](../../goodwatch-flows/windmill/f/dna/generate/fetch.py) tries `gemini-2.5-flash`, then `gemini-3.6-flash`. Its prompt requires 74 integer scores in 0–10, highlights, tags, prose and other metadata; unknown titles should return `{"unknown": true}`. [The models](../../goodwatch-flows/windmill/f/dna/models.py) describe a larger `DNAAnalysis` response. [Embedding generation](../../goodwatch-flows/windmill/f/dna/generate/vectors.py) is a separate API stage. This screening concerns custom trait generation; its prices do not include embeddings.

Recommended provisional comparisons:

- Preserve both configured Gemini models as separate controls.
- Screen direct DeepSeek Flash and Z.AI GLM-4.7-Flash/FlashX for inexpensive generation and a genuinely advertised free model.
- Include OpenAI GPT-5.6 Luna provisionally, subject to confirmation that this is the intended “Luna.”
- Add Groq GPT-OSS 20B for inexpensive strict-schema output, and Gemini 3.1 Flash-Lite as a low-effort provider-preserving alternative.
- Hold “Muse” pending exact provider/version and verified API terms. Meta Muse Spark is a plausible identity, not an assumption about the user's intent.

These choices deliberately span billing and schema behavior. Provider benchmarks do not establish movie knowledge, trait calibration, or useful nearest neighbors.

## Price screen

USD per million **text** tokens, standard synchronous API route unless specified. “Cached” applies only to actual cache hits. Rates are public documentation observations, not verified account entitlements.

| Provider / exact request model | Uncached input | Cached input | Output | POC role |
| --- | ---: | ---: | ---: | --- |
| Google / `gemini-2.5-flash` | $0.30 | $0.03 | $2.50 | Current first-choice control |
| Google / `gemini-3.6-flash` | $0.75 | $0.075 | $3.75 | Current fallback control |
| Google / `gemini-3.1-flash-lite` | $0.25 | $0.025 | $1.50 | Cheaper same-provider candidate |
| DeepSeek / `deepseek-flash` | $0.15 off-peak; $0.30 peak | $0.003 off-peak; $0.006 peak | $0.60 off-peak; $1.20 peak | Direct low-cost challenger |
| Z.AI / `glm-4.7-flash` | Free | Free | Free | Free API candidate |
| Z.AI / `glm-4.7-flashx` | $0.07 | $0.01 | $0.40 | Inexpensive paid sibling |
| OpenAI / `gpt-5.6-luna` | $0.20 | $0.02 | $1.20 | Strict-schema candidate |
| Groq / `openai/gpt-oss-20b` | $0.075 | $0.0375* | $0.30 | Small strict-schema challenger |

Google rates: [live pricing](https://ai.google.dev/gemini-api/docs/pricing). Its 3.6 rates double on 2027-01-01. Cache storage additionally costs $1/M token-hours for 2.5 Flash and 3.1 Flash-Lite, $0.50 for 3.6 during the promotion ($1 afterward). Google output prices include thinking. All three list free-tier token usage separately from paid-tier rates; do not apply that as a free allowance on a paid project.

DeepSeek rates: [live model/pricing table](https://api-docs.deepseek.com/quick_start/pricing/). `deepseek-flash` currently resolves to DeepSeek-V4.1-Flash; old `deepseek-v4-flash` names are served by this replacement. Peak windows are weekdays 01:00–04:00 and 06:00–10:00 UTC. Its table lists 1M context, up to 384K output and 2,500 concurrent requests. Charges draw from granted or topped-up balance; this is not a standing free API tier. Old indexed V3 pricing is unsuitable for this comparison.

Z.AI rates: [live pricing](https://docs.z.ai/guides/overview/pricing). Cache storage is currently promotional free. The same page also lists newer GLM-5.3-Flash at $0.15 input/$0.03 cached/$0.50 output; retain it as a reserve pending model-specific capability confirmation rather than silently expanding the first experiment.

Luna rates and capabilities: [official model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Groq rates: [live model catalog](https://console.groq.com/docs/models). *Groq's cached price is calculated from its [documented 50% input discount](https://console.groq.com/docs/prompt-caching), which adds no storage charge. Old search summaries advertising cheap self-serve Llama 3.1 8B on Groq are stale: the live catalog now labels it Enterprise/Contact Sales. The chosen GPT-OSS route remains publicly priced.

## Output and access constraints

**Google.** Gemini supports a JSON Schema subset; schema-compliant output still requires semantic checks, and excessively complex schemas can be rejected. [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [3.6 capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), and [3.1 Flash-Lite capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) establish screening eligibility. Actual project limits must be read in AI Studio; request, token and daily limits are separate. Public free availability does not establish this account's quota. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

**DeepSeek.** Documented `response_format: {"type":"json_object"}` guarantees JSON syntax, not all 74 keys or their ranges. The prompt must mention JSON and include an example. Empty content is a documented possible failure. [JSON mode](https://api-docs.deepseek.com/guides/json_mode/). Thinking is enabled by default and can be disabled explicitly. [Thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/). Usage separates cache hits/misses and reports reasoning as a completion-token breakdown; price the entire completion and do not add the reasoning subset twice. [API usage fields](https://api-docs.deepseek.com/api/create-chat-completion/).

**Z.AI.** The [GLM-4.7 family page](https://docs.z.ai/guides/llm/glm-4.7) documents Flash/FlashX, text generation and JSON capability, with 200K context. The [API reference](https://docs.z.ai/api-reference/llm/chat-completion) exposes `json_object`; it does not establish strict JSON Schema enforcement. It exposes reasoning content and completion usage, but the reviewed public pages did not clearly establish a separate reasoning billing rule: reconcile total usage with the account bill before drawing cost conclusions. Account-specific concurrency applies even to a free-priced model. [Core parameters](https://docs.z.ai/guides/overview/concept-param). Use the general API account/key and endpoint described in [quick start](https://docs.z.ai/guides/overview/quick-start); the [Coding Plan policy](https://docs.z.ai/devpack/usage-policy) limits subscriptions to supported coding products and does not authorize arbitrary Windmill SDK calls.

**Luna.** The official model page documents structured outputs, a 1,050,000-token context and 128,000 maximum output; reasoning effort supports `none` through `max`, defaulting to `medium`. Free API tier is unsupported; Tier 1 lists 500 RPM/500K TPM. Larger prompts above 272K have higher prices, outside the intended small benchmark. [Model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Invisible reasoning is billed as output and consumes the output budget. [Reasoning accounting](https://developers.openai.com/api/docs/guides/reasoning). A ChatGPT/Codex subscription should not be entered as a per-token API credit in the experiment ledger.

**Groq GPT-OSS 20B.** Supports strict JSON Schema using `strict: true`; all fields must be required and objects set `additionalProperties: false`. Structured output currently excludes streaming/tool use. [Schema guide](https://console.groq.com/docs/structured-outputs). Context is 131,072; maximum completion is 65,536. [Catalog](https://console.groq.com/docs/models). Published free-plan limits are 30 RPM, 1,000 RPD, 8K TPM and 200K TPD; actual account limits remain authoritative. [Rate limits](https://console.groq.com/docs/rate-limits). Reasoning effort can vary independently of how reasoning is displayed; measure the complete usage response, not visible JSON length. A separate reasoning price was not established by the reviewed [reasoning guide](https://console.groq.com/docs/reasoning), so retain billing reconciliation as a POC check.

## Names that still need confirmation

“Luna” has an exact general-purpose API candidate in OpenAI's documented `gpt-5.6-luna`, but the user has not confirmed that identity. “Muse” could mean Meta Muse Spark, Muse-AI, or another product. Meta's [Muse Spark page](https://developer.meta.com/ai/models/muse-spark/) returned a page titled “Muse Spark 1.3” to a direct public fetch, but only a client-rendered shell; browser retrieval of model/pricing details failed. That establishes a plausible product name, not verified API model ID, pricing, schema support, access region or Contributor terms. Do not copy secondary pricing claims into the cost comparison. [Muse-AI's pricing page](https://muse-ai.io/pricing/) describes an agent/credit product, not enough evidence for a fixed fingerprint model route.

The protocol session should confirm the intended Muse and Luna products. If Muse means Meta, capture the exact endpoint/model ID, standard versus Contributor tier, input/cache/output/reasoning prices, schema mode and account limits from its official console/docs before admitting it. This missing candidate evidence does not prevent comparing the documented shortlist.

## Handoff to the protocol decision

[Choose the POC comparison protocol](https://github.com/alp82/goodwatch-monorepo/issues/31) should settle the final bounded candidate set and spending ceiling. Suggested evaluation requirements, still subject to that decision:

- Freeze the same title identities, source facts, 74-key glossary, score bounds and unknown-title policy across providers. Resolve whether the test requests scores alone or the full production response; costs must correspond to the same output contract.
- Validate exact keys, integer types/ranges, item-to-title alignment and cross-field consistency locally for every provider. Required integer fields alone do not express 0–10 bounds; strict JSON also cannot certify that a trait is true.
- Distinguish provider/schema transport failures, abstentions, wrong-title knowledge and valid-but-poor scores. Unknown-title output must be represented in the schema without forcing a fabricated fingerprint.
- Freeze explicit thinking settings, output limits and retry caps; report both first-attempt and eventual success. Record requested/resolved model, route/tier, timestamp, input/cache/output/reasoning usage, latency, retries and billed cost per accepted fingerprint. Separate embedding cost.
- Judge trait quality and similarity behavior on the agreed movies/shows with human feedback. A cheap rate or well-formed response is not evidence that custom vectors are useful.

No winner is selected and no production rollout decision is implied.
