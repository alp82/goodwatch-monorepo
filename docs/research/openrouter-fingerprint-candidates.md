# OpenRouter candidates for Windmill fingerprinting

## Decision summary

OpenRouter offers enough inexpensive, distinct model families to justify a broad controlled comparison. A sensible starting proposal is twelve candidates: the two configured Gemini models, two DeepSeek Flash generations, GLM 5.3 Flash, GPT-5.6 Luna, Muse Spark 1.3, Qwen3.8 Flash, Mistral Small 4, MiniMax M3, MiMo V2.5, and Nemotron 3.5 Lightning. This is a proposal for discussion, not an approved shortlist or a finding that these models produce good fingerprints.

The strongest research finding is that **a candidate must identify its model, provider, service tier, quantization where disclosed, and reasoning settings**. A model's catalog price and combined capability flags are insufficient. Several official routes advertise JSON formatting while third-party hosts advertise strict structured output. Different versions of the same family also have different reasoning requirements and rates.

Three choices should precede the final lineup: how much review breadth is worthwhile, whether to admit third-party hosts and JSON-only routes, and whether Meta's Contributor terms are acceptable. The research supports a low-cost trial; it cannot decide the preferred trade-off between factual coverage, plausible trait scores, reliability, and price.

The twelve-candidate illustration costs about **$0.80 including ten-title repeats for the two most expensive candidates**, under an assumed 6,000 input and 2,000 total billed output tokens per title. A larger-token illustration is about $2.53. These are arithmetic scenarios, not measured costs, forecasts, or spending authorization. Actual reasoning, retries, cache writes, service tiers, and failures can materially change them. The agreed $5 target and $10 ceiling remain authoritative.

## Scope and evidence

Public evidence was retrieved on September 12, 2026. The catalog contained 445 entries; 38 relevant model options received endpoint inspection, supplemented by vendor documentation and model cards. This is a purposeful landscape screen rather than an evaluation of every catalog entry. It covers requested names, newer inexpensive general-purpose families, older price controls, and several more expensive comparison options. Specialized image/audio generation, safety classifiers, coding-only variants without a distinct hypothesis, and floating routers are not useful default additions to this task.

The [comparison spreadsheet](openrouter-fingerprint-candidates.csv) records exact selected routes, prices, cache fields, context/output limits, capability flags, catalog cutoffs, reasoning metadata, and cost calculations. The [public evidence snapshot](openrouter-fingerprint-evidence.json) preserves relevant catalog fields and every checked endpoint with its source URL and retrieval time. A listing means advertised availability; account entitlement, available balance, schema acceptance, and successful generation remain untested. No inference was performed.

