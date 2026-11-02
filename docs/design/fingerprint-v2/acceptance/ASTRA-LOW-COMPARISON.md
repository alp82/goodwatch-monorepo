# Astra low: matched local-agent extension — 25 October 2026

**Verdict: this pass does not establish a practical upgrade over Sol low.** Astra low is close to Sol in its numerical predictions, has slightly less repeat drift on the two checks, but produces fewer complete vectors and fewer populated targeted attributes. Keep Qwen primary and Sol supporting; none of these passes approves unattended trusted collection.

Completed 38 fresh `gpt-6-astra` / `low` agents: twelve titles × vector, targeted attributes and facts, plus exact-input vector repeats for Truman and Mushishi. All 38 first outputs parse and pass their wire schemas. No repairs, retries, OpenRouter calls, paid-ledger changes or production changes occurred. Subscription allowance and cost were not measured.

Every producer received the exact same title, message content and wire schema as its Sol counterpart. The prompts match the selected Qwen component lineage, including its mixture of original and later recipes. Prior answers and quality findings were excluded. The two local-agent arms share their read/write wrapper; Qwen used API structured output and had bounded earlier follow-ups. Explicit spawn settings establish the requested local configuration; separate server-side attestation is unavailable.

## Coverage and consistency

| Measure | Qwen | Sol low | Astra low |
|---|---:|---:|---:|
| Complete vectors | 10/12 | 5/12 | 4/12 |
| Numeric vector coordinates | 3285/3288 | 3252/3288 | 3250/3288 |
| Numeric targeted attributes | 3436/4064 | 3639/4064 | 3523/4064 |
| Existing publication-pair checks pass | 7/12 | 5/12 | 4/12 |
| Unknown advisory topics | 14/264 | 111/264 | 113/264 |
| Known-value intake-pair contradictions | 5 | 0 | 0 |
| Additional bounded cross-part contradictions | 9 | 2 | 2 |
| Numeric-complete and all bounded checks clear | 3/12 | 3/12 | 3/12 |

Astra has 38 vector nulls spread over eight titles. Its four complete vectors are Truman, Breaking Bad, Paterson and The Witch. Paterson fails the same audio-startle/jump-scare definition check as in Sol, leaving three complete fingerprints without a detected deterministic blocker. Singin’ in the Rain has the other conflict and also has two vector nulls. None of these automatic results establishes factual quality.

Astra marks 119 advisory topics present, 32 absent and 113 unknown. This is close to Sol’s 123/30/111 and very different from Qwen’s 101/149/14. Unknowns cannot support exclusion filters; known absence is not interchangeable with unassessed content. Fewer contradictions partly reflect fewer known assertions.

## Every title

Each linked Astra fingerprint contains one key/value row per canonical attribute. Unknowns and eight movie-inapplicable series scores remain explicit.

