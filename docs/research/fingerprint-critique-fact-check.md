# Fact-check of the fingerprint model-selection critique

## Assessment

The critique correctly prioritizes knowledge and factual reliability over merely producing JSON. It also identifies legitimate additional candidates and an important Gemini promotional-price caveat. Several claims, however, are outdated, conflate model variants, or generalize narrow benchmark measurements. None establishes that the approved twelve-model, ten-title POC should be replaced with a hundred-title factual-extraction evaluation.

Evidence was checked on September 12, 2026 against model providers, public OpenRouter endpoints, and the organizations that conducted the cited benchmarks. This is a bounded follow-up to [OpenRouter candidates for Windmill fingerprinting](openrouter-fingerprint-candidates.md), not a measured evaluation of fingerprints. No inference ran.

## What the task actually requires

The approved experiment already supplies identical frozen title identities and TMDB-derived overviews. It evaluates 74 named trait values, with full-response plausibility and validity as supporting evidence. This is not primarily a request to recover cast lists and release dates. Metadata grounding is useful, but an overview does not establish acting quality, cinematography, recurring themes, tonal ambiguity, or the full identity of a television series.

Subjective scoring still requires factual familiarity: an invented plot can lead to a superficially plausible but wrong tone or trope score. Conversely, a low price or coding-oriented model card does not prove inability to analyze a familiar title. The right evaluation question is whether the particular candidate configuration produces plausible, title-specific scores and avoids unsupported content under the shared inputs.

Adding richer TMDB/Wikidata evidence could become a useful separate experiment if coverage failures appear. It would change the frozen inputs and the task being measured. A hundred-title obscure/international holdout could likewise improve external validity, but it would multiply review work and require a new agreed corpus. The current ten-title set is a pilot, not a claim of catalog-wide performance.

## Claims checked

### DeepSeek existence, price, and hallucination

