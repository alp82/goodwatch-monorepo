# Item 002 fix pass report (builder: Opus 5.5, high effort), saved by the orchestrator

All 15 fixes of `FIX-BRIEF.md` are done. The suite has 58 tests and passes; the ladder (21 runs), six controls and
a verify of B5 ran on the real pack. `gate.py` was never run on the real gate.

## Fixes and how each was checked

1. Control mode restricted: tested, each misuse refused with no ledger line.
2. Mode `ladder` added; `table.py` reads only `ladder` lines.
3. PREREG.md parsed and bound to candidate, reference, others and task: 13 refusals and 3 accepted runs tested.
4. Ledger integrity: removing, editing or emptying a committed line refuses run, verify and gate.
5. Gate: `replicated` only on an improvement; look written before the run; a candidate failing on tier B on purpose
   uses the look and leaves only a log.
6. Slots and limits cannot be bypassed through environment variables.
7. Sandbox: `predict` is called from a frame with no harness state; 64 KB cap; cached answers checked.
8. Rank-only scorers return the reference-pool percentile; calibrator is a monotone median fit in bins of 20,
   active from 40 history ratings; control `rankscale` fails the contract check.
9. Pair-accuracy difference beside every error difference; "not like for like" marked.
10. Owner intervals replaced by "n/a: the largest of 97 sittings holds 39% of the targets"; franchise resampling
    shown as a second labelled figure.
11. `--others before` and `no-owner` run; B4 and B5 answer as B1 with no other ratings.
12. 71 history rows edited after their cutoff omitted; 122 targets flagged (error moves by 0.002 or less).
13. `table.py` refuses mixed pack, harness or views hashes.
14. Tests for a bulk write after a block start and a gate replay with `others: before`.
15. `PROTOCOL.md` rewritten, with "What T1 measures".

## Ladder, T1, tier A, others (72 members, 4,058 targets): error, difference to B0, pair accuracy

| Rung | all | before | no-owner |
|---|---|---|---|
| B0 | 1.466, reference, 0.500 | same | same |
| B1 | 1.472, +0.006 (-0.096 to +0.107), 0.598 | 1.450, -0.017 (-0.115 to +0.079), 0.598 | 1.474, +0.007, 0.598 |
| B2 (calibrated) | 1.459, -0.008 (-0.029 to +0.011), 0.528 | same | same |
| B3 (calibrated) | 1.462, -0.004 (-0.022 to +0.015), 0.560 | same | same |
| B4 | 1.378, -0.089 (-0.177 to -0.001), 0.616 | 1.371, -0.095 (-0.180 to -0.012), 0.622 | 1.370, -0.097, 0.611 |
| B5 | 1.351, -0.115 (-0.196 to -0.033), 0.617 | 1.362, -0.105 (-0.183 to -0.025), 0.626 | 1.349, -0.118, 0.618 |
| BP (calibrated) | 1.448, -0.018 (-0.043 to +0.001), 0.546 | same | same |

Owner, 999 targets, plain figures: B0 1.075 / 0.500; B1 1.008 / 0.686; B2 1.075 / 0.555; B3 0.959 / 0.641;
B4 0.869 / 0.687; B5 0.852 / 0.706; BP 1.012 / 0.509 (error / pair accuracy). With `before`, the owner's B4 and B5
equal B1, because no other member had rated yet.

- B5 against B1 (others): -0.121 (-0.179 to -0.061) with all, -0.088 (-0.141 to -0.033) with before; pair accuracy
  +0.019 (-0.014 to +0.050).
- B5 against B4: -0.026 (-0.058 to +0.005).
- B3 against B2: error +0.004 (-0.005 to +0.013), pair accuracy +0.031 (+0.013 to +0.051); owner error -0.116.
- Calibrated rungs can differ from B0 only on blocks with 40 or more history ratings (2,198 of 4,195 others'
  targets). Read pair accuracy for them.

## Calibrator floor

Floor minus B0 for others, 20 permutations: B2 +0.000, B3 +0.001, BP -0.001. All within 0.01.

## Controls, all pass

Shuffled: pair accuracy 0.497 to 0.511, no rung better than B0. Planted 0.15: found as -0.148 (-0.162 to -0.133).
Leak: error equals B0 for every member, 8,960 attempts, nothing found. Contract: fails with no measures. Clash:
each file gets its own result. Rankscale: fails the contract check. Verify: B5 ladder run reproduced exactly.

## Decided where the brief was silent

- `lab/pins.json` pins the hash of every rung and control predictor; unpinned or edited files are refused.
- The harness hash now covers `run.sh`, `gate.py` and `pins.json`; the ladder was run twice because of that.
- The pack comes from the committed `MANIFEST.json`; `--pack` and `--loop-dir` are gone.
- Verify and gate start as `lab/run.sh --verify <run id>` and `lab/run.sh --gate NNN`.
- An item is three digits and needs a committed `BRIEF.md`.
- The 0..1 rank check catches gross scale changes only.
- A gate run that fails prints `not finished` and the look is used.
- The leak canary never touches a `gate` path.
- Registered runs are refused until `lab/` is committed. Ledger lines not yet committed can still be removed.
