# Item 004: ranking later Want to See adds (T2b), and the popularity check for T2a

You are the builder for item 004 of the GoodWatch taste research loop. Work in the git worktree
`/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop` (branch `research/taste-loop`). Paths below
are relative to `docs/research/taste-loop/` unless absolute.

## The question

Two measures the D1 decision still lacks:

1. **T2b.** When a member later added titles to Want to See, where would each rung have placed those titles among
   everything the member had not yet touched? This is the only offline test that looks at choices of titles the
   member had not watched.
2. **"Among equally popular" for T2a.** B3 wins at the top of the T2a list, but its first 50 have a median of
   142,136 votes against 7,181 for B2, and T2a favours popular scorers because members watch popular titles. The
   question is whether B3's lead survives when each hidden title is compared only with candidates of similar
   popularity.

No rung changes in this item. No new scorer.

## Read first

- `PLAN.md` 2.2 (T2b), 2.3, 2.5. `PROTOCOL.md` (all of it; 4a is T2a as built). `DECISIONS.md` (D1 so far).
- `items/003-hidden-title/REPORT.md` and `ladder-T2a.md`.
- `CENSUS.md`, the Want to See section: 2,072 adds from 150 members; 36 members with 10 or more dated adds; 17 with
  adds in two or more sittings; 329 adds in bulk writes.
- `lab/views.py`, `score.py`, `stats.py`, `run.py`, `table.py`, `top.py`, `controls/`.

## What to build

1. **T2b as PLAN.md 2.2 specifies.** Per member, Want to See adds sorted by `created_at`. A sitting of 10 or more
   adds is a transfer: history only. Targets are the adds in the last 40% of the member's add sittings, at least 3.
   History is everything the member wrote before the first target (ratings, Want to See, Skip, Not interested, with
   times). Other members: all their rows written before the cutoff (`--others before`) as the default, and `all`
   as an option reported apart. Candidates: the product pool (`in_pool` and `has_fingerprint`, as in T2a) minus
   every title the member rated, added, skipped or marked Not interested before the cutoff. Watch tables stay out of
   views, as before. The whole pool is ranked; targets outside the pool are dropped and their share reported.
   - Primary: mean percentile of the targets per member (0.5 random, 1.0 top), paired against B2.
   - Guards as PLAN.md lists: targets in the first 50 and 200; median vote count of the first 50; shows and
     animation in the first 50 against the member's own mix; largest franchise count; titles the member rated
     before the cutoff in the first 50 (must be none: a check that candidates are built right); mean percentile of
     titles the member later skipped or marked Not interested (after the cutoff); Want to See against Skip AUC,
     labelled a stand-in.
   - Owner reported alone, as in T2a.
2. **The entry-order variant, because sittings are few.** Only 17 members added in two or more sittings. Also build
   a variant `--split order`: targets are the last 40% of a member's non-transfer adds in entry order (at least 3),
   history everything written before the first target. Report it apart and label it what it is: learning from the
   adds made earlier in the same visit. The sitting rule stays the primary T2b. Report how many members each rule
   keeps, before running any rung.
3. **"Among equally popular" for T2a and T2b.** The same percentile, counted only against candidates whose vote count
   lies within a factor of 1.5 of the target's (log-scale band, inclusive), alongside the existing "equally
   well-rated" figure. Also report it for both conditions at once (GoodWatch score within 3 points and votes within a
   factor of 2), if at least 50 candidates qualify for most targets; say how often fewer do. Record any band you
   change, and why, before you look at rung results.
4. **Controls for T2b:** shuffled targets (each member's targets swapped for an equal number of random candidates of
   the same view: no rung shows skill against B2 beyond chance) and the leak canary (finds no target). The T2a
   controls rerun under the new harness hash.
5. **Table.** `table.py T2b` → `items/004-want-to-see/ladder-T2b.md`, same layout as T2a; the T2a table rebuilt with the
   new columns → `items/004-want-to-see/ladder-T2a.md`. `top.py` unchanged.
6. **`PROTOCOL.md`:** a section 4b for T2b and the new T2a columns, with every decision the plan left open.

Run the ladder (B1, B2, B3, B4, B5, BP; B2 the reference) on T2b with both split rules, and on T2a again for the new
columns, tier A, explore mode. Existing T1 and T2a figures must come out identical; say so or explain.

## Forbidden

- Reading the gate file; running `gate.py`. T2b has no gate.
- Querying production. Changing any rung, or adding scorers. Tuning bands on results.
- Installing packages (numpy, scipy, sklearn only). Sleep or polling loops. More than 2 threads or about 4 GB per
  process; check `free -m` first. At most one run at a time if available memory is under 3 GB.
- Committing. The orchestrator verifies and commits.

## Hand back

Code under `lab/`, `PROTOCOL.md` 4b, the ledger lines, both tables. Your final message is the report, at most 60
lines: members kept by each T2b rule; the T2b table (others and owner); the T2a "equally popular" figures for each
rung against B2; each control's outcome; run times; every decision where the plan was silent; what you could not do.

## Acceptance (the orchestrator runs these)

- Views for T2b hold no target and no row written after the cutoff, for the member or (with `before`) for others.
- No title rated before the cutoff appears among candidates.
- Both tables rebuild from the ledger; T1 and T2a figures unchanged.
- Shuffled and leak controls pass; one T2b run reproduces under `run.sh --verify`.