This research supports [Choose the POC comparison protocol](https://github.com/alp82/goodwatch-monorepo/issues/31), within [Optimize Windmill fingerprint quality and cost](https://github.com/alp82/goodwatch-monorepo/issues/27). The fixed ten-title corpus, independent human/Astra/Fable review, and repeat-run policy were settled in [Define the benchmark and quality bar](https://github.com/alp82/goodwatch-monorepo/issues/30#issuecomment-5643029338). The [subsequent protocol discussion](https://github.com/alp82/goodwatch-monorepo/issues/31#issuecomment-5643079805) confirms full production responses and manual judging through existing Codex and Claude Code subscriptions.

## What is being compared

A fingerprint comprises 74 named integer trait scores in the range 0–10. The generation response also includes four to eight ordered highlight keys, anime and production information, content advisories, eleven social-suitability booleans, six viewing-context booleans, eight to ten essence tags, and a four-to-five-sentence essence description. The separate embedding stage consumes essence text; constructing the score vector itself is local. Generating only scores would change both the task and its cost.

The [frozen benchmark assets](https://github.com/alp82/goodwatch-monorepo/tree/3b3248f712146f22c4d0d644c40cf2aee9d13992/docs/benchmarks/fingerprint) preserve the full production contract. The system prompt contains 15,632 characters; character length is not a model-native token count. A schema supplied separately may add substantial input. The ten inputs combine original title, year, media type, and overview. Shows are judged by their overall series identity under the agreed scope.

The corpus includes recent and potentially less well-covered titles, particularly *Das Kanu des Manitu* and *Adolescence*. An overview can establish a premise without establishing acting quality, cinematography, pacing, or the full tonal profile. A fluent response may therefore be a plausible guess. That is a central quality risk the benchmark should expose, rather than conceal with model-generated reference scores.

The current [generation code](https://github.com/alp82/goodwatch-monorepo/blob/5a24c90/goodwatch-flows/windmill/f/dna/generate/fetch.py) uses five titles per request and JSON MIME formatting, with Gemini 2.5 Flash followed by Gemini 3.6 Flash as fallback. It has model attempts and an outer flow retry. It does not explicitly fix temperature, thinking budget, output limit, or seed. Existing validation does not fully enforce the 74 integer ranges, and unknown-title and repair instructions do not consistently match the parser contract. Consequently, running the benchmark through an unchanged production retry/fallback path would blur candidate identity and failure costs. Those are experiment-design issues, not authorization for production changes.

## Proposed twelve-candidate starting set

The following routes are concrete discussion candidates. They are not uniformly the cheapest listed host: standard service tiers, an official route where suitable, and disclosed precision are preferable starting evidence to automatically selecting an obscure price minimum. “Schema flag” means the endpoint advertises `structured_outputs`; successful compilation of this full schema has not been tested.

Prices are USD per million text tokens. The last column assumes ten independent titles, each with 6,000 input and 2,000 **total billed output** tokens. For Luna, all input is conservatively priced at its automatic cache-write rate of $0.25/M. Other rows assume uncached input, no explicit cache writes, no tools, no retries, and the named route's current listed rates, including any current discount. No flex or batch discount is assumed for the proposed twelve. Sources for each row are the linked first-party endpoint APIs.

| Model / endpoint evidence | Selected route | Input $/M | Output $/M | Schema flag | Ten-title illustration |
|---|---|---:|---:|---|---:|
| [google/gemini-2.5-flash](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints) | `google-ai-studio` | 0.3 | 2.5 | Yes | $0.0680 |
| [google/gemini-3.6-flash](https://openrouter.ai/api/v1/models/google/gemini-3.6-flash/endpoints) | `google-ai-studio` | 0.75 | 3.75 | Yes | $0.1200 |
| [deepseek/deepseek-v4.1-flash](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints) | `deepinfra/fp8` | 0.2 | 0.6 | Yes | $0.0240 |
| [deepseek/deepseek-v4-flash-0731](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-flash-0731/endpoints) | `deepinfra/fp8` | 0.06 | 0.18 | Yes | $0.0072 |
| [z-ai/glm-5.3-flash](https://openrouter.ai/api/v1/models/z-ai/glm-5.3-flash/endpoints) | `deepinfra/fp4` | 0.075 | 0.25 | Yes | $0.0095 |
| [openai/gpt-5.6-luna](https://openrouter.ai/api/v1/models/openai/gpt-5.6-luna/endpoints) | `openai` | 0.2 | 1.2 | Yes | $0.0390 |
| [meta/muse-spark-1.3](https://openrouter.ai/api/v1/models/meta/muse-spark-1.3/endpoints) | `meta` | 1.25 | 4.25 | Yes | $0.1600 |
| [qwen/qwen3.8-flash](https://openrouter.ai/api/v1/models/qwen/qwen3.8-flash/endpoints) | `alibaba` | 0.15 | 0.47 | Yes | $0.0184 |
| [mistralai/mistral-small-2603](https://openrouter.ai/api/v1/models/mistralai/mistral-small-2603/endpoints) | `mistral` | 0.15 | 0.6 | Yes | $0.0210 |
| [minimax/minimax-m3](https://openrouter.ai/api/v1/models/minimax/minimax-m3/endpoints) | `coreweave/fp4` | 0.23 | 0.96 | Yes | $0.0330 |
| [xiaomi/mimo-v2.5](https://openrouter.ai/api/v1/models/xiaomi/mimo-v2.5/endpoints) | `deepinfra/fp8` | 0.133 | 0.266 | Yes | $0.0133 |
| [nvidia/nemotron-3.5-lightning](https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-lightning/endpoints) | `deepinfra/bf16` | 0.08 | 0.2 | Yes | $0.0088 |

The two Gemini controls answer how alternatives compare with configured model identities; they do not reproduce the exact deployed transport and defaults unless the protocol deliberately preserves those settings. Neither is ground truth. Keeping both costs little in this small experiment and helps explain whether an improvement comes from a different family or simply replacing the older primary model.

Two DeepSeek versions are proposed because “DeepSeek 4 Flash” now covers materially different releases and prices. If review time is tight, keep V4.1 first and move the July release to an optional cost-floor comparison. Other adjacent versions should earn a slot through a specific question, rather than through recency alone.

Muse standard is included in the arithmetic so the cost proposal does not assume acceptance of Contributor terms. If the Contributor offering is accepted, its distinct ID and terms must be recorded. It should not automatically receive a second quality-review slot merely because its commercial terms differ. Output equivalence between the offerings has not been established; any comparison result applies to the offering actually tested.

## Requested families in detail

### DeepSeek Flash

The requested family is available as `deepseek/deepseek-v4-flash`, `deepseek/deepseek-v4-flash-0731`, and `deepseek/deepseek-v4.1-flash`. Direct DeepSeek currently uses `deepseek-flash`, and its documentation says legacy names now redirect to V4.1. A direct legacy name therefore must not be assumed to identify the same release as a similarly named OpenRouter slug.[^deepseek-pricing]

The direct V4.1 route shows $0.15/$0.60 input/output off-peak and $0.30/$1.20 during its documented weekday peak windows. Its official route advertises JSON formatting but not the strict-schema flag. DeepInfra FP8 advertises strict output at $0.20/$0.60. For the July release, DeepInfra FP8 is $0.06/$0.18; another inspected FP8 host is $0.05/$0.16. The endpoint snapshots preserve these differences. They are deployment options, not evidence that any host is equally accurate or reliable.

DeepSeek's V4.1 model card includes factual-question and general-knowledge evaluations, a more relevant signal than coding alone. However, some numbers describe base models, while instruct evaluations use high-compute settings. No result measures these 74 scores, this title corpus, or quality at the proposed cheap inference settings.[^deepseek-card] A low or disabled reasoning arm is a hypothesis to test where supported, not a guaranteed free improvement.

### Muse Spark

Meta's current researched release is Muse Spark 1.3. Its release material emphasizes instruction following, awareness of limitations, and complex work; its evaluation methodology spans professional tasks, research, and automation. These remain vendor-reported general capabilities.[^meta-release][^meta-evals]

Both `meta/muse-spark-1.3` and `meta/muse-spark-1.3-contributor` have a listed Meta endpoint and advertise schema support. Standard input/output prices are $1.25/$4.25; Contributor is $0.10/$0.20. The Contributor listing explicitly permits prompts and outputs to improve Meta products. This materially changes the interpretation of the low price.[^meta-contributor]

The frozen benchmark uses catalog metadata rather than private watch history, but acceptance of the Contributor condition is still a real selection choice. Complete direct-vendor terms and direct API identifiers were not established because the linked developer portal could not be retrieved. Exact OpenRouter IDs are established. Before using Contributor, review the offering's then-current terms rather than inferring them from its name. Standard Muse remains affordable for this small comparison.

### GPT Luna and Composer

Official OpenAI documentation verifies `gpt-5.6-luna`: a cost-sensitive model with a February 16, 2026 knowledge cutoff, structured output, 1.05M context, and 128K maximum output. Its standard input/output rate is $0.20/$1.20. It defaults to medium reasoning and supports an explicit none setting. Long-context surcharges begin far above this benchmark's expected input size.[^luna]

The concrete OpenRouter ID is `openai/gpt-5.6-luna`. Its standard `openai` route advertises schema support, while an inspected Bedrock route does not. Flex and fast are distinct service tiers, at $0.10/$0.60 and $0.40/$2.40 respectively. The floating `~openai/gpt-luna-latest` alias is unsuitable as the sole recorded experiment identity. Luna Pro is a deeper-reasoning variant rather than an independently justified cheap baseline. Standard Luna is the clearest initial comparison.

OpenAI Docs and OpenRouter's caching documentation establish an easily missed cost: GPT-5.6 can incur cache-write pricing at 1.25 times ordinary input even with automatic caching. “No explicit cache configured” does not mean “no write premium.” The cost illustration accounts conservatively for that.[^luna][^or-cache]

Composer is not an unresolved model name. Cursor's current Composer 2.5 offering has standard $0.50/$2.50 token rates and is available through Cursor products, including its SDK. The SDK provides programmatic agents using Cursor credentials. **No Composer entry was present in the public OpenRouter catalog.** Excluding it from a common OpenRouter test is a transport/scope recommendation, not a claim that Composer has no API or cannot perform the task.[^composer][^cursor-sdk]

### GLM

`z-ai/glm-5.3` and `z-ai/glm-5.3-flash` are distinct, verified options. Official rates are $1.40/$4.40 and $0.15/$0.50. Both require reasoning, with low/high/max efforts and max as the documented default. A universal “turn thinking off” protocol would not fit them.[^zai-pricing][^glm][^glm-flash]

The official Z.ai endpoints advertise JSON formatting without the strict-schema flag. Several third-party routes advertise strict output. For Flash, the selected DeepInfra FP4 route is currently discounted to $0.075/$0.25 (the snapshot reports `discount: 0.5`); Morph FP8 is $0.10/$0.35. Do not extrapolate the discounted rate as permanent production pricing. The lower precision is part of the candidate identity. GLM 5.3 on DigitalOcean is $0.95/$3.40 in the preserved snapshot. The larger GLM is an optional quality probe, not an assumed winner over Flash.

GLM 4.7 Flash remains a useful older cheap comparison, but its direct free offering does not imply free OpenRouter use. FlashX is a separate direct product and was absent from the public OpenRouter catalog.[^zai-pricing] The earlier shortlist's focus on 4.7 therefore misses a newly relevant modern Flash option.

## Wider landscape and reasons to include or defer

The following 26 options received endpoint inspection in addition to the proposed twelve. The same price and cost assumptions apply. Some rows intentionally demonstrate expensive alternatives or missing schema flags. A concrete selected route makes the table auditable; it is not approval to use that route.

| Model / endpoint evidence | Selected route | Input $/M | Output $/M | Schema flag | Ten-title illustration |
|---|---|---:|---:|---|---:|
| [openai/gpt-oss-20b](https://openrouter.ai/api/v1/models/openai/gpt-oss-20b/endpoints) | `darkbloom/fp8` | 0.02 | 0.1 | Yes | $0.0032 |
| [qwen/qwen3.7-flash](https://openrouter.ai/api/v1/models/qwen/qwen3.7-flash/endpoints) | `alibaba` | 0.03 | 0.13 | Not advertised | $0.0044 |
| [amazon/nova-micro-v1](https://openrouter.ai/api/v1/models/amazon/nova-micro-v1/endpoints) | `amazon-bedrock/eu-west-1` | 0.035 | 0.14 | Not advertised | $0.0049 |
| [openai/gpt-oss-120b](https://openrouter.ai/api/v1/models/openai/gpt-oss-120b/endpoints) | `akashml/bf16` | 0.03 | 0.17 | Yes | $0.0052 |
| [cohere/command-r7b-12-2024](https://openrouter.ai/api/v1/models/cohere/command-r7b-12-2024/endpoints) | `cohere` | 0.0375 | 0.15 | Yes | $0.0053 |
| [inclusionai/ling-3.0-flash-vl](https://openrouter.ai/api/v1/models/inclusionai/ling-3.0-flash-vl/endpoints) | `deepinfra/fp16` | 0.06 | 0.18 | Yes | $0.0072 |
| [deepseek/deepseek-v4-flash](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-flash/endpoints) | `deepinfra/fp8` | 0.09 | 0.18 | Yes | $0.0090 |
| [meta/muse-spark-1.3-contributor](https://openrouter.ai/api/v1/models/meta/muse-spark-1.3-contributor/endpoints) | `meta` | 0.1 | 0.2 | Yes | $0.0100 |
| [z-ai/glm-4.7-flash](https://openrouter.ai/api/v1/models/z-ai/glm-4.7-flash/endpoints) | `cloudflare` | 0.0605 | 0.4 | Yes | $0.0116 |
| [google/gemma-4-31b-it](https://openrouter.ai/api/v1/models/google/gemma-4-31b-it/endpoints) | `deepinfra/turbo` | 0.09 | 0.34 | Yes | $0.0122 |
| [google/gemini-2.5-flash-lite](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-lite/endpoints) | `google-ai-studio` | 0.1 | 0.4 | Yes | $0.0140 |
| [openai/gpt-5.4-nano](https://openrouter.ai/api/v1/models/openai/gpt-5.4-nano/endpoints) | `openai` | 0.2 | 1.25 | Yes | $0.0370 |
| [openai/gpt-5.6-luna-pro](https://openrouter.ai/api/v1/models/openai/gpt-5.6-luna-pro/endpoints) | `openai` | 0.2 | 1.2 | Yes | $0.0390 |
| [qwen/qwen3.7-plus](https://openrouter.ai/api/v1/models/qwen/qwen3.7-plus/endpoints) | `alibaba` | 0.32 | 1.28 | Yes | $0.0448 |
| [mistralai/mistral-large-2512](https://openrouter.ai/api/v1/models/mistralai/mistral-large-2512/endpoints) | `mistral` | 0.5 | 1.5 | Yes | $0.0600 |
| [google/gemini-3.5-flash-lite](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints) | `google-ai-studio` | 0.3 | 2.5 | Yes | $0.0680 |
| [deepseek/deepseek-v4-pro-0813](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4-pro-0813/endpoints) | `baidu/fp8` | 0.57816 | 1.73448 | Yes | $0.0694 |
| [moonshotai/kimi-k2.5](https://openrouter.ai/api/v1/models/moonshotai/kimi-k2.5/endpoints) | `siliconflow/int4` | 0.45 | 2.25 | Yes | $0.0720 |
| [google/gemini-3.8-flash](https://openrouter.ai/api/v1/models/google/gemini-3.8-flash/endpoints) | `google-ai-studio` | 0.75 | 3.75 | Yes | $0.1200 |
| [z-ai/glm-5.3](https://openrouter.ai/api/v1/models/z-ai/glm-5.3/endpoints) | `digitalocean` | 0.95 | 3.4 | Yes | $0.1250 |
| [x-ai/grok-4.3](https://openrouter.ai/api/v1/models/x-ai/grok-4.3/endpoints) | `xai/zdr` | 1.25 | 2.5 | Yes | $0.1250 |
| [openai/gpt-5.4-mini](https://openrouter.ai/api/v1/models/openai/gpt-5.4-mini/endpoints) | `openai` | 0.75 | 4.5 | Yes | $0.1350 |
| [anthropic/claude-haiku-4.5](https://openrouter.ai/api/v1/models/anthropic/claude-haiku-4.5/endpoints) | `anthropic` | 1 | 5 | Yes | $0.1600 |
| [moonshotai/kimi-k3](https://openrouter.ai/api/v1/models/moonshotai/kimi-k3/endpoints) | `sail-research/fp4` | 2.30273 | 11.5502 | Yes | $0.3692 |
| [anthropic/claude-sonnet-4.6](https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-4.6/endpoints) | `anthropic` | 3 | 15 | Yes | $0.4800 |
| [anthropic/claude-fable-5](https://openrouter.ai/api/v1/models/anthropic/claude-fable-5/endpoints) | `anthropic` | 10 | 50 | Yes | $1.6000 |

**Qwen3.8 Flash** is a strong low-cost family representative at $0.15/$0.47 on Alibaba with schema support. Qwen3.7 Flash is even cheaper at $0.03/$0.13 but only advertises JSON formatting on its inspected route, and its price rises at longer prompt sizes. Its exclusion from a strict-only test would be a protocol choice, not a quality conclusion. The published Flash-Next weights and hosted Flash product are not identical deployment claims.[^qwen]

**Mistral Small 4** has an official schema-supporting route at $0.15/$0.60 and documented language breadth that includes German. Its explicit none/high reasoning choice also offers a useful operational contrast with mandatory-thinking families. Mistral Large 3 at $0.50/$1.50 is a reasonably priced optional larger-family probe. Language support alone does not prove German-film knowledge.[^mistral]

**MiniMax M3** offers switchable thinking and competitive prices, but the official route does not advertise strict schema. CoreWeave FP4 at $0.23/$0.96 or Together at $0.30/$1.20 do. **MiMo V2.5** similarly gains an advertised strict route through DeepInfra FP8 at $0.133/$0.266. Their model cards emphasize broader agentic/multimodal tasks; neither establishes fingerprint quality.[^minimax][^mimo]

**Nemotron 3.5 Lightning** provides a cheap BF16 route at $0.08/$0.20 and unusually explicit training provenance: September 2025 pretraining cutoff and May 2026 post-training. **Gemma 4 31B** is another cheap exploratory option, with January 2025 pretraining cutoff and broad language representation. **Ling 3.0 Flash VL** is a still-cheaper wildcard. These are sensible ways to broaden the price floor, but adding all of them increases review workload more than inference cost.[^nemotron][^gemma][^ling]

**Gemini 2.5 Flash Lite** is the most direct cheap same-family addition. **Gemini 3.8 Flash** costs the same as the configured 3.6 standard route but has a higher minimum supported thinking level: minimal is not accepted. Its model card reports March 2026 knowledge cutoff with an explicit warning that some domains remain at January 2025. That nuance matters more than its release date.[^gemini38][^gemini38-card]

**Claude Haiku 4.5**, **GLM 5.3**, **Mistral Large 3**, and **Kimi K2.5** can serve as optional, somewhat higher-cost comparisons. This role means a quality-oriented hypothesis, not a reference answer. Kimi K3, Claude Fable, and larger Sonnet routes cost substantially more; none is necessary merely to make the test credible. Haiku's vendor documentation gives a reliable February 2025 cutoff and optional thinking.[^claude-models][^kimi]

**GPT-OSS 20B/120B**, old OpenAI mini/nano offerings, **Nova Micro**, and **Command R7B** are potential historical or ultra-cheap controls. Their low prices should be weighed against older factual coverage, missing route features, and redundant review effort. Nova Micro's inspected routes lack a strict-schema flag. The goal is informative family diversity, not the largest possible model count.

## Output controls and fair comparison

OpenRouter supports schema-constrained responses on compatible endpoints. Use a declared schema mode and local validation; a schema flag does not prove factual correctness or full compatibility with this schema. Google's implementation also supports only a subset of JSON Schema, so a successful request with a trivial schema does not validate the complete contract.[^or-schema][^google-schema]

There are two defensible experiment policies. One admits only routes advertising strict schema, measuring a deployment that aims to reduce repair costs. The other admits JSON-only routes and measures their raw validity plus explicitly bounded repair costs. The latter could include Qwen3.7 Flash and official DeepSeek/Z.ai routes, and more closely resembles current production's formatting mechanism. The decision should be explicit because strict-only admission changes which cheap models can compete.

Recommendation: keep the full semantic prompt and trait definitions identical, permit documented transport adaptations, and report output mode as part of each configuration. If a common envelope such as an object containing a results array is needed for schema compatibility, apply it consistently and version the adaptation. Do not silently delete required response fields or fix an answer before recording the raw failure.

Pin a model and provider endpoint, disable provider fallbacks for the controlled arm, and require support for the parameters being sent. A provider order using a broad base slug can cover more than one endpoint variant; save the specific route, returned model identity, and service tier. Unpinned default routing can change the serving host between runs. OpenRouter exposes provider filters and per-million price ceilings, but these do not themselves cap the entire experiment.[^or-routing]

Reasoning must be configured per model. GLM 5.3, Muse, and newer Gemini options do not share Luna's ability to disable it. OpenRouter's common effort names are not equal token or compute budgets. Hiding reasoning output does not avoid its bill; bounded completion tokens must leave room for both thinking and the complete JSON response.[^or-reasoning] A cost-oriented pass at the lowest supported useful effort is a recommendation to discuss, with deeper reasoning reserved for a later, evidence-driven comparison.

OpenRouter's response-healing plugin can modify malformed JSON. Leaving it active would measure model plus repair middleware and hide some raw formatting failures.[^or-healing] For raw validity comparison, avoid healing and web/search augmentation. If healing is later evaluated, preserve both original evidence where available and repaired results, identify that as a different configuration, and charge any resulting work to the same experiment budget.

One title per request is a useful first-pass recommendation: it isolates failures and title association. Five-title batching matches current production and can amortize the long system prompt, but introduces order/association failure and correlated retries. Asynchronous provider Batch is a separate concept from putting five titles into one prompt. OpenRouter documents a 24-hour batch window and typically discounted rates, with model-specific exceptions.[^or-batch] A single-title synchronous first pass followed by a finalist batching experiment would preserve interpretability; neither step is approved by this research alone.

## Cost accounting and budget scenarios

Use actual account-charged cost per attempt as the primary spend measure. OpenRouter returns native-token usage and cost; the generation metadata endpoint provides additional identity, timing, native-token, and cost fields for reconciliation.[^or-usage][^or-generation] Save generation IDs so discrepancies can be investigated. A timeout or missing usage field is an unresolved charge, not proof of zero cost. BYOK, if configured, requires checking upstream billed inference separately from OpenRouter fees.

For estimates, distinguish uncached input, cache reads, cache writes, billed output including reasoning, and non-token charges. Avoid counting reasoning twice if it is already included in completion usage. Prompt-cache behavior varies by route; cache hits cannot be assumed just because the system prompt repeats.[^or-cache]

For the illustrated 12-model set:

| Scenario | Per title assumption | First pass: 120 responses | Repeat ten titles for two most expensive candidates | Total before retries/other stages |
|---|---|---:|---:|---:|
| Smaller token scenario | 6,000 input + 2,000 billed output | $0.5222 | $0.2800 | $0.8022 |
| Larger token scenario | 12,000 input + 8,000 billed output | $1.6534 | $0.8800 | $2.5334 |

These calculations conservatively charge all Luna input at the cache-write price and assume no explicit cache writes for other candidates. The latter assumption must be checked during execution. The more expensive two candidates are used solely for repeat-cost illustration; actual advancement follows independent quality review. Repeating the whole larger-token scenario once would exceed the $5 target, demonstrating why inexpensive rates do not remove the need to bound attempts.

The CSV supplies the rates and both formulas: for ten titles, `0.06 × input_rate + 0.02 × output_rate`, or `0.12 × input_rate + 0.08 × output_rate`. Substitute Luna's conservative write rate for input as stated. These scenarios exclude paid tools, embeddings, new credit-purchase fees, and unmeasured exceptional charges. They are not worst-case request reservations: a real reservation must use actual prompt size, output cap, route surcharges, and every outstanding attempt.

Track three useful costs separately: cost per attempted title, cost per structurally valid title, and cost per title accepted after quality review. Include failures and retries in the numerator, and state the acceptance rule used for the denominator. A model producing cheap but implausible output is not automatically cost-effective. Report valid coverage alongside cost so a model cannot appear cheap by answering only easy titles.

The $10 ceiling includes candidate inference, retries, paid judge calls if any, and embedding calls. The current selected manual subscription judge route adds no planned judge API spend; existing subscription fees are a separate fixed expense. Embeddings are a separate measured stage, not multiplied across every candidate by default. OpenRouter's credit-purchase fee is distinct from inference usage: its FAQ lists 5.5% with an $0.80 minimum for ordinary purchases. Record any new purchase fee separately rather than confusing a balance top-up with consumed tokens.[^or-faq]

Before paid execution, the protocol should establish an affordable request reservation, a small unresolved-charge buffer, sequential or explicitly reserved concurrency, and stop conditions. Do not start another request if worst-case outstanding plus next-request cost would exceed the remaining ceiling. Key-level caps are an additional guard where available, but the experiment ledger must also include separately billed stages. The existing key's funding and restrictions have not been inspected.

## Quality evidence and review workload

None of the primary evidence establishes GoodWatch fingerprint accuracy. General factual QA can motivate a candidate; coding and agentic rankings are weak substitutes for film knowledge and trait calibration. Published results often use high reasoning, tools, different model variants, or different benchmark versions. Combining their leaderboard scores into a numerical fingerprint-quality ranking would be unsupported.

The agreed independent review remains appropriate: hide candidate identity, preserve original scores, give each reviewer the same trait definitions and frozen title inputs, collect initial verdicts separately, and let the human decide after comparing them. Codex and Claude Code are the selected delivery tools; record the exact Astra/Fable model identities and settings available at execution, rather than inferring them from the app name. Use the intended subscription-authenticated sessions.[^codex-auth][^claude-auth]

Twelve candidates across ten titles produce **8,880 trait values per reviewer before repeats**, plus the wider response. Eighteen produce 13,320. This is the strongest reason to select a coherent family-diverse subset even when the token estimate is small. Review packets should surface flagged attributes and rationale without silently replacing independent judgments with an aggregate score or majority vote.

Keep recent-title and uncertain-title observations explicit. Abstention is a recorded failure under the agreed complete-output rule, but confident fabrication may be worse in final judgment. A cutoff after release is not proof of coverage; a cutoff before release does not prevent premise-based inference from the provided overview. Do not add browsing or extra per-model evidence midway through the fixed experiment. If coverage failures suggest retrieval, that becomes a separate decision and equally frozen evidence-conditioned experiment.

## Grilling agenda and remaining uncertainty

The next live round should settle selection policy before declaring exact arms:

1. **Breadth:** start with the proposed twelve, reduce redundant family variants, or expand with cheap same-family and stronger comparisons. The recommendation is twelve with optional additions justified by a distinct hypothesis.
2. **Route admission:** allow explicitly pinned third-party hosts and disclosed quantization; decide whether JSON-only routes can compete with measured validation/repair costs. The recommendation is to allow third-party hosts and retain a small JSON-only comparison if cost-floor coverage matters.
3. **Muse terms:** choose standard Muse or knowingly admit Contributor. Standard is the conservative starting cost basis; the Contributor saving is real but conditional.

Once those choices are made, settle exact versions and routes, explicit per-model reasoning settings, output caps, retries, single-title versus grouped requests, review packet structure, and stop/reservation rules. No candidate is selected merely by appearing in the report.

Unresolved factual checks for the execution boundary are full-schema compatibility, actual output lengths and reasoning costs, account availability/filters, current price overrides, exact judge model availability, and the full terms of any conditional offering. Account, documentation, and configuration checks can be read-only. Successful schema acceptance, output lengths, and actual reasoning costs require execution-time inference and belong inside the approved experiment budget. Keep the protocol issue open until the live decisions are resolved.

## Sources

All external sources below were accessed September 12, 2026. The model tables link directly to OpenRouter's public endpoint APIs; their factual responses, retrieval times, and source URLs are preserved in the accompanying evidence JSON. Prices and availability are snapshots, not future commitments.

[^deepseek-pricing]: DeepSeek. [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/). Current direct IDs, redirect behavior, token rates and peak windows.
[^deepseek-card]: DeepSeek. [DeepSeek V4.1 Flash model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash). Architecture and vendor evaluation methodology/results.
[^meta-release]: Meta. [Introducing Muse Spark 1.3](https://research.meta.ai/blog/introducing-muse-spark-1-3), September 2, 2026. Release identity and capability claims.
[^meta-evals]: Meta. [Muse Spark 1.3 evaluation methodology](https://research.meta.ai/static/muse-spark-1-3-multimodal-evaluation-methodology). Evaluation scope and effort settings.
[^meta-contributor]: OpenRouter. [Muse Spark 1.3 Contributor](https://openrouter.ai/meta/muse-spark-1.3-contributor). Exact offering and data-contribution disclosure.
[^luna]: OpenAI. [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Identity, prices, cutoff, limits and reasoning options.
[^composer]: Cursor. [Composer](https://cursor.com/composer). Composer 2.5 availability and pricing.
[^cursor-sdk]: Cursor. [TypeScript SDK](https://cursor.com/docs/sdk/typescript). Programmatic agent access and credentials.
[^zai-pricing]: Z.ai. [Pricing](https://docs.z.ai/guides/overview/pricing). Direct GLM prices and distinct Flash/FlashX offerings.
[^glm]: Z.ai. [GLM 5.3](https://docs.z.ai/guides/llm/glm-5.3). Thinking controls and limits.
[^glm-flash]: Z.ai. [GLM 5.3 Flash](https://docs.z.ai/guides/vlm/glm-5.3-flash). Model characteristics, thinking and limitations.
[^qwen]: Qwen. [Qwen3.8 Flash-Next model card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next). Hosted-versus-weight distinction and evaluation scope.
[^mistral]: Mistral AI. [Mistral Small 4 model card](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603). Languages, output and reasoning support.
[^minimax]: MiniMax. [MiniMax M3 model card](https://huggingface.co/MiniMaxAI/MiniMax-M3). Thinking modes and capability evidence.
[^mimo]: Xiaomi. [MiMo V2.5 model card](https://huggingface.co/XiaomiMiMo/MiMo-V2.5). Model identity, task emphasis and evidence limits.
[^nemotron]: NVIDIA. [Nemotron 3.5 Lightning BF16 model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16). Training provenance and language scope.
[^gemma]: Google. [Gemma 4 31B model card](https://huggingface.co/google/gemma-4-31B-it). Training cutoff and language coverage.
[^ling]: InclusionAI. [Ling 3.0 Flash VL model card](https://huggingface.co/inclusionAI/Ling-3.0-flash-VL). Exact model evidence.
[^gemini38]: Google. [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Supported thinking levels and model characteristics.
[^gemini38-card]: Google DeepMind. [Gemini 3.8 Flash model card](https://deepmind.google/models/model-cards/gemini-3-8-flash/). Cutoff and domain-specific limitations.
[^claude-models]: Anthropic. [Models overview](https://platform.claude.com/docs/en/models/overview). Haiku pricing, limits and reliable knowledge cutoff.
[^kimi]: Moonshot AI. [Kimi K2.5 model card](https://huggingface.co/moonshotai/Kimi-K2.5). General-knowledge evidence and modes.
[^or-schema]: OpenRouter. [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Schema response configuration and compatibility checks.
[^google-schema]: Google. [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). Supported schema subset.
[^or-routing]: OpenRouter. [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection). Endpoint selection, fallbacks, parameters and price ceilings.
[^or-reasoning]: OpenRouter. [Reasoning tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). Controls, model differences and billed reasoning.
[^or-healing]: OpenRouter. [Response healing](https://openrouter.ai/docs/guides/features/plugins/response-healing). Response mutation and JSON repair.
[^or-batch]: OpenRouter. [Batch API quickstart](https://openrouter.ai/docs/batch-quickstart). Asynchronous window and price caveats.
[^or-usage]: OpenRouter. [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting). Native usage and account cost.
[^or-generation]: OpenRouter. [Generation request and usage metadata](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation). Reconciliation fields.
[^or-cache]: OpenRouter. [Prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching). Reads, writes and provider-specific behavior.
[^or-faq]: OpenRouter. [FAQ](https://openrouter.ai/docs/faq). Credit fees and inference accounting.
[^codex-auth]: OpenAI. [Codex authentication](https://learn.chatgpt.com/docs/auth). Subscription and API-key access modes.
[^claude-auth]: Anthropic. [Claude Code authentication](https://code.claude.com/docs/en/authentication). Subscription authentication and credential selection.
