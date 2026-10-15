# Item 015 harness fixes

Applied every P1/P2 item in `REVIEW-fable-harness.md`, plus the Codex event clarification in
`BRIEF-fixes.md`. Changes and checks use synthetic data only. No network, model calls, member data,
production changes or commits. Builder B's statement code/tests and the orchestrator's broker confinement
patch are preserved.

Locations below are relative to `docs/research/taste-loop/`, except this folder's `PREREG-draft.md`.
Each test location names the test function immediately below it.

| Finding | Change (file:line) | Test |
|---|---|---|
| P1: anchor-centred rematch preserves the middle-mean leak | `lab/t5/cases.py:103`: all-pair displayed-mean/show-share ranges ≤0.2; minimize triple ranges. `lab/t5/cases.py:112`: cycle seeded low/middle/high anchor ranks, requiring all three ranks, with distinct pairs and counts differing by at most one. Report coverage exclusions. | `lab/tests/test_t5_cases.py:152`, `test_t5_anchor_centred_leak_is_cured_by_balanced_rank_rematch`: 30-person leaking population, middle baseline **60.0% → 34.6%**, final ready, 26 members/104 triples. `lab/tests/test_t5_cases.py:129` still tests an incurable leak stopping before calls. |
| P1: noisy position baselines stop runs; answer positions unbalanced | `lab/t5/cases.py:129`: cycle A/B/C from a seeded member offset, with label counts differing by at most one. `lab/t5/cases.py:175`: report all positions, stop only on middle/closest means. | `lab/tests/test_t5_cases.py:175`, `test_t5_answer_labels_balanced_by_construction`, covers initial and rematched cases. `lab/tests/test_t5_cases.py:187`, `test_t5_position_baselines_reported_without_stopping`, allows 100% position accuracy while both mean baselines are at chance. |
| P1: deadline forfeits completed reader work | `lab/t5/run.py:134`: validate every existing `record.json`, reparse/hash-check bytes and prompt/reader identity, then skip it, including terminal voids. `lab/t5/run.py:145`: ledger resume/start, skipped/new calls, attempts, usage/cost and final interruption/completion. Keep the per-job 30-minute limit; bound attempt time by remaining budget. The broker still refuses replacement folders/bytes. | `lab/tests/test_t5_run.py:39`, `test_t5_read_resume_skips_immutable_records_and_ledgers_resume`: interrupt, resume without recalling either completed record (including tool use), resume a fully complete job with zero calls, preserve bytes, ledger resume, reject tampering before calls. |
| P1: one unresolved transport/tool event invalidates everything | `lab/t5/score.py:78`: a frozen triple is void if any of its reader's three responses has unresolved transport/tool use; count once per reader. Exclude the union across readers from all paired columns. Keep members with surviving triples; malformed stays wrong. More than 10% per reader is incomplete; exactly 10% is allowed. `lab/t5/run.py:150` stops and ledgers incomplete as soon as the cap is exceeded, including on resume. Preregistered at `PREREG-draft.md:47`. | `lab/tests/test_t5_broker_score.py:202`, `test_t5_per_case_void_cap_and_shared_pairing`, tests the 10% boundary and >10%; `lab/tests/test_t5_broker_score.py:218`, `test_t5_void_union_preserves_unaffected_triples_and_members`; `lab/tests/test_t5_broker_score.py:102` keeps malformed wrong. `lab/tests/test_t5_run.py:81`, `test_t5_read_stops_and_ledgers_incomplete_above_void_cap`, checks early stopping and no further calls on resume. |
| P2: Haiku tool detection uses invented fields; model metadata missing | `lab/t5/broker.py:61`: use `num_turns > 1`, model IDs from `modelUsage` keys, and preserve usage/cost even on tool-use voids. `lab/t5/synthetic.py:44`: fake output follows this schema. | `lab/tests/test_t5_broker_score.py:142`, `test_t5_haiku_real_json_schema_and_metadata`; updated `lab/tests/test_t5_broker_score.py:53`, `test_t5_malformed_and_transport`, no longer asserts invented fields. |
| P2: edited-label sensitivity and early-size/show-share strata absent | `lab/t5/cases.py:139`: freeze anchor displayed show share and edited count across **all three lists**. `lab/t5/score.py:112`: sensitivity drops whole triples containing edited labels; fixed early-size and show-share strata use equal-member summaries, paired controls/readers and common subset bootstrap draws. No list refill, rematch or extra calls. `lab/t5/score.py:153`: report counts, S intervals and S−numbers intervals in Markdown; full control summaries remain in aggregate JSON. Preregistered at `PREREG-draft.md:64`. | `lab/tests/test_t5_cases.py:215`, `test_t5_edited_labels_include_distractor_lists`; `lab/tests/test_t5_broker_score.py:228`, `test_t5_edited_sensitivity_and_fixed_strata`, checks changed sensitivity, fixed boundary membership, counts and report round-trip. |
| P2: rating count still affects match cost | `lab/t5/cases.py:106`: remove the log-count term entirely; initial cost uses only eligible early means. Documented at `PREREG-draft.md:26`. | `lab/tests/test_t5_cases.py:201`, `test_t5_matching_cost_ignores_count`, changes counts without changing any selected case; existing `lab/tests/test_t5_cases.py:116`, `test_t5_no_count_caliper`. |
| P2: draft implies headline is UI wording; franchise limitation unstated | `PREREG-draft.md:12` names the adapter-authored headline sentence and production Side names; `PREREG-draft.md:58` states that the separate franchise statement is inert without complete-series ordering evidence. No statement behavior changed. | `lab/tests/test_t5_sides.py:14`, `test_t5_pinned_ts_parity_and_normalization`, now checks the adapter sentence against the headline's Side names. Existing `lab/tests/test_t5_statements.py:61`, `test_franchise_evidence_distinguishes_every_unknown`, clears completeness evidence and checks unknown first/known later. |
| Brief clarification: Codex configuration warning is not tool use | `lab/t5/broker.py:85`: retain `item.completed`/`error` before `turn.started` in `configuration_warnings`; error items after turn start and all other unknown item kinds still fail closed. | `lab/tests/test_t5_broker_score.py:157`, `test_t5_codex_configuration_warnings_before_turn_only`, checks warning capture, valid answer, post-start error and unknown kinds. |
| Preserve orchestrator confinement patch | `lab/t5/broker.py:128`: unchanged auth-only disposable `CODEX_HOME`; no `features.skills` option restored. | `lab/tests/test_t5_broker_score.py:174`, `test_t5_codex_clean_auth_only_home_preserved`, intercepts the subprocess and verifies fake auth only, empty working directory, modes, cleanup and absent skills option. No real CLI/model invocation. |

