# First-pass execution evidence

**Quality review is pending. Structural validity does not establish factual or trait accuracy.**

Reconciled inference charges: **$0.3764186484**. Additional unresolved reservations: **$0.3525869666666666666768**. No judge API or embedding calls have run. The account has a $9 non-resetting cap; the complete experiment ceiling is $10.

| Configuration | Titles attempted / 10 | First full-response valid | Full valid after retry | Attempts | Reconciled USD | Held USD |
|---|---:|---:|---:|---:|---:|---:|
| google/gemini-2.5-flash @ google-ai-studio | 1/10 | 0 | 0 | 2 | 0 | 0.1051069999999999944220 |
| google/gemini-3.6-flash @ google-ai-studio | 1/10 | 0 | 0 | 2 | 0 | 0.1941581666666666722548 |
| deepseek/deepseek-v4.1-flash @ deepinfra/fp8 | 10/10 | 10 | 10 | 10 | 0.015166720 | 0 |
| z-ai/glm-5.3-flash @ deepinfra/fp4 | 1/10 | 0 | 0 | 2 | 0 | 0.03325820 |
| openai/gpt-5.6-luna @ openai | 10/10 | 10 | 10 | 10 | 0.01377491 | 0 |
| meta/muse-spark-1.3-contributor @ meta | 1/10 | 0 | 0 | 2 | 0 | 0.0200636 |
| qwen/qwen3.8-flash @ alibaba | 10/10 | 10 | 10 | 10 | 0.00846388 | 0 |
| qwen/qwen3.7-flash @ alibaba | 10/10 | 7 | 10 | 13 | 0.00337971 | 0 |
| mistralai/mistral-small-2603 @ mistral | 10/10 | 10 | 10 | 10 | 0.015058635 | 0 |
| minimax/minimax-m3 @ coreweave/fp4 | 10/10 | 10 | 10 | 10 | 0.01618840 | 0 |
| xiaomi/mimo-v2.5 @ deepinfra/fp8 | 10/10 | 10 | 10 | 10 | 0.0111639934 | 0 |
| nvidia/nemotron-3.5-lightning @ deepinfra/bf16 | 10/10 | 10 | 10 | 10 | 0.00707840 | 0 |
| x-ai/grok-4.6 @ xai | 10/10 | 10 | 10 | 10 | 0.286144 | 0 |

## Interpretation and limitations

- The primary 74-score structural check is reported separately from full-response validity. The JSON-only repairs corrected two omitted required-null animation_style fields and one invalid highlight key; original score vectors remain available, annotated with full-response outcome.
- This is a ten-title pilot. Full-response and 74-score human/Astra/Fable quality reviews remain pending; no winners or finalists are selected.
- Transport errors are distinct from unknown titles or bad fingerprints. Remaining titles for stopped configurations were not attempted. All costs include failed paid attempts where charges are available.
- A rejected request without generation metadata retains its full reservation even when the observed account delta is zero. Held values are conservative allowances, not measured charges. Later unexplained account usage stops the run.
- Generation metadata and key-usage counters were observed to lag responses. Read-only polling reconciles them; it never resubmits an inference request.
- Public model IDs map to dated canonical slugs in generation metadata. The captured public model catalog verifies these exact mappings; neither candidate IDs nor providers were substituted.
- Requested reasoning and returned reasoning counts are preserved. Zero reported reasoning tokens alone does not prove the provider disabled internal computation. Provider-side retries/streaming metadata may differ from the single non-streaming client request and are preserved.
- Latency statistics in summary.json include observed request attempts, with sample counts; summed HTTP attempt time excludes accounting polls and backoff. Complete-pair wall time additionally includes all intervening waits from the first attempt start through the final response, including any manual recovery pause. Ten titles gives a small sample.
- Repeats and separately billed finalist embeddings depend on independent first-pass review and human selection. Cost per human-accepted title is therefore unmeasured.
- Public copies redact account/user/workspace identifiers from response metadata. Raw response content and generation details are otherwise preserved; private original captures remain in the execution worktree.

Reviewers should use only `../blind-first/` before recording their initial judgments. The mapping and this financial report must remain outside their review context.
