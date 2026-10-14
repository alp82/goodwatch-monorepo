# Item 012: amendment A3, the judged-pool test (T3) frozen before any page exists

You are the drafter for item 012 (run as Sol 6.1 through `codex exec`). Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths are
relative to `docs/research/taste-loop/`.

## Why

Phase 1 ended with G1 (item 009) as D1's challenger: registered on T2a, replicated on tier B. T2a sees only titles
members chose to watch; whether G1's top is good on titles a member has not seen needs T3 (PLAN.md 2.3), judged by
20 or more members. The owner confirmed on October 14, 2026: start T3; freeze the harm rule and the pool design
before the page exists; harm margin one extra bad title per ten (below). Two families review the amendment before
anything is built (PLAN.md: a protocol change needs a review).

## Read first

`PLAN.md` 2.3 (T3), 2.5, 2.7, phase 2, open questions; `PROTOCOL.md` (all, especially 4a, 11, 13); `DECISIONS.md`
D1; `STATE.md`; `items/011-phase1-exit/GATE-REVIEW-fable.md` and `GATE-REVIEW-sol.md` (their phase 2 proposals);
`items/009-composition/PREREG.md`, `DISTANCE.md`, `STRATA.md`; `lab/candidates/009/g1_mix.py`; `CENSUS.md`.

## What to write: `PROTOCOL.md` section 13, amendment A3, and a new section "T3" (or 4c), dated

1. **Pool.** Which scorers fill the pool and how many titles each (PLAN says today's taste, standardized taste,
   pooled predictor, GoodWatch score alone, 12 each, plus 8 random; G1 must now be in it, and B2 as reference;
   propose and justify the set and sizes, keeping the page near 24 to 40 titles). Eligibility of titles (unrated,
   not on Want to See / Skip / Not interested, released, the member's country and services where known), dedup,
   shuffle, blinding, and that every scorer's full ranking for that member is hashed into the ledger before the
   member sees the pool.
2. **Answers and their handling.** The five answers of PLAN.md 2.3 (Seen it, then a rating; Want to See, knew it;
   Want to See, new to me; Not for me; Can't tell); missing answers, Can't tell, partial sessions.
3. **Primary.** Hits in a scorer's first 10 (unseen titles marked Want to See), G1 minus B2, paired over members;
   the floor (PLAN.md 2.5: one extra hit per ten unless the plan says otherwise; check), interval rule, analysis
   (member bootstrap, 10,000 draws, seed), and how titles chosen by both scorers count.
4. **Harm criterion (owner, October 14, 2026):** per member, the count in a scorer's first 10 of titles marked Not
   for me plus titles marked Seen it and rated 5 or less; G1 minus B2, paired; **G1 is blocked if the upper bound of
   the 95% interval reaches +1 per 10**; an interval too wide to show that is inconclusive, which blocks. Say whether
   Fable's second condition (G1's rate above the random slots' point estimate) is adopted, and why.
5. **Guards and descriptive figures:** new-to-me hits reported beside the primary (G1's popular top will lose hits to
   "knew it" and "Seen it"); seen titles rated 8 or more; franchise repeats; availability where known.
6. **Sample size and stopping.** Members needed for the primary floor and for the harm margin, from a stated
   planning approximation (use the T2a first-50 shares, the census and any defensible assumption; state each);
   20 is PLAN's minimum. A fixed stopping rule (a count or a date), no peeking, one analysis. Who is eligible to be
   invited (other members, not the owner: PLAN says T3 is not needed from the owner), and that invitations wait for
   the owner's checkpoint.
7. **Decision.** What passing, failing and inconclusive mean for D1, and what happens to G1 in each; G1 and B2 are
   frozen by hash now (state their hashes).
8. **A3(c), the mix guard's form:** write into section 4a that "shows/animation worse than the reference" means a
   larger per-member mean distance from the member's own share (per view absolute difference, averaged over views,
   paired), as `items/009-composition/distance.py` computes it, for every future candidate; the signed figures stay
   reported.
9. **Data handling:** where answers are stored (a new table, behind a flag, through normal development as PLAN.md
   2.7 says), what the loop pulls, privacy rules unchanged.

Also write `items/012-t3-protocol/RESULTS.md`: a one-page summary of the choices and the sample-size calculation.
Keep the amendment self-contained and precise enough that a page builder and an analyst can follow it without asking.

## Forbidden

Changing code, the ledger, DECISIONS.md or any other file; runs; reading `~/goodwatch-research/taste/gate/`;
production; committing.

## Hand back

At most 25 lines: the choices, the sample size and its assumptions, anything you could not decide.

## Revision after the two reviews (orchestrator, October 14, 2026)

Read `REVIEW-astra.md` and `REVIEW-fable.md` in this folder. Revise `PROTOCOL.md` (4a, 4c, A3) and `RESULTS.md`:

1. **Harm statistic, chosen by simulation, frozen before any data.** The reviewers pull in opposite directions:
   Astra shows the percentile bootstrap can certify safety too readily under rare concentrated harm (false safety
   about 5% at a true harm equal to the margin); Fable shows that counting every unknown G1-only card as harmful
   blocks almost surely. Adopt Fable's label handling for the decision (Can't tell counts 0 for both scorers;
   No answer and Seen-unrated imputed at the scorer's observed per-slot harm rate on the member's answered cards in
   that ten, population rate if none; sessions with no answer in the G1 ∪ B2 union excluded and reported as
   non-response; worst-case bound and complete-answer table reported). Then choose the upper-bound method (for
   example a studentized bootstrap, a t interval, or a bootstrap with a small-sample correction) by a small
   simulation you write and commit under `items/012-t3-protocol/` (synthetic data only): scenarios at n = 20, 30, 60
   with harm 0, +0.5 and +1 per ten, including Astra's concentrated case (0 for 90%, +10 for 10%) and realistic
   label missingness. Pick the method whose false-safety rate at a true +1 is at most 2.5% (state if none reaches it
   and what it achieves), and report its block rate at 0 and +0.5. Same check for the primary's false-win rate.
