# CPU0 owned lifecycle source review

This prepared source supports [map #100](https://github.com/alp82/goodwatch-monorepo/issues/100). It has not performed a clone stop, setup, comparison or production activation. The fourteen-file backend freeze is at source commit `58d368c360cfe6ac72955f26b95bae085abdf6c4`; adding these publication records does not change any frozen source bytes.

The new lifecycle signals only the authenticated owned clone Qdrant child through a retained pidfd. It requires the reviewed wrapper, exact births/mounts/configuration, closed clients, the shared owner lock and fresh admission. A refused stop never starts a new source. Completed stop receipts survive later refusal and cleanup failures. Successful handoffs require the old clone stopped and new clone running. Source policy, root review and both actual Opus reports retain fail-closed and durability qualifications.

The [first actual Opus 5.5 review](opus-original-block.txt) blocked lost stop receipts and the interpreter/timestamp gap. The [amendment review](opus-amendment-pass.txt) passed at source level after those fixes and the root-requested fences. Both invocations configured `claude-opus-5-5` and medium effort; the returned modelUsage identifies `claude-opus-5-5`. The model did not run tools, recompute hashes or execute tests. Its PASS excludes consumer/stager bindings and benchmark readiness.

[Root's independent receipt](root-review.json) records full source/diff review, fourteen bindings, four unchanged core bindings, 31 lifecycle plus 12 controller fixtures passed. The author ran the entire 259-test suite successfully. The original f831 helper and core files remain unchanged. [Provenance](provenance.json) pins exact retained reports and source freeze.

The frozen CPU0.md's `test_cpu0*.py` command omits lifecycle fixtures. To verify both relevant patterns from the repository root:

```sh
python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics/pinning-prototype -p 'test_cpu0*.py'
python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics/pinning-prototype -p 'test_lifecycle_cpu0.py'
```

Full-suite verification uses the same directory with `-p 'test_*.py'`. These fixtures are local only. Fake-child wrapper exits and clone source safety do not prove real Qdrant durability, production latency, sufficient headroom, nine passing comparison pairs or seven-day acceptance. Single post-stop Docker sampling and process disappearance races can refuse safely. Interrupted receipt emission can lose proof; the external packet must stop. Every failed signal action is terminal, and query-finished alone is not phase completion: authenticated handoff, release and final completion remain mandatory. External closure and the direct consumer/socket teardown still require their own exact-source review before root execution.
