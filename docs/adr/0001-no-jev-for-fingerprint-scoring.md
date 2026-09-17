---
status: accepted
---

# Don't use Jev for fingerprint scoring

We tested TypeSafe's Jev model as a faster source for the 74 fingerprint scores and decided to keep Qwen3.8 Flash with Qwen3.7 Flash as fallback. Jev scores only what the input text states and shows no knowledge of the title. With our synopsis-only input, the mean difference to the reviewed Qwen3.8 scores was 2.65 points against a 0.51 repeat-run noise floor, and craft traits such as `editing` and `acting` were 6 to 7 points too low. Jev is 10 to 25 times faster, but it costs about the same as Qwen3.8 ($0.79 vs. $0.85 per 1,000 titles) and can't write the essence text or tags, so a second model would still be needed.

Evidence: [Jev scoring experiment](../benchmarks/fingerprint/jev/README.md), September 17, 2026.

## Consequences

Revisit this decision only if fingerprint input gains rich text per title, such as reviews or long plot summaries. Batch size isn't a lever: Jev answers are the same from 1 to 222 questions per request.