2. **New-to-me hits are a guard again** (PLAN.md 2.3): G1 fails if new-to-me hits in the first 10 are worse than
   B2's with an interval excluding zero. D1's conclusion is worded as expressed interest in unseen titles, not
   enjoyment after watching.
3. **Withdrawals:** members who withdraw after exposure are counted in a pre-registered sensitivity analysis with
   the worst-case paired outcome; deleted answers are not retained. Confirmation must survive it, else inconclusive.
4. **Stopping:** the earlier of the 60th first exposure or a calendar date fixed at the owner checkpoint (propose 8
   weeks after the first invitation); minimum 20 exposed members, else inconclusive; one analysis, no interim. The
   smallest detectable effect is printed in the verdict.
5. **Planning honesty:** joint power (primary and harm and guards) under the realistic case (extra harm +0.25,
   G1's popular top, Seen-it rate as T2a suggests) at n = 20, 30 and 60; say plainly when the test is more likely
   inconclusive than passing. Remove the 75% uptake assumption; give feasibility as a range from CENSUS.md.
6. **Integrity:** hash mismatches block; ineligibility found after exposure is reported per card and blocks only above
   5% of exposed G1/B2 top-ten cards.
7. **Pool:** drop B3's slots (G1's top ten falls back to B3's order) unless you can show they add information.
   Judged object: the suggestion as the product would show it, availability included; say so.
8. **Builder spec:** add the exposure definition (per-card first display time, navigation, submission, the answer
   instructions that separate "don't know it" from "not for me"); state what storage must make recoverable instead
   of a schema.
9. **A3(c):** "each mix is a separate guard, and both must pass"; in T3, own-mix titles are the member's rated titles
   with a fingerprint, independent of the eligible set; a member with none is excluded before exposure.

Forbidden as above. Hand back at most 25 lines, including the simulation's chosen method and its error rates.
