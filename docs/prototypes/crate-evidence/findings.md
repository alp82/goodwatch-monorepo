# Scratch evidence column: measured findings

Experiment run on 2026-09-20 after explicit user approval, for [Scratch-table prototype of the evidence column in Crate](https://github.com/alp82/goodwatch-monorepo/issues/104).

**Status: experiment complete; user quality review and analyzer choice remain open.** No relevance judgments or production rollout decision have been made.

[Open the self-contained review page](review.html). It compares top tens and exposes matching source evidence. [Method, commands and limitations](README.md).

## Measured scope

Created only `doc.prototype_search_evidence_104_v1`: 5,000 titles, exactly 2,500 movies and 2,500 shows, including 3,700 titles with trope names. Combined source evidence contains 14,680,668 UTF-8 bytes before index/control-column duplication. No source catalog or sync-flow writes occurred. The scratch table is retained for review and must be dropped when the ticket closes.

Frozen 13 request interpretations using the existing D4+ full attribute questions and short fingerprint questions: 26 Jev requests, 105,630 input tokens, approximately $0.004436 at the inherited prototype's rate. The inherited `jev-latest` model alias was not changed; saved readings make this retrieval comparison repeatable despite future alias changes.

All variants used the same captured interpretations, sample, eligibility IDs and fingerprint scores. Each request/variant had one warm-up and five measured runs in rotated, alternating order. The first request was repeated after analyzer probes finished to exclude concurrent probe traffic; published artifacts contain that repeat. There were 90 separate read-only analyzer probes.

## Latency

Median of the per-request median retrieval wall times, excluding the two mood-gated cases:

| Variant | Median | Per-request range |
| --- | ---: | ---: |
| Original D4+ predicate | 482.8 ms | 223.3–1385.9 ms |
| D4+ essence-text predicate | 407.8 ms | 174.8–1280.8 ms |
| Combined evidence / standard | 134.7 ms | 80.5–213.6 ms |
| Combined evidence / English | 130.1 ms | 97.3–164.7 ms |
| Combined evidence / English / strong boost 2 | 137.3 ms | 93.2–488.9 ms |

These are sample retrieval timings, not production search latency. They exclude Jev, attribute eligibility precomputation, rendering, and Qdrant fill. Source tables and the scratch table have different sizes and shard layouts. Candidate cap, deterministic sample fallback, and cached fingerprint/display data differ from an unmodified full-catalog D4+ call. The consolidated query also removes the original phrase-prefix bonus and separate fallback queries. Standard versus English is the controlled analyzer comparison; baseline versus consolidated is a broader retrieval comparison.

## Result examples for human review

- **Dark comedy about rich people:** corrected D4+ begins with Crime Scene Cleaner, Wonder Showzen, The Wolf of Wall Street, Heathers, and Don't Look Up. English consolidated begins with Saltburn, Killing It, The Favourite, The Righteous Gemstones, and American Psycho. This is a promising change, not a recorded human quality judgment.
- **Rich people being absolutely awful to each other, preferably funny:** the English column includes Saltburn, American Psycho, The Favourite, The Righteous Gemstones, Succession and The White Lotus. Compare the full top ten rather than accepting increased candidate count as quality.
- **Car chases:** English finds 211 candidates versus 22 for unstemmed consolidated evidence and 91 for corrected D4+. Consolidation and stemming change both candidate coverage and order. A bigger candidate pool is not automatically better.
- **Indirect unreliable-narrator request (“feeding you nonsense”):** corrected D4+ returns only four text candidates, including Wallace & Gromit and WALL·E. The consolidated column falls through to different phrases and produces 42 candidates, including Mulholland Drive, Gone Girl, Vertigo and Psycho. Human judgments must decide whether these fit the intended meaning.
- **Tense but not bleak / with my parents:** the inherited mood gate skips text retrieval. Empty panels are expected in this sample-only experiment; Qdrant fill was deliberately not run.
- **With my parents:** the inherited interpretation also requires family and intergenerational suitability. That is an existing interpretation assumption, not a decision made by this experiment.

## Analyzer problems and ranking cautions

The live probes establish concrete tradeoffs:

- English stemming gives `car chase` and `car chases` the same top ten, and lets `sunglass` find the sunglasses results where the standard index finds none.
- English gives `university` and `universe` identical top-ten IDs and scores across all three probed match modes. Standard distinguishes them.
- English gives `no anime` and `anime` identical top-ten IDs and scores, and likewise `not bleak` and `bleak`. Exclusions must remain structured constraints. Its `anime` results also include Animal Control, illustrating another reason to review the strength of the stemming.
- The original and corrected eligibility predicates return the same candidate sets for every request, but their raw score contributions differ and the final top-ten order differs on 9 of the 11 text-search requests. Do not treat the predicate optimization as automatically ranking-neutral.
- Candidate sets stayed stable across the five measured repetitions of every variant. Two corrected-baseline requests had top-ten order changes between repetitions (the long tense request and long crime-show request); the other measured top tens were stable. The report displays the last measured ranking and preserves stability flags.
- A strong-evidence boost of 2 was measured as an exploratory alternative. It is not a chosen production weight.

## Recommendation for the live review

Continue with separate strong and prose evidence columns, subject to the user's result judgments. Do not lock the built-in English analyzer yet: compare a gentler stemmer or retain standard indexing with controlled query-side plural handling. The present experiment did not create a custom cluster analyzer. A custom-analyzer experiment would extend the approved write scope and should be made concrete before requesting that extension.

The reviewed baseline and per-request quality floors remain owned by [Establish and review the search evaluation baseline](https://github.com/alp82/goodwatch-monorepo/issues/116). This experiment neither resolves that ticket nor substitutes agent judgments for the user's.

## Evidence

- [Compact comparisons](comparison.json), [captured interpretations](interpretations.json), [per-query timings](timings.json), [analyzer probes](probes.json), [load record](load.json), and [sample IDs and snapshot hash](sample-manifest.json).
- Raw sample snapshot and repeated result payloads remain in `goodwatch-webapp/scripts/prototype-crate-evidence/private/` in the experiment worktree, excluded from Git. No credentials are included in the published artifacts.
- The review page was opened in Chromium: 20 result cards rendered for the two-column comparison, changing a judgment updated the in-memory count, no page errors were observed, and a 390-pixel viewport had no horizontal overflow. That temporary UI-check judgment was discarded and is not a user relevance judgment.
