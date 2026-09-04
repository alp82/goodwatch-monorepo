# Gemini DNA model replacement and cost review

Research date: 2026-09-04. Prices are Gemini Developer API standard, interactive prices in USD per 1 million tokens unless stated otherwise. This flow uses `genai.Client(api_key=...)`, not Vertex AI, so Gemini Developer API pricing is the relevant schedule.

## Bottom line

The previous direct API cost was approximately **$0** as long as the project remained on the Gemini Developer API free tier and within the available project quotas. The repository does not automatically spill into paid usage: it keeps its own per-model daily request counters and refuses to select a model after its configured allowance. Free-tier usage and paid list price are different facts; a free-tier request has no token charge, while the paid-equivalent figures below show what the same workload would cost after billing is enabled or if free quota is unavailable.

`gemini-2.0-flash-001` was shut down on June 1, 2026, which explains the current 404. Google's official deprecation table names `gemini-3.6-flash` as its replacement. The exact model ID **does exist**: Google released it as a stable GA model on July 21, 2026, and its model page lists structured output support. ([deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations), [release notes](https://ai.google.dev/gemini-api/docs/changelog), [3.6 model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash))

At current promotional pricing, 3.6 Flash is substantially more expensive than the retired 2.0 Flash, but still inexpensive at this pipeline's scale: approximately **$0.38 per 100 media entries before hidden thinking tokens**, versus approximately **$0.04** for 2.0 Flash at its former paid list price. Starting January 1, 2027, the published 3.6 prices double, making the same baseline approximately **$0.75 per 100 entries**. Free-tier requests remain free, subject to the live quota Google shows for the project in AI Studio. ([current Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing), [rate-limit policy](https://ai.google.dev/gemini-api/docs/rate-limits))

## What the repository actually does

The DNA fetch script currently tries these model IDs in order:

1. `gemini-2.5-pro`, locally configured as 0 requests/day
2. `gemini-2.5-flash`, locally configured as 60 requests/day
3. `gemini-2.0-flash-001`, locally configured as 200 requests/day

See [`goodwatch-flows/windmill/f/dna/generate/fetch.py`](../../goodwatch-flows/windmill/f/dna/generate/fetch.py). A 20-request safety margin means the code actually selects 2.5 Flash only while its local counter is below 40 and 2.0 Flash only while below 180. Pro is therefore always skipped. The iterator groups media into batches of five, while each scheduled run selects up to 100 media, or normally 20 API calls; see [`iterate.py`](../../goodwatch-flows/windmill/f/dna/generate/iterate.py) and [`next.py`](../../goodwatch-flows/windmill/f/dna/generate/next.py).

Consequently, the nominal locally configured free allowance was 260 calls/day, but the code's usable allowance was 220 successful calls/day after its two safety margins: up to roughly 1,100 media entries at five entries per request. Validation retries consume additional successful API calls and reduce that throughput. These are repository constants, **not verified current Google quotas**.

Google now says API rate limits vary with usage tier and account status, that actual capacity can vary, and that the active limits should be read in AI Studio. It also says RPD limits reset at midnight Pacific time. The repository instead keys its counters by UTC calendar date, so its local accounting day does not exactly match Google's quota day. ([official rate-limit policy](https://ai.google.dev/gemini-api/docs/rate-limits))

## Published prices

| Model | Availability on 2026-09-04 | Free-tier token price | Standard paid input | Standard paid output | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| `gemini-2.0-flash-001` | Shut down 2026-06-01 | Was free within quota | $0.10 | $0.40 | Historical Gemini Developer API price; Google named 3.6 Flash as replacement. |
| `gemini-2.5-flash` | Available; no shutdown announced | Free within quota | $0.30 | $2.50 | Output price includes thinking tokens. |
| `gemini-2.5-pro` | Available; no shutdown announced | Free within quota | $1.25 for prompts <=200k | $10.00 for prompts <=200k | Output price includes thinking tokens; higher prices apply above 200k input, irrelevant here. |
| `gemini-3.1-flash-lite` | Available | Free within quota | $0.25 | $1.50 | Google's low-cost replacement recommendation for retired 2.0 Flash-Lite, not the official 2.0 Flash replacement. |
| `gemini-3.5-flash-lite` | Available | Free within quota | $0.30 | $2.50 | Current cost-oriented 3.x option; minimal thinking by default. |
| `gemini-3.6-flash` | Stable GA | Free within quota | $0.75 through 2026-12-31; $1.50 afterward | $3.75 through 2026-12-31; $7.50 afterward | Official replacement for 2.0 Flash; output includes thinking tokens. |
| `gemini-3.8-flash` | Stable GA; newest Flash as of research date | Free within quota | $0.75 through 2026-12-31; $1.50 afterward | $3.75 through 2026-12-31; $7.50 afterward | Same promotional price as 3.6; released only two days before this review. |

