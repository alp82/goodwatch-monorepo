# Fingerprint comparison: completed human review

**Provisional interpretation: Qwen3.8 Flash (F) is the strongest default-value candidate; Grok 4.6 (A) is the premium comparison, especially for shows.** This interpretation combines the owner’s blind judgments and the measured first-pass charges. It is not a resolved provider strategy or a substitute for the pending independent judges and repeats.

## Cost, response validity, and latency

All figures are USD. Actual cost is the entire ten-title first pass for that configuration, including structural repair calls. The 1,000-title column is only a linear extrapolation of that observed average, not a price quote or catalog forecast. Cached input mix, title/output length, provider conditions and future prices can change the result. Embeddings, production storage and any new credit-purchase fees are excluded. No credits were purchased during this run.

| Label | Model | Actual / 10 titles | Extrapolated / 1,000 | First full-response validity | Median complete-title time |
|---|---|---:|---:|---:|---:|
| F | Qwen3.8 Flash | $0.00846 | $0.85 | 10/10 | 19.2s |
| A | Grok 4.6 | $0.28614 | $28.61 | 10/10 | 21.6s |
| E | MiMo V2.5 | $0.01116 | $1.12 | 10/10 | 20.3s |
| D | Qwen3.7 Flash | $0.00338 | $0.34 | 7/10 | 12.8s |
| B | MiniMax M3 | $0.01619 | $1.62 | 10/10 | 8.1s |

All five retained candidates supplied valid full responses for all ten titles after the allowed repairs. Median complete-title time spans the first attempt start through the final response, including waits between repairs. Separate HTTP latency and p95 values are in comparison-data.json and the execution report; these ten samples do not establish production throughput.

## What the owner’s judgments support

- **F — Qwen3.8 Flash, Alibaba, strict schema, requested thinking disabled:** the strongest price/quality balance in this pilot. Every overall verdict was positive; highlights include Fight Club, Breaking Bad, Adolescence and Black Mirror. Game of Thrones was “rather good,” and Preacher was “very good” with some traits understated. It cost $0.00846388 for all ten titles and needed no repairs. Requested disabled thinking is not proof of internally disabled computation.
- **A — Grok 4.6, xAI, strict schema, low reasoning:** the clearest TV strength. All five show verdicts were “very strong” or “extremely strong,” with Preacher the latter. The notable miss was Everything Everywhere All at Once (“not quite”), including severely understated coming of age. Its $0.286144 total was 33.81 times F’s cost and 76.02% of all reconciled first-pass spend. That premium is not justified by a universal win across movies and shows; it is a candidate for an explicit quality/cost choice.
- **E — MiMo V2.5, DeepInfra FP8, strict schema, requested thinking disabled:** consistently positive overall verdicts, with Game of Thrones and Preacher especially strong. Adolescence was only “good”; coming of age and pop culture were too low. It costs more than F and had a similar median completion time in this pilot, so there is no obvious broad advantage over F in the owner’s notes.
- **D — Qwen3.7 Flash, Alibaba, JSON-object mode, requested thinking disabled:** the cheapest retained configuration, with especially strong Everything Everywhere All at Once and Game of Thrones judgments. Black Mirror and Inside Out were “good.” Three full-response repairs were necessary: two omitted required-null animation_style fields in the common transport, and one used an invalid highlight key. All original 74-score sets were valid; 7/10 full responses passed initially and 10/10 after repair. The $0.00337971 total includes those repairs. It costs about 40% of F’s measured average, but requires more repair handling.
- **B — MiniMax M3, CoreWeave FP4, strict schema, requested thinking disabled:** fastest retained option by observed median complete-title time (8.1 seconds), with strong later TV results. Das Kanu des Manitu was “overall a bit off,” and the movie reviews repeatedly noted inflated coming of age. Its $0.01618840 total is about 1.91 times F’s cost. It remains plausible when latency matters, rather than being an automatic next elimination.

