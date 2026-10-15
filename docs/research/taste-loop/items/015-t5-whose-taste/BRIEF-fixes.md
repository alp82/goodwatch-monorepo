# Item 015 brief: fixes from the harness review

For the builder (Codex). Apply every P1 and P2 finding in `REVIEW-fable-harness.md` (this folder) to `lab/t5/`,
its tests and `PREREG-draft.md`. Same rules as `BRIEF-A.md` (no model calls, no network, no member data, no
commits, Python from the t5venv named there). `broker.py` was patched by the orchestrator after the build (clean
`CODEX_HOME` with only `auth.json`, `features.skills` removed); keep those changes.

Facts for the Haiku P2 item, from a real `claude -p --output-format json` result: top-level keys include
`result`, `is_error`, `num_turns`, `total_cost_usd`, `usage`, `modelUsage` (keyed by model id). Treat
`num_turns > 1` as tool use. For Codex: `item.completed` items of type `error` that arrive before `turn.started`
are configuration warnings; record them, do not count them as tool use, but keep failing closed on any other
unknown item type.

For the P1 rematch: add a test where anchor-centred matching leaks (the middle-mean baseline trips) and the
rematch cures it on a synthetic population, and a test that answer labels are balanced by construction.
For resumable reads: a resumed job must never re-call a case that already has `record.json`, and the ledger must
show the resume. The per-case void rule: a voided case (unresolved transport or tool use) leaves the primary;
more than 10% voided cases for a reader stops the suite as incomplete.

Done when: `pytest -q docs/research/taste-loop/lab/tests -k t5` passes, the synthetic `all` run completes, and
`REPORT-fixes.md` in this folder lists each finding with what changed (file:line) and its test.
