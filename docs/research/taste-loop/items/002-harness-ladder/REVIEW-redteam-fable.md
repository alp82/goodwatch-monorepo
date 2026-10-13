# Red team review of item 002 (Fable 5.1, high effort; role taken over from a cut-off Astra run), saved by the orchestrator

## Verdict

Not sound as is; sound after the fixes in findings 1 and 2. The label boundary (views and sandbox) held against
every attempt; the process boundary (budget, pre-registration, gate) is a convention the harness does not enforce,
so a win can be manufactured without touching a label.

## Blocking findings

### 1. Unbudgeted exploration and unbound registration

Each verified by running `run.sh` on the made-up pack with a scratch loop folder.

- `--mode control --control <any name>` runs any predictor with full measures and no budget (`run.py:85-88`).
- `--ref` is unbounded and unchecked: one budgeted run scores any number of predictors, including arbitrary files.
- `check_prereg` is a substring test (`run.py:80-82`): a PREREG.md reading "rejected drafts, do not run: `<sha>`"
  satisfied it. It binds neither reference, `--others` nor `--members`. A registered run on three members was
  accepted and ledgered as registered.
- `gate.py` replays only candidate and primary reference: it compared an n=1 tier A effect with a tier B run on
  all members, printed `replicated`, and used a look.
- The budget is a count of lines in a plain file; lines can be added or removed. Any existing `items/NNN-*` folder
  is a fresh budget. `run.execute(..., write_ledger=False)` from Python writes no line.
- A registered run is not refused when `lab/` has uncommitted changes.

Fix: `control` mode accepts only predictors under `lab/ladder/` or `lab/controls/predictors/` and only the five
control names; references must be files under `lab/ladder/`. Parse PREREG.md for exactly one `candidate: <sha256>`,
one `reference: ladder/<file>`, `others:` and `members:`; a registered run must match all four, with `--members`
refused; refuse when `git status --porcelain lab/` is not empty. The gate refuses a registered line whose options
it cannot replay. Before any run, refuse unless the committed ledger is a prefix of the working copy.

### 2. The gate look budget can be spent zero times for unlimited tier B numbers on disk

A candidate can tell a gate view from a tier A view. A probe that fails only on tier B makes `gate.py` say "did not
finish; no look was used", yet `run.execute` has already written `gate/results/runs/<id>/result.json` with full
tier B measures. Verified twice on the made-up pack.

Fix: append to `looks.jsonl` before `run.execute`; for tier B write `result.json` only when status is `ok`, or not
at all.

## Non-blocking findings

- A predictor file of any size could embed tier A ratings. Cap the file (64 KB) and have the gate reviewer read
  any literal table.
- The attempts report is forgeable from inside `predict` through the calling frame's locals; the boundary held
  regardless. Do not pass `state` and `notes` as locals of the frame that calls `predict`; call the report advisory.
- The same frame reveals the view id, the view list and the predictor's position in it. No label in it; pass only
  what is needed.
- GoodWatch user and overall scores in title data are averages of TMDB, IMDb, Metacritic and RT, not member
  ratings. No leak.
- No no-knowledge scorer beats B0 with an interval below zero (constants, history mean, shrunk means, median with
  halves down). B0 is a fair reference.
- `gate.py` prints `replicated` when both effects are positive (a replicated loss).
- `TASTE_RUN_SH=1 python3 run.py` and `TASTE_LOCKS=<dir>` bypass the slot and limits.
- Stored reference answers in `work/cache` are trusted without a check against the predictor's hash.
- A registered candidate file need not be committed; require the blob in git.

## What was run

Real pack, read-only, harness functions, no ledger lines: user-score leak predictor against B0, others +0.118;
no-knowledge candidates as above. One member through `sandbox.py`: raw `open` of the pack, `/proc/self/maps`, the
work folder: errno 13; `socket`: errno 1. Made-up pack: 1 control, 3 explore, 2 registered, 3 gate runs for the
process findings. Nothing written to the real ledger, the data folder or the gate.