Validation used the prescribed Python:
`/tmp/claude-1000/-home-alp-dev-projects-goodwatch-goodwatch-monorepo/7164ebd6-c72f-402c-a014-b250753f35d0/scratchpad/t5venv/bin/python`.

- From the repository root, `python -m pytest -q docs/research/taste-loop/lab/tests -k t5`:
  **53 passed, 105 deselected**. This includes Builder B's statement tests.
- From `docs/research/taste-loop/lab`, `python -m t5.run --synthetic --output /tmp/t5-fixes-all-20261016 all`:
  completed; fresh-process replay returned `{"match": true}`. Default fixture: 18 members, 72 triples,
  216 fake calls per reader, ready true, invalid false, no voids. Files/directories are 600/700. Its fake
  screen verdict is false; completion/replay, not a positive research result, is the acceptance criterion.
- `lab/tests/test_t5_run.py:13` also runs the entire pipeline and fresh-process verification. Added Markdown
  subset tables render in stable order before/after sorted JSON serialization, avoiding report replay drift.
- The unrelated known `test_harness.py::test_t2a_controls` was not run by `-k t5`; its environmental status
  was not investigated in this fix scope.

The draft freezes descriptive sensitivity choices without changing the primary decision. Rank balancing can
reduce coverage and does not promise any real pack can pass the baseline guard. A job interrupted inside an
unfinished response folder still fails closed for inspection; it never overwrites bytes or retries a completed
record. Real reader execution, registration, wrapper integration and overlap sensitivity remain outside this
synthetic preparation, as specified in BRIEF-A and the draft.
