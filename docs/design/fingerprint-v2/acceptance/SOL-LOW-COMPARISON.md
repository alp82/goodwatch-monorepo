# Sol 6.1 low: matched local-agent extension

The subsequent [Astra low comparison](ASTRA-LOW-COMPARISON.md) includes all three arms on identical shared fields. The original Sol results below remain unchanged.

**Verdict: keep Sol low as a useful supporting producer and cross-check, not an automatic replacement for Qwen or an approved unattended collector.** It resolves several retained semantic/factual problems and is more consistent in the two repeats, but produces fewer complete vectors and leaves substantially more advisory questions unresolved. The field inventory stays unchanged.

Completed 38 fresh `gpt-6.1-sol` / `low` agents: twelve titles × three disjoint parts, plus exact-input vector repeats for Truman and Mushishi. Every initial raw output was saved once; all 38 parse and pass their wire schemas. No retries, repairs, OpenRouter calls, paid-ledger changes or production changes occurred. Subscription allowance consumption was not measured.

Each agent received only its matched Qwen system/user content and output schema, with local file-writing instructions. Prior predictions and assessment findings were excluded. The explicit spawn arguments establish the selected configuration; there is no independent server-side model attestation. The local tool wrapper and schema instructions differ from API-enforced structured output. Qwen results include earlier bounded follow-ups, so this is a matched selected-prompt comparison, not an equal-attempt-cost contest.

## Coverage and contradictions

| Measure | Qwen selected outputs | Sol low first attempts |
|---|---:|---:|
| Numeric vector coordinates | 3285/3288 | 3252/3288 |
| Complete vectors | 10/12 | 5/12 |
| Numeric targeted attributes | 3436/4064 | 3639/4064 |
| Existing publication-pair checks pass | 7/12 | 5/12 |
| Unknown advisory topics | 14/264 | 111/264 |
| Known-value intake-pair contradictions | 5 | 0 |
| Additional bounded cross-part contradictions | 9 | 2 |
| Numeric-complete and all bounded checks clear | 3/12 | 3/12 |

Sol has 36 vector nulls spread over seven titles; Qwen has three spread over two. The higher total targeted coverage for Sol is driven by Daughters and The Witch. Across the other ten titles, Qwen supplies 3,380 targeted numbers versus Sol’s 3,008. This is neither universal coverage superiority nor a reason to force unknowns to zero.

Sol marks 123 advisory topics present, 30 absent and 111 unknown; Qwen marks 101 present, 149 absent and 14 unknown. More abstention can avoid false reassurance but also makes exclusion filters unavailable. This difference does not by itself establish which model is more accurate.

Sol’s two cross-part conflicts are `sound.audio_startles=1` alongside jump-scare presence `absent` in Singin’ in the Rain and Paterson, contrary to the supplied audiovisual definition. Its three automatically clear complete fingerprints are Truman, Breaking Bad and The Witch. Passing these checks is not factual acceptance.

## Every title

Linked fingerprints show one key/value row per canonical attribute, including nulls. Movie-only series traits remain explicitly inapplicable.

