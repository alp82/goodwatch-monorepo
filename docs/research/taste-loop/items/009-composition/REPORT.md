# Item 009 experimenter's report (Sol 6.1)

Saved by the orchestrator from the experimenter's final message, read after item 010 was accepted.

G1 improves composition and loved-title retrieval, but still fails the disliked-title guard.

| Scorer | T2a separation | Loved in first 50 | Disliked in first 50 |
|---|---:|---:|---:|
| B2 | .134342 | 1.89% | 0.11% |
| B3 | .130792 | 9.00% | 2.47% |
| F3 | .219993 | 8.53% | 2.51% |
| G1 | .220004 | **10.25%** | **3.03%** |

G1 separation gains, with 95% intervals: **+.086 [.049, .121] against B2**; **+.089 [.062, .116] against B3**. F3 figures are historical; no paired G1–F3 interval is available.

First-50 guards:

- Shows: **39.1%**, versus members’ own **38.6%**.
- Animation: **18.7%**, versus own **13.4%** and F3’s **36.3%**.
- Largest franchise count: **1.0**.
- Median votes: **146,230**, versus B2’s **7,049** and F3’s **104,070**.
- Disliked retrieval exceeds B2 by **2.92 percentage points [.93, 5.52]**. The full development-win rule is not met.

Owner T2a separation is **.449120**; loved/disliked first-50 retrieval is **5.24%/1.06%**.

T2b gains over B2:

- Sitting: **+.218 [.130, .387]**, 3 other members.
- Order: **+.098 [.010, .197]**, 9 other members.
- Owner: **+.158** and **+.169**, respectively; trails B3 in both.
- Touched-title counts are zero. Order-split later-skip percentile and AUC worsen against B2.

Implemented G1 and its test; **12 checks passed**. All three explore runs succeeded:
`20261014T113107-e864bd47-b08d`, `20261014T114320-e864bd47-8d77`, `20261014T114343-e864bd47-976f`.

[RESULTS.md](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/items/009-composition/RESULTS.md) contains complete figures, intervals and guards. Used the permitted B2/B3/B5 reference fallback because F3 is unpinned. No PREREG, gate access or commit.