# Fable 5.1 review of the T5 result (October 16, 2026)

**T5 result review (read-only; verify re-run: `{"match": true}`; no record has `fake: true`; 0 voids)**

**1. Verdict computed correctly and honestly.** I recomputed from the records: member-level S accuracy Astra 9.0/12 = 75.0% (members 4/4 ×4, 3/4 ×5, 3/3, 1/4, 0/4), Haiku 46.5%; pooled 35/47 and 22/47; position counts and answer key as stated. Haiku fails only the excess-over-chance rule (lo −2.8); it meets the 43⅓% line and its paired S−numbers is +12.5 [4.2, 22.9] (5 members improved, 7 tied, 0 worse), which incidentally clears the loop-level PLAN 2.5 floor (+10, interval above zero). The registered item rule is stricter and binding, so "does not pass" is right.

Spot-check of what drives Astra's correct answers:
- **Highest-mean prior.** Under numbers-only both readers simply pick the list with the highest mean (Astra 37/47, Haiku 31/47). Balanced anchor ranks (12/18/17) keep that at chance, so the design did its job. In S, Astra is 17/17 when the anchor is the highest-mean list and 18/30 (60%) otherwise; words add correct answers at every rank (+4/+7/+7 over numbers-only). Haiku's S by rank is 2/12, 8/18, 12/17 and its S choice equals its numbers-only choice in 35/47 triples: it mostly rides the prior.
- **Residual title cues the removal cannot catch.** Three Astra-correct triples (three members) carry one: a show named in the description whose same-named movie sits in the anchor list (exact title match); and two cases where a named franchise film has a same-character film under a different `movie_series_id` in the anchor list. Dropping them leaves 32/44 pooled; the verdict does not move. Weak-token overlap with named titles runs about twice as high per anchor list as per distractor list (13 vs 13 across two lists), nearly all generic words. The show→movie namesake gap is systematic after A1 (26 of 31 descriptions name shows, lists hold movies only) but was hit once in 47.
- No year-range tell (anchor year-median extreme 28/35 vs 2/3 base rate), no SD tell, no list-level cue I could find.

No integrity problem; the namesake/cross-series gap is a known small leak to log and fix before any replication.

**2. Gate verdict on #652.** Closed by rule. Fair wording: "One of two readers (Astra) cleared every registered rule, 75% [56–90] against 33%, +39.6 points over its numbers-only control; Haiku met the share line and beat its numbers-only control but its excess over chance did not clear zero at n = 12. Both point the same way. Unreplicated, 12 movie-only members; gate stays closed." "Three times in four" is fair only with the qualifiers: member mean, n = 12, 100% when the anchor also had the highest mean and 60% otherwise.

Worth a ticket:
- **Tier C replication** (same frozen descriptions, post-T0 ratings as later lists, after ≥300 new ratings from 15 members and six weeks), with the namesake/cross-series removal fixed and the pass rule registered up front. Cheapest honest route to "replicated".
- **Owner decision, registered before that replication:** whether the gate means both readers or one strong reader plus a non-negative weaker one. Must not be applied retroactively to this run.

Not worth a ticket now: the 20-member task (PLAN 2.5 "established"): the map put line-by-line member confirmation out of scope on 2026-10-15, and only 18 members qualify; a tier B T5 gate, since B does not support T5 and tier C arrives anyway.

**3. RESULTS.md fixes before commit** (`/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/015-t5-whose-taste/RESULTS.md`):
- The Astra rows start a second table with no header row; it will not render. Merge into one table.
- `show_share` strata are struck by PREREG ("not reported") but appear; drop them (`movies_only` duplicates the primary).
- Say which rules Haiku met and which it failed, and that a null at SDE 23.8 points says little.
- Add the rank-conditional descriptive and the "both readers pick the highest mean under numbers-only" finding.
- Add the residual-cue note (three triples, verdict unchanged) as a known gap for replication.
- One line pointing to the `run-20261016e` fake-reader incident in PREREG.
