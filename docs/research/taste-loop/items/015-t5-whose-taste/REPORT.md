# Builder A report: synthetic S harness

Built the S-only preparation harness under `lab/t5/`, without changing production, the old statement builder,
the existing prediction/gate entry points, PROTOCOL, STATE, DECISIONS or the lab ledger. Nothing was committed.
No model request, network request, member-data read, pack rebuild or database access occurred. CLI execution
was limited to local help/version output and fake Python readers. Builder B's paths were left alone.

## Files and behavior

- `lab/t5/adapter.ts`, `sides.py`, `tsconfig.json`, `stubs/{taste,availability}.ts`: Bun adapter using the actual
  pinned person/clustering/naming functions. The adapter emits S, the exact named-title registry, a separately
  constructed numbers-only layout, fingerprint-filter losses and normalization facts. Poster facts are explicit;
  absent backdrop is false, never invented. `unseen=[]` prevents suggestions and edges affecting this screen.
- `lab/t5/prod-manifest.json`, `prod/`: eleven byte-identical production source files and their original paths,
  commit and SHA-256 hashes. Pure dependencies are copied; the I/O taste facade reexports its pinned pure module,
  and availability throws if reached. No Redis/database/snapshot loader is imported at runtime. Source was taken
  from local `origin/main` at `6082cadcbed75c0d792d778b431ba8ece4389e9b`; the four portrait files have no diff
  from the plan's `dbb974ed799df4cef385c24eef25a14730f6fbf2` pin.
- `lab/t5/cases.py`: deterministic time split/edit filtering, bulk exclusion, distinct later lists, matching,
  up to four triples/member, alias/franchise closure, empty-S coverage, three heuristic families, one prescribed
  displayed-list rematch, and hard stop if shortcuts remain. Source tokens/keys/times/answers stay outside payloads.
- `lab/t5/prompt.txt`, `broker.py`: frozen task; exact CLI arguments verified against installed help;
  empty attempt directory, settings/context suppression, Codex event allowlist/tool-use invalidation, strict
  choice parsing, immutable raw response hashes, reported model/usage/cost, and one identical-input transport retry.
  Temperature and seed are explicitly unavailable. Both reader commands were tested only with fake subprocesses.
- `lab/t5/score.py`: equal-member accuracy and excess over exact 1/3, paired lab bootstrap, SDE, both-reader
  decision, paired S−numbers requirement, no-description and independent answer-permutation controls, descriptive
  pooled binomial p, and title-free/identity-free report tables.
- `lab/t5/run.py`, `storage.py`: separate build/read/score/verify stages; frozen code/input/description/case hashes,
  aggregate-only private preparation ledger, immutable files at 600/directories at 700, real-artifact root checks,
  and fresh-process reconstruction/reparsing/scoring. `--synthetic all` completes every stage with invented input
  and fake readers. Real reader calls deliberately refuse pending the reviewed registration extension.
- `lab/t5/synthetic.py`, `parity_check.ts`, `__init__.py`: invented catalog/population/fake CLI and an independently
  constructed snapshot for direct pinned-production parity.
- New A tests: `lab/tests/test_t5_{sides,cases,broker_score,run}.py`.
- `PREREG-draft.md`: the reviewable frozen choices and outstanding registration requirements. It is not PREREG.md.

## Running

Use the specified interpreter, here abbreviated as `$T5_PY`:

```bash
T5_PY=/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python
"$T5_PY" -m pytest -q docs/research/taste-loop/lab/tests -k t5
cd docs/research/taste-loop/lab
"$T5_PY" -m t5.run --synthetic --output /tmp/t5-invented-run all
```

Use a fresh output directory: frozen artifacts and reader answers cannot be overwritten. The synthetic command
runs two separate fake-reader jobs and launches verify in a fresh Python process. Its private `RESULTS.md`
is explicitly labelled synthetic, alongside `aggregate.json` and `ledger.jsonl`; it is no finding about members.

Once the original pack is reachable, after the protocol/registration review, build with:

```bash
"$T5_PY" -m t5.run --output ~/goodwatch-research/taste/work/t5/reviewed-run build
```

That path reads only the pack named in the loop manifest, verifies its frozen file hashes and fingerprint order,
and never reads the gate. Do not run it as part of this synthetic preparation. Inspect the aggregate `ready`,
coverage, baselines and final-n power. Reader-stage interfaces are `read --reader haiku` and `read --reader astra`,
followed by `score` and `verify`, using the same output argument. **Real `read` is blocked in this preparation**:
the orchestrator must first integrate the reviewed registration/wrapper/ledger contract. `--synthetic` cannot
load a real pack or call a real reader. The existing lab run.sh/run.py/verify.py were not repurposed.

