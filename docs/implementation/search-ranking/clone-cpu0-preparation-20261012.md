# Prepared CPU0 clone source; no setup or benchmark run

The separately versioned CPU0 source is prepared and reviewed. It has not created,
staged or run a CPU0 clone. V5 remains failed: one valid red baseline and no passing
candidate pair. This step concerns #100; #407's production acceptance window remains
unstarted.

The reviewed source commit is `fd401aac5fdcdf84a2829195f89bd68130c46e79`.
Original CPU2 files and stages remain unchanged. The new modules bind exact453 pin
bytes and a runtime derived from exact453 with only the new owned clone name and
versioned pin import. The daemon requires a new CPU0 schema and strict integer
zero, with memory and swap fixed at 6 GiB. This is a new combined helper, not an
unchanged exact453 helper.

CPU admission requires actual source quota, period, cpuset and weight evidence.
Non-root ancestor metrics must exist; finite quota refuses. Hierarchy-root bandwidth
is explicitly not applicable, with required numeric usage metrics. Host load1 and
load5 each must be at most half online CPUs, and CPU PSI some.avg10 at most 10
percent, without waiting. Resource failures preserve their numeric before/after
ledger and original cause independently of cleanup. Overlapping scopes are
non-additive. The existing memory, dirty, single-write, latency and deadline guards
remain unchanged.

The [first source review](clone-cpu0-preparation-20261012/original-source-review-block.txt)
returned BLOCK: the runtime still imported unversioned pin symbols, and some refusal
paths discarded evidence. That report is preserved. The corrected source binds only
`pin_cpu0`; a fresh isolated `-I -B` subprocess imports versioned files without
`pin.py`. The successor also retains preflight/turnover numeric refusals, partial
ancestor observations, typed missing snapshots and separate pressure-finalization
failure evidence.

The [successor actual Opus 5.5 medium review](clone-cpu0-preparation-20261012/successor-source-review-pass.txt)
returned PASS for these prepared sources. It did not execute tests or verify hashes.
Root independently checked exact ancestry, source bindings and the 20 local fixtures.
The [plan review](clone-cpu0-preparation-20261012/plan-review.txt) and
[public provenance](clone-cpu0-preparation-20261012/provenance.json) retain the review
history and exact hashes. No review establishes physical CPU0 latency or production
acceptance.

The successor notes nonblocking diagnostic limitations: some isolation refusals
remain reason-only, the zero-child joined path loses its child's fixed reason,
non-resource pressure-finalization reasons use a fixed fallback, and some fixtures
use shared test helpers. Those observations remain explicit rather than being
silently resolved outside the reviewed source.

Before execution, root must review the complete new-container recreation and
staging packet. It must preserve the old stopped clone and V1–V5 stages/receipts,
never run both clones, bind all twelve source files plus the exact reclaim helper,
and renew source/lifecycle checks. A new consumer, auditor and transport must enforce
CPU0-only pairing and the new source/config bindings. No launcher is included in
this step; `benchmarkPacketReady` remains false. Root alone performs host operations.

Run the local fixtures from the repository root:

```sh
python3 -B -m unittest discover -s goodwatch-qdrant/diagnostics/pinning-prototype -p 'test_cpu0*.py'
```

The fixtures pass locally and perform no Docker or production I/O. They are not
physical benchmark evidence. Source details and the plan supplement are in
[CPU0.md](../../../goodwatch-qdrant/diagnostics/pinning-prototype/CPU0.md).
