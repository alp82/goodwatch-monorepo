# Fable result review, item 016 (#674), October 16, 2026

Model: Fable (critical review). Read-only; aggregates only. Verbatim.

Read-only. Files read: the committed registration set under `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/016-t5-live-sides/` (plus the untracked draft `RESULTS.md` there and the uncommitted `DECISIONS.md` and `STATE.md` diffs), item 015's registration, results and reviews, the lab code and tests under `lab/t5/` and `lab/tests/`, and only the six permitted aggregate files in `~/goodwatch-research/taste/work/t5/run-016-3cba031f/`. No reader, rebuild, rescore, or edit was run. Nothing else under `~/goodwatch-research/` was opened or listed.

### 1. Does the registered verdict stand under the registered rule?

Yes. The aggregate reproduces the registration's three tests exactly:

- Bar 1 (Q62): Astra S share 80.6%, interval 69.4% to 91.7%. `_clear` tests `lo > 1/3` on the 6-decimal rounded lower bound. Met with a 36-point margin.
- Bar 2 (Q67): S minus numbers only +36.1, interval +19.4 to +52.8. `_beats` tests `lo > 0`. Met.
- Validity guard: Astra numbers 27.8%, none 16.7%, permuted 25.0% lower bounds; `shortcut_controls` is empty. Voids 0 of 36 for both readers.

Integrity checks hold: the run's `source-manifest.json` (40 entries) hashes match the worktree at HEAD `3f66ac92` with zero mismatches, so the scored code is the committed code. `source_digest`, `cases_digest`, descriptions digest and prompt digest in the ledger equal the PREREG. `verify.log` is `{"match": true}` after a fresh-process description and case rebuild. Both reader stages show `resumed: false`, `existing_records: 0`, `skipped: 0`, `attempts == calls == 144`, so no retry, resume, or rerun happened.

Ordering: `run.registered()` refuses live reads unless the digests are in a tracked, clean `PREREG.md`, and those digests first appear in commit `3f66ac92` (14:54:38 local). The build (`source-manifest.json` mtime 14:53:52) precedes the commit by 46 seconds, and score (`aggregate.json` 15:20:08) follows it by 25.5 minutes against 25.0 minutes of logged reader time. The sequence is consistent and code-enforced, but tight: the ledger carries no wall-clock timestamps, so the ordering rests on the `registered()` check plus file mtimes, not on a logged clock. Add timestamps to the ledger for future runs.

The verdict is also robust to the bootstrap method. From the aggregate alone, Astra's 12 member S scores decompose as 6 members at 3/3, 5 at 2/3, 1 at 1/3, 0 at 0/3 (excess: 11 improved, 1 tied, 0 worse, pooled 29). A sign test against chance gives p about 0.001; S versus numbers only (10 improved, 1 worse, 1 tied) gives p about 0.012. The percentile bootstrap on 12 members is coarse, but no plausible interval method flips either bar.

Code versus registration text, three discrepancies, none affecting this run:

- The registration says a tripped guard makes the run "invalid, not a pass". In `score.py`, `invalid` is set only from voids; a shortcut sets `pass: false` and leaves `invalid: false`. Labeling only; the guard did not trip.
- `rule_for()` selects `astra_share` from `frozen['sides'] == 'live'`, not from the registration text. Any future live run gets this rule silently, whatever its PREREG says.
- `_analysis` still computes a per-reader `pass` under item 015's rule (43.3% line, excess interval above zero, S beats numbers, controls not screened). It is unused for the verdict. For the record, Astra also passes that stricter per-reader test; Haiku does not, so the run would fail under 015's both-readers rule.

### 2. Residual shortcuts