These are interpretations of free-text judgments, not numeric accuracy scores. “No flagged traits” was not converted into a formal pass threshold, and words such as “strong” were not assigned invented point values. Cross-candidate comparisons in the notes do not establish any candidate as ground truth.

## Complete survivor verdict matrix

Verdicts below are the owner’s original wording, trimmed only for table display. Detailed flags and all historical notes remain in completed-review.original.json.

| Title | A: Grok | B: MiniMax | D: Qwen3.7 | E: MiMo | F: Qwen3.8 |
|---|---|---|---|---|---|
| The Matrix | all looks good to me | rest is all good | rest is all good | rest good | rest good |
| Fight Club | very strong | looks great otherwise | very good | very strong | very strong |
| Everything Everywhere All at Once | not quite | looks great | very! strong | pretty good | otherwise strong |
| Das Kanu des Manitu | overall good | looks overall a bit off | rather strong | rather strong | also strong |
| Inside Out | very strong | good | good | pretty strong | strong |
| Breaking Bad | very strong | looks good | rather strong | strong | very! strong |
| Game of Thrones | very strong | very strong | very!! strong | very!! strong | rather good |
| Adolescence | very strong | very strong | strong | only good | very strong |
| Black Mirror | very strong | very strong | good | strong | very strong |
| Preacher | extremely strong | very good | very strong | super strong | very good |

## Screened configurations

Every executable configuration generated all ten titles before human screening. Early-screened candidates have fewer human reviews, so their quality record cannot be compared as if all ten titles had been judged.

| Label | Model | Human titles reviewed | Actual / 10 generated titles | Screen outcome |
|---|---|---:|---:|---|
| G | GPT-5.6 Luna | 2 | $0.01377 | Screened after Matrix/Fight Club; recurring inflated traits. |
| H | Mistral Small 4 | 1 | $0.01506 | Matrix: not impressed. |
| I | Nemotron 3.5 Lightning | 7 | $0.00708 | Screened after seven titles; weakness recurred across movies and shows. |
| M | DeepSeek V4.1 Flash | 1 | $0.01517 | Matrix: not impressed. |

- **C — Muse Spark 1.3 Contributor:** blocked by the existing account privacy policy.
- **J — GLM 5.3 Flash:** the pinned route returned upstream rate limits twice.
- **K/L — Gemini 3.6 Flash / 2.5 Flash:** both rejected the common strict schema’s complexity.

Those four have no usable outputs and cannot be ranked for trait quality. Each stopped after two transport attempts; the remaining titles were not attempted.

## Experiment totals and next decision

- Reconciled inference charges: **$0.3764186484**; account counter: $0.376418648, agreeing to displayed precision.
- Conservative reservations still retained for rejected requests: **$0.3525869667**, not additional measured charges.
- 101 inference attempts covered 94 candidate/title pairs; 36 planned pairs remained unattempted after their configurations stopped.
- 90 usable full responses after three repairs; 87 first-attempt full-response passes. All 90 initial generated 74-score sets were structurally valid.
- All ten titles are now human-reviewed for the five survivors. Earlier screened candidates retain their partial reviews.
- No paid judge API calls or embedding calls ran; no credit purchases or production writes occurred. Independent Astra/Fable reviews, finalist repeatability and separate embedding measurement remain pending.

**Recommended next pair for the human to consider: F and A.** This compares the low-cost general candidate with the premium option that performed especially well on shows. If minimizing spend is the overriding goal, D is the alternative challenger; if latency dominates, B is the alternative. The owner has not yet selected two finalists, and this report starts no repeat inference.

Keep this report and human judgments out of the independent judges’ initial context. They should still use only the original blind-first packets.

Primary artifacts: [original human export](completed-review.original.json), [machine-readable comparison](comparison-data.json), [per-attempt execution evidence](../evidence-first/README.md), [final account reconciliation](../evidence-first/final-account-check.json), [pinned model/route identities](../blind-key-private.json).
