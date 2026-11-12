# OpenRouter overflow benchmark admission

Checked 2026-11-12. This note uses public provider metadata and official OpenRouter documentation. It makes no inference calls or key changes. The user authorized paid benchmarking; operational caps and the actual run belong to the benchmark runner.

## Ten candidates

These recommendations balance five materially cheaper entries with larger models and alternative providers around JEV's current price. They are a candidate selection, not a claim that quality is preserved. Each had one live provider endpoint in a public metadata read; all advertise native `/api/alpha/decisions` support. Output is free for all ten.

| Model ID | Provider | Input $/M | Context | Selection reason |
| --- | --- | ---: | ---: | --- |
| `perplexity/pplx-decider-v1.2` | Perplexity | 0.020 | 262,144 | 27B decision checkpoint at a lower rate |
| `perplexity/pplx-decider-flash-v1.2` | Perplexity | 0.010 | 262,144 | Smaller, cheaper sibling under the same API |
| `liquid/d1.1` | Liquid | 0.020 | 65,536 | Current d1 release, cheaper-rate family comparison |
| `respan/span-02` | Respan | 0.010 | 131,072 | Low-rate provider diversity; successor to Span-01 |
| `baseten/joey-1` | BaseTen | 0.010 | 16,384 | 2B low-rate native checkpoint |
| `baseten/elephant-1` | BaseTen | 0.035 | 16,384 | 9B quality/price step above Joey |
| `liquid/d1-ultra` | Liquid | 0.042 | 32,768 | Larger Liquid tier at JEV's rate |
| `morph/reflex` | Morph | 0.042 | 65,536 | Alternative runtime with state prefix caching |
| `scaledown/classify-1` | ScaleDown | 0.040 | 1,000,000 | Near-JEV rate and different provider |
| `nace-ai/drex-max` | DeepInfra | 0.060 | 262,144 | Higher-capacity quality-oriented comparison; explicitly costs 43% more per token than JEV |

The first five rates are 52.4% or 76.2% below $0.042/M **at equal billed-token counts**. The latter five are overflow candidates, so a useful quality/latency result could matter even without large savings.

