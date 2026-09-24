# Round 2 report: rubric

I've written the rubric fix and built the re-grade packets, but nothing is graded yet. REPORT.md wasn't written, because the tool blocks report files from subagents. Its content is summarised here instead. This task builds no ranker, so there are no variants to pool, no ΔS and no evalsimp rows. grades.json and evalsimp.py are unchanged.

**1. GRADER.md** (`results/grading/GRADER.md`)
- New section "Vague and mood queries". It applies to packets with `"rubric": "vague"` and to the 13 query ids it lists, and frames each query as an adult asking what to watch now.
- It keeps the contract's 0-3 scale:
  - 3 = a pick you'd recommend to most adults for that mood (good and broadly appealing)
  - 2 = fits, but a weaker pick
  - 1 = matches one surface feature only
  - 0 = a poor pick even if it matches literally
- A literal match on one word is not enough. Quality and broad appeal count on these queries, which is now a one-line exception to the general "not quality or popularity" rule. An unknown title can't earn 3 on mood words in its packet alone.
- Kids' shows get 0 or 1 for adult occasions; family films adults enjoy are graded normally. The query's intent still wins where it is explicit.
- The worked example doesn't name the calibration titles. Even so, the core-25 calibration pairs aren't a blind check, because the rule was written from them. The two new-17 pairs are the real check.

**2. The 13 queries.** All have an id and reason in `results/simplify/rubric/vague-queries.json`.
- dev: lab-00 "complete nonsense", lab-06 "furious", core-19 "cozy", core-21 "funny", core-25 "something short to watch after work", new-17 "mindbending"
- holdout: core-12 "with my parents", core-18 "Brain's fried…warm and funny…", core-29 (Turkish version of core-18), new-14 "good first anime…", core-20 "bleak", new-18 "wholesome"
- holdout2: ho2-20 "epic"
- None are in holdout3 or holdout4.
- Excluded because they have explicit constraints: core-06/30, core-13/26, new-13, lab-02/03, core-23, new-04, ho2-12, and lab-07 (a typo).

**3. Packets** (built with `grade6.make_packet`, the same builder `evalsimp pool` uses)
- `results/simplify/rubric/regrade-part1.json` and `-part1-rev.json`: **135 pairs**.
  - 130 are the graded top-10 pairs; r6, r5 and r4-combo-fast have identical top 10s on all 13 queries. Their current grades: 84 at 3, 29 at 2, 9 at 1, 8 at 0.
  - The other 5 are the user's calibration pairs on these queries (core-25 ×3, new-17 ×2).
- `regrade-part2.json` and `-part2-rev.json`: **337 pairs**, every other graded pair of these queries. I recommend grading these too. NDCG's ideal uses all graded pairs of a query, so re-grading only the top 10 would leave the old lenient 3s in the ideal and lower NDCG for every ranker.
- Tooling in `results/simplify/rubric/vague.py`: `packets` (already run), `compare` (kappa, plus packets for assessor C), `merge` (writes `overlay.json`), `diff` (changed pairs and the human calibration check). Grade = C when |A−B| ≥ 2, else the floor of the mean.

**4. Overlay**
- `overlay.json` holds `{meta, grades, previous}` and never touches grades.json.
- `results/simplify/rubric/evalsimp-overlay.patch` adds an opt-in `--overlay[=path]` flag to `score`, `table` and `compare`. It applies the overlay in memory only and records which grades the saved scores used. Apply it from the arena folder with `patch -p1 < results/simplify/rubric/evalsimp-overlay.patch`.
- A dry run of the patch applies cleanly. I also ran a patched copy against a dummy overlay (core-25 top 10 all set to 0): r6 dev went from 0.836 to 0.818 and bad5 on dev went from 10 to 15.

**Recommendation:** grade part1 and part2 with the A/B/C assessors, then run merge and diff, and check that The Prisoner moves toward the user's 2. Then run `table --overlay` next to the plain table. Until then, treat NDCG changes on these 13 queries as low-confidence in the simplify loop.

**Proposed dated note for evaluation-contract.md** (not applied; not my file): "On queries naming only a mood or occasion, grades judge whether the title is a good pick for it. Quality and broad appeal count; literal one-word matches and kids' shows for adult occasions don't. Existing pairs are re-graded into an overlay; grades.json is unchanged until accepted."

Files are in `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/search-simplify/docs/prototypes/search-arena/`:
- `results/grading/GRADER.md`
- `results/simplify/rubric/vague-queries.json`
- `results/simplify/rubric/vague.py`
- `results/simplify/rubric/regrade-part1.json`
- `results/simplify/rubric/regrade-part1-rev.json`
- `results/simplify/rubric/regrade-part2.json`
- `results/simplify/rubric/regrade-part2-rev.json`
- `results/simplify/rubric/evalsimp-overlay.patch`
