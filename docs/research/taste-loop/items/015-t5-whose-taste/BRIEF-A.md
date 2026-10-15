# Item 015 build brief A: S harness on synthetic data

For the builder (Codex). Ticket [#656](https://github.com/alp82/goodwatch-monorepo/issues/656). October 16, 2026.

## Situation

- `PLAN.md` in this folder is the design. Read it whole, plus `../../PLAN.md` (T5, 2.3, 2.5) and the parts of
  `../../PROTOCOL.md` the lab code follows. `REVIEW-fable.md` in this folder lists the review findings; where it
  and `PLAN.md` disagree, `REVIEW-fable.md` and the scope section of this brief win.
- The frozen pack (`~/goodwatch-research/taste/`) is **not on this machine**. Do not try to pull, rebuild or fetch
  member data, and do not open any production database. Everything in this item runs on made-up data.
- The three known errors live only in the lab's statement-list builder
  (`docs/research/taste-prediction/lab/agents/profile/{lib,feats,render}.py`). Production
  (`goodwatch-webapp/app/server/taste-portrait/`) has none of them. Do not change production code.

## Scope

Two builders work at once. **You are builder A: the S harness.** Builder B works in `lab/t5/statements/` and
`lab/tests/test_t5_statements.py`; do not touch those paths. S (Sides of you) is the sole primary format and the
only one that decides the words gate. L and SL are out of this run.

Build under `lab/t5/` (package) with tests in `lab/tests/test_t5_*.py` (not `test_t5_statements.py`):

1. **S adapter.** A lab-only TypeScript entry run with `bun` that imports the pinned production
   `person.server.ts`, `sides.server.ts`, `words.server.ts`, `view.ts` (copied from `origin/main` into
   `lab/t5/prod/` with a manifest of commit SHA and SHA-256 per file; stub only what they import that is not
   pure: the title snapshot, Redis, database). Input: a JSON case with early ratings, title facts and
   fingerprints over the frozen lab universe (PLAN.md 1, normalization limitation; handle `hasPoster` and other
   snapshot facts explicitly and record the choice). Output: the S text (headline, Side names, four attribute
   labels per Side, loved share, mean rating, up to four `here` examples with their early ratings) and a
   **named-title registry** (title keys). Parity test: the adapter's `buildSides` output on a synthetic person
   equals a direct call of the pinned production function.
2. **Split, matching, lists** per PLAN.md 3, with these changes from the review:
   - Drop the rating-count caliper; keep early-mean matching within 0.5 as the starting rule.
   - Several triples per anchor: up to 4 distinct distractor pairs (seeded), each with its own seeded list
     sample and label shuffle. The member stays the unit: a member's score is the mean over their triples.
   - Remove from every list the named titles **and every movie sharing a `movie_series_id` with a named title**
     (franchise siblings), plus aliases.
   - Primary population: anchors whose S is non-empty. Report the empty share as coverage.
3. **Heuristic baselines** computed on the frozen cases before any reader call, with no model: pick the list
   whose mean is the middle of three; pick the list whose mean is closest to the description's printed mean
   rating; pick by position. If any baseline exceeds 40% correct on the real cases, the run must stop and
   rematch on displayed-list mean (implement that rematch path and its test now; the switch is a frozen rule,
   not a judgment).
4. **Controls** (case builders, no calls here): (a) no-description control, (b) **numbers-only control**: S with
   every word and title name removed, keeping only the printed numbers in the same layout, (c) free
   answer-key permutation replay over stored answers.
5. **Reader broker** (`lab/t5/broker.py`): gets opaque case payloads only (no member hash, no answer key), writes
   raw responses with hashes. Two reader commands, built but only exercised with a fake reader in tests:
   - Haiku: `claude -p --model claude-haiku-5-5 --effort low --output-format json --no-session-persistence`
     with tools disabled, run from a fresh empty directory, with settings, CLAUDE.md, memory and MCP servers kept
     out (find the flags that do this with `claude --help`; `--setting-sources`, `--strict-mcp-config`,
     `--system-prompt` and similar; prove it in a test of the argument list).
   - Astra: `codex exec -m gpt-6-astra` from a fresh empty directory, read-only sandbox, `--skip-git-repo-check`,
     no project docs, output via `--output-last-message` or JSON events. If the codex CLI cannot turn shell tools
     off, detect any tool use in its JSON event stream and void that case.
   - Record model id, usage and cost when the CLI reports them. Temperature and seed are unavailable through
     these CLIs: record that, do not claim determinism. One transport retry, ledgered; malformed counts wrong.
   - Prompt text from PLAN.md 3, frozen in a file with its hash.
6. **Scorer** (`lab/t5/score.py`): per reader, member-level share correct over non-empty S, excess over exact
   1/3, `lab/stats.py` paired member bootstrap (10,000 draws, seed 20261013, same draws for both readers and
   all controls), exact binomial p against 1/3 on member-majority or on pooled triples with the member bootstrap
   as the interval (pick one, document it), SDE, and the pass rule: estimate ≥ 43 1/3%, interval above zero,
   **for both readers**, **and** S beats the numbers-only control by a paired interval above zero in both
   readers. Output a `RESULTS.md`-ready aggregate (counts, shares, intervals; no member hashes, no titles).
7. **Runner and dry run** (`lab/t5/run.py`): stages `build` (cases, frozen digests, baselines, power at final n),
   `read --reader haiku|astra` (separate invocations), `score`, `verify` (fresh-process replay of the scoring
   from stored response bytes). All member artifacts under `~/goodwatch-research/taste/work/t5/` or
   `results/<run id>/` (mode 700/600); refuse to write member data inside the repository or `/tmp`. Ledger lines
   carry aggregates and hashes only. Add a `--synthetic` flag that runs the whole pipeline end to end on a made-up
   pack with a fake reader into a temporary folder (tests only).
8. **Tests on synthetic data:** planted identity signal is found; shuffled labels give chance; middle-mean
   heuristic on a pack built to leak is caught and triggers rematch; franchise siblings and aliases removed;
   empty S excluded from primary and counted; split never crosses a bulk run; edited history excluded; lists
   hold 15 distinct later titles; no member hash, timestamp or answer in any payload; broker arguments confine
   both readers; malformed and transport failures; deterministic rebuild gives identical digests.

Do not implement the B-tier gate for T5, `PREREG.md`, or changes to `run.sh`/`run.py`/`verify.py` of the lab;
note in REPORT.md what registration will need. Write a one-page `PREREG-draft.md` with every frozen choice.

## Rules

- Work only under `docs/research/taste-loop/` in this worktree. Do not edit the old
  `docs/research/taste-prediction/` files; copy what you need into the new T5 code and fix it there.
- Do not commit. The orchestrator commits.
- No model calls, no network, no member data. The reader broker is built and tested with a fake reader.
- Python: `/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python`
  (NumPy, SciPy, scikit-learn, pytest). TypeScript: `bun` (see `lab/tests/formula_check.ts` for how the lab runs
  production TS against made-up input).
- Production TS source for the S adapter comes from `git show origin/main:<path>`; pin the commit SHA and the
  SHA-256 of each copied or imported file in a small manifest.
- Match the lab's style: short modules, docstrings that say what and why, plain names, no member ids anywhere.
- One existing lab test, `lab/tests/test_harness.py::test_t2a_controls`, fails on this machine (likely library
  versions). Leave it; say in your report whether it is environmental.

## Done when

- New tests pass: `t5venv/bin/python -m pytest -q docs/research/taste-loop/lab/tests -k t5`.
- `REPORT.md` in this folder: what you built, file list, how to run it once the pack is reachable, the test list,
  anything you could not do, and every place you departed from `PLAN.md` and why.