What the aggregate rules out: a highest-mean or middle-mean prior (balanced ranks, baselines 33.3% to 36.1%, numbers-only at chance by interval), position habits (positions exactly 33.3%, Haiku's "A" habit sits at chance by construction), media type (movie-only lists, A1 tie-break), the generated genre nouns alone (S minus nouns +33.3, interval 11.1 to 55.6), and any effect of the fixed copy (identical across all descriptions, so it cannot discriminate between lists).

What the aggregate cannot rule out:

- Residual title cues of the kind 015 found (3 of 47 triples). Live removal now closes exact namesakes and production's `franchiseOf` prefix across all three lists, from shows as well as movies. Still open: same-character films under different prefixes, remakes and adaptations with different titles, spin-off films of named shows, and director or cast affinity between a named example and a list title. The pack has no character identities, and the alias closure is inert on real data because `load_pack` sets `aliases: []`. This can only be checked at case level. The aggregate check that would answer it: count triples where any list title shares a `movie_series_id`, franchise prefix, normalized title, or production company with a named example, and report Astra's S pooled score with those triples dropped, as 015 did. Given 6 members at 3/3 and the +36 margin, a 015-size residual (3 triples) would not move the verdict.
- Numbers inside titles in the numbers-only control (3 tokens). This makes numbers only slightly richer, not poorer, so it biases bar 2 against the pass. Not a concern.
- The big one, a scope point rather than a leak: S includes up to four named example titles with ratings per group. Example titles carry genre, era, language, and taste information on their own. There is no examples-only control and no words-without-examples control. S minus nouns shows the full panel beats the genre noun; nothing isolates the generated names, attribute labels and mood lines from the example titles. The registered description has always been the whole panel text (015 and 016), so the pass is valid as registered, but it attributes the signal to the panel, not to the generated wording.
- Rating-scale cue (a member's own scale in example ratings versus list ratings). Covered by bar 2, and visible in Astra's numbers-only point estimate of 44.4% (16 of 36). At n = 12 the guard would trip only at roughly 55% or above, so the guard is weak and bar 2 is the binding control, as 015's PREREG already said.
- Distractor reuse up to 9 and 12 primary members drawn from an 18-member pool: member outcomes are correlated, and the member bootstrap treats them as independent. The intervals are somewhat narrow. The margins absorb this.

### 3. Hold and re-registration

Handled cleanly as far as aggregates show. The abandonment rule in `HOLD.md` ("if descriptions change, abandon unscored") was written before the new pin was known, and Q70 changed 6 of 31 descriptions, so the rule forced the abandonment; there was no outcome to depend on. The read-stage ledger lines carry only counts, costs and tokens, never correctness, so even a ledger glance could not have leaked outcomes. The PREREG diff `b206163e..3f66ac92` changes only the pin, the digests, the heading line, and the name and baseline counts; no rule, control, caliper, or matching change. The lab diff across the hold is one adapter line ("In your taste" to "Fits your taste"), the re-pinned page and manifest, `NAME_LENGTH` 28 to 29, and a new test.

The one thing I cannot verify from permitted files is the claim that the `0da351cd` run was never scored or inspected. The aggregate check: that folder's `ledger.jsonl` should contain no `score` or `verify` stage and the folder should hold no `aggregate.json` or `RESULTS.md`.

One upstream caveat to state honestly: the Astra-only rule was set after 015 showed Astra passing and Haiku failing. The 015 review asked for exactly that decision to be registered before replication, and the PREREG says it never applies to #656 retroactively. It is proper, but the rule was chosen with knowledge that this reader passes on a near-identical design, so its prior chance of passing was high. The 015 review suggested "one strong reader plus a non-negative weaker one"; the registered rule dropped the non-negative condition. Haiku's S minus numbers is +5.6, so it would have met that too.

### 4. What the pass licenses

Licensed: on the October 13 pack, at production pin `3cba031f`, the full Sides of you panel text (names, headline, attribute labels, mood lines, and four example titles with ratings per group) lets GPT-6 Astra pick a member's own later movie ratings from two matched members' at 80.6% (69.4 to 91.7) against 33.3%, and 36 points (19.4 to 52.8) above what the printed numbers alone give. The words gate on #652 opens under the owner's registered rule.

Not licensed: that the generated group names or trait labels carry the signal without the example titles; that Haiku corroborates (47.2%, interval includes chance, S minus numbers −22.2 to +30.6; it is a descriptive null); that the effect holds for show-heavy members, members with fewer than 40 early ratings, a different pack, or later data; replication; any product change.

Wording for the ticket resolution. Say: one reader, GPT-6 Astra; member-weighted share with the interval; S beats numbers only and nouns only with intervals; the registered rule set before the run (and after 015); 12 members, 36 triples, movie-only later lists, one pack, one pin, unreplicated; the readers are offline stand-ins and the product never calls an LLM; the panel text includes example titles. Avoid: "both readers" or "Haiku points the same way" as support (the draft `RESULTS.md` says "points the same way, more weakly", which reads as corroboration; say "descriptive, interval includes chance"); "nouns only 47.2%, inside chance" (say "interval includes chance"; the point estimate is 14 points above); "the words carry the signal" without "including the example titles"; any "three times in four" style summary without the member-mean and n = 12 qualifiers; "replicates 015" (different pin, matching and triples; the draft already calls it a direction, keep that).

Two reporting notes. The draft `RESULTS.md` and `DECISIONS.md` cite rank-conditional counts (10/8/11 of 12 by rank), prior-following counts (19 of 36), and answer-position counts (14/11/11) that are not in `aggregate.json` or the ledger; they were computed from records and cannot be checked from aggregates. Either add them to the scorer's aggregate output or label them as computed outside the registered scorer. The run folder's `RESULTS.md` has the same rendering fault 015 had (the Astra rows start a second table without a header); the draft item `RESULTS.md` merges the tables correctly.

### 5. Blockers

None for resolving #674 as "passes" under the registered rule. Conditions on the wording: name the one-reader rule and when it was set; say the panel text includes example titles; keep n = 12, one pack, movie-only lists, one pin, unreplicated; do not present Haiku as support. Recommended, not blocking: log the residual-cue count for this run as 015 did, add timestamps to the ledger, and fix the `invalid` labeling in `score.py` before the next registration.

**Verdict: Stands with caveats: a one-reader rule set after 015's result, a pass on the whole panel text including example titles (no examples-only control), n = 12 movie-only members on one pack and one pin, unreplicated; residual title cues unchecked at case level but too small to move a +36 margin.**
