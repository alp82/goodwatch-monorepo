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