DeepSeek V4.1 Flash is real. It has an [official model card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash), [current direct API documentation](https://api-docs.deepseek.com/quick_start/pricing/), and a [public OpenRouter model/provider listing](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints). Direct legacy Flash identifiers now redirect to V4.1. Current direct prices are $0.15/$0.60 per million input/output off-peak and $0.30/$1.20 at documented peak times. The approved DeepInfra FP8 OpenRouter route is a different deployment at $0.20/$0.60. The critique's $0.14/$0.28 should not be carried into this configuration's cost projection.

Artificial Analysis defines its hallucination rate as `incorrect / (incorrect + partial + abstained)`: correct answers are excluded. Its current maximum-effort results include:

| Configuration | Accuracy | Conditional hallucination |
|---|---:|---:|
| DeepSeek V4.1 Flash max | 46.40% | 96.46% |
| GPT-5.6 Luna max | 42.73% | 92.58% |
| Muse Spark 1.3 max | 43.58% | 32.94% |

The warning is real, including for V4.1, but it does not mean 96% of all answers are false. Muse's lower rate accompanies substantially more abstention. These are different configurations from the approved POC, not film-trait results or evidence that standard Muse equals Contributor. [AA methodology and current data](https://artificialanalysis.ai/evaluations/omniscience), [V4.1 model result](https://artificialanalysis.ai/models/deepseek-v4-1-flash).

### JSON success percentages

The stated 10–20%, under-2%, and under-0.1% rates have no identified primary experiment in the supplied critique. Their applicability depends on the exact schema, model, provider, mode, output cap, refusals, and repair policy. Validation detects and rejects failures; it does not itself improve the generator or make accepted factual claims true. Google explicitly distinguishes structured output from semantic correctness, while OpenRouter documents endpoint-specific support. [Google structured output](https://ai.google.dev/gemini-api/docs/structured-output), [OpenRouter structured output](https://openrouter.ai/docs/guides/features/structured-outputs).

The approved protocol already treats structural validity and semantic quality separately. Removing validation would lose useful reliability and cost evidence; treating validity as the quality ranking would be equally mistaken.

### Gemini chronology, cost, and lifecycle

The release chronology is correct: Gemini 3.7 Flash followed 3.6, and Gemini 3.8 Flash was released September 2. That does not make the configured 3.6 control irrelevant. Google's current lifecycle table announces no shutdown date for stable Gemini 2.5 Flash or those newer Flash releases. Preview and image variant schedules must not be transferred to stable text models. [Google lifecycle table](https://ai.google.dev/gemini-api/docs/deprecations).

The roughly 30% more output and 40% greater task cost come from a real Artificial Analysis experiment: high-reasoning Gemini 3.8 cost $0.58 per Intelligence Index task versus $0.40 for 3.7, with more output and additional agentic turns. Its low setting cost $0.24/task. These are workload-and-setting-specific observations, not a universal multiplier for GoodWatch. [Original Artificial Analysis report](https://artificialanalysis.ai/articles/gemini-3-8-flash).

The promotion is an important addition to the earlier research: Google's introductory Gemini 3.8 rate of $0.75/$3.75 lasts through December 31, 2026, with $1.50/$7.50 announced from January 1, 2027. Future production projections must use the applicable dates. The approved lineup does not contain 3.8, so its current POC arithmetic is unaffected. [Google release announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/).

The recommendation to use Gemini 3.7 with thinking off is not a documented configuration. Its model page lists low/medium/high and rejects minimal. The approved 3.6 arm supports minimal, and no claim is made that this is a true non-thinking mode. [Gemini 3.7 documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash).

### Reasoning, Luna, and Haiku

The 33% and 51% hallucination figures correspond to o3 on PersonQA and SimpleQA, respectively. The original card also reports o4-mini at 48%/79% and o1 at 16%/44%. These are specific model/benchmark results; they do not show that enabling reasoning causes those rates across model families. OpenAI explicitly says the causes require further research. Reasoning does not guarantee factual knowledge, but the quoted evidence does not prove that switching it off improves this fingerprint task. [OpenAI system-card table](https://deploymentsafety.openai.com/o3/appendix#33-hallucinations).

Luna's $0.20/$1.20 rate is verified. Its July 30 price reduction is also documented. A comparative advantage in pop-culture knowledge against this candidate set is not established by those sources. [Luna model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [July 30 announcement](https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/).

Haiku 4.5 is a reasonable additional family to test. Its safety/alignment evidence does not establish that it is more factually honest about films than these twelve configurations. Lower attempt rate, deliberate deception, accidental factual error, and well-calibrated uncertainty are different measurements. The [Haiku system card](https://www-cdn.anthropic.com/7aad69bf12627d42234e01ee7c36305dc2f6a970.pdf) and [launch announcement](https://www.anthropic.com/news/claude-haiku-4-5) do not provide the claimed comparison.

### Additional names and variant mismatches

| Suggested option | Verified evidence | Interpretation |
|---|---|---|
| Plain Ling 3.0 Flash | `inclusionai/ling-3.0-flash` on Novita currently $0.021/$0.063, discounted; inspected routes lack the strict-schema flag. [Endpoints](https://openrouter.ai/api/v1/models/inclusionai/ling-3.0-flash/endpoints) | The rounded price is credible. Plain Ling is distinct from the more expensive VL route in the previous landscape. A possible additional JSON-only arm. |
| Solar Pro 4 | `upstage/solar-pro4`, official schema-supporting route at $0.09/$0.36. [Endpoints](https://openrouter.ai/api/v1/models/upstage/solar-pro4/endpoints) | A legitimate omission from the previous 38-option screen. Interesting economical reserve candidate; film quality unmeasured. |
| Grok 4.6 | `x-ai/grok-4.6` standard short-context $2/$6; mandatory thinking. [Pricing](https://docs.x.ai/developers/pricing), [reasoning controls](https://docs.x.ai/developers/model-capabilities/text/reasoning) | No exact cheap “Fast 4.6” offering was established. Previous Fast model names cannot inherit their old rates/behavior after retirement. |
| Ministral 3B | The cheap `mistralai/ministral-3b-2512` API listing maps to the Instruct checkpoint; the Reasoning checkpoint is distinct. [Endpoints](https://openrouter.ai/api/v1/models/mistralai/ministral-3b-2512/endpoints), [Reasoning card](https://huggingface.co/mistralai/Ministral-3-3B-Reasoning-2512) | Combining an Instruct API price with a Reasoning benchmark score is unsupported. A generic score-per-output-dollar ratio would not rank film traits anyway. |

Solar's current discount is temporary: Upstage lists base $0.30/$1.20 and $0.09/$0.36 from September 11 to October 10, 2026; the earlier 90% promotion has ended. [Upstage pricing](https://www.upstage.ai/pricing/api). xAI documents retirement and redirection of previous Grok Fast identifiers, so their historic prices are not a current 4.6 quote. [xAI retirement notice](https://docs.x.ai/developers/migration/may-15-retirement).

The Qwen distinction also matters: the published Flash-Next checkpoint underlies the hosted Flash product, which adds production features. Preserve the hosted model/provider identity and attribute any weight-card results to their actual checkpoint. The earlier research already states this limitation. [Qwen's official card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next).

## Implications for the approved protocol

Keep the approved twelve configurations and frozen ten-title pilot. Both Gemini rows are controls for configured models, not recommendations to deploy an old model forever. Retain DeepSeek as an empirical candidate while scrutinizing unsupported title assertions and implausible traits. Keep structural validation as an operational metric, and use independent human/Astra/Fable judgments for quality.

The accepted low-cost thinking settings are an explicit cost/quality experiment, not a claimed cure for hallucination. Record raw failures, abstentions, repairs, actual billed output, and uncertainty in the reviews. Do not award a model an assumed movie-knowledge advantage or restrict entire families to parsing based on marketing focus or national origin.

Haiku, Solar Pro 4, plain Ling, and Gemini 3.8-low are reasonable reserve hypotheses. They should earn any future slot from the first comparison's results and a deliberate trade-off in review effort. A larger obscure/international holdout or richer shared grounding is a possible follow-up if the pilot exposes coverage problems; neither is silently inserted into the agreed experiment.