Sources: [live decision catalogue](https://openrouter.ai/api/v1/models?output_modalities=decisions), and endpoint metadata for [Decider](https://openrouter.ai/api/v1/models/perplexity/pplx-decider-v1.2/endpoints), [Decider Flash](https://openrouter.ai/api/v1/models/perplexity/pplx-decider-flash-v1.2/endpoints), [d1.1](https://openrouter.ai/api/v1/models/liquid/d1.1/endpoints), [Span-02](https://openrouter.ai/api/v1/models/respan/span-02/endpoints), [Joey](https://openrouter.ai/api/v1/models/baseten/joey-1/endpoints), [Elephant](https://openrouter.ai/api/v1/models/baseten/elephant-1/endpoints), [d1-ultra](https://openrouter.ai/api/v1/models/liquid/d1-ultra/endpoints), [Reflex](https://openrouter.ai/api/v1/models/morph/reflex/endpoints), [Classify-1](https://openrouter.ai/api/v1/models/scaledown/classify-1/endpoints), and [Drex Max](https://openrouter.ai/api/v1/models/nace-ai/drex-max/endpoints).

`baseten/mammoth-1` is a possible quality-ceiling reserve at $0.100/M with 16,384 context, but its 2.38x JEV rate makes it a weaker cost candidate. [Endpoint](https://openrouter.ai/api/v1/models/baseten/mammoth-1/endpoints). Microsoft Decision 1 and Kev 4B are other same-rate reserves, without a demonstrated GoodWatch quality advantage.

## Budget and request controls

The exact official Decisions schema is visible in the [raw Markdown/OpenAPI reference](https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request.md). `DecisionsRequest.provider` references shared `ProviderPreferences`; it supports `only`, `order`, `allow_fallbacks`, and `max_price`. Set a single model and provider, `allow_fallbacks: false`, and do not configure retries. The `max_price` members include `prompt` and `completion` in USD per million tokens, plus `request` in USD per request. These are endpoint price filters, not evidence of a ceiling on the total bill for an arbitrarily large token-metered request. The Decisions request does **not** expose `max_tokens` or a documented total-request dollar budget field.

A key's server-enforced `limit` can cap spend independently of the model body. `GET /api/v1/key` exposes usage and remaining limit. Creating, editing, disabling or rotating a child key through `/api/v1/keys` requires a **management key**; a normal inference key cannot do it. No attempt should be made to mutate keys using an ordinary inference credential. [Management-key contract](https://openrouter.ai/docs/guides/overview/auth/management-api-keys), [create-key API](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key), [spend controls](https://openrouter.ai/blog/tutorials/team-spend-controls-setup/).

If only an existing inference key is available, first read its hard limit and current usage, then retain that result in redacted form. A local benchmark cap should reserve before each request, issue calls sequentially during admission, reconcile every response's actual cost and leave failed/unknown-cost reservations unresolved. It is separate from the provider-enforced key limit; neither should be described as the other. An existing exhausted key must not be worked around with another key or increased allowance.

## Billing evidence and bounded admission

The response schema defines `usage.cost` as what OpenRouter charges for the request in credits; on BYOK it is only the OpenRouter fee. `usage.input_tokens_details.cached_tokens` identifies cached input tokens. The exact schema does not define a universal text billing formula saying state is charged once for every provider. Therefore neither `shared state + sum(question tokens)` nor `question count * context window` should be presented as the **measured bill**.

Use the already-authorized paid screen to establish actual costs: a small complete request can confirm answer-shape/usage support; a complete production reading then measures the real two-request cost, including every question. Capture model, provider, raw probabilities, input tokens, cached tokens, `usage.cost`, errors, retries (none), and end-to-end latency. If cost is missing, nonfinite or inconsistent with the admitted rate/accounting policy, stop before another request. State/question token expansion remains an uncertainty until a provider contract or observed response resolves it; an estimate must remain labelled as an estimate.

For Morph, the published $0.002/M cache-read rate can affect repeated-state runs. Report first-use and repeated-state timings/costs separately rather than claiming that a warm repeated query predicts the cost of a new guest query. [Reflex caching/pricing](https://openrouter.ai/morph/reflex). Liquid's advertised cache rate for the selected entries equals its prompt rate at access time; it is not an additional advertised discount.

## Input and question compatibility

All ten selected providers' adapters accept `noul`, `choice` and `score`, according to the current registry. That verifies primitive availability, not every rubric/option combination or full-questionnaire limit. Keep the production state/questions unchanged for the compatibility screen and count any rejected/truncated/partial interpretation as unusable. Do not silently drop questions to produce a score. Any later chunked profile must retain all questions and sum latency/cost across all requests. [Adapter capability table](https://openrouter.ai/docs/guides/community/multimodal-decisions#what-each-endpoint-accepts).

Excluded from the ten: Cloudflare Clef/Clef Flash silently read only roughly the first 2,000 state-text tokens; Parallel Decisions Fast adds web research and permits at most 100 questions, below the existing 148-question fingerprint payload; old Mercury Decide has no public provider endpoint in the inspected response. These are concrete compatibility reasons, not quality scores. [Cloudflare limits](https://openrouter.ai/docs/guides/community/multimodal-decisions#limits), [Parallel contract](https://openrouter.ai/parallel/decisions-fast/providers), [Mercury endpoint](https://openrouter.ai/api/v1/models/inception/mercury-decide/endpoints).

No selected model has a documented GoodWatch-specific quality guarantee. OpenRouter explicitly instructs users to re-check thresholds for each model. Keep original JEV-decoder compatibility scores separate from model-specific calibration fitted on a different split. [Official model-switch guidance](https://openrouter.ai/docs/guides/community/jev#other-decision-models).