Sources: Google's [current Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations), and the first-party [Gemini 2.0 launch post](https://developers.googleblog.com/start-building-with-the-gemini-2-0-flash-family/). The official pricing page's still-indexed localized 2.0 table records the former Developer API rate as $0.10 input and $0.40 output; Vertex AI had a different $0.15/$0.60 schedule and should not be mixed into this comparison.

Google's pricing table labels the **tokens** as free on the free tier, but it does not promise a fixed RPD in that table. The number of free requests available is controlled separately by the project's live rate limit. Enabling a paid tier also does not turn the first N paid-tier tokens into a free allowance; billing tier and its limits must be checked in AI Studio. Google's billing guide describes new projects as starting on the free tier and paid access as a separate billing upgrade. ([billing guide](https://ai.google.dev/gemini-api/docs/billing))

## Approximate cost for this flow

The fixed system instruction is 15,632 characters. Google's pricing documentation uses roughly four characters per text token as a rule of thumb, implying about 3,900 input tokens before the five titles and overviews are added. The example JSON object in the prompt is 3,294 characters, or about 824 visible output tokens per media entry by the same rule of thumb.

For a useful planning baseline, assume each five-entry call uses:

- 4,500 input tokens (fixed instruction plus five titles/overviews)
- 4,100 visible output tokens (five DNA objects)
- no additional hidden thinking tokens

A 100-entry run is 20 calls, or approximately 90,000 input tokens and 82,000 visible output tokens.

| Model | Approx. per five-entry call | Approx. per 100 media | Approx. per 1,000 media |
| --- | ---: | ---: | ---: |
| Former 2.0 Flash paid equivalent | $0.0021 | $0.042 | $0.42 |
| 2.5 Flash | $0.0116 | $0.23 | $2.32 |
| 2.5 Pro | $0.0466 | $0.93 | $9.33 |
| 3.1 Flash-Lite | $0.0073 | $0.15 | $1.46 |
| 3.5 Flash-Lite | $0.0116 | $0.23 | $2.32 |
| 3.6 Flash through 2026-12-31 | $0.0188 | $0.38 | $3.75 |
| 3.6 Flash from 2027-01-01 | $0.0375 | $0.75 | $7.50 |
| 3.8 Flash through 2026-12-31 | $0.0188 | $0.38 | $3.75 |
| 3.8 Flash from 2027-01-01 | $0.0375 | $0.75 | $7.50 |

Formula for 100 entries: `0.09 × input price + 0.082 × output price`.

