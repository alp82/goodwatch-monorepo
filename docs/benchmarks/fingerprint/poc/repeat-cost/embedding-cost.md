# Essence-text embedding cost baseline

Run date: 2026-09-14. **20/20 valid vectors, each 768 dimensions.** The API measured **1,881 text input tokens**. At the current standard paid rate of **$0.20 per million text tokens**, this sample costs **$0.0003762**, or **$0.01881 per 1,000 titles** (1.881 cents).

This is a rate-derived cost using measured token usage, **not an observed invoice charge**. No billing-export access or account-tier/credit reconciliation was available. Actual charged cost is unmeasured; free-tier allowances or credits could differ. Do not label the paid-rate baseline as an invoice-confirmed charge.

## Sample and settings

- Ten original first-pass F essence texts and ten original first-pass D essence texts from commit `a7841d2`. “First pass” includes its allowed structural repairs: the earliest fully schema-valid result for each model/title is selected. These are the original comparison experiment’s texts, not newly generated repeat texts. The D repeat outage does not reduce this pre-existing valid sample.
- The [input manifest](embedding-inputs.json) records model label, title ID, original artifact and exact essence text for every input.
- Deployed settings verified read-only from Windmill before calls: `gemini-embedding-2`, `RETRIEVAL_DOCUMENT`, 768 dimensions; [deployed script snapshot](deployed-vectors.py.snapshot).
- One synchronous `batchEmbedContents` request containing twenty independent content requests, matching the deployed list-input embedding behavior. No asynchronous Batch API discount applies. One attempt per input; no retries, truncation, padding, title prefix, model substitution or production database/index writes.
- The raw [request](embedding-request.json), [response including usageMetadata](embedding-response.json), [ledger](embedding-ledger.json) and [pricing record](embedding-pricing.json) are preserved. Every vector was checked for exactly 768 finite numeric values.

## Calculation

| Quantity | Result |
|---|---:|
| Valid essence inputs | 20 |
| Measured text input tokens | 1,881 |
| Mean tokens per title | 94.05 |
| Standard paid rate / 1M text tokens | $0.20 |
| Rate-derived sample cost | $0.0003762 |
| Rate-derived cost / 1,000 titles | $0.01881 |
| Invoice-confirmed charge | Unmeasured |
| Synchronous request elapsed time | 0.705 seconds |

Formula: `1881 / 1_000_000 × 0.20 = 0.0003762`; scaling the twenty-title sample by `1000 / 20` gives `0.01881`.

The conservative pre-call reservation was $0.0032324, calculated from UTF-8 input bytes plus per-input overhead at the standard paid text rate. Measured usage reduced the rate-derived allowance to $0.0003762. Combined experiment accounting, including two unresolved generation-rejection reservations, is $0.016148324, below the approved $0.05.

[Google’s current pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-embedding-2) supports the standard paid rate; [the API reference](https://ai.google.dev/api/embeddings) defines synchronous batch output ordering and usage metadata. Both were checked on 2026-09-14.

## Use for the embeddings follow-up

Use **94.05 measured input tokens/title and $0.01881/1,000 titles at today’s standard paid rate** as this sample’s baseline. Preserve its exact twenty texts and deployed task/dimension settings when comparing alternatives. This experiment measured expense and output shape only; it did not measure retrieval quality, similarity, ranking, throughput at scale or catalog-wide text lengths. A future model comparison remains outside this validation ticket.
