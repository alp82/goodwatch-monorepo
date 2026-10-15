# Fable 5.1 review of PLAN.md (October 16, 2026)

**Review of 015 T5 plan (read-only; nothing run, edited, or committed)**

## 1. Design soundness

In outline it is sound: blind triples, registry-based title removal, seeded shuffles, answer keys outside the broker, two readers, paired member bootstrap. Four things would make a pass or a null misleading:

**a. Numbers leak, and matching makes the anchor the median.** S prints per-Side mean rating, loved share and `here` examples with ratings; lists print ratings. The ±0.5 early-mean caliper is wider than the SD of a 15-title list mean (~0.4), so "pick the list closest to the description's numbers" works. Worse, both distractors are matched *to the anchor*, so the anchor's list mean is the middle of the three in ~50% of triples, not 33%: a "pick the middle" reader beats chance with no words at all. A pass could be numbers, not words, which is exactly what the words gate must not accept. The no-description control catches the second only; nothing catches the first.

**b. Franchise siblings.** Removal covers named titles and aliases, not later entries of a named franchise (`here: Harry Potter 1`; list: HP 3). That is a title match, not a Side description, and `movie_series_id` is available.

**c. Empty S.** `buildSides` returns empty below 5 loved titles or fewer than 2 clusters of 2–3 members; with ~28-rating histories a sizeable share will be empty and score as forced guesses, dragging the primary toward 1/3. The gate is about descriptions that exist.

**d. Reader confinement.** `claude -p` in a repo cwd loads CLAUDE.md, the user's auto-memory (which describes this loop) and MCP servers; `codex exec` read-only sandbox still reads files outside cwd and runs shell. Not an answer-key leak, but it breaks "no tools, no other context" unlogged.

Minor: 200/231 members rated in one sitting, so "later" is the tail of one session. Fine for identity; keep the stratum.

## 2. What n ≤ 21 can support

A pass needs 12/21 (13 under Holm) in both readers, i.e. an observed +24 to +29 points. If it happens it is a real, large signal (one-reader p≈.01). A null means "could have seen +29 and did not"; it says nothing about +10 and is near-certain even if +10 is true (15%/7% per reader, lower jointly). Reading the gate as "pass unlocks, null keeps closed" is correct as a product rule, but record a null as absence of evidence. Since #652 took member confirmation out of scope, this screen is the only evidence route: a null leaves the words closed until many more 40+ members exist. Say this to the owner before building; keeping "pass required" is their call.

Disproportionate: L and SL, and therefore the three fact fixes, cross-fitting, k-means over 60k titles and TF-IDF axes, are the bulk of the build for formats the gate does not need, and the three-format Holm family is what halves power. Cut them; S is the sole primary with both readers. Keep the paired bootstrap, exact binomial, free answer-key permutation replay, and the scoring replay in `verify.py` (cheap). Add a free pre-check (heuristic baselines on the frozen cases: middle-mean, closest-to-description-mean) and a paid numbers-only control (S with words and title names stripped, 42 calls). If numbers-only also passes, S's pass does not unlock words.

To buy power without touching tier B: several triples per anchor (3–5 distractor pairs, list samples, label shuffles), one vote per member in the bootstrap. With homogeneous members the SDE drops from ~29 to roughly 13–17 points; empties limit it. Fits in US$75 once L/SL go.

Smallest trustworthy build: pinned-TS S adapter (lab-universe normalization, `hasPoster` handled, named-title registry) → split/match/sample with baseline check → confined broker for two readers → scorer with bootstrap and permutation replay → numbers-only control → one-page PREREG with a manifest hash.

## 3. Fixes before building

- **P1** Do not rebuild the pack or tiers from production; build on synthetic fixtures until the pack machine is reachable; the registered run waits.
- **P1** Compute heuristic baselines on frozen cases before any reader call; if any exceeds ~40%, rematch on displayed-list mean and show share, not early mean.
- **P1** Add the numbers-only control and register "S must beat it" as part of the words-gate pass rule.
- **P1** Confine both readers: empty cwd, no settings/CLAUDE.md/memory/MCP, tools off, JSON output with model id and usage in the ledger; any tool use voids the case.
- **P1** Drop L, SL and the three fact fixes from 015; S sole primary; no cross-format Holm.
- **P2** Remove franchise siblings of named titles from all three lists.
- **P2** Primary on non-empty S cases; empty share reported as coverage; recompute final n and power before calls.
- **P2** Several triples per anchor; member stays the unit.
- **P2** Keep the no-description control as the odd-one-out/position check.
- **P3** Drop the invisible rating-count caliper (recovers up to 8 anchors).
- **P3** Record that temperature and seed are unavailable through `claude -p`; do not claim determinism.

Files read: `/home/alp/dev/projects/goodwatch/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/015-t5-whose-taste/PLAN.md`, `.../taste-loop/PLAN.md`, `.../taste-loop/STATE.md`, `origin/main:goodwatch-webapp/app/server/taste-portrait/{sides,person}.server.ts`, issues #656 and #652.
