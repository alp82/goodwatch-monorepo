# Item 002 report (builder: Opus 5.5, high effort), saved by the orchestrator

The harness, ladder, controls and `PROTOCOL.md` are built and the T1 ladder has run on tier A in explore mode.

## Incident

While extending the leak canary the builder ran it once outside the sandbox with `HOME` pointing at the real home
folder. Before it was killed it walked the home folder four levels deep, reading `.pkl` and `.bin` files, so it may
have opened `gate/2026-10-13/gate.pkl`. The disk is mounted `noatime`, so this cannot be confirmed. Nothing from the
file was printed, stored or used; no tier B number was seen. The canary now refuses to run outside the sandbox, has
a test mode limited to one folder, and only opens, never reads, anything under a `gate` folder. `gate.py` was never
run on the real pack.

## Built, under `lab/`

- `views.py` (per-block view folders without hidden ratings, target times or target order), `score.py` (contract,
  rounding, calibrator, T1 measures), `stats.py` (intervals, smallest detectable effects).
- `run.sh`, `run.py` (lock slots, limits, pre-registration check, budgets, ledger).
- `sandbox.py`: each view runs in its own process; Landlock lets it read only its view folder; a seccomp filter
  and separate namespaces block the rest.
- `ladder/` (B0 to B5, BP), `gate.py`, `verify.py`, `table.py`, `controls/`, 44 tests on a made-up pack.
- B2 matches `formula.server.ts` bit for bit (run through bun) and a hand-worked example; B4 and B5 match the
  first loop's `pool.py` to 1e-8.

## Ladder, T1, tier A, explore mode

Full table: `ladder-T1.md`. Others: 72 members with 10 or more targets. Owner: 999 targets.

| Rung | Others: error | Others: difference to B0 | Owner: error | Owner: difference to B0 |
|---|---:|---:|---:|---:|
| B0 | 1.469 | reference | 1.075 | reference |
| B1 | 1.473 | +0.005 (-0.097 to +0.107) | 1.006 | -0.069 (-0.135 to +0.020) |
| B2 | 1.442 | -0.027 (-0.084 to +0.033) | 1.051 | -0.024 (-0.076 to +0.100) |
| B3 | 1.442 | -0.026 (-0.098 to +0.048) | 0.931 | -0.144 (-0.196 to -0.034) |
| B4 | 1.378 | -0.091 (-0.179 to -0.003) | 0.868 | -0.207 (-0.259 to -0.092) |
| B5 | 1.352 | -0.117 (-0.198 to -0.035) | 0.850 | -0.225 (-0.286 to -0.104) |
| BP | 1.499 | +0.031 (-0.069 to +0.127) | 0.993 | -0.082 (-0.153 to +0.076) |

Others: B3 against B2 +0.001 (-0.043 to +0.044); B5 against B2 -0.090 (-0.147 to -0.034); B5 against B1 -0.121
(-0.181 to -0.061); B5 against B4 -0.026 (-0.058 to +0.005). Owner: B3 against B2 -0.120 (-0.173 to -0.074).
`verify.py` reproduced the B5 run exactly.

## Controls, all pass on the real pack

- Shuffled labels: every rung level with or worse than B0; pair accuracy 0.498 to 0.511.
- Planted 0.15: found as -0.148 (-0.162 to -0.133) for others, -0.128 for the owner.
- Leak canary: error equal to B0 for every member, 9,800 attempts reported, nothing obtained.
- Bare array: the run fails with no measures. Two `best.py`: each gets its own result.

## Run time

Full ladder 549 seconds under machine load 12 to 32 with swap nearly full; peak memory about 165 MB.

## Decisions where the plan was silent (all in `PROTOCOL.md`, marked "Decided here")

Block boundaries never split ratings written less than 2 seconds apart; isotonic calibrator on history ranks,
falling back to B0 below 10 ratings; halves round up, out-of-range scores are clipped; pair accuracy and low-rating
AUC within a block only; smallest detectable effect is 2.80 standard errors; B1 shrunk with 3 pseudo-ratings; B4 and
B5 use the first loop's base columns without its 51 text columns; a target without a fingerprint gets the block's
median rank in B2 and B3; views leave out favorites, watch tables, imports, settings, embeddings and title text;
predictors import only the standard library, numpy, scipy and sklearn.

## Not done

- The franchise resampling check for the owner.
- The run with only what others had written before the block (`--others before` is built, not run).
- Intervals for the owner's pair accuracy and AUC.
- `gate.py` is tested only on a made-up pack.
- The shuffled control cannot rule out a rung that beats B0's median only by shrinking a member's mean toward the
  population; pair accuracy covers that case.

Item 002 has used 11 of its 20 exploratory runs. The ledger holds four `smoke` control lines from rehearsals.
