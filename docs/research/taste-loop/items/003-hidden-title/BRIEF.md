# Item 003: the hidden-title test (T2a)

You are the builder for item 003 of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`).

## The question

The owner's idea, and the main offline test for decision D1 (which scorer orders titles under Best match and For
you): take a title a member rated, remove that one rating, treat the title as unwatched, and see where each scorer
places it among all the titles the member has not rated. A title the member rated 9 should land near the top of the
list; a title they rated 4 should land well down. No new model is built in this item: it adds a task to the harness
and runs the fixed ladder through it.

## Read first

- `docs/research/taste-loop/PLAN.md` section 2.2 (T2a), 2.4 and 2.5; `PROTOCOL.md` (the harness as it stands, and
  how views, the sandbox, pins, modes and the ledger work); `items/002-harness-ladder/FIX-REPORT.md`.
- The code under `lab/`. You extend it; you do not weaken any check in it.

## What to build

1. **Task `T2a` in the harness** (`views.py`, `score.py`, `run.py`, `table.py`):
   - Eligible members: tier A, 20 or more ratings, at least 5 of them 8 or more. The owner is reported alone.
   - For each member, split their rated titles (those in the candidate universe, below) into folds of 20 with a
     seeded shuffle. A view hides one fold: the member's history is all their other ratings and their Want to See,
     Skip and Not interested rows, with the hidden titles removed from every one of those lists (a hidden title that
     is also on Want to See would hand the scorer the answer).
   - Candidate universe: titles with `in_pool` and `has_fingerprint`. Targets of a view: the hidden titles plus
     every universe title the member has not rated, in one shuffled list, with nothing that marks which is which.
     A hidden title outside the universe is not a target; report how many per member.
   - The predictor returns `rank` for every target (the same contract; `score` and `p_low` are optional and, where
     given for hidden titles, are scored as in T1).
   - Other members' rows: as T1's default (`all`). The pooled rungs see other members' ratings of the hidden
     title; that is what the product would have.
2. **Measures**, per member, then across members with the existing paired statistics:
   - Percentile of each hidden title among the view's unrated candidates (1.0 is the top), averaged by the member's
     real rating: 8 or more, 6 to 7, 5 or less.
   - **Primary:** mean percentile of titles rated 8 or more minus mean percentile of titles rated 5 or less
     ("separation"). Members need at least 5 titles in each band to count for the primary; report how many do.
   - Share of titles rated 8 or more that land in the first 50 and the first 200; the same for titles rated 5 or
     less (lower is better).
   - **Among equally well-rated titles:** the same percentile, computed only against candidates whose GoodWatch
     score is within 3 points of the hidden title's score. This removes "it is simply a well-rated title" and
     leaves what is personal. Report the same separation on it.
   - Guards: share of shows and of animation among the first 50 candidates against the member's own rated mix;
     the largest number of titles from one franchise in the first 50; median vote count of the first 50.
3. **Ladder for T2a:** B1 (rank is the GoodWatch score), B2, B3, B4, B5, BP. B0 has no ordering and is left out.
   The reference for paired differences is B2 (today's taste); also report every rung against B1 and BP.
   Scoring 60,000 candidates per view must stay cheap: precompute what does not depend on the member; keep peak
   memory under about 3 GB; if the owner's 50 views times six rungs cannot finish inside the run timeout, say so
   and propose the smallest change (fewer, larger folds for the owner), do not sample candidates.
4. **Controls for T2a:** shuffled (each member's ratings permuted among their titles: separation must be level
   with zero); leak canary (unchanged boundary; a predictor cannot tell hidden titles from candidates).
5. **`table.py T2a`** builds `items/003-hidden-title/ladder-T2a.md` from the ledger: others and owner apart, with
   intervals for others and plain figures for the owner where the interval rule says "n/a".
6. **`lab/top.py <rung> --member owner --n 20`**: with the member's full history, print the first 20 unrated
   candidates the rung would show, with title, year, media type and GoodWatch score. It writes to standard output
   only. Run it for every rung and save the output to `~/goodwatch-research/taste/out/top20-owner.md` (not in the
   repository).
7. Update `PROTOCOL.md` with T2a as implemented, marking each choice you made as "Decided here". The harness hash
   will change: rerun the T1 ladder in `ladder` mode so `table.py T1` still builds, and rerun the controls.

## Forbidden

- Opening anything under `~/goodwatch-research/taste/gate/`; running the gate.
- Querying production. New models, feature searches or tuning. Weakening an existing check.
- Background jobs, sleep or polling loops; more than 2 threads or about 4 GB per process; tests with `HOME`
  pointing at the real home. The machine is heavily loaded: run serially.
- Committing. The orchestrator verifies and commits. Note: registered runs and some checks need `lab/` committed;
  use `ladder` mode, and tell the orchestrator what must be committed for anything you could not run.

## Hand back

Your final message is the report, at most 60 lines: what was built; the T2a table (others and owner: percentile by
rating band, separation, first-50 and first-200 shares, the equally-well-rated version, guards) for every rung with
paired differences against B2, B1 and BP; how many members count; the two controls' outcomes; run times; every
"Decided here"; what could not be done. Do not interpret the result beyond what the numbers say.
