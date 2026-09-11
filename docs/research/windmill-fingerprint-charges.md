# Windmill fingerprint charges: evidence and remaining question

Research date: 2026-09-11. Ticket: [Explain current charges](https://github.com/alp82/goodwatch-monorepo/issues/28). Code inspected at `5a24c90cc26bc6329aa11058015a8393ff43c7b5`; deployment parity is unverified. No credentials, private billing dashboards, or inference endpoints were accessed.

## Finding

**The account-specific cause remains unresolved.** The code contains request guardrails, not a free-billing guarantee. A paid-project key would explain charged requests within those guardrails, but the repository cannot establish the project's actual tier or attribute invoice charges. Generation and essence-text embedding are separate possible charges; constructing the custom fingerprint vector itself is local computation.

Google states that API keys inherit their project's billing status; projects linked to a billing account inherit its tier. An advertised free-tier rate therefore does not establish eligibility for this key. AI Studio can show quota, and Cloud Billing reports can group Gemini API costs by SKU and usage date. Google also distinguishes free API access from Cloud welcome credits, which generally cannot pay Gemini API usage after the March 2026 change. Its billing FAQ explicitly exempts requests failing with **400 or 500** from token charges while counting them toward quota; this is not evidence for a blanket exemption for every error code. These policy facts are confirmed; their application to this account is not. [Official billing guide](https://ai.google.dev/gemini-api/docs/billing)

## What the current code does

| Stage | Evidence | Cost implication |
| --- | --- | --- |
| Generate DNA | [fetch.py](../../goodwatch-flows/windmill/f/dna/generate/fetch.py) reads `u/Alp/GEMINI_API_KEY` and calls `genai.Client(api_key=...)` / `generate_content`. Order: `gemini-2.5-flash`, then `gemini-3.6-flash`. | Source config targets the Developer API; actual deployment/environment should still be confirmed. Both attempts use the same key, so switching models does not select another billing tier. |
| Guard generation requests | Same file: configured RPD 60 and 100, headroom 5, atomic Redis reservation before each application-level call. Pacific-date keys; daily quota errors block a model until reset. | Effective local allowances are 55 and 95 attempts/day. These are constants, not live Google limits. There is no tier lookup, price lookup, or currency budget. SDK-level retries, if any, are not individually reserved here. |
| Retry/fallback | `MAX_RETRIES_PER_MODEL = 2` means up to two attempts per model. Validation/length failures retry with old output plus errors in the prompt; 5xx can retry once. Failure moves to the next model. | A successful API response rejected by local validation still performed inference. Correction prompts grow input usage. Up to four application-level calls per batch are possible within one fetch execution, subject to failure paths and guardrails. |
| Orchestrate | [iterate.py](../../goodwatch-flows/windmill/f/dna/generate/iterate.py) groups five entries; [next.py](../../goodwatch-flows/windmill/f/dna/generate/next.py) selects up to 100. [crawl flow](../../goodwatch-flows/windmill/f/dna/crawl_all_by_id.flow/flow.yaml) runs five groups concurrently and configures an exponential retry with `attempts: 1`. | Twenty generation calls is a clean 100-entry baseline, not an invoice bound. The flow retry is another potential replay layer beyond the Python attempts; confirm actual retries in job history. |
| Embed essence text | [vectors.py](../../goodwatch-flows/windmill/f/dna/generate/vectors.py) calls `embed_content` on `gemini-embedding-2` using the same key and generated `essence_text`, requesting 768 dimensions. [generation flow](../../goodwatch-flows/windmill/f/dna/generate_dna.flow/flow.yaml) invokes this after DNA generation. | A separate API operation with separate model pricing. It has no Redis quota guard or token usage logging. A list of texts in one call is not evidence of Google's discounted asynchronous Batch service. |
| Build custom vector | `create_embedding_from_scores` in `vectors.py` orders `CoreScores` fields and converts scores to floats locally. | This step has no model call. Its content quality depends on the preceding generated scores. |

Generation logs input, visible-output, thinking, and total token counts, and stores the winning model on the DNA record. Logs do not provide durable cost reconciliation or embedding usage. Request counters cannot distinguish successful-but-invalid output from provider failures for billing purposes. The source sets no explicit thinking budget, output cap, grounding tools, or cache creation.

## Reverified prices and limits

Standard text rates, USD per million tokens, as retrieved today:

| Configured model | Published free-tier text rate | Paid input | Paid output, including thinking |
| --- | --- | ---: | ---: |
| `gemini-2.5-flash` | Free | $0.30 | $2.50 |
| `gemini-3.6-flash` | Free | $0.75 through 2026-12-31; $1.50 afterward | $3.75 through 2026-12-31; $7.50 afterward |
| `gemini-embedding-2` | Free | $0.20 | Not applicable |

These are model/tier prices, not an entitlement for the deployed key. [Official pricing](https://ai.google.dev/gemini-api/docs/pricing)

Limits are per project, rather than per key, and can include RPM, input TPM, and RPD. RPD resets at midnight Pacific; active limits should be read in AI Studio. Another job using the project can consume quota outside this repository's counters. A request-count margin neither controls tokens nor determines billing. [Official rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

For paid calls, measure input and billed output, including thoughts, per attempt; estimate using the matching model's rates, then reconcile against billing. The API exposes `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, cached usage, and total usage; these are consumption metadata, not remaining free quota or an invoice amount. [GenerateContent response schema](https://ai.google.dev/api/generate-content#UsageMetadata) Thinking can contribute paid output beyond visible JSON. [Thinking guide](https://ai.google.dev/gemini-api/docs/thinking)

## Audit of the earlier note

[The September 4 review](gemini-dna-model-costs-2026-09.md) is historical context, not current deployment or account evidence:

- Its old three-model order, 20-request headroom, post-success counting, and UTC reset description no longer match this checkout. Current code already reserves attempts and uses Pacific dates.
- Its configured-generation prices for 2.5 Flash and 3.6 Flash are independently confirmed above. Google's current deprecation table also lists `gemini-2.0-flash-001` with June 1, 2026 shutdown and `gemini-3.6-flash` replacement, and lists 3.6 released July 21. This does not prove what caused a particular historical job error. [Official deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- The earlier approximately-$0 conclusion was conditional on a free-tier project; that condition was never account evidence. Its approximate generation totals omit separately billed essence embeddings and are not measured costs.
- Its generalized 404/non-200 billing claim borrowed Vertex AI policy for a Developer API client. Do not rely on that cross-product inference; the current Developer API billing FAQ explicitly mentions only 400 and 500.
- Other candidate-model and Cloud Monitoring metric claims are unnecessary to this ticket's present conclusion and were not revalidated here. Do not treat them as verified by this audit.

## Minimum redacted evidence to finish

Provide one matched time window, preferably an already-completed representative run:

1. AI Studio project **tier/plan**, effective billing status during that window, and active quotas for both generation models and the embedding model. Use a stable project alias; omit account identifiers and key values.
2. Confirmation that the Windmill variable belongs to that same aliased project, plus deployed script revision/model IDs and relevant environment routing settings. Never provide the secret itself.
3. Billing export or screenshot scoped to that project and dates, grouped by **service and SKU**, showing usage quantity, units, gross cost, credits, and net cost. Distinguish prepaid credit purchases from usage charges.
4. Redacted job timestamps/IDs, attempt and fallback counts, HTTP error codes, generation token logs, embedding request counts, and any other workload sharing the project.

If the same project is paid and corresponding generation/embedding SKUs match job usage, that supports the paid-tier explanation. If it was free throughout, investigate mismatched projects, unrelated services, delayed billing, and credit purchases before alleging erroneous per-call charging. No account evidence was available here, so neither branch is established.

## Decision unlocked by that evidence

A free route requires verified Free Tier project eligibility and active quotas for **both** API stages, with exhaustion handled as stop/defer. A predictably paid route requires per-attempt token accounting, a bounded experiment, explicit model/thinking/output settings, retry limits, and reconciliation of generation plus embedding costs per accepted title. These are proposed criteria for the later comparison protocol, not production changes or a finding that either route has already been configured.

Ticket status: **needs-info; open and unclaimed** pending the redacted evidence above.