## Validation

**Final required command: 40 passed, 105 deselected in 25.40 seconds**, including builder B’s tests present
in the shared worktree. All A tests and the end-to-end fake-reader/fresh-process replay pass.

Tests cover direct pinned-TS S parity;
missing-as-zero/offline population normalization and SD fallback; explicit poster eligibility; missing fingerprint
losses and empty state; changed source/response/case hashes; temporal boundary/bulk and edited history;
transitive aliases/franchise siblings; 15 unique later titles; count-caliper removal/matching failure;
identical blinded control lists; no source token/timestamp/answer in payloads; leaking middle-mean pack detection,
rematch and refusal; position checks; numbers-only stripping; both-reader CLI confinement arguments;
empty cwd/sanitized environment; terminal malformed/tool-use cases; transport failure and identical-prompt retry;
planted identity; chance-level shuffled-label replay; numbers-shortcut rejection; missing-suite refusal;
member weighting; private modes; deterministic rebuild and full fresh-process scoring replay.

Relevant existing tests were run once: `test_stats_score.py`, `test_blocks.py`, `test_views.py`, `test_ladder.py`,
`test_harness.py`: **79 passed, 2 failed** in 167.36 seconds. The failing tests are
`test_harness.py::test_t2a_controls` and `::test_t2b_controls`. Both assert 18 runs and receive 21.
`controls/shuffled.py` schedules six rungs plus `g1_mix.py` across three seeds (7×3=21); these are stale count
expectations, not evidence of an environmental numerical failure. The brief's known T2a failure reproduced;
T2b has the same issue. Left unchanged. Environment: Python 3.13.11, NumPy 2.5.4, SciPy 1.18.1,
scikit-learn 1.9.1, Bun 1.4.3, Claude Code 2.1.301, Codex CLI 0.162.1.

## Differences from PLAN and remaining registration work

BRIEF-A/REVIEW-fable require S alone, removal of L/SL and their fact fixes from this run, no cross-format Holm,
four triples/member, no count caliper, nonempty S primary with coverage, franchise/alias removal, shortcut
baselines and displayed-list rematching, numbers-only control and S−numbers decision. These are implemented.
The early mean caliper stays 0.5; count still contributes to the initial matching cost, without excluding anyone.
The rematch freezes 0.2 rating-point and 0.2 show-share calipers on the actually sampled lists, ranked by summed
mean/share distances; continued shortcut excess stops the suite. Closest-description mean is the share-weighted
mean of printed rounded Side means. Key-order/tie/hash choices and seeds are explicit in code and draft.

Normalization remains the plan's lab-universe adaptation, with missing-as-zero and actual poster facts;
backdrop is explicitly unavailable. Emptying unseen suppresses the omitted suggestion/edge branch; descriptive
parity is tested against the untouched source. This is not parity with the live page's smaller normalization pool.
Pooled-triple binomial p was chosen from the brief's allowed alternatives, labelled descriptive because repeated
triples are dependent; member bootstrap and paired controls determine the screen. We do not certify extra power
from four correlated triples: final-n planning retains a one-trial/member approximation and its shared-distractor
limitation. No owner diagnostic or gate is implemented in this scope.

All preparation artifacts are immutable and private, but this is not yet the registered run machinery. Before
real execution, review and enforce parsed registration, committed source/ledger-prefix checks, run budgets,
wrapper locking/CPU/RSS/thread/time limits, independent protocol review, provider auth/availability/version
reporting, exact token limits and billed-output/reasoning caps, quote and ≤US$75 suite budget with ≤10% retry
reserve, title/alias audit, descriptive strata and source-overlap/component sensitivity. The frozen pack has no
separate duplicate-work alias table: known spellings use one key; the case API supports explicit transitive
alias-key mappings. Any extra authoritative mapping must be frozen before registration, never fetched based
on later ratings. No account/model availability or price claim has been made here. At four triples and three
inputs per reader, maximum planned calls are **24n**, e.g. **504 at n=21**, before retries; the old 168-call
estimate no longer applies. Final n can shrink further on matching, removal, empties or shortcut checks.

The real pack was absent and was not sought. No real feasibility count, result, T5 gate claim, or rollout claim
is made. The follow-on registered suite waits for the pack machine and those reviewed safeguards; the complete
synthetic preparation is executable now.

Final S harness closure SHA-256 (including prompt, local stubs, pinned production, loader and stats):
`69689a40b7abd563dc4ecebb710aa2231541d189fda50d3655432f0aae4a6c45`. Builder B’s isolated statement package is excluded from this S closure.