| Title / full Astra fingerprint | Vector Qwen / Sol / Astra (of 274) | Targeted Qwen / Sol / Astra |
|---|---:|---:|
| [Thank You for Smoking](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/thank-you-for-smoking/fingerprint.md) | 274 / 262 / 262 | 336 / 320 / 279 (of 336) |
| [The Truman Show](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/the-truman-show/fingerprint.md) | 274 / 274 / 274 | 336 / 307 / 291 (of 336) |
| [Breaking Bad](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/breaking-bad/fingerprint.md) | 274 / 274 / 274 | 343 / 306 / 301 (of 344) |
| [Code Geass: Lelouch of the Rebellion](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/code-geass/fingerprint.md) | 274 / 271 / 271 | 343 / 308 / 299 (of 344) |
| [Koyaanisqatsi](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/koyaanisqatsi/fingerprint.md) | 274 / 273 / 273 | 333 / 325 / 234 (of 336) |
| [Daughters of the Dust](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/daughters-of-the-dust/fingerprint.md) | 274 / 269 / 265 | 55 / 301 / 290 (of 336) |
| [Singin' in the Rain](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/singin-in-the-rain/fingerprint.md) | 274 / 274 / 272 | 332 / 311 / 306 (of 336) |
| [Paterson](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/paterson/fingerprint.md) | 274 / 274 / 274 | 335 / 283 / 323 (of 336) |
| [The Witch](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/the-witch/fingerprint.md) | 274 / 274 / 274 | 1 / 330 / 326 (of 336) |
| [Persepolis](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/persepolis/fingerprint.md) | 273 / 271 / 272 | 336 / 271 / 301 (of 336) |
| [Detectorists](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/detectorists/fingerprint.md) | 272 / 272 / 268 | 343 / 265 / 268 (of 344) |
| [Mushishi](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/mushishi/fingerprint.md) | 274 / 264 / 271 | 343 / 312 / 305 (of 344) |

## Numerical disagreement on identical fields

All three arms are compared on the same numeric intersection within each part. These are disagreements, not errors against reference truth. This common intersection differs from earlier two-arm tables; a changed average does not mean a model improved. Facts here refer to numeric advisory intensity/frequency/explicitness, not numeric encodings of categories.

| Part | Shared fields | Qwen–Sol mean | Qwen–Astra mean | Sol–Astra mean |
|---|---:|---:|---:|---:|
| vector | 3236 | 1.144 | 1.108 | 0.327 |
| targeted | 2839 | 0.946 | 0.909 | 0.262 |
| facts | 405 | 1.528 | 1.486 | 0.264 |

For vector scores, Sol–Astra median difference is 0, P90 is 1 and maximum is 6. Astra is slightly closer to Qwen on these shared fields; that is not evidence of greater accuracy. The full JSON includes median, P90, maximum, total and RMSE for every pair and part.

## Identical-input repeats

| Title | Shared coordinates across all repeat pairs | Qwen mean change | Sol mean change | Astra mean change | Qwen / Sol / Astra maximum |
|---|---:|---:|---:|---:|---:|
| the-truman-show | 274 | 0.810 | 0.299 | 0.245 | 10 / 4 / 2 |
| mushishi | 259 | 0.672 | 0.247 | 0.236 | 3 / 3 / 3 |

Truman’s Astra simulation score stays at 0, whereas Qwen previously changed 0→10. Mushishi’s Astra repeat loses eight previously numeric scores to null. Its all-available numeric mean change is 0.232 on 263 fields; the table uses the smaller 259-field intersection shared with Sol and Qwen. A stable numeric subset must not hide those eight lost values. Two repeats do not establish model-wide stability.

## Practical quality findings

The retained factual improvements mostly overlap with Sol: correct dance categories for Singin’ in the Rain, digital capture for The Witch, mixed color presentation for Persepolis, Daughters’ sexual-violence warning and cultural tradition, and Detectorists’ continuing story arcs. The 64 inspected field comparisons did not establish an additional source-backed factual correction unique to Astra.

There are useful local differences, but no consistent coverage gain:

- **Paterson:** targeted numeric coverage rises from Sol’s 283 to Astra’s 323; the capture field remains unknown and the audio-startle conflict remains.
- **Persepolis:** targeted coverage rises from 271 to 301. Exact years become unknown instead of asserting unverified precision; the vector still has two nulls.
- **Koyaanisqatsi:** targeted coverage falls from 325 to 234 despite retaining the same key semantic corrections.
- **Thank You for Smoking:** targeted coverage falls from 320 to 279; both leave twelve vector coordinates unresolved.
- **Daughters of the Dust:** Astra removes Sol’s dystopia 5 interpretation, but this is a narrower reading rather than an independently established correct ordinal. Known positive profanity/substance-use information remains unknown in both.
- **Mushishi:** supernatural hunting falls from Sol’s 8 to Astra’s 6 and monster focus from 8 to 7. The ecological-investigation versus monster-hunting boundary remains consequential; nonhuman protagonist rises from 0 to 2 and warrants a role check.

The [all-title content review](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/quality/REPORT.md) checks retained concrete concerns against the same saved evidence. It distinguishes verified corrections, unknown replacing a wrong claim, and unresolved interpretive differences. No scores were replaced, and no accuracy percentage is inferred from these spot-checks.

## Evidence and limits

- [Three-arm machine-readable comparison](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/three-arm-comparison.json) includes all common field values, metrics, repeat transitions and source hashes.
- [Astra full export and outlier tables](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/results-final-v2/summary.json) retain exact raw references and missingness.
- [Bounded consistency audit](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/consistency-final-v1/REPORT.md).
- [Actual agent configuration record](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/controller/agent-provenance.actual.json) and [matched input manifest](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/manifest.json).
- [Independent verification](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-astra-low-v1/verification/independent-verification.json).

The frozen schema and producer wording remain unchanged. This extension tests a model/effort combination under the same local protocol; it does not authorize production publication or silently combine preferred values from different models.