| Title / full Sol fingerprint | Vector Qwen → Sol /274 | Targeted Qwen → Sol |
|---|---:|---:|
| [Thank You for Smoking](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/thank-you-for-smoking/fingerprint.md) | 274 → 262 | 336 → 320 /336 |
| [The Truman Show](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/the-truman-show/fingerprint.md) | 274 → 274 | 336 → 307 /336 |
| [Breaking Bad](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/breaking-bad/fingerprint.md) | 274 → 274 | 343 → 306 /344 |
| [Code Geass: Lelouch of the Rebellion](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/code-geass/fingerprint.md) | 274 → 271 | 343 → 308 /344 |
| [Koyaanisqatsi](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/koyaanisqatsi/fingerprint.md) | 274 → 273 | 333 → 325 /336 |
| [Daughters of the Dust](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/daughters-of-the-dust/fingerprint.md) | 274 → 269 | 55 → 301 /336 |
| [Singin' in the Rain](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/singin-in-the-rain/fingerprint.md) | 274 → 274 | 332 → 311 /336 |
| [Paterson](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/paterson/fingerprint.md) | 274 → 274 | 335 → 283 /336 |
| [The Witch](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/the-witch/fingerprint.md) | 274 → 274 | 1 → 330 /336 |
| [Persepolis](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/persepolis/fingerprint.md) | 273 → 271 | 336 → 271 /336 |
| [Detectorists](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/detectorists/fingerprint.md) | 272 → 272 | 343 → 265 /344 |
| [Mushishi](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/mushishi/fingerprint.md) | 274 → 264 | 343 → 312 /344 |

## Numerical disagreement with Qwen

These are same-field differences, not errors against a gold reference. Nulls, missing values and NAs are never imputed. Facts below include numeric advisory intensity/frequency/explicitness; categorical facets are compared separately in the full export.

| Part | Shared numeric | Mean absolute difference | Median | P90 | Maximum |
|---|---:|---:|---:|---:|---:|
| vector | 3249 | 1.143 | 1 | 3 | 9 |
| targeted | 3054 | 0.923 | 0 | 3 | 10 |
| facts | 438 | 1.591 | 1 | 4 | 8 |

## Identical-input repeats

| Title | Same fields in both models’ repeat pairs | Qwen mean change | Sol mean change | Qwen / Sol maximum |
|---|---:|---:|---:|---:|
| the-truman-show | 274 | 0.810 | 0.299 | 10 / 4 |
| mushishi | 262 | 0.676 | 0.248 | 3 / 3 |

Truman changes on 71 Sol coordinates, but digital simulation remains 0; Qwen’s prior repeat changed that field from 0 to 10. Mushishi changes on 62 jointly numeric coordinates and has four additional number↔null transitions. The 262-field Qwen mean above is recomputed on the exact Sol repeat overlap; Qwen’s original all-274 mean remains 0.661. Two repeats show an observed advantage, not established general reliability.

## Practical quality assessment

The retained evidence supports several specific improvements:

- **The Witch:** digital capture replaces the incorrect 35mm claim; the 1900s setting error disappears. Targeted coverage rises from 1 to 330 of 336 applicable scores.
- **Singin’ in the Rain:** removes breaking/hip-hop and masala classifications, retaining ballet, jazz, tap and musical theatre.
- **Persepolis:** records both color and black-and-white presentation.
- **Daughters of the Dust:** recovers sexual-violence presence and the LA Rebellion tradition. Profanity and substance use become unknown rather than falsely absent, so those filters remain incomplete.
- **Paterson:** recovers narration. The wrong 35mm assertion becomes unknown, which avoids an error but does not supply the supported digital-capture fact.
- **Detectorists:** preserves serialized continuity and multi-episode arcs alongside episodic structure.

Important problems remain. Mushishi still receives supernatural hunting 8 and monster focus 8, so its ecological-investigation distinction remains vulnerable in niche searches. Sol introduces some unverified advisory positives and precise dates. Daughters receives dystopian society 5, an interpretive boundary concern. The two audio-startle conflicts and seven incomplete vectors remain unresolved. These examples support using Sol to identify disagreements worth checking, not automatically trusting whichever model offers a value.

The separate [all-title assessment](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/quality/REPORT.md) distinguishes supported corrections, safer abstention, remaining uncertainty and interpretive disagreements. It does not replace scores or infer truth from model agreement.

## Artifacts and scope

- [Complete numeric/categorical comparison](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/results-final-v1/summary.json) and sibling CSV tables include groups, outliers and exact raw references.
- [Cross-part audit](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/consistency-final-v1/REPORT.md) uses the same checks as Qwen.
- [Producer manifest](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/manifest.json) binds all matched messages and schemas; [agent configuration evidence](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/controller/agent-provenance.json) records all 38 explicit local spawns.
- [Independent verification](/home/alp/.local/share/goodwatch-benchmarks/v2-acceptance-sol-low-v1/verification/independent-verification.json) checks preserved values, assembly, metrics and source hashes.

The practical next use is selective second opinions on known failures and retained disagreements. Do not silently stitch both models’ preferred values into one accepted vector. Neither these results nor the original Qwen pass approve unattended trusted collection. No new attributes are needed to explain the material failures observed here.
