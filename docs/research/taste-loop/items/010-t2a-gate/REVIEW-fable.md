# Review of the T2a gate by Fable (read-only), October 14, 2026

Saved by the orchestrator from the reviewer's final message. The reviewer did not open the real gate.

**Verdict: accept with fixes** (small ones; nothing blocks the gate). `tests/test_t2a_gate.py`: 10 passed.

- **A1 rule: correct.** `gate.py` requires a positive tier A separation, a positive tier B separation of at least
  half of it, guard 1 below +0.03, and at least 10 paired members for both. `diff` is candidate minus reference,
  so the guard's direction is right; `n` counts members finite in both rungs, which is the paired coverage. The only
  deviation from A1's letter: "same sign" is tightened to "positive".
- **Leaks: none found.** Tier B logs, work files and views stay under the private gate folders and are removed; the
  whole replay's stdout and stderr go to a private log; exceptions go to the private summary; the open ledger gets
  the verdict and counts only.
- **Replay: faithful.** Hash-checked predictor and primary reference, pack and harness hash, refusals for members,
  shuffles, plants and unknown options, frozen copies; the look is logged before the gate file is loaded.
- **Figures: unchanged.** Comparing item 006's and item 010's T2a tables after removing "(descriptive)": only the
  two new tables are added; every existing row is identical.

Findings, all applied by the orchestrator:

1. (low) The "harm" test did not show the verdict came from the guard. Added an assertion that separation passed.
2. (low) The gate replayed `fold_check` runs, which are diagnostics. Now refused.
3. (low) A crashed T2a replay printed `not replicated` and exited 0, like a real failure. It now exits 2, still
   printing only the two words, so the orchestrator knows to read the private log.
4. (nit) A1 says "same sign", the code requires positive. Section 11 now says so.
5. (nit) `table.py` import order; B2's upper-bound cell now reads `reference`.
