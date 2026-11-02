# Stored trope inventory and additional gaps

The stored trope audit supports two additional scoring candidates—**foreshadowing** and **dramatic irony**—and a wider sparse concept vocabulary. Symbolism is an optional calibration candidate. These are proposals for evaluation; the 547-attribute definitions and production systems remain unchanged.

## Inventory and review scope

| Source | Inventory | What the count means |
|---|---:|---|
| Published movie arrays | 36,204 exact names; 2,679,783 entries | 55,744 movie rows have nonnull arrays |
| Published show arrays | 37,076 exact names; 1,125,725 entries | 13,706 show rows have nonnull arrays |
| Combined arrays | **42,936 exact names; 3,805,508 entries** | Exact-name vocabulary, with per-name deduplicated title counts |
| Detailed trope table | **42,142 stored URL strings; 3,830,249 rows** | A different source/unit; these are not validated canonical identities |
| Selected stored contexts | 468 excerpts for 169 stored URL strings | Title-specific, sometimes truncated assertions; not generic trope definitions |

[Extraction provenance](tropes-extraction-manifest.json) and [context provenance](tropes-example-extraction-manifest.json) preserve queries and hashes. All names received computational screening. The vocabulary branch semantically reviewed 1,282 prioritized names; the other branches reviewed selected narrative/search families and contexts. The reviews overlap and must not be added as a unique review count. Unresolved lexical labels are not missing attributes. No TV Tropes website requests or production writes occurred.

## Recommended additions

Foreshadowing has 12,133 exact-name title associations and Chekhov's Gun has 10,266. They expose setup/payoff and anticipatory clues beyond surprise, concealed information, or quality. Dramatic Irony has 2,389 associations and describes differences in audience/character knowledge. Neither count proves demand, correctness, prominence or ranking benefit.

Sparse additions include frames and nested stories, conflicting accounts, symbolic/musical motifs, soundtrack counterpoint, tone/genre transitions, protagonist/opponent roles, practical competence, blackmail and wrongful accusation, hostage/siege situations, nonhuman communication, hive minds and soul containment, astral projection, impossible geometry, living/generation ships, and specific action choreography. Precise relationships and outcomes matter as much as the nouns.

Existing structures already cover parts of these ideas. Fall from grace includes moral decline; temporal scopes can express genre transitions; outcome relations can express who survives or wins. Bookends partly overlaps cyclical returns. Arranged marriage, curses, wishes and precognition were already proposed in the earlier query audit. Avoid extra similarity weight from these overlaps.

The consolidated [JSON recommendations](recommended-changes.json) retain the earlier five scored candidates and add a separate trope addendum. Full proposed vocabularies and examples remain in the branch reports rather than being discarded in this summary.

## Source-quality findings to benchmark

The vocabulary contains people, works, recaps, creator references, aliases and nonliteral names. **The Dragon** can mean a villain's lieutenant; **The Ghost** can be an unseen person; **Kick the Dog** need not depict animal harm. Mexican standoffs do not establish a Mexican setting. Averted and subverted tropes are not automatically positive occurrences.

There are **1,452 malformed stored URL strings affecting 3,416 detailed rows**, including duplicated host prefixes. Only 35,403 stored strings have both an actual TV Tropes host and a Main path. Retain originals and normalize identities deliberately; do not infer unique-title counts by summing aliases. The array and detailed-table count difference is observed; its cause was not established.

Selected excerpts also mix books, albums, episodes and adaptations, or attach to suspect catalog identities. Consequently neither stored trope assertions nor generated essence tags are reference truth. Benchmark cases need independent identity/scope verification, explicit assertion mode, spoiler controls and supported absence judgments.

## Complete branch results

- [Vocabulary findings](tropes-vocabulary-findings.md), [15-family proposals](tropes-vocabulary-proposals.json), [screening](tropes-vocabulary-screening.json), [all-name ledger](tropes-vocabulary-ledger.json.gz), [reviewed sample](tropes-vocabulary-reviewed-sample.json), [URL roles](tropes-vocabulary-url-roles.json).
- [Narrative findings](tropes-narrative-findings.md) and [14-family proposals](tropes-narrative-proposals.json).
- [Search findings](tropes-search-findings.md) and [29-family proposals](tropes-search-proposals.json), including 78 synthetic query scenarios and 104 referenced labels. These are imagined cases, not measured search demand or retrieval results.

The [wayfinder review packet](../../design/fingerprint-v2/wayfinder/README.md) carries all these inventories into the benchmark/prototype program.