These are planning estimates, not invoice predictions. The prompt's non-ASCII titles, overview lengths, generated tag/text lengths, malformed-response retries, and tokenizer behavior all vary. Exact measurement should use the API's `countTokens` method for input and response usage metadata for output. Google documents the four-characters-per-token figure only as an average and says actual billing is token-based. ([official Vertex AI token-pricing explanation](https://cloud.google.com/vertex-ai/generative-ai/pricing))

## Thinking-token ambiguity

The baseline above likely understates costs for the current code because it does not set a thinking configuration:

- 2.5 Flash defaults to dynamic thinking; it can be disabled with `thinking_budget=0`.
- 2.5 Pro defaults to dynamic thinking and cannot disable thinking entirely.
- 3.6 Flash defaults to medium thinking; it supports `minimal`, `low`, `medium`, and `high`.
- 3.5 Flash-Lite defaults to minimal thinking.

Google bills the full thought-token count even when only a thought summary or no thoughts are visible. ([official thinking guide](https://ai.google.dev/gemini-api/docs/generate-content/thinking))

As a sensitivity example, an average extra 2,000 thinking tokens per call adds 40,000 billed output tokens per 100 media. That adds approximately $0.10 on 2.5 Flash, $0.40 on 2.5 Pro, $0.15 on promotional 3.6 Flash, or $0.30 on post-promotion 3.6 Flash. Actual thinking usage needs to be measured; it cannot be inferred from visible JSON length.

## Practical interpretation before changing code

- If the goal is a direct, officially supported replacement for the failing endpoint, `gemini-3.6-flash` is real, stable, supports structured output, and is Google's documented target.
- Google's current latest-model page now calls `gemini-3.8-flash` the newest stable Flash and publishes the same 2026 promotional price as 3.6. It was released on September 2, 2026, only two days before this review, while the API error and the 2.0 deprecation table still direct users to 3.6. Treat 3.8 as a separate, very recent candidate rather than silently overriding the API's migration advice. ([latest-model guide](https://ai.google.dev/gemini-api/docs/latest-model), [release notes](https://ai.google.dev/gemini-api/docs/changelog))
- If the main goal is minimizing paid cost for this structured extraction workload, `gemini-3.1-flash-lite` and `gemini-3.5-flash-lite` deserve quality tests. They are cheaper than 3.6, but Google does not designate them as the replacement for 2.0 Flash, so output quality cannot be assumed.
- The current 2.5 models are still available and still have free-tier pricing, but their actual free request limits must be read from this project's AI Studio page. Hard-coded RPD values should not be treated as authoritative.
- Before choosing based on the table, run a representative batch and record `prompt_token_count`, `candidates_token_count`, and `thoughts_token_count`. Cost is dominated by output and thought tokens, not the fixed input prompt.
- The 404 response is not billable inference work. Google documents on its Vertex AI pricing page that non-200 requests are not charged; the Developer API page does not state this as explicitly, so confirm in billing telemetry if this distinction matters for the API-key project.

## Can the application read remaining free quota?

Not directly from `generateContent`. A successful response's `usageMetadata` reports the tokens consumed by that request (`promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, cached/tool tokens, and `totalTokenCount`). It has no quota limit, remaining quota, or reset-time field. The repository's pinned `google-genai==1.53.0` exposes the same information as `response.usage_metadata`; although it also retains generic HTTP response headers in `response.sdk_http_response`, neither the Gemini API contract nor the SDK defines a supported rate-limit-remaining header. ([token-counting guide](https://ai.google.dev/gemini-api/docs/generate-content/tokens), [GenerateContent API schema](https://ai.google.dev/api/generate-content), [`python-genai` 1.53.0 response types](https://github.com/googleapis/python-genai/blob/v1.53.0/google/genai/types.py))

There is now a separate, programmatic source that is better than hard-coded guesses: Google Cloud Monitoring publishes Gemini Developer API free-tier quota time series for both input tokens and requests:

- `generativelanguage.googleapis.com/quota/generate_content_free_tier_input_token_count/{limit,usage}`
- `generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/{limit,usage}`

The metrics are split by labels including `model` and `limit_name`; usage also includes `method`. The limit is a gauge and usage is a delta, so a consumer can calculate an advisory remainder for the applicable quota window by subtracting aligned/windowed usage from the matching limit. They can be queried through Cloud Monitoring's `projects.timeSeries.list` endpoint using Google Cloud OAuth/IAM credentials with Monitoring read access. The Gemini API key by itself is not authentication for this endpoint. ([official Gemini metric catalog](https://cloud.google.com/monitoring/api/metrics_gcp_d_h), [Cloud Monitoring `timeSeries.list`](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list))

This calculated remainder is not an atomic, real-time admission check. Google samples the limit metrics every 60 seconds and warns that both limit and usage data can remain unavailable for up to 150 seconds. It also is not a single "free tokens remaining" balance: Gemini applies several independent limits such as RPM, input TPM, RPD, and for some models TPD; any one can reject a request. RPD resets at midnight Pacific time. AI Studio remains Google's supported human-facing place to view active limits and usage. ([metric catalog](https://cloud.google.com/monitoring/api/metrics_gcp_d_h), [rate-limit policy](https://ai.google.dev/gemini-api/docs/rate-limits), [billing FAQ](https://ai.google.dev/gemini-api/docs/billing#where_can_i_view_my_quota))

The Cloud Quotas API and the older Service Usage quota API can return quota configuration/effective limits, but not a live remaining balance; consumption is supplied separately by Cloud Monitoring. ([Cloud Quotas overview](https://cloud.google.com/docs/quotas/api-overview), [Service Usage quota list](https://cloud.google.com/service-usage/docs/reference/rest/v1beta1/services.consumerQuotaMetrics/list))

For this flow, keep immediate Redis counters and a safety margin for routing, but stop estimating actual per-call token use: atomically reserve local request capacity before every API attempt, leave failed attempts counted, and record `response.usage_metadata.prompt_token_count` (plus output and thought counts for cost telemetry) after successful calls. Optionally poll Cloud Monitoring every two to five minutes to refresh the model-specific limits and reconcile observed usage. Continue treating `429 RESOURCE_EXHAUSTED` as authoritative and back off/fall through when it occurs. If the local daily counter remains, align its reset to midnight Pacific rather than UTC.
